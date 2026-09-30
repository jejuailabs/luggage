"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function RefundReviewActions({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  async function submit(action: "approve" | "reject", reason?: string) {
    if (action === "reject" && !reason?.trim()) { setMessage("거절 사유를 입력해 주세요."); return; }
    setPending(true); setMessage("");
    try {
      const response = await fetch(`/api/v1/refunds/${requestId}/${action}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(action === "reject" ? { reason } : {}) });
      const json = await response.json().catch(() => null);
      setMessage(response.ok ? action === "approve" ? "승인했습니다. 환불 실행 상태를 확인해 주세요." : "거절했습니다." : `처리하지 못했습니다. ${json?.error?.code ?? ""}`);
      if (response.ok) router.refresh();
    } catch { setMessage("연결에 실패했습니다."); }
    setPending(false);
  }
  return <div className="grid gap-2 sm:min-w-64"><button disabled={pending} onClick={() => void submit("approve")} className="min-h-11 rounded-[var(--radius-button)] bg-primary px-4 text-sm font-semibold text-on-primary">환불 승인·실행</button><form onSubmit={(e) => { e.preventDefault(); void submit("reject", String(new FormData(e.currentTarget).get("reason") ?? "")); }} className="flex gap-2"><input name="reason" aria-label="거절 사유" required maxLength={500} placeholder="거절 사유" className="min-h-11 min-w-0 flex-1 rounded-[var(--radius-button)] border border-line bg-bg px-3 text-sm" /><button disabled={pending} className="min-h-11 rounded-[var(--radius-button)] border border-line px-3 text-sm font-semibold">거절</button></form>{message ? <p role="status" className="text-xs">{message}</p> : null}</div>;
}
