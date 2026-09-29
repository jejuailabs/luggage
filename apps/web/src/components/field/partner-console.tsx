"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { fieldErrorText, fieldRequest, newClientId } from "@/lib/field-client";
import { IncidentForm } from "./incident-form";
import { BAG_SIZE_KO, BAG_STATUS_KO } from "./labels";
import { TagInput } from "./tag-input";

export interface PartnerJob {
  jobId: string;
  /** pickup: 고객이 맡기는 짐 / dropoff: 기사가 이 호텔로 배송하는 짐 */
  direction: "pickup" | "dropoff";
  orderCode: string;
  customerName: string | null;
  window: string;
  bags: { tagId: string; seq: number; size: string; status: string; version: number }[];
}

/**
 * 호텔 프런트:
 * - 맡기는 짐(pickup): 태그를 확인하고 보관 확정(origin_received)
 * - 도착하는 짐(dropoff): 기사가 가져온 짐의 태그를 확인하고 인수(delivered)
 * 짐 수가 예약과 다르면 사고(수량 불일치)로 보고한다.
 */
export function PartnerConsole({ jobs }: { jobs: PartnerJob[] }) {
  const router = useRouter();
  const [message, setMessage] = useState<{ tone: "ok" | "warn"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const receive = useCallback(
    async (tag: string) => {
      const job = jobs.find((j) => j.bags.some((b) => b.tagId === tag));
      const bag = job?.bags.find((b) => b.tagId === tag);
      if (!job || !bag) {
        setMessage({ tone: "warn", text: `${tag}: 오늘 이 지점 예약의 짐이 아닙니다.` });
        return;
      }
      const eventType = job.direction === "dropoff" ? "delivered" : "origin_received";
      setBusy(true);
      const result = await fieldRequest("/api/v1/bags/events", "POST", {
        tagId: tag,
        jobId: job.jobId,
        eventType,
        clientEventId: newClientId(),
        deviceOccurredAt: new Date().toISOString(),
        expectedVersion: bag.version,
      });
      setBusy(false);
      if (result.ok) {
        setMessage({ tone: "ok", text: `${job.orderCode} ${bag.seq}번 짐 ${job.direction === "dropoff" ? "인수 완료" : "보관 확정"}` });
        router.refresh();
      } else {
        setMessage({ tone: "warn", text: result.network ? "네트워크가 없습니다. 연결 후 다시 확인하세요." : fieldErrorText(result.code) });
      }
    },
    [jobs, router],
  );

  const card = "rounded-[var(--radius-card)] border border-line bg-card p-4";
  return (
    <div className="flex flex-col gap-4" lang="ko" data-testid="partner-console">
      <section className={card}>
        <h2 className="mb-2 font-semibold">짐 태그 확인 (맡김 보관 · 도착 인수)</h2>
        <TagInput onTag={receive} disabled={busy} />
      </section>
      {message ? (
        <p role={message.tone === "warn" ? "alert" : "status"} className={message.tone === "warn" ? "text-sm text-warm" : "text-sm"}>
          {message.text}
        </p>
      ) : null}
      {jobs.length === 0 ? <p className="text-muted">오늘·내일 예약이 없습니다.</p> : null}
      {jobs.map((job) => (
        <section key={job.jobId} className={`${card} flex flex-col gap-2`} data-testid="partner-job">
          <div className="flex justify-between">
            <span className="font-semibold">
              {job.direction === "dropoff" ? "[도착] " : "[맡김] "}
              {job.orderCode}
            </span>
            <span className="text-sm">{job.customerName}</span>
          </div>
          <p className="text-sm text-muted">
            {job.direction === "dropoff" ? "도착 예정" : "기사 수거"} {job.window} (한국 시간)
          </p>
          <ul className="flex flex-col gap-1 text-sm">
            {job.bags.map((bag) => (
              <li key={bag.tagId} className="flex items-center justify-between gap-2">
                <span>
                  {bag.seq}번 · {BAG_SIZE_KO[bag.size] ?? bag.size} · <span className="font-mono text-xs">{bag.tagId}</span>
                </span>
                {(job.direction === "pickup" && bag.status === "registered") ||
                (job.direction === "dropoff" && bag.status === "ready_for_handoff") ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => receive(bag.tagId)}
                    className="min-h-11 rounded-[var(--radius-button)] border border-line px-3"
                  >
                    {job.direction === "dropoff" ? "인수" : "보관 확정"}
                  </button>
                ) : (
                  <span>{BAG_STATUS_KO[bag.status] ?? bag.status}</span>
                )}
              </li>
            ))}
          </ul>
          <IncidentForm jobId={job.jobId} tags={job.bags.map((b) => b.tagId)} />
        </section>
      ))}
    </div>
  );
}
