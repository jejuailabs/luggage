import { createClient } from "@supabase/supabase-js";
import { ROUTE_TYPES, type RouteType } from "@luggage/domain";
import type { Locale } from "@luggage/i18n";
import { getServerConfig } from "@/lib/env";

export type BasePrices = Partial<Record<RouteType, { standard: number | null; large: number | null }>>;

export interface AirportPoint {
  name: string;
  floor: string | null;
  directions: string | null;
  openingHours: string | null;
  latitude: number;
  longitude: number;
}

/** 제주국제공항 여객터미널 대략 좌표. 운영 장소에 좌표가 없을 때 지도 중심으로만 쓴다. */
export const JEJU_AIRPORT = { latitude: 33.5066, longitude: 126.4929 };

// fixture 모드(로컬·E2E)용 합성 값. 실제 판매 요금·장소가 아니다.
const FIXTURE_PRICES: BasePrices = {
  hotel_to_airport: { standard: 15000, large: 20000 },
  airport_to_hotel: { standard: 15000, large: 20000 },
  hotel_to_hotel: { standard: 15000, large: 20000 },
};
const FIXTURE_AIRPORT: Record<Locale, AirportPoint> = {
  ko: { name: "예시 짐 카운터", floor: "1층 도착장", directions: "3번 출구 앞", openingHours: "08:00–21:00", ...JEJU_AIRPORT },
  "zh-CN": { name: "示例行李柜台", floor: "1 楼到达大厅", directions: "3 号出口前", openingHours: "08:00–21:00", ...JEJU_AIRPORT },
  en: { name: "Sample bag counter", floor: "Arrivals hall, 1F", directions: "In front of Exit 3", openingHours: "08:00–21:00", ...JEJU_AIRPORT },
};

function publicClient() {
  const config = getServerConfig();
  if (config.publicDataSource === "fixture" || !config.supabase) return null;
  return createClient(config.supabase.url, config.supabase.publishableKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

const todayKst = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);

/** 노선별 현재 유효한 짐 1개 기본 요금(부가세 포함, 원). 판매 중지 노선과 요금이 없는 노선은 빠진다. */
export async function loadBasePrices(): Promise<BasePrices> {
  if (getServerConfig().publicDataSource === "fixture") return FIXTURE_PRICES;
  const client = publicClient();
  if (!client) return {};
  const { data, error } = await client
    .from("price_rules")
    .select("bag_size, unit_amount_minor, valid_from, valid_until, status, route_offerings!inner(route_type, enabled)");
  if (error || !data) return {};
  const today = todayKst();
  const prices: BasePrices = {};
  for (const row of data as unknown as { bag_size: "standard" | "large"; unit_amount_minor: number; valid_from: string; valid_until: string | null; status: string; route_offerings: { route_type: RouteType; enabled: boolean } }[]) {
    if (row.status !== "active" || !row.route_offerings.enabled || row.valid_from > today || (row.valid_until && row.valid_until < today)) continue;
    const entry = (prices[row.route_offerings.route_type] ??= { standard: null, large: null });
    const current = entry[row.bag_size];
    entry[row.bag_size] = current === null ? row.unit_amount_minor : Math.min(current, row.unit_amount_minor);
  }
  return Object.fromEntries(ROUTE_TYPES.filter((type) => prices[type]).map((type) => [type, prices[type]])) as BasePrices;
}

/** 현재 운영 중인 공항 인계 장소 1곳. 없으면 null (화면은 ‘예약증·전날 알림으로 안내’로 대체한다). */
export async function loadAirportPoint(locale: Locale): Promise<AirportPoint | null> {
  if (getServerConfig().publicDataSource === "fixture") return FIXTURE_AIRPORT[locale];
  const client = publicClient();
  if (!client) return null;
  const now = new Date().toISOString();
  const { data, error } = await client
    .from("handoff_locations")
    .select("name_ko, floor, landmark_ko, latitude, longitude, opening_hours, valid_from, valid_until, handoff_location_translations(locale, name, directions)")
    .in("type", ["airport_counter", "airport_meeting_point"])
    .eq("status", "active")
    .lte("valid_from", now)
    .order("valid_from", { ascending: false });
  if (error || !data) return null;
  const row = (data as unknown as { name_ko: string; floor: string | null; landmark_ko: string | null; latitude: number | null; longitude: number | null; opening_hours: string | null; valid_until: string | null; handoff_location_translations: { locale: string; name: string; directions: string | null }[] }[])
    .find((item) => !item.valid_until || item.valid_until > now);
  if (!row) return null;
  const translation = row.handoff_location_translations.find((item) => item.locale === locale);
  return {
    name: locale === "ko" ? row.name_ko : translation?.name ?? row.name_ko,
    floor: row.floor,
    directions: locale === "ko" ? row.landmark_ko : translation?.directions ?? row.landmark_ko,
    openingHours: row.opening_hours,
    latitude: Number(row.latitude ?? JEJU_AIRPORT.latitude),
    longitude: Number(row.longitude ?? JEJU_AIRPORT.longitude),
  };
}
