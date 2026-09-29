import { createHmac, timingSafeEqual } from "node:crypto";
import type { IntegrationMode } from "./index";

export type PaymentMethod = "wechat_pay_jsapi" | "wechat_pay_h5" | "wechat_pay_miniprogram" | "alipay" | "card";
export type ProviderPaymentStatus = "pending" | "succeeded" | "failed" | "cancelled" | "unknown";

export interface PaymentSessionRequest {
  attemptId: string;
  merchantOrderId: string;
  amountMinor: number;
  currency: string;
  method: PaymentMethod;
  /** 결제 후 돌아올 주문 화면. 이 주소 도착은 결제 성공의 근거가 아니다. */
  returnUrl: string;
}

export type PaymentAction =
  | { type: "redirect"; url: string }
  | { type: "wechat_jsapi"; params: Record<string, string> }
  | { type: "miniprogram"; params: Record<string, string> };

export interface PaymentSession {
  providerTransactionId: string | null;
  action: PaymentAction;
}

export interface PaymentStatus {
  status: ProviderPaymentStatus;
  amountMinor: number | null;
  currency: string | null;
  providerTransactionId: string | null;
}

export interface PaymentNotification {
  eventId: string;
  merchantOrderId: string;
  payloadHash: string;
  /** 공급사가 알린 상태. 확정 전 retrieve()로 다시 확인한다 (mock은 서명된 알림 자체가 원장). */
  reported: PaymentStatus;
}

export interface RefundResult {
  status: "processing" | "succeeded" | "failed" | "unknown";
  providerRefundId: string | null;
}

/**
 * PG 어댑터 계약 (04 문서 7절). 공급사 SDK는 이 뒤에 숨기고 UI에 공급사 코드를 흩뿌리지 않는다.
 * timeout은 실패가 아니라 unknown으로 돌려준다.
 */
export interface PaymentAdapter {
  readonly provider: string;
  readonly mode: IntegrationMode;
  supports(method: PaymentMethod): boolean;
  createSession(request: PaymentSessionRequest): Promise<PaymentSession>;
  retrieve(merchantOrderId: string, notification?: PaymentNotification): Promise<PaymentStatus>;
  refund(input: { refundId: string; merchantOrderId: string; amountMinor: number; currency: string }): Promise<RefundResult>;
  /** 서명 검증 실패면 예외. */
  parseWebhook(headers: Headers, rawBody: string): PaymentNotification;
}

export class WebhookVerificationError extends Error {
  override name = "WebhookVerificationError";
}

/** mock 결제 알림 본문. 개발·테스트 전용이며 production에서는 어댑터를 만들 수 없다. */
export interface MockPaymentEvent {
  eventId: string;
  merchantOrderId: string;
  status: ProviderPaymentStatus;
  amountMinor: number;
  currency: string;
  issuedAt: string;
}

const MOCK_SIGNATURE_HEADER = "x-mock-signature";
const MOCK_MAX_AGE_MS = 5 * 60_000;

function sign(secret: string, body: string): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

function sha256(body: string): string {
  return createHmac("sha256", "payload").update(body).digest("hex");
}

export class MockPaymentAdapter implements PaymentAdapter {
  readonly provider = "mock";
  readonly mode: IntegrationMode = "mock";

  constructor(
    private readonly secret: string,
    private readonly checkoutBaseUrl: string,
    private readonly now: () => Date = () => new Date(),
  ) {
    if (secret.length < 16) throw new Error("mock payment secret must be at least 16 characters");
  }

  supports(): boolean {
    return true;
  }

  async createSession(request: PaymentSessionRequest): Promise<PaymentSession> {
    const url = new URL(`${this.checkoutBaseUrl}/${request.attemptId}`);
    url.searchParams.set("return", request.returnUrl);
    return { providerTransactionId: `mock_${request.merchantOrderId}`, action: { type: "redirect", url: url.toString() } };
  }

  /** mock PG는 별도 조회 원장이 없다. 서명 검증된 알림을 현재 상태로 쓰고, 알림이 없으면 pending이다. */
  async retrieve(_merchantOrderId: string, notification?: PaymentNotification): Promise<PaymentStatus> {
    return notification?.reported ?? { status: "pending", amountMinor: null, currency: null, providerTransactionId: null };
  }

  async refund(input: { refundId: string }): Promise<RefundResult> {
    return { status: "succeeded", providerRefundId: `mock_refund_${input.refundId}` };
  }

  /** 개발용 결제창이 서버에서 알림을 만들 때 쓴다. */
  signEvent(event: MockPaymentEvent): { body: string; signature: string } {
    const body = JSON.stringify(event);
    return { body, signature: sign(this.secret, body) };
  }

  parseWebhook(headers: Headers, rawBody: string): PaymentNotification {
    const signature = headers.get(MOCK_SIGNATURE_HEADER) ?? "";
    const expected = sign(this.secret, rawBody);
    const valid =
      signature.length === expected.length && timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
    if (!valid) throw new WebhookVerificationError("invalid signature");

    let event: MockPaymentEvent;
    try {
      event = JSON.parse(rawBody) as MockPaymentEvent;
    } catch {
      throw new WebhookVerificationError("invalid body");
    }
    const age = this.now().getTime() - new Date(event.issuedAt).getTime();
    if (!Number.isFinite(age) || age < -60_000 || age > MOCK_MAX_AGE_MS) {
      throw new WebhookVerificationError("stale event");
    }
    return {
      eventId: event.eventId,
      merchantOrderId: event.merchantOrderId,
      payloadHash: sha256(rawBody),
      reported: {
        status: event.status,
        amountMinor: event.amountMinor,
        currency: event.currency,
        providerTransactionId: `mock_${event.merchantOrderId}`,
      },
    };
  }

  static readonly signatureHeader = MOCK_SIGNATURE_HEADER;
}
