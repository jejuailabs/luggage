import { randomUUID } from "node:crypto";
import { z } from "zod";
import { MockPaymentAdapter } from "@luggage/integrations";
import { getServerConfig } from "@/lib/env";
import { fail, isSameOrigin, newRequestId, ok } from "@/server/api";
import { getAuthContext } from "@/server/auth";
import { getPaymentAdapter, processPaymentNotification } from "@/server/payments";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ outcome: z.enum(["succeeded", "failed", "cancelled"]) }).strict();

/**
 * 개발용 mock 결제창의 결과 버튼. 비운영·mock 모드에서만 동작한다.
 * 실제 PG처럼 서명된 알림을 만들어 웹훅과 같은 처리 경로로 보낸다.
 */
export async function POST(request: Request, { params }: { params: Promise<{ attemptId: string }> }) {
  const requestId = newRequestId();
  const adapter = getPaymentAdapter("mock");
  if (getServerConfig().appEnv === "production" || !(adapter instanceof MockPaymentAdapter)) {
    return fail("NOT_FOUND", requestId);
  }
  if (!isSameOrigin(request)) return fail("FORBIDDEN", requestId);
  const { attemptId } = await params;
  if (!z.string().uuid().safeParse(attemptId).success) return fail("NOT_FOUND", requestId);
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("VALIDATION_FAILED", requestId);

  // 결제창을 연 주문 소유자만 결과를 낼 수 있다 (RLS로 자기 주문의 시도만 보인다).
  const auth = await getAuthContext();
  if (!auth.user || !auth.client) return fail("SESSION_REQUIRED", requestId);
  const { data: attempt } = await auth.client
    .from("payment_attempts")
    .select("merchant_order_id, amount_minor, currency")
    .eq("id", attemptId)
    .maybeSingle();
  if (!attempt) return fail("NOT_FOUND", requestId);

  const { body, signature } = adapter.signEvent({
    eventId: `mock_${randomUUID()}`,
    merchantOrderId: attempt.merchant_order_id,
    status: parsed.data.outcome,
    amountMinor: attempt.amount_minor,
    currency: attempt.currency,
    issuedAt: new Date().toISOString(),
  });
  const notification = adapter.parseWebhook(new Headers({ [MockPaymentAdapter.signatureHeader]: signature }), body);
  const result = await processPaymentNotification(adapter, notification);
  if (!result.ok) return fail("PROVIDER_UNAVAILABLE", requestId, { messageKey: "payment.unavailable" });
  return ok({ result: result.result }, requestId);
}
