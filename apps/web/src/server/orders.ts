import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface OrderView {
  id: string;
  publicCode: string;
  reservationStatus: "draft" | "held" | "confirmed" | "cancelled" | "expired" | "needs_review";
  holdExpiresAt: string | null;
  routeType: string;
  originHotel: { slug: string; nameKo: string } | null;
  destinationHotel: { slug: string; nameKo: string } | null;
  slot: { pickupStartsAt: string; pickupEndsAt: string; deliveryStartsAt: string; deliveryEndsAt: string };
  flight: { number: string | null; departsAt: string | null; arrivesAt: string | null };
  bags: { size: string; quantity: number; unitAmountMinor: number; amountMinor: number }[];
  totalMinor: number;
  taxIncludedMinor: number;
  currency: string;
  contact: { name: string; email?: string; phone?: string; wechat?: string };
  locale: string;
  createdAt: string;
  payment: {
    summary: "unpaid" | "pending" | "paid" | "partially_refunded" | "refunded";
    latestAttempt: { id: string; status: string; method: string } | null;
  };
  refund: { requestStatus: string; amountMinor: number; executionStatus: string | null } | null;
}

const ORDER_COLUMNS = `
  id, public_code, reservation_status, hold_expires_at, route_type, flight_number, flight_departs_at, flight_arrives_at,
  total_minor, tax_minor, currency, contact, locale, created_at,
  origin:hotels!orders_origin_hotel_id_fkey(slug, name_ko),
  destination:hotels!orders_destination_hotel_id_fkey(slug, name_ko),
  slot:service_slots!orders_slot_id_fkey(pickup_starts_at, pickup_ends_at, delivery_starts_at, delivery_ends_at),
  order_bags(size, quantity, unit_amount_minor, amount_minor),
  payment_attempts(id, status, method, created_at),
  refund_requests(status, amount_minor, created_at, refunds(status))
`;

interface OrderRow {
  id: string;
  public_code: string;
  reservation_status: OrderView["reservationStatus"];
  hold_expires_at: string | null;
  route_type: string;
  flight_number: string | null;
  flight_departs_at: string | null;
  flight_arrives_at: string | null;
  total_minor: number;
  tax_minor: number;
  currency: string;
  contact: OrderView["contact"];
  locale: string;
  created_at: string;
  origin: { slug: string; name_ko: string } | null;
  destination: { slug: string; name_ko: string } | null;
  slot: { pickup_starts_at: string; pickup_ends_at: string; delivery_starts_at: string; delivery_ends_at: string };
  order_bags: { size: string; quantity: number; unit_amount_minor: number; amount_minor: number }[];
  payment_attempts: { id: string; status: string; method: string; created_at: string }[];
  refund_requests: { status: string; amount_minor: number; created_at: string; refunds: { status: string } | null }[];
}

const SIZE_ORDER: Record<string, number> = { standard: 0, large: 1 };

export function toOrderView(row: OrderRow, summary: OrderView["payment"]["summary"]): OrderView {
  const latestAttempt = [...row.payment_attempts].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  const latestRefund = [...row.refund_requests].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  return {
    id: row.id,
    publicCode: row.public_code,
    reservationStatus: row.reservation_status,
    holdExpiresAt: row.hold_expires_at,
    routeType: row.route_type,
    originHotel: row.origin ? { slug: row.origin.slug, nameKo: row.origin.name_ko } : null,
    destinationHotel: row.destination ? { slug: row.destination.slug, nameKo: row.destination.name_ko } : null,
    slot: {
      pickupStartsAt: row.slot.pickup_starts_at,
      pickupEndsAt: row.slot.pickup_ends_at,
      deliveryStartsAt: row.slot.delivery_starts_at,
      deliveryEndsAt: row.slot.delivery_ends_at,
    },
    flight: { number: row.flight_number, departsAt: row.flight_departs_at, arrivesAt: row.flight_arrives_at },
    bags: [...row.order_bags]
      .sort((a, b) => (SIZE_ORDER[a.size] ?? 9) - (SIZE_ORDER[b.size] ?? 9))
      .map((b) => ({ size: b.size, quantity: b.quantity, unitAmountMinor: b.unit_amount_minor, amountMinor: b.amount_minor })),
    totalMinor: row.total_minor,
    taxIncludedMinor: row.tax_minor,
    currency: row.currency,
    contact: row.contact,
    locale: row.locale,
    createdAt: row.created_at,
    payment: {
      summary,
      latestAttempt: latestAttempt ? { id: latestAttempt.id, status: latestAttempt.status, method: latestAttempt.method } : null,
    },
    refund: latestRefund
      ? {
          requestStatus: latestRefund.status,
          amountMinor: latestRefund.amount_minor,
          executionStatus: latestRefund.refunds?.status ?? null,
        }
      : null,
  };
}

/** RLS가 소유자(또는 운영자)에게만 행을 돌려준다. 없으면 null — 존재 여부를 구분하지 않는다. */
export async function getOrderView(client: SupabaseClient, orderId: string): Promise<OrderView | null | undefined> {
  const { data, error } = await client.from("orders").select(ORDER_COLUMNS).eq("id", orderId).maybeSingle();
  if (error) return undefined;
  if (!data) return null;
  const { data: summary } = await client.rpc("order_payment_summary", { p_order_id: orderId });
  return toOrderView(data as unknown as OrderRow, (summary as OrderView["payment"]["summary"] | null) ?? "unpaid");
}
