import Link from "next/link";
import { StaffGate } from "@/components/staff-gate";
import { resolveLocale } from "@/lib/request-context";
import { getViewer } from "@/server/auth";

export default async function AdminOrders({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ status?: string }> }) {
  const locale = await resolveLocale(params);
  const { status } = await searchParams;
  const viewer = await getViewer();
  const allowed = viewer.client && viewer.roles.some((role) => role.role === "admin");
  const statuses = ["all", "held", "confirmed", "needs_review", "cancelled", "expired"];
  const query = allowed ? viewer.client!.from("orders").select("id, public_code, reservation_status, route_type, total_minor, currency, created_at").order("created_at", { ascending: false }).limit(100) : null;
  const { data } = query ? await (status && statuses.includes(status) && status !== "all" ? query.eq("reservation_status", status) : query) : { data: [] };
  return <StaffGate locale={locale} area="admin"><section className="admin-data-page"><header><span>BOOKINGS</span><h1>예약 관리</h1><p>최근 예약 100건과 결제·배송 검토 상태를 확인합니다.</p></header><nav className="admin-data-page__filters" aria-label="예약 상태">{statuses.map((value) => <Link key={value} href={`/${locale}/admin/orders?status=${value}`} aria-current={(status || "all") === value ? "page" : undefined}>{value}</Link>)}</nav><div className="admin-data-page__table"><table><thead><tr><th>예약 번호</th><th>노선</th><th>상태</th><th>금액</th><th>예약 시각</th></tr></thead><tbody>{data?.map((order) => <tr key={order.id}><td><Link href={`/${locale}/orders/${order.id}`}>{order.public_code} ↗</Link></td><td>{order.route_type}</td><td><span className="admin-data-page__status">{order.reservation_status}</span></td><td>{new Intl.NumberFormat("ko-KR").format(order.total_minor)} {order.currency}</td><td>{new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", dateStyle: "medium", timeStyle: "short" }).format(new Date(order.created_at))}</td></tr>)}</tbody></table>{!data?.length ? <p>해당 상태의 예약이 없습니다.</p> : null}</div></section></StaffGate>;
}
