import { HotelCreateForm } from "@/components/admin/hotel-create-form";
import { HotelStatusSelect } from "@/components/admin/hotel-status-select";
import { ADMIN_LABELS } from "@/components/admin/labels";
import { StaffGate } from "@/components/staff-gate";
import { resolveLocale } from "@/lib/request-context";
import { getViewer } from "@/server/auth";

interface HotelRow {
  id: string;
  slug: string;
  name_ko: string;
  address_ko: string;
  status: "draft" | "active" | "suspended" | "archived";
  service_zones: { name_ko: string } | null;
}

async function HotelAdmin() {
  const viewer = await getViewer();
  const client = viewer.client!;
  const isAdmin = viewer.roles.some((r) => r.role === "admin");
  // 업무자 세션으로 조회한다. RLS가 역할에 맞는 범위(비활성 포함)를 돌려준다.
  const [hotels, zones] = await Promise.all([
    client.from("hotels").select("id, slug, name_ko, address_ko, status, service_zones(name_ko)").order("name_ko"),
    client.from("service_zones").select("id, name_ko, kind").eq("kind", "area").order("sort_order"),
  ]);

  return (
    <section className="flex flex-col gap-4" lang="ko">
      <h1 className="text-xl font-bold">{ADMIN_LABELS.hotels}</h1>
      {!isAdmin ? <p className="text-sm text-muted">{ADMIN_LABELS.readOnly}</p> : null}
      {hotels.error ? (
        <p role="alert">{ADMIN_LABELS.loadFailed}</p>
      ) : hotels.data.length === 0 ? (
        <p className="text-muted">{ADMIN_LABELS.empty}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {(hotels.data as unknown as HotelRow[]).map((hotel) => (
            <li
              key={hotel.id}
              className="flex flex-col gap-2 rounded-[var(--radius-card)] border border-line bg-card p-4 md:flex-row md:items-center md:justify-between"
            >
              <div>
                <p className="font-semibold">{hotel.name_ko}</p>
                <p className="text-sm text-muted">
                  {hotel.service_zones?.name_ko} · {hotel.address_ko} · {hotel.slug}
                </p>
              </div>
              {isAdmin ? (
                <HotelStatusSelect hotelId={hotel.id} status={hotel.status} />
              ) : (
                <span className="text-sm">{ADMIN_LABELS.status[hotel.status]}</span>
              )}
            </li>
          ))}
        </ul>
      )}
      {isAdmin && !zones.error ? (
        <div className="rounded-[var(--radius-card)] border border-line bg-card p-4">
          <HotelCreateForm zones={zones.data.map((z) => ({ id: z.id, name: z.name_ko }))} />
        </div>
      ) : null}
    </section>
  );
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const locale = await resolveLocale(params);
  return (
    <StaffGate locale={locale} area="admin">
      <HotelAdmin />
    </StaffGate>
  );
}
