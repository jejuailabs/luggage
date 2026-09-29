import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { RouteType } from "@luggage/domain";
import { getServerConfig } from "@/lib/env";
import type { CatalogSnapshot, HotelRecord } from "./catalog";

export interface AvailableSlot {
  slotId: string;
  serviceDate: string;
  pickup: { startsAt: string; endsAt: string };
  delivery: { startsAt: string; endsAt: string };
  bookingCutoffAt: string;
  remainingUnits: number;
}

/**
 * 판매 중 노선을 찾는다.
 * - 숙소→공항: 호텔 권역 출발 / 공항→숙소: 호텔 권역 도착 / 숙소→숙소: 출발 호텔 권역 → 도착 호텔 권역
 */
export function findOffering(catalog: CatalogSnapshot, routeType: RouteType, hotel: HotelRecord, destination?: HotelRecord) {
  return catalog.routes.find((route) => {
    if (!route.enabled || route.routeType !== routeType) return false;
    if (routeType === "airport_to_hotel") return route.destinationZoneId === hotel.zoneId;
    if (routeType === "hotel_to_hotel") {
      return Boolean(destination) && destination!.id !== hotel.id && route.originZoneId === hotel.zoneId && route.destinationZoneId === destination!.zoneId;
    }
    return route.originZoneId === hotel.zoneId;
  });
}

/** 이 호텔에서 고를 수 있는 노선과 (숙소→숙소면) 도착 가능한 호텔. */
export function routeChoicesForHotel(catalog: CatalogSnapshot, hotel: HotelRecord) {
  const choices: { routeType: RouteType; destinations: HotelRecord[] }[] = [];
  if (findOffering(catalog, "hotel_to_airport", hotel)) choices.push({ routeType: "hotel_to_airport", destinations: [] });
  if (findOffering(catalog, "airport_to_hotel", hotel)) choices.push({ routeType: "airport_to_hotel", destinations: [] });
  const destinations = catalog.hotels.filter((other) => findOffering(catalog, "hotel_to_hotel", hotel, other));
  if (destinations.length > 0) choices.push({ routeType: "hotel_to_hotel", destinations });
  return choices;
}

const FIXTURE_WINDOWS: Record<RouteType, string[][]> = {
  hotel_to_airport: [
    ["09:00", "11:00", "14:00", "16:00", "a"],
    ["12:00", "14:00", "17:00", "19:00", "b"],
  ],
  airport_to_hotel: [["10:00", "13:00", "15:00", "18:00", "a"]],
  hotel_to_hotel: [["10:00", "12:00", "15:00", "18:00", "a"]],
};

/** fixture 모드용 합성 슬롯 (supabase/seed.sql과 같은 시간대, 한국 시간). */
function fixtureSlots(routeOfferingId: string, routeType: RouteType, serviceDate: string): AvailableSlot[] {
  const at = (time: string) => new Date(`${serviceDate}T${time}:00+09:00`).toISOString();
  const cutoff = new Date(new Date(`${serviceDate}T20:00:00+09:00`).getTime() - 24 * 3600_000).toISOString();
  if (new Date(cutoff) <= new Date()) return [];
  return FIXTURE_WINDOWS[routeType].map(([ps, pe, ds, de, suffix]) => ({
    // 결정적 UUID: 날짜(8자리) + 회차 + 노선 ID 끝 12자리
    slotId: `${serviceDate.replaceAll("-", "")}-0000-4000-${suffix === "a" ? "8000" : "8001"}-${routeOfferingId.slice(-12)}`,
    serviceDate,
    pickup: { startsAt: at(ps!), endsAt: at(pe!) },
    delivery: { startsAt: at(ds!), endsAt: at(de!) },
    bookingCutoffAt: cutoff,
    remainingUnits: 20,
  }));
}

export async function listAvailableSlots(
  routeOfferingId: string,
  routeType: RouteType,
  serviceDate: string,
): Promise<AvailableSlot[] | null> {
  const config = getServerConfig();
  if (config.publicDataSource === "fixture") return fixtureSlots(routeOfferingId, routeType, serviceDate);
  if (!config.supabase) return null;
  const client = createClient(config.supabase.url, config.supabase.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.rpc("available_slots", {
    p_route_offering_id: routeOfferingId,
    p_service_date: serviceDate,
  });
  if (error) return null;
  return (data as Record<string, string | number>[]).map((row) => ({
    slotId: String(row.slot_id),
    serviceDate: String(row.service_date),
    pickup: { startsAt: String(row.pickup_starts_at), endsAt: String(row.pickup_ends_at) },
    delivery: { startsAt: String(row.delivery_starts_at), endsAt: String(row.delivery_ends_at) },
    bookingCutoffAt: String(row.booking_cutoff_at),
    remainingUnits: Number(row.remaining_units),
  }));
}
