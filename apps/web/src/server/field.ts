import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface FieldJob {
  id: string;
  status: string;
  orderId: string;
  orderCode: string | null;
  originHotel: string | null;
  slot: { pickupStartsAt: string; pickupEndsAt: string; deliveryStartsAt: string; deliveryEndsAt: string };
  bags: { tagId: string; seq: number; size: string; status: string; version: number }[];
}

/**
 * 업무자 세션으로 작업 상세를 읽는다. RLS가 배정 기사·출발 호텔·운영자에게만 행을 돌려준다.
 * 고객 연락처·결제 정보는 조회하지 않는다.
 */
export async function loadFieldJob(client: SupabaseClient, jobId: string): Promise<FieldJob | null> {
  const { data: job } = await client
    .from("delivery_jobs")
    .select(
      "id, status, order_id, origin:hotels!delivery_jobs_origin_hotel_id_fkey(name_ko), slot:service_slots!delivery_jobs_slot_id_fkey(pickup_starts_at, pickup_ends_at, delivery_starts_at, delivery_ends_at)",
    )
    .eq("id", jobId)
    .maybeSingle();
  if (!job) return null;
  const row = job as unknown as {
    id: string;
    status: string;
    order_id: string;
    origin: { name_ko: string } | null;
    slot: { pickup_starts_at: string; pickup_ends_at: string; delivery_starts_at: string; delivery_ends_at: string };
  };
  const [{ data: bags }, { data: code }] = await Promise.all([
    client.from("bags").select("tag_id, seq, size, bag_status, version").eq("order_id", row.order_id).order("seq"),
    // 참조 번호는 운영자에게만 orders RLS로 보인다. 기사·호텔은 driver_jobs()/partner_jobs()의 값을 쓴다.
    client.from("orders").select("public_code").eq("id", row.order_id).maybeSingle(),
  ]);
  return {
    id: row.id,
    status: row.status,
    orderId: row.order_id,
    orderCode: code?.public_code ?? null,
    originHotel: row.origin?.name_ko ?? null,
    slot: {
      pickupStartsAt: row.slot.pickup_starts_at,
      pickupEndsAt: row.slot.pickup_ends_at,
      deliveryStartsAt: row.slot.delivery_starts_at,
      deliveryEndsAt: row.slot.delivery_ends_at,
    },
    bags: (bags ?? [])
      .filter((b) => b.bag_status !== "cancelled_before_pickup")
      .map((b) => ({ tagId: b.tag_id, seq: b.seq, size: b.size, status: b.bag_status, version: b.version })),
  };
}

export function kstTime(iso: string): string {
  return new Intl.DateTimeFormat("ko", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "Asia/Seoul" }).format(new Date(iso));
}

export function kstDate(iso: string): string {
  return new Intl.DateTimeFormat("ko", { month: "long", day: "numeric", weekday: "short", timeZone: "Asia/Seoul" }).format(new Date(iso));
}

/** 한국 기준 오늘 (YYYY-MM-DD) */
export function kstToday(offsetDays = 0): string {
  return new Date(Date.now() + 9 * 3600_000 + offsetDays * 86_400_000).toISOString().slice(0, 10);
}
