"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { fieldErrorText, fieldRequest } from "@/lib/field-client";

const SETTLEMENT_ERRORS: Record<string, string> = {
  SETTLEMENT_NOT_CONFIRMABLE: "초안 상태의 정산만 확정할 수 있습니다.",
  SETTLEMENT_NOT_PAYABLE: "확정된 정산만 지급 기록할 수 있습니다.",
  PAYOUT_REFERENCE_REQUIRED: "이체 증빙 참조를 입력하세요.",
};
const errorText = (code: string) => SETTLEMENT_ERRORS[code] ?? fieldErrorText(code);

export function CreateSettlementForm({ partnerId, defaultStart, defaultEnd }: { partnerId: string; defaultStart: string; defaultEnd: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        setBusy(true);
        const result = await fieldRequest<{ totalMinor: number }>("/api/v1/settlements", "POST", {
          partnerId,
          periodStart: String(form.get("start")),
          periodEnd: String(form.get("end")),
        });
        setBusy(false);
        setMessage(result.ok ? `초안 생성: ${result.data.totalMinor.toLocaleString("ko-KR")}원` : errorText(result.code));
        router.refresh();
      }}
    >
      <label className="flex flex-col text-xs">
        시작
        <input type="date" name="start" defaultValue={defaultStart} className="min-h-11 rounded-[var(--radius-button)] border border-line bg-bg px-2" />
      </label>
      <label className="flex flex-col text-xs">
        종료
        <input type="date" name="end" defaultValue={defaultEnd} className="min-h-11 rounded-[var(--radius-button)] border border-line bg-bg px-2" />
      </label>
      <button type="submit" disabled={busy} className="min-h-11 rounded-[var(--radius-button)] bg-primary px-3 text-sm font-semibold text-on-primary disabled:opacity-50">
        정산 초안 만들기
      </button>
      {message ? <p role="status" className="w-full text-sm">{message}</p> : null}
    </form>
  );
}

export function SettlementBatchActions({ batchId, status }: { batchId: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [reference, setReference] = useState("");

  async function run(action: "confirm" | "paid") {
    setBusy(true);
    const result = await fieldRequest(`/api/v1/settlements/${batchId}/${action}`, "POST", action === "paid" ? { payoutReference: reference } : {});
    setBusy(false);
    setMessage(result.ok ? null : errorText(result.code));
    router.refresh();
  }

  if (status === "paid") return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {status === "draft" ? (
        <button type="button" disabled={busy} onClick={() => run("confirm")} className="min-h-11 rounded-[var(--radius-button)] border border-line px-3 text-sm">
          검토 완료·확정
        </button>
      ) : (
        <>
          <input
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="이체 증빙 참조"
            className="min-h-11 rounded-[var(--radius-button)] border border-line bg-bg px-2 text-sm"
          />
          <button type="button" disabled={busy || !reference.trim()} onClick={() => run("paid")} className="min-h-11 rounded-[var(--radius-button)] border border-line px-3 text-sm">
            지급 기록
          </button>
        </>
      )}
      {message ? <span role="alert" className="text-xs text-warm">{message}</span> : null}
    </div>
  );
}
