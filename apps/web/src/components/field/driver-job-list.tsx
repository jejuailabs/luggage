"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { deleteItem, getAll, putItem } from "@/lib/local-store";
import { JOB_STATUS_KO } from "./labels";

export type DriverJobSummary = { jobId: string; orderCode: string; status: string; origin: string; destination: string; pickupWindow: string; deliveryWindow: string; bagCount: number };
type CachedJob = DriverJobSummary & { driverId: string; checkedAt: string };

export function DriverJobList({ locale, driverId, jobs }: { locale: string; driverId: string; jobs: DriverJobSummary[] }) {
  const router = useRouter();
  const [offline, setOffline] = useState(false);
  const [cached, setCached] = useState<CachedJob[]>([]);
  useEffect(() => {
    const sync = async () => {
      const isOffline = !navigator.onLine;
      setOffline(isOffline);
      try {
        const previous = await getAll<CachedJob>("jobs");
        if (isOffline) { setCached(previous.filter((job) => job.driverId === driverId)); return; }
        const active = new Set(jobs.map((job) => job.jobId));
        for (const old of previous) if (old.driverId !== driverId || !active.has(old.jobId)) await deleteItem("jobs", old.jobId);
        const checkedAt = new Date().toISOString();
        for (const job of jobs) await putItem("jobs", job.jobId, { ...job, driverId, checkedAt });
        localStorage.setItem("luggage-active-driver-id", driverId);
        setCached(jobs.map((job) => ({ ...job, driverId, checkedAt })));
      } catch { setCached([]); }
    };
    void sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    const refresh = window.setInterval(() => { if (navigator.onLine) router.refresh(); }, 60_000);
    return () => { window.removeEventListener("online", sync); window.removeEventListener("offline", sync); window.clearInterval(refresh); };
  }, [driverId, jobs, router]);
  const visible = offline ? cached : jobs;
  return <><p className="text-sm text-muted">{offline ? "오프라인 사본입니다. 배정·상태가 바뀌었을 수 있습니다. 최종 인계는 연결 후 확인하세요." : "배정 목록은 이 기기에 최소 정보만 저장됩니다. 해제된 작업은 다음 서버 갱신 때 삭제됩니다."}</p>{visible.length === 0 ? <p className="text-muted">{offline ? "저장된 작업 사본이 없습니다." : "배정된 작업이 없습니다."}</p> : <ul className="flex flex-col gap-3">{visible.map((job) => <li key={job.jobId}><Link href={`/${locale}/driver/jobs/${job.jobId}`} className="flex flex-col gap-1 rounded-[var(--radius-card)] border border-line bg-card p-4" data-testid="driver-job"><span className="flex justify-between font-semibold"><span>{job.orderCode}</span><span className="text-sm">{JOB_STATUS_KO[job.status] ?? job.status}</span></span><span className="text-sm">{job.origin} → {job.destination} · 짐 {job.bagCount}개</span><span className="text-sm text-muted">수거 {job.pickupWindow} → 도착 {job.deliveryWindow}</span>{offline ? <span className="text-xs text-warm">마지막 서버 확인 {new Date((job as CachedJob).checkedAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })} KST</span> : null}</Link></li>)}</ul>}</>;
}
