"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { fieldErrorText, fieldRequest, newClientId } from "@/lib/field-client";
import { IncidentForm } from "./incident-form";
import { BAG_SIZE_KO, BAG_STATUS_KO } from "./labels";
import { TagInput } from "./tag-input";

export interface PartnerJob {
  jobId: string;
  orderCode: string;
  customerName: string | null;
  pickupWindow: string;
  bags: { tagId: string; seq: number; size: string; status: string; version: number }[];
}

/**
 * 호텔 프런트: 예약 고객의 짐을 받아 태그를 확인하고 보관 확정(origin_received)한다.
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
      setBusy(true);
      const result = await fieldRequest("/api/v1/bags/events", "POST", {
        tagId: tag,
        jobId: job.jobId,
        eventType: "origin_received",
        clientEventId: newClientId(),
        deviceOccurredAt: new Date().toISOString(),
        expectedVersion: bag.version,
      });
      setBusy(false);
      if (result.ok) {
        setMessage({ tone: "ok", text: `${job.orderCode} ${bag.seq}번 짐 보관 확정` });
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
        <h2 className="mb-2 font-semibold">짐 태그 확인 후 보관</h2>
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
            <span className="font-semibold">{job.orderCode}</span>
            <span className="text-sm">{job.customerName}</span>
          </div>
          <p className="text-sm text-muted">기사 수거 {job.pickupWindow} (한국 시간)</p>
          <ul className="flex flex-col gap-1 text-sm">
            {job.bags.map((bag) => (
              <li key={bag.tagId} className="flex items-center justify-between gap-2">
                <span>
                  {bag.seq}번 · {BAG_SIZE_KO[bag.size] ?? bag.size} · <span className="font-mono text-xs">{bag.tagId}</span>
                </span>
                {bag.status === "registered" ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => receive(bag.tagId)}
                    className="min-h-11 rounded-[var(--radius-button)] border border-line px-3"
                  >
                    보관 확정
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
