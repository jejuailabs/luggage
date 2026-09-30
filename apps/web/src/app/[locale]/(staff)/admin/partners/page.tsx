import { PartnerManager } from "@/components/admin/partner-manager";
import { StaffGate } from "@/components/staff-gate";
import { resolveLocale } from "@/lib/request-context";
import { getViewer } from "@/server/auth";

export default async function AdminPartners({ params }: { params: Promise<{ locale: string }> }) {
  const locale = await resolveLocale(params);
  const viewer = await getViewer();
  const { data } = viewer.client && viewer.roles.some((role) => role.role === "admin") ? await viewer.client.from("hotel_partners").select("id, name, status, contract_reference, created_at").order("created_at", { ascending: false }) : { data: [] };
  return <StaffGate locale={locale} area="admin"><section className="admin-data-page"><header><span>PARTNERSHIPS</span><h1>고객사·제휴 관리</h1><p>제휴사를 등록하고 계약 준비·운영 상태를 관리합니다. 지점은 숙소 관리에서 연결합니다.</p></header><PartnerManager partners={data ?? []} /></section></StaffGate>;
}
