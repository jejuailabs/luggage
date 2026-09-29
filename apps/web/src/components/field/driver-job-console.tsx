"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { enqueue, fieldErrorText, fieldRequest, flushQueue, newClientId, readQueue, uploadEvidence } from "@/lib/field-client";
import { IncidentForm } from "./incident-form";
import { BAG_SIZE_KO, BAG_STATUS_KO } from "./labels";
import { TagInput } from "./tag-input";

export interface ConsoleBag {
  tagId: string;
  seq: number;
  size: string;
  status: string;
  version: number;
}

const NEXT_ACTION: Record<string, { event: string; label: string } | undefined> = {
  registered: { event: "collected", label: "수거" },
  at_origin: { event: "collected", label: "수거" },
  collected: { event: "loaded", label: "차량 적재" },
  in_transit: { event: "ready_for_handoff", label: "도착지 인계 준비" },
};

export function DriverJobConsole({
  jobId,
  bags,
  destination = "airport",
}: {
  jobId: string;
  bags: ConsoleBag[];
  /** 공항 인계는 고객 수령 코드, 숙소 도착은 도착 호텔 직원이 태그로 인수한다. */
  destination?: "airport" | "hotel";
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "ok" | "warn"; text: string } | null>(null);
  const [pending, setPending] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [photos, setPhotos] = useState<Record<string, string[]>>({});
  const [reason, setReason] = useState("");
  const [online, setOnline] = useState(true);

  const refreshPending = useCallback(() => {
    setPending(readQueue().map((item) => String(item.body.tagId)));
  }, []);

  // 연결이 돌아오면 대기 이벤트를 같은 ID로 다시 보낸다.
  useEffect(() => {
    const sync = async () => {
      setOnline(navigator.onLine);
      if (!navigator.onLine || readQueue().length === 0) return refreshPending();
      const result = await flushQueue();
      refreshPending();
      if (result.rejected.length > 0) {
        setMessage({ tone: "warn", text: `서버가 거절한 기록 ${result.rejected.length}건: ${fieldErrorText(result.rejected[0]!.code)}` });
      }
      if (result.sent > 0) router.refresh();
    };
    void sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, [refreshPending, router]);

  const onTag = useCallback(
    (tag: string) => {
      if (bags.some((bag) => bag.tagId === tag)) {
        setSelected(tag);
        setMessage(null);
      } else {
        // 다른 작업의 짐을 현재 주문에 붙이지 않는다.
        setMessage({ tone: "warn", text: `${tag}: ${fieldErrorText("BAG_NOT_IN_JOB")}` });
      }
    },
    [bags],
  );

  async function attachPhoto(tag: string, file: File) {
    setBusy(true);
    const result = await uploadEvidence({ jobId, tagId: tag, purpose: "collection_photo", file });
    setBusy(false);
    if (!result.ok) {
      setMessage({ tone: "warn", text: fieldErrorText(result.code) });
      return;
    }
    setPhotos((prev) => ({ ...prev, [tag]: [...(prev[tag] ?? []), result.data.evidenceId] }));
  }

  async function act(bag: ConsoleBag, eventType: string) {
    const body = {
      tagId: bag.tagId,
      jobId,
      eventType,
      clientEventId: newClientId(),
      deviceOccurredAt: new Date().toISOString(),
      expectedVersion: bag.version,
      evidenceIds: photos[bag.tagId] ?? [],
      note: reason.trim() || undefined,
    };
    setBusy(true);
    const result = await fieldRequest("/api/v1/bags/events", "POST", body);
    setBusy(false);
    if (result.ok) {
      setMessage({ tone: "ok", text: `${bag.seq}번 짐: 서버에 기록됐습니다.` });
      setReason("");
      router.refresh();
      return;
    }
    if (result.network) {
      // 서버 확정 전이다. 완료로 표시하지 않는다.
      enqueue({ clientEventId: body.clientEventId, body, queuedAt: new Date().toISOString() });
      refreshPending();
      setMessage({ tone: "warn", text: `${bag.seq}번 짐: 네트워크 없음 — 동기화 대기 (아직 확정 아님)` });
      return;
    }
    setMessage({ tone: "warn", text: fieldErrorText(result.code) });
  }

  const card = "rounded-[var(--radius-card)] border border-line bg-card p-4";

  return (
    <div className="flex flex-col gap-4" lang="ko" data-testid="driver-console">
      {!online ? (
        <p role="status" className="rounded-[var(--radius-button)] bg-warm px-3 py-2 text-sm text-bg">
          오프라인: 스캔은 기기에 임시 저장되고, 수령 코드 인계는 할 수 없습니다.
        </p>
      ) : null}
      <section className={card}>
        <h2 className="mb-2 font-semibold">태그 확인</h2>
        <TagInput onTag={onTag} disabled={busy} />
      </section>

      {message ? (
        <p role={message.tone === "warn" ? "alert" : "status"} className={message.tone === "warn" ? "text-sm text-warm" : "text-sm"} data-testid="driver-message">
          {message.text}
        </p>
      ) : null}

      <ul className="flex flex-col gap-3">
        {bags.map((bag) => {
          const next = NEXT_ACTION[bag.status];
          const isPending = pending.includes(bag.tagId);
          const needsEvidence = next?.event === "collected";
          return (
            <li
              key={bag.tagId}
              className={`${card} flex flex-col gap-2 ${selected === bag.tagId ? "border-primary" : ""}`}
              data-testid="driver-bag"
              data-status={bag.status}
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold">
                  {bag.seq}번 · {BAG_SIZE_KO[bag.size] ?? bag.size}
                </span>
                <span className="text-sm">{isPending ? "동기화 대기" : (BAG_STATUS_KO[bag.status] ?? bag.status)}</span>
              </div>
              <span className="font-mono text-xs text-muted">{bag.tagId}</span>
              {next && selected === bag.tagId ? (
                <div className="flex flex-col gap-2">
                  {needsEvidence ? (
                    <>
                      <label className="flex flex-col gap-1 text-sm">
                        <span>외관 사진 {photos[bag.tagId]?.length ? `(${photos[bag.tagId]!.length}장 첨부)` : ""}</span>
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          disabled={busy}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) void attachPhoto(bag.tagId, file);
                            e.target.value = "";
                          }}
                        />
                      </label>
                      <label className="flex flex-col gap-1 text-sm">
                        <span>사진을 못 찍는 경우 사유</span>
                        <input
                          value={reason}
                          onChange={(e) => setReason(e.target.value)}
                          maxLength={200}
                          className="min-h-11 rounded-[var(--radius-button)] border border-line bg-bg px-3"
                        />
                      </label>
                    </>
                  ) : null}
                  <button
                    type="button"
                    disabled={busy || isPending || (needsEvidence && !photos[bag.tagId]?.length && !reason.trim())}
                    onClick={() => act(bag, next.event)}
                    className="min-h-12 rounded-[var(--radius-button)] bg-primary px-4 font-semibold text-on-primary disabled:opacity-50"
                    data-testid={`action-${next.event}`}
                  >
                    {next.label}
                  </button>
                </div>
              ) : next ? (
                <p className="text-xs text-muted">태그를 스캔하거나 입력하면 다음 단계({next.label})를 진행할 수 있습니다.</p>
              ) : null}
            </li>
          );
        })}
      </ul>

      {destination === "airport" ? (
        <HandoffForm jobId={jobId} readyBags={bags.filter((b) => b.status === "ready_for_handoff")} online={online} />
      ) : bags.some((b) => b.status === "ready_for_handoff") ? (
        <p className="rounded-[var(--radius-card)] border border-line bg-card p-4 text-sm">
          도착 호텔 프런트 직원이 태그를 확인하고 인수 처리하면 인계가 완료됩니다.
        </p>
      ) : null}
      <IncidentForm jobId={jobId} tags={bags.map((b) => b.tagId)} />
    </div>
  );
}

