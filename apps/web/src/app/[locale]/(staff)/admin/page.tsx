import Link from "next/link";
import { StaffGate } from "@/components/staff-gate";
import { resolveLocale } from "@/lib/request-context";
import { getViewer } from "@/server/auth";

export default async function AdminHome({ params }: { params: Promise<{ locale: string }> }) {
  const locale = await resolveLocale(params);
  const viewer = await getViewer();
  const client = viewer.client;
  const [orders, hotels, members, partners, tickets, jobs, recent] = client && viewer.roles.some((role) => role.role === "admin") ? await Promise.all([
    client.from("orders").select("id", { count: "exact", head: true }),
    client.from("hotels").select("id", { count: "exact", head: true }),
    client.rpc("admin_list_members"),
    client.from("hotel_partners").select("id", { count: "exact", head: true }),
    client.from("support_tickets").select("id", { count: "exact", head: true }).neq("status", "closed"),
    client.from("delivery_jobs").select("id", { count: "exact", head: true }).neq("status", "completed"),
    client.from("orders").select("id, public_code, reservation_status, created_at").order("created_at", { ascending: false }).limit(6),
  ]) : [null, null, null, null, null, null, null];
  const stats = [{ label: "전체 예약", value: orders?.count ?? "—", href: "orders" }, { label: "진행 중 배송", value: jobs?.count ?? "—", href: "dispatch" }, { label: "열린 문의", value: tickets?.count ?? "—", href: "support" }, { label: "등록 숙소", value: hotels?.count ?? "—", href: "hotels" }, { label: "회원", value: Array.isArray(members?.data) ? members.data.length : "—", href: "members" }, { label: "제휴 고객사", value: partners?.count ?? "—", href: "partners" }];
  return (
    <StaffGate locale={locale} area="admin">
      <section className="admin-dashboard">
        <div className="admin-dashboard__intro"><div><span>JEJU CONNECT / OPERATIONS</span><h1>오늘의 운영 현황</h1><p>예약, 배송, 고객 응대와 제휴 현황을 한곳에서 확인합니다.</p></div><Link href={`/${locale}/admin/dispatch`}>실시간 배송 보기 ↗</Link></div>
        <div className="admin-dashboard__stats">{stats.map((item) => <Link key={item.href} href={`/${locale}/admin/${item.href}`}><span>{item.label}</span><strong>{item.value}</strong><small>자세히 보기 ↗</small></Link>)}</div>
        <div className="admin-dashboard__grid"><section className="admin-dashboard__panel"><div><span>RECENT BOOKINGS</span><h2>최근 예약</h2></div>{recent?.data?.length ? <ul>{recent.data.map((order) => <li key={order.id}><span><strong>{order.public_code}</strong><small>{new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", dateStyle: "medium", timeStyle: "short" }).format(new Date(order.created_at))}</small></span><em>{order.reservation_status}</em></li>)}</ul> : <p>표시할 예약이 없습니다.</p>}<Link href={`/${locale}/admin/orders`}>전체 예약 관리 ↗</Link></section><section className="admin-dashboard__panel"><div><span>QUICK ACTIONS</span><h2>바로가기</h2></div><div className="admin-dashboard__quick">{[["숙소 관리", "hotels"], ["회원·권한", "members"], ["고객사·제휴", "partners"], ["고객지원", "support"], ["노선 운영", "routes"], ["운영 분석", "metrics"]].map(([label, path]) => <Link key={path} href={`/${locale}/admin/${path}`}>{label}<span>↗</span></Link>)}</div></section></div>
      </section>
    </StaffGate>
  );
}
