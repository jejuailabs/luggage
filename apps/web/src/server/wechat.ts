import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import {
  MockMiniProgramPaymentAdapter,
  MockWeChatIdentityAdapter,
  type MiniProgramPaymentAdapter,
  type WeChatIdentityAdapter,
} from "@luggage/integrations";
import { getServerConfig } from "@/lib/env";

/** 위챗 로그인 코드 교환. sandbox/live는 AppID·AppSecret 설정과 함께 추가한다. 없으면 null. */
export function getWeChatIdentityAdapter(): WeChatIdentityAdapter | null {
  return getServerConfig().integrations.wechat === "mock" ? new MockWeChatIdentityAdapter() : null;
}

/** 미니프로그램 결제 준비. 결제 공급사가 정해지면 같은 계약으로 교체한다. */
export function getMiniProgramPaymentAdapter(): MiniProgramPaymentAdapter | null {
  return getServerConfig().integrations.payment === "mock" ? new MockMiniProgramPaymentAdapter() : null;
}

/**
 * mock 전용: 미니프로그램 모의 결제 완료 요청을 증명하는 토큰 (결제 시도 ID에 대한 HMAC).
 * 쿠키 세션이 없는 미니프로그램 결제 페이지에서 쓴다. production에는 mock 자체가 없다.
 */
export function mockCompletionToken(attemptId: string): string | null {
  const secret = getServerConfig().secrets.mockPayment;
  return secret ? createHmac("sha256", secret).update(`mp-complete:${attemptId}`).digest("hex") : null;
}

export function verifyMockCompletionToken(attemptId: string, token: string): boolean {
  const expected = mockCompletionToken(attemptId);
  return Boolean(expected) && expected!.length === token.length && timingSafeEqual(Buffer.from(expected!), Buffer.from(token));
}
