"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** 문의 답장. staff이면 공개 범위(고객 공개/내부 메모)를 고른다. 같은 전송은 clientMessageId로 한 번만 기록된다. */
export function MessageForm({
  ticketId,
  staff,
  labels,
}: {
  ticketId: string;
  staff: boolean;
  labels: { placeholder: string; send: string; failed: string };
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [clientMessageId, setClientMessageId] = useState(() => crypto.randomUUID());

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={async (event) => {
        event.preventDefault();
        const formElement = event.currentTarget;
        const form = new FormData(formElement);
        setBusy(true);
        setFailed(false);
        const response = await fetch(`/api/v1/support/tickets/${ticketId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            body: String(form.get("body") ?? ""),
            visibility: staff ? String(form.get("visibility")) : "customer",
            clientMessageId,
          }),
        }).catch(() => null);
        setBusy(false);
        if (!response?.ok) {
          setFailed(true);
          return;
        }
        formElement.reset();
        setClientMessageId(crypto.randomUUID());
        router.refresh();
      }}
    >
      <textarea name="body" required maxLength={4000} rows={3} placeholder={labels.placeholder} className="rounded-[var(--radius-button)] border border-line bg-bg p-3" />
      {staff ? (
        <select name="visibility" defaultValue="customer" className="min-h-11 rounded-[var(--radius-button)] border border-line bg-bg px-2 text-sm">
          <option value="customer">고객에게 보내기</option>
          <option value="internal">내부 메모 (고객 비공개)</option>
        </select>
      ) : null}
      <button type="submit" disabled={busy} className="min-h-12 rounded-[var(--radius-button)] bg-primary px-4 font-semibold text-on-primary disabled:opacity-50">
        {labels.send}
      </button>
      {failed ? (
        <p role="alert" className="text-sm text-warm">
          {labels.failed}
        </p>
      ) : null}
    </form>
  );
}
