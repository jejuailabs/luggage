import { z } from "zod";
import { WeChatCodeError } from "@luggage/integrations";
import { fail, failFromDb, newRequestId, ok } from "@/server/api";
import { createSupabaseServiceClient } from "@/server/service-client";
import { getMiniProgramPaymentAdapter, getWeChatIdentityAdapter, mockCompletionToken } from "@/server/wechat";

export const dynamic = "force-dynamic";

const bodySchema = z
  .object({
    // web-view의 주문 소유자가 발급한 1회용 결제 티켓
    ticket: z.string().regex(/^[0-9a-f]{64}$/),
    // 미니프로그램 결제 페이지의 wx.login code (결제자 openid 확인)
    code: z.string().regex(/^[A-Za-z0-9_-]{8,128}$/),
  })
  .strict();

/**
 * 미니프로그램 결제 파라미터 발급. 쿠키 세션 대신 1회용 티켓이 권한이다 (5분, 한 번).
 * 결제 성공 여부는 여기서 정하지 않는다 — PG 웹훅·조회가 확정한다.
 */
export async function POST(request: Request) {
  const requestId = newRequestId();
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("VALIDATION_FAILED", requestId);

  const identity = getWeChatIdentityAdapter();
  const payments = getMiniProgramPaymentAdapter();
  const service = createSupabaseServiceClient();
  if (!identity || !payments || !service) return fail("PROVIDER_UNAVAILABLE", requestId, { messageKey: "payment.unavailable" });

  // 코드를 먼저 확인한다 (잘못된 코드로 티켓이 소비되지 않게).
  let openid: string;
  try {
    openid = (await identity.exchangeCode(parsed.data.code)).openid;
  } catch (error) {
    if (error instanceof WeChatCodeError) return fail("VALIDATION_FAILED", requestId);
    return fail("PROVIDER_UNAVAILABLE", requestId);
  }

  const { data: attempt, error } = await service
    .rpc("redeem_miniprogram_pay_ticket", { p_ticket: parsed.data.ticket })
    .single<{ id: string; order_id: string; merchant_order_id: string; amount_minor: number; currency: string }>();
  if (error || !attempt) return failFromDb(error, requestId);

  const prepared = await payments.prepare({
    merchantOrderId: attempt.merchant_order_id,
    amountMinor: attempt.amount_minor,
    currency: attempt.currency,
    payerOpenid: openid,
  });
  await service.rpc("mark_payment_pending", { p_attempt_id: attempt.id, p_provider_transaction_id: null });

  return ok(
    {
      orderId: attempt.order_id,
      attemptId: attempt.id,
      params: prepared.params,
      mock: prepared.mock,
      // mock에서만: 결제 페이지의 모의 결과 버튼용
      ...(prepared.mock ? { mockCompletionToken: mockCompletionToken(attempt.id) } : {}),
    },
    requestId,
    { headers: { "Cache-Control": "no-store" } },
  );
}
