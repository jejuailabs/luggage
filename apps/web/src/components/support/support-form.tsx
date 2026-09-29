"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { createTranslator, type Locale } from "@luggage/i18n";

/** 고객 문의 접수. 주문 화면에서 열면 주문이 연결된다. 비회원이면 먼저 소유 세션을 만든다. */
export function SupportForm({ locale, orderId }: { locale: Locale; orderId?: string }) {
  const t = useMemo(() => createTranslator(locale), [locale]);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [clientMessageId] = useState(() => crypto.randomUUID());

  return (
    <form
      className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-line bg-card p-4"
      data-testid="support-form"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        setBusy(true);
        setFailed(false);
        await fetch("/api/v1/sessions/guest", { method: "POST" }).catch(() => null);
        const response = await fetch("/api/v1/support/tickets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orderId,
            locale,
            subject: String(form.get("subject") ?? ""),
            body: String(form.get("body") ?? ""),
            clientMessageId,
          }),
        }).catch(() => null);
        const json = await response?.json().catch(() => null);
        setBusy(false);
        if (!response?.ok) {
          setFailed(true);
          return;
        }
        router.push(`/${locale}/help/requests/${json.data.ticketId}`);
      }}
    >
      <h2 className="font-semibold">{t("support.title")}</h2>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">{t("support.subject")}</span>
        <input name="subject" required maxLength={200} className="min-h-11 rounded-[var(--radius-button)] border border-line bg-bg px-3" />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">{t("support.body")}</span>
        <textarea name="body" required maxLength={4000} rows={4} className="rounded-[var(--radius-button)] border border-line bg-bg p-3" />
      </label>
      <button type="submit" disabled={busy} className="min-h-12 rounded-[var(--radius-button)] bg-primary px-4 font-semibold text-on-primary disabled:opacity-50">
        {t("support.send")}
      </button>
      {failed ? (
        <p role="alert" className="text-sm text-warm">
          {t("support.failed")}
        </p>
      ) : null}
    </form>
  );
}
