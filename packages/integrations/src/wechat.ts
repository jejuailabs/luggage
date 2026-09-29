import { createHash } from "node:crypto";
import type { IntegrationMode } from "./index";

/**
 * WeChatIdentity 어댑터 (04 문서 7절). wx.login code를 서버에서 교환한다.
 * app secret은 서버 설정에만 두며 클라이언트로 보내지 않는다.
 * openid는 미니프로그램별 식별자다. 전역 계정 ID로 쓰지 않고, unionid가 항상 있다고 가정하지 않는다.
 */
export interface WeChatIdentity {
  openid: string;
  unionid: string | null;
}

export interface WeChatIdentityAdapter {
  readonly mode: IntegrationMode;
  exchangeCode(code: string): Promise<WeChatIdentity>;
}

export class WeChatCodeError extends Error {
  override name = "WeChatCodeError";
}

/** mock: code에서 결정적 가짜 openid를 만든다. 실제 위챗 서버를 호출하지 않는다. */
export class MockWeChatIdentityAdapter implements WeChatIdentityAdapter {
  readonly mode: IntegrationMode = "mock";

  async exchangeCode(code: string): Promise<WeChatIdentity> {
    if (!/^[A-Za-z0-9_-]{8,128}$/.test(code)) throw new WeChatCodeError("invalid code");
    const digest = createHash("sha256").update(`mock-wechat:${code}`).digest("hex");
    return { openid: `mock_${digest.slice(0, 24)}`, unionid: null };
  }
}

/** 미니프로그램 결제 파라미터 (wx.requestPayment 인자). */
export interface MiniProgramPaymentParams {
  timeStamp: string;
  nonceStr: string;
  package: string;
  signType: "RSA" | "MD5" | "HMAC-SHA256";
  paySign: string;
}

export interface MiniProgramPaymentRequest {
  merchantOrderId: string;
  amountMinor: number;
  currency: string;
  payerOpenid: string;
}

/**
 * 미니프로그램 결제 준비. 실제 공급사 어댑터는 prepay 주문을 만들고 서명한다.
 * mock은 형식만 맞춘 가짜 파라미터를 돌려주며 mock=true로 표시한다 (실제 결제 불가).
 */
export interface MiniProgramPaymentAdapter {
  readonly mode: IntegrationMode;
  prepare(request: MiniProgramPaymentRequest): Promise<{ params: MiniProgramPaymentParams; mock: boolean }>;
}

export class MockMiniProgramPaymentAdapter implements MiniProgramPaymentAdapter {
  readonly mode: IntegrationMode = "mock";

  constructor(private readonly now: () => Date = () => new Date()) {}

  async prepare(request: MiniProgramPaymentRequest) {
    const nonce = createHash("sha256").update(`${request.merchantOrderId}:${request.payerOpenid}`).digest("hex").slice(0, 32);
    return {
      mock: true,
      params: {
        timeStamp: String(Math.floor(this.now().getTime() / 1000)),
        nonceStr: nonce,
        package: `prepay_id=mock_${request.merchantOrderId}`,
        signType: "RSA" as const,
        paySign: "MOCK_SIGNATURE",
      },
    };
  }
}
