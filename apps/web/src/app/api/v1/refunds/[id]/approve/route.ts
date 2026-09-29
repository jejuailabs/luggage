import { z } from "zod";
import { fail, failFromDb, isSameOrigin, newRequestId, ok } from "@/server/api";
import { getAuthContext } from "@/server/auth";
import { getPaymentAdapter } from "@/server/payments";
import { createSupabaseServiceClient } from "@/server/service-client";

export const dynamic = "force-dynamic";

/**
 * 환불 승인 (finance). 승인 후 PG 환불을 실행하고 결과를 기록한다.
 * PG timeout은 unknown으로 남겨 대사 작업이 재조회한다 (새 환불을 만들지 않는다).
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = newRequestId();
  const authorization = request.headers.get("authorization");
  if (!authorization && !isSameOrigin(request)) return fail("FORBIDDEN", requestId);
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return fail("NOT_FOUND", requestId);

  const auth = await getAuthContext({ authorization });
  if (!auth.user || !auth.client) return fail("SESSION_REQUIRED", requestId);
  if (!auth.roles.some((r) => r.role === "finance" || r.role === "admin")) return fail("FORBIDDEN", requestId);

  const { data: refund, error } = await auth.client
    .rpc("approve_refund", { p_refund_request_id: id })
    .single<{ id: string; amount_minor: number; currency: string; status: string; payment_attempt_id: string }>();
  if (error || !refund) return failFromDb(error, requestId);
  if (refund.status === "succeeded") return ok({ refundId: refund.id, status: refund.status }, requestId);

  const service = createSupabaseServiceClient();
  const { data: attempt } = service
    ? await service.from("payment_attempts").select("provider, merchant_order_id").eq("id", refund.payment_attempt_id).single()
    : { data: null };
  const adapter = attempt ? getPaymentAdapter(attempt.provider) : null;
  if (!service || !attempt || !adapter) {
    // 승인은 기록됐다. 실행은 설정이 준비되면 대사 작업이 이어서 한다.
    return ok({ refundId: refund.id, status: refund.status }, requestId);
  }

  let status: "processing" | "succeeded" | "failed" | "unknown" = "unknown";
  let providerRefundId: string | null = null;
  try {
    const result = await adapter.refund({
      refundId: refund.id,
      merchantOrderId: attempt.merchant_order_id,
      amountMinor: refund.amount_minor,
      currency: refund.currency,
    });
    status = result.status;
    providerRefundId = result.providerRefundId;
  } catch {
    status = "unknown";
  }
  await service.rpc("record_refund_result", { p_refund_id: refund.id, p_status: status, p_provider_refund_id: providerRefundId });
  return ok({ refundId: refund.id, status }, requestId);
}
