import { randomUUID } from "node:crypto";
import { z } from "zod";
import { MockPaymentAdapter } from "@luggage/integrations";
import { getServerConfig } from "@/lib/env";
import { fail, newRequestId, ok } from "@/server/api";
import { getPaymentAdapter, processPaymentNotification } from "@/server/payments";
import { createSupabaseServiceClient } from "@/server/service-client";
import { verifyMockCompletionToken } from "@/server/wechat";

export const dynamic = "force-dynamic";

const bodySchema = z
  .object({
    attemptId: z.string().uuid(),
    token: z.string().regex(/^[0-9a-f]{64}$/),
    outcome: z.enum(["succeeded", "failed", "cancelled"]),
  })
  .strict();

/**
 * 미니프로그램 모의 결제 결과 (비운영·mock 전용). 실제 PG 대신 서명된 알림을 만들어 웹훅과 같은 경로로 처리한다.
 */
export async function POST(request: Request) {
  const requestId = newRequestId();
  const adapter = getPaymentAdapter("mock");
  if (getServerConfig().appEnv === "production" || !(adapter instanceof MockPaymentAdapter)) return fail("NOT_FOUND", requestId);
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("VALIDATION_FAILED", requestId);
  if (!verifyMockCompletionToken(parsed.data.attemptId, parsed.data.token)) return fail("FORBIDDEN", requestId);

  const service = createSupabaseServiceClient();
  if (!service) return fail("PROVIDER_UNAVAILABLE", requestId);
  const { data: attempt } = await service
    .from("payment_attempts")
    .select("merchant_order_id, amount_minor, currency")
    .eq("id", parsed.data.attemptId)
    .maybeSingle();
  if (!attempt) return fail("NOT_FOUND", requestId);

  const { body, signature } = adapter.signEvent({
    eventId: `mock_mp_${randomUUID()}`,
    merchantOrderId: attempt.merchant_order_id,
    status: parsed.data.outcome,
    amountMinor: attempt.amount_minor,
    currency: attempt.currency,
    issuedAt: new Date().toISOString(),
  });
  const notification = adapter.parseWebhook(new Headers({ [MockPaymentAdapter.signatureHeader]: signature }), body);
  const result = await processPaymentNotification(adapter, notification);
  if (!result.ok) return fail("PROVIDER_UNAVAILABLE", requestId);
  return ok({ result: result.result }, requestId);
}
