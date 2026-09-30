"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { adminFetch } from "./admin-fetch";

type Bag = { tagId: string; seq: number; status: string; version: number };
type Event = { id: string; bag_id: string; event_type: string; from_status: string; to_status: string; server_received_at: string; note: string | null };

export function BagCorrection({ bags, events }: { bags: (Bag & { id: string })[]; events: Event[] }) {
  const router = useRouter();
  const [eventId, setEventId] = useState("");
  const [toStatus, setToStatus] = useState("registered");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const selected = events.find((event) => event.id === eventId);
  const bag = bags.find((row) => row.id === selected?.bag_id);
  const statuses = ["registered", "at_origin", "collected", "in_transit", "ready_for_handoff", "exception_hold"];
  return <section className="rounded-[var(--radius-card)] border border-line bg-card p-5"><h2 className="text-lg font-bold">이벤트 기록 정정</h2><p className="mt-1 text-sm text-muted">원본 이벤트는 그대로 보존됩니다. 실제 확인한 상태와 정정 사유를 기록하세요. 인계 완료·반환 완료 기록은 이 화면에서 변경할 수 없습니다.</p><form className="mt-4 grid gap-3" onSubmit={async (event) => { event.preventDefault(); if (!bag) return; setBusy(true); const result = await adminFetch("/api/v1/admin/bag-corrections", "POST", { originalEventId: eventId, toStatus, reason, expectedVersion: bag.version, clientEventId: crypto.randomUUID() }); setBusy(false); setMessage(result.ok ? "정정 이벤트를 기록했습니다." : "정정하지 못했습니다. 짐 상태·권한·버전을 확인하세요."); if (result.ok) router.refresh(); }}><label className="text-sm">정정할 원본 이벤트<select required value={eventId} onChange={(event) => setEventId(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-line bg-bg px-3"><option value="">이벤트 선택</option>{events.filter((event) => event.event_type !== "correction").map((event) => <option key={event.id} value={event.id}>{bags.find((row) => row.id === event.bag_id)?.seq ?? "?"}번 · {event.event_type} · {new Date(event.server_received_at).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}</option>)}</select></label>{bag ? <p className="text-sm text-muted">현재 상태: {bag.status} · 태그: {bag.tagId}</p> : null}<label className="text-sm">확인한 상태<select value={toStatus} onChange={(event) => setToStatus(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-line bg-bg px-3">{statuses.map((status) => <option key={status} value={status}>{status}</option>)}</select></label><label className="text-sm">정정 사유<textarea required minLength={10} maxLength={1000} rows={3} value={reason} onChange={(event) => setReason(event.target.value)} className="mt-1 w-full rounded-xl border border-line bg-bg p-3" /></label><button disabled={busy || !bag || bag.status === toStatus || ["delivered", "returned", "cancelled_before_pickup"].includes(bag.status)} className="min-h-11 rounded-xl bg-primary px-4 font-semibold text-on-primary disabled:opacity-50">정정 기록 남기기</button>{message ? <p role="status" className="text-sm">{message}</p> : null}</form></section>;
}
