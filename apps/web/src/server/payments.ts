import "server-only";
import { MockPaymentAdapter, type PaymentAdapter, type PaymentNotification } from "@luggage/integrations";
import { getServerConfig } from "@/lib/env";
import { createSupabaseServiceClient } from "./service-client";

/**
 * 현재 설정의 PG 어댑터. sandbox/live 공급사 어댑터는 계약 공급사가 정해지면 추가한다.
 * 연동되지 않은 모드면 null — 결제 진입을 막는다.
 */
export function getPaymentAdapter(provider = "mock"): PaymentAdapter | null {
  const config = getServerConfig();
  if (provider === "mock" && config.integrations.payment === "mock" && config.secrets.mockPayment) {
    return new MockPaymentAdapter(config.secrets.mockPayment, `${config.appUrl}/zh-CN/mock-pay`);
  }
  return null;
}

export type ProcessResult = { ok: true; result: string } | { ok: false; reason: "service_unavailable" | "db_error" };

/**
 * 검증된 알림을 처리한다: 공급사 현재 상태를 조회하고 DB 함수로 대조·확정한다.
 * 웹훅과 mock 결제창이 같은 경로를 쓴다.
 */
export async function processPaymentNotification(
  adapter: PaymentAdapter,
  notification: PaymentNotification,
): Promise<ProcessResult> {
  const service = createSupabaseServiceClient();
  if (!service) return { ok: false, reason: "service_unavailable" };
  const current = await adapter.retrieve(notification.merchantOrderId, notification);
  const { data, error } = await service.rpc("record_payment_result", {
    p_provider: adapter.provider,
    p_event_id: notification.eventId,
    p_payload_hash: notification.payloadHash,
    p_merchant_order_id: notification.merchantOrderId,
    p_provider_transaction_id: current.providerTransactionId,
    p_status: current.status,
    p_amount_minor: current.amountMinor,
    p_currency: current.currency,
  });
  if (error) return { ok: false, reason: "db_error" };
  return { ok: true, result: String(data) };
}
