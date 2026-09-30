"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ReissueTag({ bagId }: { bagId: string }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  return <form className="no-print mt-3 flex flex-wrap gap-2" onSubmit={async (event) => { event.preventDefault(); const reason = String(new FormData(event.currentTarget).get("reason") ?? "").trim(); setPending(true); setMessage(""); try { const response = await fetch(`/api/v1/bags/${bagId}/reissue`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason }) }); const json = await response.json().catch(() => null); setMessage(response.ok ? "새 태그가 발급됐습니다. 이전 라벨은 폐기하세요." : `재발급 실패: ${json?.error?.code ?? "연결 오류"}`); if (response.ok) router.refresh(); } catch { setMessage("연결에 실패했습니다."); } setPending(false); }}><input name="reason" required maxLength={500} placeholder="재발급 사유" aria-label="재발급 사유" className="min-h-10 min-w-0 flex-1 rounded-lg border border-line bg-bg px-3 text-sm" /><button disabled={pending} className="rounded-lg border border-line px-3 text-sm font-semibold">태그 재발급</button>{message ? <p role="status" className="w-full text-xs">{message}</p> : null}</form>;
}
