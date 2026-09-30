import Link from "next/link";
import { PaymentReconcileAction } from "@/components/admin/payment-reconcile-action";
import { StaffGate } from "@/components/staff-gate";
import { resolveLocale } from "@/lib/request-context";
import { getViewer } from "@/server/auth";

export default async function PaymentReviews({ params }: { params: Promise<{ locale: string }> }) {
  const locale = await resolveLocale(params);
  const viewer = await getViewer();
  const finance = viewer.roles.some((role) => role.role === "finance" || role.role === "admin");
  const [{ data: orders }, { data: attempts }] = finance && viewer.client ? await Promise.all([
    viewer.client.from("orders").select("id, public_code, reservation_status, total_minor, currency, created_at").eq("reservation_status", "needs_review").order("created_at", { ascending: false }).limit(100),
    viewer.client.from("payment_attempts").select("id, order_id, provider, merchant_order_id, provider_transaction_id, amount_minor, currency, status, failure_code, created_at").in("status", ["unknown", "succeeded"]).order("created_at", { ascending: false }).limit(200),
  ]) : [{ data: [] }, { data: [] }];
  const byOrder = new Map<string, typeof attempts>();
  for (const attempt of attempts ?? []) byOrder.set(attempt.order_id, [...(byOrder.get(attempt.order_id) ?? []), attempt]);
  const suspicious = new Set((orders ?? []).map((order) => order.id));
  for (const [orderId, rows] of byOrder) if (rows?.some((row) => row.failure_code === "amount_mismatch") || (rows?.filter((row) => row.status === "succeeded").length ?? 0) > 1) suspicious.add(orderId);
  return <StaffGate locale={locale} area="admin"><section lang="ko" className="admin-dashboard"><header className="admin-dashboard__intro"><div><span>PAYMENTS / EXCEPTIONS</span><h1>결제 확인 큐</h1><p>금액 불일치, 늦은 결제, 중복 수납을 확인합니다. 재조회는 공급사 결과만 반영하며, 초과 수납은 환불 검토에서 처리합니다.</p></div></header>{!finance ? <p className="rounded-xl border border-line bg-card p-5">재무 권한이 필요합니다.</p> : suspicious.size === 0 ? <p className="rounded-xl border border-line bg-card p-5">확인이 필요한 결제가 없습니다.</p> : <div className="grid gap-4">{[...suspicious].map((orderId) => { const order = (orders ?? []).find((row) => row.id === orderId); const rows = byOrder.get(orderId) ?? []; return <article key={orderId} className="rounded-[var(--radius-card)] border border-line bg-card p-5"><div className="flex flex-wrap justify-between gap-2"><h2 className="text-lg font-bold">{order?.public_code ?? orderId}</h2><span className="text-sm text-warm">{order?.reservation_status === "needs_review" ? "예약 확인 필요" : "결제 확인 필요"}</span></div>{order ? <p className="text-sm text-muted">주문 금액 {order.total_minor.toLocaleString()} {order.currency}</p> : null}<div className="mt-3 grid gap-3">{rows.map((attempt) => <div key={attempt.id} className="rounded-xl border border-line bg-bg p-3"><p className="text-sm font-semibold">{attempt.provider} · {attempt.status} {attempt.failure_code ? `· ${attempt.failure_code}` : ""}</p><p className="text-xs text-muted">{attempt.merchant_order_id} · {attempt.amount_minor.toLocaleString()} {attempt.currency}</p><PaymentReconcileAction attemptId={attempt.id} /></div>)}</div><Link className="mt-3 inline-flex text-sm font-semibold text-primary underline" href={`/${locale}/admin/refunds`}>환불 검토 보기 →</Link></article>; })}</div>}</section></StaffGate>;
}
