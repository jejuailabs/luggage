"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { adminFetch } from "./admin-fetch";

export function PaymentReconcileAction({ attemptId }: { attemptId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  return <div className="flex flex-wrap items-center gap-2"><button disabled={busy} onClick={async () => { setBusy(true); const result = await adminFetch(`/api/v1/admin/payment-reviews/${attemptId}/reconcile`, "POST", {}); setBusy(false); setMessage(result.ok ? (result.data as { result?: string } | null)?.result === "pending" ? "공급사에서 아직 결제 중으로 확인됩니다." : "공급사 결과를 대조했습니다. 최신 상태를 다시 확인하세요." : result.code === "PROVIDER_UNAVAILABLE" ? "이 결제 공급사 조회 연결이 없습니다. 공급사 관리자에서 확인해 주세요." : "조회하지 못했습니다."); if (result.ok) router.refresh(); }} className="min-h-10 rounded-lg border border-line px-3 text-sm font-semibold disabled:opacity-50">공급사 결과 재조회</button>{message ? <span role="status" className="text-xs text-muted">{message}</span> : null}</div>;
}
