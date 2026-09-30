import { randomUUID } from "node:crypto";
import { z } from "zod";
import { fail, failFromDb, newRequestId, ok } from "@/server/api";
import { requireFinance } from "@/server/admin";
import { getPaymentAdapter } from "@/server/payments";
import { createSupabaseServiceClient } from "@/server/service-client";

export const dynamic = "force-dynamic";

/** 재무 담당자의 개별 결제 조회. PG 조회 결과만 서버 함수에 기록하며 화면 입력값으로 성공 처리하지 않는다. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = newRequestId();
  const gate = await requireFinance(request, requestId);
  if (!gate.ok) return gate.response;
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return fail("NOT_FOUND", requestId);
  const service = createSupabaseServiceClient();
  if (!service) return fail("PROVIDER_UNAVAILABLE", requestId);
  const { data: attempt, error } = await gate.auth.client.from("payment_attempts").select("id, provider, merchant_order_id").eq("id", id).maybeSingle();
  if (error) return failFromDb(error, requestId);
  if (!attempt) return fail("NOT_FOUND", requestId);
  const adapter = getPaymentAdapter(attempt.provider);
  if (!adapter) return fail("PROVIDER_UNAVAILABLE", requestId);
  let current;
  try { current = await adapter.retrieve(attempt.merchant_order_id); } catch { return fail("PROVIDER_UNAVAILABLE", requestId); }
  if (current.status === "pending") return ok({ result: "pending" }, requestId);
  const { data, error: recordError } = await service.rpc("record_payment_result", {
    p_provider: adapter.provider, p_event_id: `manual_reconcile_${randomUUID()}`, p_payload_hash: "manual_reconcile",
    p_merchant_order_id: attempt.merchant_order_id, p_provider_transaction_id: current.providerTransactionId,
    p_status: current.status, p_amount_minor: current.amountMinor, p_currency: current.currency,
  });
  if (recordError) return failFromDb(recordError, requestId);
  return ok({ result: data }, requestId);
}
