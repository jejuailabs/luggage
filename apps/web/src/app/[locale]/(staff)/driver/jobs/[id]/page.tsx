import Link from "next/link";
import { DriverJobConsole } from "@/components/field/driver-job-console";
import { LocationShare } from "@/components/field/location-share";
import { JOB_STATUS_KO } from "@/components/field/labels";
import { StaffGate } from "@/components/staff-gate";
import { resolveLocale } from "@/lib/request-context";
import { getViewer } from "@/server/auth";
import { kstDate, kstTime, loadFieldJob } from "@/server/field";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function JobDetail({ locale, id }: { locale: string; id: string }) {
  const viewer = await getViewer();
  // 배정이 끝난 기사는 RLS에서 행을 받지 못한다.
  const job = UUID.test(id) ? await loadFieldJob(viewer.client!, id) : null;
  if (!job) {
    return (
      <section lang="ko" className="rounded-[var(--radius-card)] border border-line bg-card p-4" data-testid="job-not-found">
        <p>작업이 없거나 현재 배정되지 않았습니다.</p>
        <Link href={`/${locale}/driver`} className="mt-2 inline-flex min-h-11 items-center text-primary">
          작업 목록
        </Link>
      </section>
    );
  }
  return (
    <div className="flex flex-col gap-4" lang="ko">
      <section className="rounded-[var(--radius-card)] bg-sea px-4 py-4">
        <p className="text-sm text-muted">{JOB_STATUS_KO[job.status] ?? job.status}</p>
        <h1 className="text-xl font-bold">
          {job.originHotel ?? "제주공항"} → {job.destinationHotel ?? "제주공항"}
        </h1>
        <p className="text-sm">
          수거 {kstDate(job.slot.pickupStartsAt)} {kstTime(job.slot.pickupStartsAt)}–{kstTime(job.slot.pickupEndsAt)} ·{" "}
          {job.destinationHotel ? "숙소 도착" : "공항 인계"}{" "}
          {kstTime(job.slot.deliveryStartsAt)}–{kstTime(job.slot.deliveryEndsAt)} (한국 시간)
        </p>
      </section>
      {["assigned", "picking_up", "transporting", "ready"].includes(job.status) ? <LocationShare jobId={job.id} /> : null}
      <DriverJobConsole jobId={job.id} bags={job.bags} destination={job.destinationHotel ? "hotel" : "airport"} />
    </div>
  );
}

export default async function Page({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const locale = await resolveLocale(params);
  const { id } = await params;
  return (
    <StaffGate locale={locale} area="driver">
      <JobDetail locale={locale} id={id} />
    </StaffGate>
  );
}
