"use client";

import { useState } from "react";

/** 개발용 모의 결제창. 결과 버튼은 서버가 서명한 알림을 만들어 웹훅과 같은 경로로 처리한다. */
export function MockCheckout({
  attemptId,
  returnUrl,
  labels,
}: {
  attemptId: string;
  returnUrl: string;
  labels: { succeed: string; fail: string; cancel: string; error: string };
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function finish(outcome: "succeeded" | "failed" | "cancelled") {
    setBusy(true);
    setError(false);
    const response = await fetch(`/api/v1/payments/mock/${attemptId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ outcome }),
    });
    if (!response.ok) {
      setBusy(false);
      setError(true);
      return;
    }
    window.location.assign(returnUrl);
  }

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        disabled={busy}
        onClick={() => finish("succeeded")}
        data-testid="mock-pay-succeed"
        className="min-h-12 rounded-[var(--radius-button)] bg-primary px-4 font-semibold text-on-primary disabled:opacity-50"
      >
        {labels.succeed}
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => finish("failed")}
        data-testid="mock-pay-fail"
        className="min-h-11 rounded-[var(--radius-button)] border border-line px-4 disabled:opacity-50"
      >
        {labels.fail}
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => finish("cancelled")}
        className="min-h-11 rounded-[var(--radius-button)] px-4 text-sm text-muted disabled:opacity-50"
      >
        {labels.cancel}
      </button>
      {error ? (
        <p role="alert" className="text-sm text-warm">
          {labels.error}
        </p>
      ) : null}
    </div>
  );
}
