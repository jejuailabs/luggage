import { randomUUID } from "node:crypto";
import { fail, newRequestId, ok } from "@/server/api";
import { isAuthorizedJob } from "@/server/jobs";
import { getPaymentAdapter } from "@/server/payments";
import { createSupabaseServiceClient } from "@/server/service-client";

export const dynamic = "force-dynamic";

/**
 * 결제 대사 (스케줄러). 결과가 확인되지 않은 결제 시도를 공급사에 다시 조회한다.
 * 고객이 결제창을 닫았거나 웹훅이 오지 않아도 결과를 찾는다. 대사 조회는 대사용 이벤트 ID로 기록한다.
 */
export async function GET(request: Request) {
  const requestId = newRequestId();
  if (!isAuthorizedJob(request)) return fail("FORBIDDEN", requestId);
  const service = createSupabaseServiceClient();
  if (!service) return fail("PROVIDER_UNAVAILABLE", requestId);

  const { data: attempts, error } = await service
    .from("payment_attempts")
    .select("provider, merchant_order_id")
    .in("status", ["created", "pending", "unknown"])
    .lt("created_at", new Date(Date.now() - 2 * 60_000).toISOString())
    .order("created_at")
    .limit(100);
  if (error) return fail("PROVIDER_UNAVAILABLE", requestId);

  let checked = 0;
  let changed = 0;
  for (const attempt of attempts ?? []) {
    const adapter = getPaymentAdapter(attempt.provider);
    if (!adapter) continue;
    let current;
    try {
      current = await adapter.retrieve(attempt.merchant_order_id);
    } catch {
      continue;
    }
    checked += 1;
    if (current.status === "pending") continue;
    const { error: recordError } = await service.rpc("record_payment_result", {
      p_provider: adapter.provider,
      p_event_id: `reconcile_${randomUUID()}`,
      p_payload_hash: "reconcile",
      p_merchant_order_id: attempt.merchant_order_id,
      p_provider_transaction_id: current.providerTransactionId,
      p_status: current.status,
      p_amount_minor: current.amountMinor,
      p_currency: current.currency,
    });
    if (!recordError) changed += 1;
  }
  return ok({ checked, changed }, requestId);
}
