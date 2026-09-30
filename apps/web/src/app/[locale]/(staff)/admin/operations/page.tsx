import { OperationsManager } from "@/components/admin/operations-manager";
import { StaffGate } from "@/components/staff-gate";
import { resolveLocale } from "@/lib/request-context";
import { getViewer } from "@/server/auth";

async function OperationsAdmin() {
  const viewer = await getViewer();
  const isAdmin = viewer.roles.some((role) => role.role === "admin");
  if (!isAdmin || !viewer.client) return <p className="rounded-[var(--radius-card)] border border-line bg-card p-5">관리자 권한이 필요합니다.</p>;
  const client = viewer.client;
  const [zones, offerings, prices, slots] = await Promise.all([
    client.from("service_zones").select("id, code, name_ko, display_names, status").order("sort_order"),
    client.from("route_offerings").select("id, route_type, origin:service_zones!route_offerings_origin_zone_id_fkey(name_ko), destination:service_zones!route_offerings_destination_zone_id_fkey(name_ko)").order("route_type"),
    client.from("price_rules").select("id, route_offering_id, bag_size, unit_amount_minor, valid_from, valid_until, status").order("valid_from", { ascending: false }).limit(60),
    client.from("service_slots").select("id, route_offering_id, service_date, pickup_starts_at, delivery_ends_at, status, capacity_buckets(max_units, held_units, committed_units)").gte("service_date", new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" })).order("service_date").limit(60),
  ]);
  const error = zones.error || offerings.error || prices.error || slots.error;
  return <section className="admin-dashboard" lang="ko"><div className="admin-dashboard__intro"><div><span>AVAILABILITY / OPERATIONS</span><h1>운영 권역·요금·슬롯</h1><p>판매 가능한 노선의 권역, 짐별 요금과 실제 예약 용량을 관리합니다. 변경 내역은 운영 감사 로그에 남습니다.</p></div></div>{error ? <p role="alert">운영 데이터를 불러오지 못했습니다.</p> : <OperationsManager zones={zones.data ?? []} offerings={(offerings.data ?? []) as unknown as Parameters<typeof OperationsManager>[0]["offerings"]} prices={prices.data ?? []} slots={slots.data ?? []} />}</section>;
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const locale = await resolveLocale(params);
  return <StaffGate locale={locale} area="admin"><OperationsAdmin /></StaffGate>;
}