function HandoffForm({ jobId, readyBags, online }: { jobId: string; readyBags: ConsoleBag[]; online: boolean }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [clientEventId] = useState(newClientId);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  if (readyBags.length === 0) return null;

  return (
    <section className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-line bg-card p-4" data-testid="handoff-form">
      <h2 className="font-semibold">고객 인계 (수령 코드)</h2>
      <p className="text-xs text-muted">고객 화면의 6자리 수령 코드를 입력하고, 실제로 건네는 짐만 선택하세요. 인터넷 연결이 필요합니다.</p>
      <input
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
        inputMode="numeric"
        placeholder="수령 코드 6자리"
        className="min-h-11 rounded-[var(--radius-button)] border border-line bg-bg px-3 font-mono tracking-widest"
      />
      {readyBags.map((bag) => (
        <label key={bag.tagId} className="flex min-h-11 items-center gap-3 text-sm">
          <input
            type="checkbox"
            className="size-5"
            checked={chosen.has(bag.tagId)}
            onChange={(e) => {
              const next = new Set(chosen);
              if (e.target.checked) next.add(bag.tagId);
              else next.delete(bag.tagId);
              setChosen(next);
            }}
          />
          {bag.seq}번 · <span className="font-mono">{bag.tagId}</span>
        </label>
      ))}
      <button
        type="button"
        disabled={!online || busy || code.length !== 6 || chosen.size === 0}
        onClick={async () => {
          setBusy(true);
          setMessage(null);
          const result = await fieldRequest<{ deliveredCount: number }>("/api/v1/handoffs/verify", "POST", {
            jobId,
            code,
            tagIds: [...chosen],
            clientEventId,
          });
          setBusy(false);
          if (result.ok) {
            setMessage(`${result.data.deliveredCount}개 인계 완료 (서버 확인)`);
            router.refresh();
          } else {
            setMessage(fieldErrorText(result.code));
          }
        }}
        className="min-h-12 rounded-[var(--radius-button)] bg-primary px-4 font-semibold text-on-primary disabled:opacity-50"
      >
        {online ? "코드 확인 후 인계 완료" : "오프라인 — 인계 불가"}
      </button>
      {message ? (
        <p role="status" className="text-sm">
          {message}
        </p>
      ) : null}
    </section>
  );
}
