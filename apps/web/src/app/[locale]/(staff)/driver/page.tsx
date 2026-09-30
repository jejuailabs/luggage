import { DriverJobList, type DriverJobSummary } from "@/components/field/driver-job-list";
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
  const summaries: DriverJobSummary[] = jobs.map((job) => ({ jobId: job.job_id, orderCode: job.order_code, status: job.job_status, origin: job.origin_hotel_name ?? "제주공항", destination: job.destination_hotel_name ?? "제주공항", pickupWindow: `${kstDate(job.pickup_starts_at)} ${kstTime(job.pickup_starts_at)}–${kstTime(job.pickup_ends_at)}`, deliveryWindow: `${kstTime(job.delivery_starts_at)}–${kstTime(job.delivery_ends_at)}`, bagCount: job.bag_count }));
  return (
    <section className="flex flex-col gap-3" lang="ko">
      <h1 className="text-xl font-bold">기사 작업</h1>
      {error ? <p role="alert">작업을 불러오지 못했습니다.</p> : null}
      {!error ? <DriverJobList locale={locale} driverId={viewer.user!.id} jobs={summaries} /> : null}
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
