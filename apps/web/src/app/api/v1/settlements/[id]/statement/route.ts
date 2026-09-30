import { z } from "zod";
import { fail, newRequestId } from "@/server/api";
import { getAuthContext } from "@/server/auth";
import { createSupabaseServiceClient } from "@/server/service-client";
import { makeSettlementPdf } from "@/server/settlement-pdf";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = newRequestId();
  const auth = await getAuthContext({ authorization: request.headers.get("authorization") });
  if (!auth.user || auth.user.isAnonymous || !auth.client) return fail("SESSION_REQUIRED", requestId);
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return fail("NOT_FOUND", requestId);
  // 사용자 세션의 RLS로 먼저 배치 접근을 확인한다. 이후 읽는 상세 행은 해당 배치에만 묶는다.
  const { data: visible, error: accessError } = await auth.client.from("settlement_batches").select("id").eq("id", id).maybeSingle();
  if (accessError || !visible) return fail("NOT_FOUND", requestId);
  const service = createSupabaseServiceClient();
  if (!service) return fail("PROVIDER_UNAVAILABLE", requestId);
  const [{ data: batch, error: batchError }, { data: items, error: itemsError }] = await Promise.all([
    service.from("settlement_batches").select("id, partner_id, period_start, period_end, status, total_minor, payout_reference, hotel_partners(name)").eq("id", id).single(),
    service.from("settlement_items").select("amount_minor, hotel_commissions(kind, order_id, hotel_id, hotels(name_ko), orders(public_code))").eq("batch_id", id),
  ]);
  if (batchError || itemsError || !batch) return fail("PROVIDER_UNAVAILABLE", requestId);
  const partner = batch.hotel_partners as unknown as { name: string } | null;
  const rows = (items ?? []) as unknown as { amount_minor: number; hotel_commissions: { kind: string; order_id: string; hotels: { name_ko: string } | null; orders: { public_code: string } | null } | null }[];
  const bytes = await makeSettlementPdf({
    partnerName: partner?.name ?? "제휴사", periodStart: batch.period_start, periodEnd: batch.period_end,
    status: batch.status, totalMinor: Number(batch.total_minor), payoutReference: batch.payout_reference,
    items: rows.map((row) => ({ orderCode: row.hotel_commissions?.orders?.public_code ?? row.hotel_commissions?.order_id.slice(0, 8) ?? "-", hotelName: row.hotel_commissions?.hotels?.name_ko ?? "숙소", kind: row.hotel_commissions?.kind ?? "commission", amountMinor: Number(row.amount_minor) })),
  });
  return new Response(new Uint8Array(bytes), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="settlement-${id}.pdf"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
}
