import { PartnerRulesManager } from "@/components/admin/partner-rules-manager";
import { StaffGate } from "@/components/staff-gate";
import { resolveLocale } from "@/lib/request-context";
import { getViewer } from "@/server/auth";

async function PartnerRules() {
  const viewer = await getViewer();
  const allowed = viewer.roles.some((role) => role.role === "admin" || role.role === "finance");
  if (!allowed || !viewer.client) return <p className="rounded-[var(--radius-card)] border border-line bg-card p-5">재무 권한이 필요합니다.</p>;
  const client = viewer.client;
  const [partners, hotels, codes, rules] = await Promise.all([
    client.from("hotel_partners").select("id, name").order("name"),
    client.from("hotels").select("id, name_ko, partner_id").order("name_ko"),
    client.from("partner_codes").select("id, code, partner_id, hotel_id, applicable_routes, valid_from, valid_until, status").order("created_at", { ascending: false }).limit(100),
    client.from("commission_rules").select("id, partner_id, kind, amount_minor, rate_bp, valid_from, valid_until, status").order("valid_from", { ascending: false }).limit(100),
  ]);
  const error = partners.error || hotels.error || codes.error || rules.error;
  return <section className="admin-dashboard" lang="ko"><div className="admin-dashboard__intro"><div><span>PARTNERS / FINANCE</span><h1>제휴 코드·수수료 규칙</h1><p>유입 코드와 계약 금액을 기간별로 관리합니다. 같은 제휴사의 수수료 기간이 겹치면 저장되지 않습니다.</p></div></div>{error ? <p role="alert">제휴 규칙을 불러오지 못했습니다.</p> : <PartnerRulesManager partners={partners.data ?? []} hotels={hotels.data ?? []} codes={codes.data ?? []} rules={rules.data ?? []} />}</section>;
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const locale = await resolveLocale(params);
  return <StaffGate locale={locale} area="admin"><PartnerRules /></StaffGate>;
}
