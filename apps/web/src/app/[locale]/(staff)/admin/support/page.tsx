import Link from "next/link";
import { StaffGate } from "@/components/staff-gate";
import { resolveLocale } from "@/lib/request-context";
import { getViewer } from "@/server/auth";

export default async function AdminSupport({ params }: { params: Promise<{ locale: string }> }) {
  const locale = await resolveLocale(params);
  const viewer = await getViewer();
  const { data } = viewer.client && viewer.roles.some((role) => role.role === "admin") ? await viewer.client.from("support_tickets").select("id, subject, status, created_at, order_id").order("created_at", { ascending: false }).limit(100) : { data: [] };
  return <StaffGate locale={locale} area="admin"><section className="admin-data-page"><header><span>CUSTOMER CARE</span><h1>고객지원</h1><p>문의와 배송 문제를 확인하고 각 스레드에서 응대합니다.</p></header><div className="admin-data-page__table"><table><thead><tr><th>문의</th><th>상태</th><th>예약</th><th>접수 시각</th></tr></thead><tbody>{data?.map((ticket) => <tr key={ticket.id}><td><Link href={`/${locale}/admin/support/${ticket.id}`}>{ticket.subject} ↗</Link></td><td><span className="admin-data-page__status">{ticket.status}</span></td><td>{ticket.order_id ? <Link href={`/${locale}/orders/${ticket.order_id}`}>예약 보기 ↗</Link> : "—"}</td><td>{new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", dateStyle: "medium", timeStyle: "short" }).format(new Date(ticket.created_at))}</td></tr>)}</tbody></table>{!data?.length ? <p>접수된 문의가 없습니다.</p> : null}</div></section></StaffGate>;
}
