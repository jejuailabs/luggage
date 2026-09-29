import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { ROUTE_TYPES, type RouteType } from "@luggage/domain";
import type { Locale } from "@luggage/i18n";
import { getServerConfig } from "@/lib/env";
import { CATALOG_FIXTURE } from "./catalog-fixtures";

export interface ZoneRecord {
  id: string;
  code: string;
  kind: "area" | "airport";
  nameKo: string;
  displayNames: Partial<Record<string, string>>;
}

export interface HotelRecord {
  id: string;
  slug: string;
  zoneId: string;
  nameKo: string;
  addressKo: string;
  frontDeskOpensAt: string | null;
  frontDeskClosesAt: string | null;
  translations: { locale: string; name: string; aliases: string[]; handoffNote: string | null }[];
}

export interface RouteOfferingRecord {
  id: string;
  routeType: RouteType;
  originZoneId: string;
  destinationZoneId: string;
  enabled: boolean;
}

export interface CatalogSnapshot {
  zones: ZoneRecord[];
  hotels: HotelRecord[];
  routes: RouteOfferingRecord[];
}

/** 공개 호텔 DTO. 계약·정산·비활성 데이터는 포함하지 않는다. */
export interface PublicHotel {
  slug: string;
  name: string;
  nameKo: string;
  addressKo: string;
  zone: string;
  frontDesk: { opensAt: string; closesAt: string } | null;
  handoffNote: string | null;
}

interface HotelRow {
  id: string;
  slug: string;
  zone_id: string;
  name_ko: string;
  address_ko: string;
  front_desk_opens_at: string | null;
  front_desk_closes_at: string | null;
  hotel_translations: { locale: string; name: string; aliases: string[]; handoff_note: string | null }[];
}

export const HOTEL_COLUMNS =
  "id, slug, zone_id, name_ko, address_ko, front_desk_opens_at, front_desk_closes_at, hotel_translations(locale, name, aliases, handoff_note)";

export function toHotelRecord(h: HotelRow): HotelRecord {
  return {
    id: h.id,
    slug: h.slug,
    zoneId: h.zone_id,
    nameKo: h.name_ko,
    addressKo: h.address_ko,
    frontDeskOpensAt: h.front_desk_opens_at,
    frontDeskClosesAt: h.front_desk_closes_at,
    translations: h.hotel_translations.map((t) => ({
      locale: t.locale,
      name: t.name,
      aliases: t.aliases,
      handoffNote: t.handoff_note,
    })),
  };
}

/**
 * 카탈로그를 읽는다. 공개 키 클라이언트면 RLS가 활성 데이터만 돌려주고,
 * 업무자 클라이언트면 그 역할이 볼 수 있는 범위를 돌려준다. 실패하면 null.
 */
export async function loadCatalog(client: SupabaseClient): Promise<CatalogSnapshot | null> {
  const [zones, hotels, routes] = await Promise.all([
    client.from("service_zones").select("id, code, kind, name_ko, display_names").order("sort_order"),
    client.from("hotels").select(HOTEL_COLUMNS).order("name_ko"),
    client.from("route_offerings").select("id, route_type, origin_zone_id, destination_zone_id, enabled"),
  ]);
  if (zones.error || hotels.error || routes.error) return null;
  return {
    zones: zones.data.map((z) => ({
      id: z.id,
      code: z.code,
      kind: z.kind,
      nameKo: z.name_ko,
      displayNames: z.display_names ?? {},
    })),
    hotels: (hotels.data as unknown as HotelRow[]).map(toHotelRecord),
    routes: routes.data.map((r) => ({
      id: r.id,
      routeType: r.route_type,
      originZoneId: r.origin_zone_id,
      destinationZoneId: r.destination_zone_id,
      enabled: r.enabled,
    })),
  };
}

/** 공개 카탈로그. PUBLIC_DATA_SOURCE=fixture 이면 합성 데이터를 쓴다. */
export async function loadPublicCatalog(): Promise<CatalogSnapshot | null> {
  const config = getServerConfig();
  if (config.publicDataSource === "fixture") return CATALOG_FIXTURE;
  if (!config.supabase) return null;
  const client = createClient(config.supabase.url, config.supabase.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return loadCatalog(client);
}

/** 판매 중인 노선 종류. 카탈로그를 불러오지 못하면 어떤 노선도 판매 중으로 표시하지 않는다. */
export function openRouteTypes(catalog: CatalogSnapshot | null): Set<RouteType> {
  const open = new Set<RouteType>();
  for (const route of catalog?.routes ?? []) if (route.enabled) open.add(route.routeType);
  return new Set(ROUTE_TYPES.filter((type) => open.has(type)));
}

export function zoneName(zone: ZoneRecord | undefined, locale: Locale): string {
  if (!zone) return "";
  if (locale === "ko") return zone.nameKo;
  return zone.displayNames[locale] ?? zone.displayNames.en ?? zone.nameKo;
}

function toTime(value: string | null): string | null {
  return value ? value.slice(0, 5) : null;
}

export function toPublicHotel(hotel: HotelRecord, catalog: CatalogSnapshot, locale: Locale): PublicHotel {
  const translation = hotel.translations.find((t) => t.locale === locale);
  const opensAt = toTime(hotel.frontDeskOpensAt);
  const closesAt = toTime(hotel.frontDeskClosesAt);
  return {
    slug: hotel.slug,
    // 고객 언어 이름이 없으면 한국어 원명을 쓴다 (호텔명은 원명 유지 원칙).
    name: translation?.name ?? hotel.nameKo,
    nameKo: hotel.nameKo,
    addressKo: hotel.addressKo,
    zone: zoneName(
      catalog.zones.find((z) => z.id === hotel.zoneId),
      locale,
    ),
    frontDesk: opensAt && closesAt ? { opensAt, closesAt } : null,
    handoffNote: translation?.handoffNote ?? null,
  };
}

function normalize(value: string): string {
  return value.normalize("NFKC").toLowerCase().replace(/\s+/g, "");
}

/** 한국어 원명·언어별 이름·별칭으로 검색한다. */
export function searchHotels(catalog: CatalogSnapshot, query: string, locale: Locale, limit = 20): PublicHotel[] {
  const needle = normalize(query);
  const matches = catalog.hotels.filter((hotel) => {
    if (!needle) return true;
    const haystack = [hotel.nameKo, ...hotel.translations.flatMap((t) => [t.name, ...t.aliases])];
    return haystack.some((value) => normalize(value).includes(needle));
  });
  return matches.slice(0, limit).map((hotel) => toPublicHotel(hotel, catalog, locale));
}
