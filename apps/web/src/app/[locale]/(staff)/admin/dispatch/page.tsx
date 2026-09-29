import Link from "next/link";
import { AssignDriver } from "@/components/admin/assign-driver";
import { INCIDENT_TYPE_KO, JOB_STATUS_KO } from "@/components/field/labels";
import { StaffGate } from "@/components/staff-gate";
import { resolveLocale } from "@/lib/request-context";
import { getViewer } from "@/server/auth";
import { kstTime, kstToday } from "@/server/field";

interface JobRow {
  id: string;
  status: string;
  order_id: string;
  order: { public_code: string } | null;
  slot: { service_date: string; pickup_starts_at: string; pickup_ends_at: string; delivery_ends_at: string };
  origin: { name_ko: string } | null;
  assignments: { driver_id: string; released_at: string | null }[];
}

/**
 * 운영 현황: 오늘 작업·배차, 미해결 사고, 운영 확인 필요 주문, 열린 문의.
 * 목록만으로 운영할 수 있게 한다 (지도는 보조).
 */
async function Dispatch({ locale, date }: { locale: string; date: string }) {
  const viewer = await getViewer();
  const client = viewer.client!;
  const canAssign = viewer.roles.some((r) => r.role === "dispatcher" || r.role === "admin");

  const [jobs, drivers, incidents, reviews, tickets] = await Promise.all([
    client
      .from("delivery_jobs")
      .select(
        "id, status, order_id, order:orders!delivery_jobs_order_id_fkey(public_code), slot:service_slots!inner(service_date, pickup_starts_at, pickup_ends_at, delivery_ends_at), origin:hotels!delivery_jobs_origin_hotel_id_fkey(name_ko), assignments:job_assignments(driver_id, released_at)",
      )
      .eq("slot.service_date", date)
      .neq("status", "cancelled"),
    canAssign ? client.rpc("list_drivers") : Promise.resolve({ data: [] }),
    client.from("incidents").select("id, type, severity, description, created_at, order_id").neq("status", "resolved").order("severity", { ascending: false }).limit(20),
    client.from("orders").select("id, public_code, reservation_status, updated_at").eq("reservation_status", "needs_review").limit(20),
    client.from("support_tickets").select("id, subject, locale, status, created_at").neq("status", "resolved").order("created_at").limit(20),
  ]);

  const jobRows = ((jobs.data ?? []) as unknown as JobRow[]).sort((a, b) => a.slot.pickup_starts_at.localeCompare(b.slot.pickup_starts_at));
  const orderIds = jobRows.map((j) => j.order_id);
  const { data: bags } = orderIds.length
    ? await client.from("bags").select("order_id, bag_status").in("order_id", orderIds)
    : { data: [] as { order_id: string; bag_status: string }[] };
  const driverList = ((drivers.data ?? []) as { user_id: string; display_name: string }[]).map((d) => ({ id: d.user_id, name: d.display_name }));

  const card = "rounded-[var(--radius-card)] border border-line bg-card p-4";
  return (
    <div className="flex flex-col gap-5" lang="ko">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold">배차·운영 현황</h1>
        <form className="flex gap-2">
          <input type="date" name="date" defaultValue={date} className="min-h-11 rounded-[var(--radius-button)] border border-line bg-card px-2" />
          <button className="min-h-11 rounded-[var(--radius-button)] border border-line px-3 text-sm">조회</button>
        </form>
      </div>

      <section className="flex flex-col gap-2" aria-labelledby="jobs-title">
        <h2 id="jobs-title" className="font-semibold">
          {date} 작업 {jobRows.length}건
        </h2>
        {jobRows.length === 0 ? <p className="text-muted">작업이 없습니다.</p> : null}
        {jobRows.map((job) => {
          const orderBags = (bags ?? []).filter((b) => b.order_id === job.order_id && b.bag_status !== "cancelled_before_pickup");
          const delivered = orderBags.filter((b) => b.bag_status === "delivered").length;
          const current = job.assignments.find((a) => a.released_at === null)?.driver_id ?? null;
          return (
            <div key={job.id} className={`${card} flex flex-col gap-2 md:flex-row md:items-center md:justify-between`} data-testid="dispatch-job">
              <div>
                <p className="font-semibold">
                  {job.order?.public_code} · {job.origin?.name_ko}
                </p>
                <p className="text-sm text-muted">
                  수거 {kstTime(job.slot.pickup_starts_at)}–{kstTime(job.slot.pickup_ends_at)} · 도착 {kstTime(job.slot.delivery_ends_at)}까지 ·{" "}
                  {JOB_STATUS_KO[job.status] ?? job.status} · 인계 {delivered}/{orderBags.length}개
                </p>
              </div>
              {canAssign ? <AssignDriver jobId={job.id} currentDriverId={current} drivers={driverList} /> : null}
            </div>
          );
        })}
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className={card}>
          <h2 className="mb-2 font-semibold">미해결 사고 {incidents.data?.length ?? 0}</h2>
          <ul className="flex flex-col gap-2 text-sm">
            {(incidents.data ?? []).map((incident) => (
              <li key={incident.id}>
                <span className={incident.severity === 3 ? "font-semibold text-warm" : "font-medium"}>{INCIDENT_TYPE_KO[incident.type] ?? incident.type}</span>
                <span className="block text-muted">{incident.description}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className={card}>
          <h2 className="mb-2 font-semibold">운영 확인 필요 주문 {reviews.data?.length ?? 0}</h2>
          <ul className="flex flex-col gap-1 text-sm">
            {(reviews.data ?? []).map((order) => (
              <li key={order.id} className="font-mono">
                {order.public_code}
              </li>
            ))}
          </ul>
        </div>
        <div className={card}>
          <h2 className="mb-2 font-semibold">열린 문의 {tickets.data?.length ?? 0}</h2>
          <ul className="flex flex-col gap-1 text-sm">
            {(tickets.data ?? []).map((ticket) => (
              <li key={ticket.id}>
                <Link href={`/${locale}/admin/support/${ticket.id}`} className="inline-flex min-h-11 items-center text-primary underline">
                  [{ticket.locale}] {ticket.subject}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  const locale = await resolveLocale(params);
  const { date } = await searchParams;
  const day = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : kstToday(0);
  return (
    <StaffGate locale={locale} area="admin">
      <Dispatch locale={locale} date={day} />
    </StaffGate>
  );
}
