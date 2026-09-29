"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { paymentOptionsFor, type RuntimeEnvironment } from "@luggage/domain";
import { createTranslator, getMessages, type Locale, type MessageKey } from "@luggage/i18n";
import { navigateToMiniProgramPage } from "@/lib/miniprogram-bridge";

interface Props {
  locale: Locale;
  orderId: string;
  runtime: RuntimeEnvironment;
  reservationStatus: string;
  paymentSummary: string;
  latestAttemptStatus: string | null;
  hasRefundRequest: boolean;
}

const POLL_MS = 3000;
const POLL_LIMIT = 40;

export function OrderActions(props: Props) {
  const { locale, orderId, runtime, reservationStatus, paymentSummary, latestAttemptStatus, hasRefundRequest } = props;
  const t = useMemo(() => createTranslator(locale), [locale]);
  const messages = getMessages(locale);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // 한 화면에서 같은 결제 수단을 여러 번 눌러도 같은 결제 시도가 되도록 키를 고정한다.
  const [keys] = useState(() => new Map<string, string>());

  const checking = paymentSummary === "pending" && latestAttemptStatus !== "failed" && latestAttemptStatus !== "cancelled";

  // 결제 확인 중이면 서버 상태를 다시 읽는다. 브라우저 복귀만으로 확정하지 않는다.
  useEffect(() => {
    if (!checking) return;
    let count = 0;
    const timer = setInterval(() => {
      count += 1;
      if (count > POLL_LIMIT) clearInterval(timer);
      else router.refresh();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [checking, router]);

  const errorText = (key: string | undefined) =>
    key && key in messages ? t(key as MessageKey) : t("booking.error.generic");

  async function pay(method: string) {
    setBusy(true);
    setError(null);
    let key = keys.get(method);
    if (!key) {
      key = crypto.randomUUID().replaceAll("-", "");
      keys.set(method, key);
    }
    const response = await fetch(`/api/v1/orders/${orderId}/payment-attempts`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": key },
      body: JSON.stringify({ method, locale }),
    });
    const json = await response.json().catch(() => null);
    if (!response.ok) {
      setBusy(false);
      setError(errorText(json?.error?.messageKey));
      return;
    }
    const action = json?.data?.action;
    if (action?.type === "redirect" && typeof action.url === "string") {
      window.location.assign(action.url);
      return;
    }
    if (action?.type === "miniprogram" && typeof action.page === "string") {
      // 미니프로그램 결제 페이지로 위임한다. 결과는 서버 확인 후 이 화면이 다시 읽는다.
      const moved = await navigateToMiniProgramPage(action.page, action.query ?? {});
      setBusy(false);
      if (!moved) setError(t("payment.methodUnavailable"));
      return;
    }
    // 위챗 JSAPI(위챗 내장 브라우저) 결제는 공급사 연동 단계에서 연결한다.
    setBusy(false);
    setError(t("payment.methodUnavailable"));
  }

  async function cancel() {
    if (!window.confirm(t("cancel.confirm"))) return;
    setBusy(true);
    setError(null);
    const response = await fetch(`/api/v1/orders/${orderId}/cancellation-requests`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "customer_request" }),
    });
    const json = await response.json().catch(() => null);
    setBusy(false);
    if (!response.ok) {
      setError(errorText(json?.error?.messageKey));
      return;
    }
    setNotice(json?.data?.outcome === "cancelled" ? t("cancel.done") : t("cancel.requested"));
    router.refresh();
  }

  const canPay = reservationStatus === "held" && !checking;
  const canCancel =
    !hasRefundRequest && (reservationStatus === "held" || (reservationStatus === "confirmed" && paymentSummary === "paid"));
  const card = "flex flex-col gap-3 rounded-[var(--radius-card)] border border-line bg-card p-4";

  return (
    <div className="flex flex-col gap-4" data-testid="order-actions">
      {checking ? (
        <p role="status" className={`${card} text-sm`} data-testid="payment-checking">
          {t("payment.checking")}
        </p>
      ) : null}
      {reservationStatus === "held" && latestAttemptStatus === "failed" ? (
        <p role="status" className="text-sm text-warm">
          {t("payment.failed")}
        </p>
      ) : null}

      {canPay ? (
        <section className={card} aria-labelledby="payment-title">
          <h2 id="payment-title" className="font-semibold">
            {t("payment.title")}
          </h2>
          {paymentOptionsFor(runtime).map((option) => {
            const name = t(`payment.method.${option.method}` as MessageKey);
            if (option.handoff === "open_in_external_browser") {
              return (
                <p key={option.method} className="text-sm text-muted">
                  {t("payment.openExternal")}
                </p>
              );
            }
            if (option.handoff && option.handoff !== "delegate_to_miniprogram_page") return null;
            return (
              <button
                key={option.method}
                type="button"
                disabled={busy}
                onClick={() => pay(option.method)}
                data-testid={`pay-${option.method}`}
                className="min-h-12 rounded-[var(--radius-button)] bg-primary px-4 font-semibold text-on-primary disabled:opacity-50"
              >
                {t("payment.pay", { method: name })}
              </button>
            );
          })}
        </section>
      ) : null}

      {error ? (
        <p role="alert" className="text-sm text-warm" data-testid="order-action-error">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p role="status" className="text-sm">
          {notice}
        </p>
      ) : null}

      {canCancel ? (
        <button
          type="button"
          disabled={busy}
          onClick={cancel}
          data-testid="cancel-order"
          className="min-h-11 rounded-[var(--radius-button)] border border-line px-4 text-sm disabled:opacity-50"
        >
          {t("cancel.button")}
        </button>
      ) : null}
    </div>
  );
}
