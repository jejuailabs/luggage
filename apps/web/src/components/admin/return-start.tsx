"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { fieldRequest, newClientId, fieldErrorText } from "@/lib/field-client";
import type { FieldJob } from "@/server/field";

export function ReturnStart({ job }: { job: FieldJob }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const eligible = job.bags.filter((bag) => ["collected", "in_transit", "ready_for_handoff", "exception_hold"].includes(bag.status));
  return <section className="rounded-[var(--radius-card)] border border-line bg-card p-5"><h2 className="text-lg font-bold">반환 지시</h2><p className="mt-1 text-sm text-muted">반환 대상 짐을 확인하고 사유를 기록합니다. 기사는 태그를 다시 확인하고 수령자 확인 내용이나 사진을 남겨 반환을 완료합니다.</p><label className="mt-4 block text-sm">반환 사유<textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={1000} rows={3} className="mt-2 w-full rounded-xl border border-line bg-bg p-3" /></label><div className="mt-4 grid gap-2 sm:grid-cols-2">{eligible.map((bag) => <button key={bag.tagId} type="button" disabled={busy || reason.trim().length < 5} onClick={async () => { setBusy(true); setMessage(""); const result = await fieldRequest("/api/v1/bags/events", "POST", { tagId: bag.tagId, jobId: job.id, eventType: "return_started", clientEventId: newClientId(), expectedVersion: bag.version, deviceOccurredAt: new Date().toISOString(), evidenceIds: [], note: reason.trim() }); setBusy(false); setMessage(result.ok ? `${bag.seq}번 짐 반환 지시가 기록됐습니다.` : fieldErrorText(result.code)); if (result.ok) router.refresh(); }} className="min-h-12 rounded-xl border border-line bg-sea px-4 text-left font-semibold disabled:opacity-50">{bag.seq}번 · {bag.tagId} 반환 시작</button>)}</div>{eligible.length === 0 ? <p className="mt-4 text-sm text-muted">반환을 시작할 수 있는 짐이 없습니다.</p> : null}{message ? <p role="status" className="mt-3 text-sm">{message}</p> : null}</section>;
}
