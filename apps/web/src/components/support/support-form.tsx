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
      className="customer-card flex flex-col gap-4 p-5"
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
      <h2 className="customer-section-heading">{t("support.title")}</h2>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">{t("support.subject")}</span>
        <input name="subject" required maxLength={200} className="customer-input min-h-12 px-3" />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">{t("support.body")}</span>
        <textarea name="body" required maxLength={4000} rows={4} className="customer-input p-3" />
      </label>
      <button type="submit" disabled={busy} className="customer-action min-h-12 px-5 font-semibold disabled:opacity-50">
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
