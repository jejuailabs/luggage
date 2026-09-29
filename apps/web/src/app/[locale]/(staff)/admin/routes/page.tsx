import { ADMIN_LABELS } from "@/components/admin/labels";
import { RouteToggle } from "@/components/admin/route-toggle";
import { StaffGate } from "@/components/staff-gate";
import { resolveLocale } from "@/lib/request-context";
import { getViewer } from "@/server/auth";

interface RouteRow {
  id: string;
  route_type: keyof typeof ADMIN_LABELS.route;
  enabled: boolean;
  origin: { name_ko: string } | null;
  destination: { name_ko: string } | null;
}

async function RouteAdmin() {
  const viewer = await getViewer();
  const isAdmin = viewer.roles.some((r) => r.role === "admin");
  const { data, error } = await viewer
    .client!.from("route_offerings")
    .select(
      "id, route_type, enabled, origin:service_zones!route_offerings_origin_zone_id_fkey(name_ko), destination:service_zones!route_offerings_destination_zone_id_fkey(name_ko)",
    )
    .order("route_type");

  return (
    <section className="flex flex-col gap-4" lang="ko">
      <h1 className="text-xl font-bold">{ADMIN_LABELS.routes}</h1>
      {!isAdmin ? <p className="text-sm text-muted">{ADMIN_LABELS.readOnly}</p> : null}
      {error ? (
        <p role="alert">{ADMIN_LABELS.loadFailed}</p>
      ) : data.length === 0 ? (
        <p className="text-muted">{ADMIN_LABELS.empty}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {(data as unknown as RouteRow[]).map((route) => {
            const label = `${ADMIN_LABELS.route[route.route_type]} · ${route.origin?.name_ko} → ${route.destination?.name_ko}`;
            return (
              <li key={route.id} className="flex items-center justify-between gap-3 rounded-[var(--radius-card)] border border-line bg-card p-4">
                <span className="font-medium">{label}</span>
                {isAdmin ? (
                  <RouteToggle routeId={route.id} enabled={route.enabled} label={label} />
                ) : (
                  <span className="text-sm">{route.enabled ? ADMIN_LABELS.enabled : ADMIN_LABELS.disabled}</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const locale = await resolveLocale(params);
  return (
    <StaffGate locale={locale} area="admin">
      <RouteAdmin />
    </StaffGate>
  );
}
