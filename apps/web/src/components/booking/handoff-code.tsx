"use client";

import { useMemo, useState } from "react";
import { createTranslator, formatKst, type Locale } from "@luggage/i18n";

/** 공항 수령 코드. 요청할 때마다 서버가 새 코드를 만들고 이전 코드는 무효가 된다. 화면에만 보여 준다. */
export function HandoffCode({ locale, orderId, ready }: { locale: Locale; orderId: string; ready: boolean }) {
  const t = useMemo(() => createTranslator(locale), [locale]);
  const [code, setCode] = useState<{ code: string; expiresAt: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  return (
    <section className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-line bg-card p-4" data-testid="handoff-code">
      <h2 className="font-semibold">{t("handoff.title")}</h2>
      {!ready ? (
        <p className="text-sm text-muted">{t("handoff.notReady")}</p>
      ) : (
        <>
          <p className="text-sm">{t("handoff.hint")}</p>
          {code ? (
            <div className="rounded-[var(--radius-button)] bg-white p-4 text-center">
              <p className="font-mono text-4xl font-bold tracking-[0.3em] text-black" aria-live="polite">
                {code.code}
              </p>
              <p className="mt-1 text-xs text-slate-600">
                {t("handoff.expires", { time: formatKst(new Date(code.expiresAt), locale, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }) })}
              </p>
            </div>
          ) : null}
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setFailed(false);
              const response = await fetch(`/api/v1/orders/${orderId}/handoff-challenges`, { method: "POST" }).catch(() => null);
              const json = await response?.json().catch(() => null);
              setBusy(false);
              if (!response?.ok) {
                setFailed(true);
                return;
              }
              setCode({ code: json.data.code, expiresAt: json.data.expiresAt });
            }}
            className="min-h-12 rounded-[var(--radius-button)] bg-primary px-4 font-semibold text-on-primary disabled:opacity-50"
          >
            {t("handoff.show")}
          </button>
          {failed ? (
            <p role="alert" className="text-sm text-warm">
              {t("booking.error.generic")}
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}
