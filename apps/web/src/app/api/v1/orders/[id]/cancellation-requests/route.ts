import { z } from "zod";
import { fail, failFromDb, isSameOrigin, newRequestId, ok } from "@/server/api";
import { getAuthContext } from "@/server/auth";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ reason: z.string().trim().max(500).default("") }).strict();

/**
 * 고객 취소 요청. 미결제 주문은 바로 취소, 결제된 주문은 환불 요청(검토 대기)을 만든다.
 * ‘취소 요청’·‘환불 승인’·‘PG 환불 완료’는 서로 다른 상태로 보여 준다. 같은 요청은 멱등.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = newRequestId();
  const authorization = request.headers.get("authorization");
  if (!authorization && !isSameOrigin(request)) return fail("FORBIDDEN", requestId, { messageKey: "error.crossOrigin" });
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return fail("NOT_FOUND", requestId);
  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return fail("VALIDATION_FAILED", requestId);

  const auth = await getAuthContext({ authorization });
  if (!auth.user || !auth.client) return fail("SESSION_REQUIRED", requestId);
  const { data, error } = await auth.client
    .rpc("request_cancellation", { p_order_id: id, p_reason: parsed.data.reason })
    .maybeSingle<{ id: string; amount_minor: number; status: string } | null>();
  if (error) return failFromDb(error, requestId);
  return ok(
    data?.id
      ? { outcome: "refund_requested", refundRequestId: data.id, amountMinor: data.amount_minor }
      : { outcome: "cancelled" },
    requestId,
  );
}
