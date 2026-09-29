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

/** 호텔 권역에서 출발(또는 도착)하는 판매 중 노선을 찾는다. */
export function findOffering(catalog: CatalogSnapshot, routeType: RouteType, hotel: HotelRecord) {
  return catalog.routes.find(
    (route) =>
      route.enabled &&
      route.routeType === routeType &&
      (routeType === "airport_to_hotel" ? route.destinationZoneId === hotel.zoneId : route.originZoneId === hotel.zoneId),
  );
}

/** fixture 모드용 합성 슬롯: 요청 날짜의 오전·낮 두 회차 (한국 시간). */
function fixtureSlots(routeOfferingId: string, serviceDate: string): AvailableSlot[] {
  const at = (time: string) => new Date(`${serviceDate}T${time}:00+09:00`).toISOString();
  const cutoff = new Date(new Date(`${serviceDate}T20:00:00+09:00`).getTime() - 24 * 3600_000).toISOString();
  if (new Date(cutoff) <= new Date()) return [];
  return [
    ["09:00", "11:00", "14:00", "16:00", "a"],
    ["12:00", "14:00", "17:00", "19:00", "b"],
  ].map(([ps, pe, ds, de, suffix]) => ({
    // 결정적 UUID: 날짜(8자리) + 회차 + 노선 ID 끝 12자리
    slotId: `${serviceDate.replaceAll("-", "")}-0000-4000-${suffix === "a" ? "8000" : "8001"}-${routeOfferingId.slice(-12)}`,
    serviceDate,
    pickup: { startsAt: at(ps!), endsAt: at(pe!) },
    delivery: { startsAt: at(ds!), endsAt: at(de!) },
    bookingCutoffAt: cutoff,
    remainingUnits: 20,
  }));
}

export async function listAvailableSlots(routeOfferingId: string, serviceDate: string): Promise<AvailableSlot[] | null> {
  const config = getServerConfig();
  if (config.publicDataSource === "fixture") return fixtureSlots(routeOfferingId, serviceDate);
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
