import Link from "next/link";
import { JOB_STATUS_KO } from "@/components/field/labels";
import { StaffGate } from "@/components/staff-gate";
import { resolveLocale } from "@/lib/request-context";
import { getViewer } from "@/server/auth";
import { kstDate, kstTime } from "@/server/field";

interface DriverJobRow {
  job_id: string;
  job_status: string;
  order_code: string;
  customer_name: string | null;
  origin_hotel_name: string | null;
  destination_hotel_name: string | null;
  pickup_starts_at: string;
  pickup_ends_at: string;
  delivery_starts_at: string;
  delivery_ends_at: string;
  bag_count: number;
}

async function DriverJobs({ locale }: { locale: string }) {
  const viewer = await getViewer();
  const { data, error } = await viewer.client!.rpc("driver_jobs");
  const jobs = (data ?? []) as DriverJobRow[];
  return (
    <section className="flex flex-col gap-3" lang="ko">
      <h1 className="text-xl font-bold">기사 작업</h1>
      {error ? <p role="alert">작업을 불러오지 못했습니다.</p> : null}
      {!error && jobs.length === 0 ? <p className="text-muted">배정된 작업이 없습니다.</p> : null}
      <ul className="flex flex-col gap-3">
        {jobs.map((job) => (
          <li key={job.job_id}>
            <Link
              href={`/${locale}/driver/jobs/${job.job_id}`}
              className="flex flex-col gap-1 rounded-[var(--radius-card)] border border-line bg-card p-4"
              data-testid="driver-job"
            >
              <span className="flex justify-between font-semibold">
                <span>{job.order_code}</span>
                <span className="text-sm">{JOB_STATUS_KO[job.job_status] ?? job.job_status}</span>
              </span>
              <span className="text-sm">
                {job.origin_hotel_name ?? "제주공항"} → {job.destination_hotel_name ?? "제주공항"} · {job.customer_name} · 짐 {job.bag_count}개
              </span>
              <span className="text-sm text-muted">
                수거 {kstDate(job.pickup_starts_at)} {kstTime(job.pickup_starts_at)}–{kstTime(job.pickup_ends_at)} → 도착{" "}
                {kstTime(job.delivery_starts_at)}–{kstTime(job.delivery_ends_at)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const locale = await resolveLocale(params);
  return (
    <StaffGate locale={locale} area="driver">
      <DriverJobs locale={locale} />
    </StaffGate>
  );
}
