import { z } from "zod";
import { detectRuntimeEnvironment, paymentOptionsFor } from "@luggage/domain";
import { isLocale } from "@luggage/i18n";
import { getServerConfig } from "@/lib/env";
import { fail, failFromDb, isSameOrigin, newRequestId, ok } from "@/server/api";
import { getAuthContext } from "@/server/auth";
import { getPaymentAdapter } from "@/server/payments";
import { createSupabaseServiceClient } from "@/server/service-client";

export const dynamic = "force-dynamic";

const bodySchema = z
  .object({
    method: z.enum(["wechat_pay_jsapi", "wechat_pay_h5", "wechat_pay_miniprogram", "alipay", "card"]),
    locale: z.string(),
  })
  .strict();

/**
 * 결제 세션 생성. 금액은 주문의 서버 금액이다. 성공 여부는 웹훅·조회로만 확정한다.
 * Idempotency-Key가 같으면 같은 결제 시도를 돌려준다.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = newRequestId();
  const authorization = request.headers.get("authorization");
  if (!authorization && !isSameOrigin(request)) return fail("FORBIDDEN", requestId, { messageKey: "error.crossOrigin" });
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return fail("NOT_FOUND", requestId);
  const key = request.headers.get("idempotency-key");
  if (!key || !/^[A-Za-z0-9_-]{8,128}$/.test(key)) return fail("VALIDATION_FAILED", requestId);
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !isLocale(parsed.data.locale)) return fail("VALIDATION_FAILED", requestId);

  // 이 실행 환경에서 바로 쓸 수 없는 결제 수단은 받지 않는다 (예: 위챗 밖의 JSAPI).
  const runtime = detectRuntimeEnvironment({ userAgent: request.headers.get("user-agent") });
  const option = paymentOptionsFor(runtime).find((o) => o.method === parsed.data.method);
  // 미니프로그램 web-view는 네이티브 결제 페이지로 위임한다. 외부 브라우저 안내가 필요한 수단은 받지 않는다.
  const delegateToMiniProgram = option?.handoff === "delegate_to_miniprogram_page";
  if (!option || (option.handoff && !delegateToMiniProgram)) {
    return fail("BUSINESS_RULE_VIOLATION", requestId, { messageKey: "payment.methodUnavailable" });
  }

  const adapter = getPaymentAdapter();
  if (!adapter || !adapter.supports(parsed.data.method)) {
    return fail("PROVIDER_UNAVAILABLE", requestId, { messageKey: "payment.unavailable" });
  }

  const auth = await getAuthContext({ authorization });
  if (!auth.user || !auth.client) return fail("SESSION_REQUIRED", requestId);

  const { data: attempt, error } = await auth.client
    .rpc("start_payment", { p_order_id: id, p_provider: adapter.provider, p_method: parsed.data.method, p_client_key: key })
    .single<{ id: string; merchant_order_id: string; amount_minor: number; currency: string }>();
  if (error || !attempt) return failFromDb(error, requestId);

  if (delegateToMiniProgram) {
    // 1회용 결제 티켓 (5분). 결제 페이지가 wx.login 코드와 함께 결제 파라미터로 교환한다.
    const { data: ticket, error: ticketError } = await auth.client.rpc("create_miniprogram_pay_ticket", { p_attempt_id: attempt.id });
    if (ticketError || typeof ticket !== "string") return failFromDb(ticketError, requestId);
    return ok(
      {
        attemptId: attempt.id,
        action: {
          type: "miniprogram",
          page: "/pages/pay/pay",
          query: { ticket, orderId: id, locale: parsed.data.locale },
        },
      },
      requestId,
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  }

  const returnUrl = `${getServerConfig().appUrl}/${parsed.data.locale}/orders/${id}?payment=${attempt.id}`;
  let session;
  try {
    session = await adapter.createSession({
      attemptId: attempt.id,
      merchantOrderId: attempt.merchant_order_id,
      amountMinor: attempt.amount_minor,
      currency: attempt.currency,
      method: parsed.data.method,
      returnUrl,
    });
  } catch {
    // 세션 생성 실패는 결제 실패가 아니다. 시도는 created로 남고 다시 시도할 수 있다.
    return fail("PROVIDER_UNAVAILABLE", requestId, { messageKey: "payment.unavailable" });
  }
  const service = createSupabaseServiceClient();
  if (service) {
    await service.rpc("mark_payment_pending", {
      p_attempt_id: attempt.id,
      p_provider_transaction_id: session.providerTransactionId,
    });
  }
  return ok({ attemptId: attempt.id, action: session.action }, requestId, { status: 201 });
}
