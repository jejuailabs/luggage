import { RefundReviewActions } from "@/components/admin/refund-review-actions";
import { StaffGate } from "@/components/staff-gate";
import { resolveLocale } from "@/lib/request-context";
import { getViewer } from "@/server/auth";

async function RefundsAdmin() {
  const viewer = await getViewer();
  const isFinance = viewer.roles.some((role) => role.role === "finance" || role.role === "admin");
  if (!isFinance || !viewer.client) return <p className="rounded-[var(--radius-card)] border border-line bg-card p-5">재무 권한이 필요합니다.</p>;
  const { data, error } = await viewer.client.from("refund_requests")
    .select("id, order_id, amount_minor, reason, status, review_note, created_at, orders(public_code, total_minor, currency), refunds(id, status, provider_refund_id, failure_code)")
    .order("created_at", { ascending: false }).limit(100);
  const rows = (data ?? []) as unknown as { id: string; amount_minor: number; reason: string; status: string; review_note: string | null; created_at: string; orders: { public_code: string; total_minor: number; currency: string } | null; refunds: { id: string; status: string; provider_refund_id: string | null; failure_code: string | null }[] }[];
  const status: Record<string, string> = { requested: "검토 대기", approved: "승인", rejected: "거절", queued: "실행 대기", processing: "처리 중", succeeded: "환불 완료", unknown: "결과 확인 필요", failed: "실패" };
  return <section className="admin-dashboard" lang="ko"><div className="admin-dashboard__intro"><div><span>PAYMENTS / REVIEW</span><h1>환불 검토</h1><p>수납액과 요청 사유를 확인한 뒤 승인하거나 이유를 남겨 거절합니다. 승인 시 PG 환불을 실행하고 결과를 기록합니다.</p></div></div>{error ? <p role="alert">환불 요청을 불러오지 못했습니다.</p> : rows.length === 0 ? <p className="rounded-[var(--radius-card)] border border-line bg-card p-5 text-muted">환불 요청이 없습니다.</p> : <div className="grid gap-3">{rows.map((row) => <article key={row.id} className="flex flex-wrap justify-between gap-5 rounded-[var(--radius-card)] border border-line bg-card p-5"><div className="grid gap-1"><span className="text-xs font-bold tracking-widest text-primary">{status[row.status] ?? row.status}</span><h2 className="text-lg font-bold">{row.orders?.public_code ?? row.id}</h2><p className="text-sm">요청 {row.amount_minor.toLocaleString()}원 / 주문 {row.orders?.total_minor.toLocaleString() ?? "?"}원</p><p className="text-sm text-muted">사유: {row.reason}</p><p className="text-xs text-muted">{new Date(row.created_at).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })} KST</p>{row.review_note ? <p className="text-sm">검토 기록: {row.review_note}</p> : null}{row.refunds?.[0] ? <p className="text-sm">실행: {status[row.refunds[0].status] ?? row.refunds[0].status}{row.refunds[0].failure_code ? ` · ${row.refunds[0].failure_code}` : ""}</p> : null}</div>{row.status === "requested" ? <RefundReviewActions requestId={row.id} /> : null}</article>)}</div>}</section>;
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const locale = await resolveLocale(params);
  return <StaffGate locale={locale} area="admin"><RefundsAdmin /></StaffGate>;
}
