import Link from "next/link";
import { canEnterStaffArea } from "@luggage/domain";
import { resolveLocale } from "@/lib/request-context";
import { getViewer } from "@/server/auth";

const items = [
  ["", "대시보드"], ["orders", "예약"], ["dispatch", "배송·배차"], ["hotels", "숙소"], ["handoffs", "공항 인계 장소"], ["partners", "고객사·제휴"], ["partner-rules", "제휴 코드·수수료"], ["members", "회원·권한"], ["support", "고객지원"], ["routes", "노선"], ["operations", "권역·요금·슬롯"], ["content", "콘텐츠"], ["payment-reviews", "결제 확인"], ["refunds", "환불"], ["settlements", "정산"], ["campaigns", "캠페인"], ["metrics", "분석"],
] as const;

export default async function AdminLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const locale = await resolveLocale(params);
  const viewer = await getViewer();
  return <div className="admin-workspace" lang="ko">{canEnterStaffArea("admin", viewer.roles) ? <nav className="admin-workspace__nav" aria-label="운영 관리"><span className="admin-workspace__nav-title">운영 센터 <small>OPERATIONS</small></span>{items.map(([path, label]) => <Link key={path} href={`/${locale}/admin${path ? `/${path}` : ""}`}>{label}</Link>)}</nav> : null}<div className="admin-workspace__content">{children}</div></div>;
}
