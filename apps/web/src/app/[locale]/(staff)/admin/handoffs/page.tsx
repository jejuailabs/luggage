import { HandoffLocationManager, type LocationRow } from "@/components/admin/handoff-location-manager";
import { StaffGate } from "@/components/staff-gate";
import { resolveLocale } from "@/lib/request-context";
import { getViewer } from "@/server/auth";
import { createSupabaseServiceClient } from "@/server/service-client";

async function HandoffAdmin() {
  const viewer = await getViewer();
  if (!viewer.roles.some((role) => role.role === "admin") || !viewer.client) return <p className="rounded-[var(--radius-card)] border border-line bg-card p-5">관리자 권한이 필요합니다.</p>;
  const [zones, locations] = await Promise.all([
    viewer.client.from("service_zones").select("id, name_ko").eq("kind", "airport").order("name_ko"),
    viewer.client.from("handoff_locations").select("id, code, type, zone_id, name_ko, floor, landmark_ko, photo_path, valid_from, valid_until, status, handoff_location_translations(locale, name, directions)").in("type", ["airport_counter", "airport_meeting_point"]).order("valid_from", { ascending: false }),
  ]);
  const service = createSupabaseServiceClient();
  const rows = await Promise.all((locations.data ?? []).map(async (row) => {
    const signed = service && row.photo_path ? await service.storage.from("evidence").createSignedUrl(row.photo_path, 600) : null;
    return { ...row, photoUrl: signed?.data?.signedUrl ?? null };
  }));
  return <section className="admin-dashboard" lang="ko"><div className="admin-dashboard__intro"><div><span>AIRPORT / HANDOFF</span><h1>공항 인계 장소</h1><p>층·출구·사진과 유효기간별 장소를 관리합니다. 운영 중 장소가 바뀌면 영향을 받는 확정 예약에 알림 작업이 쌓입니다.</p></div></div>{zones.error || locations.error ? <p role="alert">인계 장소를 불러오지 못했습니다.</p> : <HandoffLocationManager zones={zones.data ?? []} locations={rows as LocationRow[]} />}</section>;
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const locale = await resolveLocale(params);
  return <StaffGate locale={locale} area="admin"><HandoffAdmin /></StaffGate>;
}
