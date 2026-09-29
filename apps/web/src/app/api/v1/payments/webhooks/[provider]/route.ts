import { WebhookVerificationError } from "@luggage/integrations";
import { fail, newRequestId, ok } from "@/server/api";
import { getPaymentAdapter, processPaymentNotification } from "@/server/payments";

export const dynamic = "force-dynamic";

/**
 * PG 웹훅. 서명 검증 → 공급사 상태 재조회 → DB 대조·확정. 같은 이벤트는 DB에서 한 번만 처리된다.
 * 처리할 수 없으면(설정·DB 장애) 5xx를 돌려 공급사가 재전송하게 한다.
 */
export async function POST(request: Request, { params }: { params: Promise<{ provider: string }> }) {
  const requestId = newRequestId();
  const { provider } = await params;
  const adapter = getPaymentAdapter(provider);
  if (!adapter) return fail("NOT_FOUND", requestId);

  const rawBody = await request.text();
  let notification;
  try {
    notification = adapter.parseWebhook(request.headers, rawBody);
  } catch (error) {
    if (error instanceof WebhookVerificationError) return fail("FORBIDDEN", requestId);
    throw error;
  }
  const result = await processPaymentNotification(adapter, notification);
  if (!result.ok) return fail("PROVIDER_UNAVAILABLE", requestId);
  return ok({ received: true, result: result.result }, requestId);
}
