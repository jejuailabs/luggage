"use client";

import { useState } from "react";
import { fieldErrorText, fieldRequest } from "@/lib/field-client";
import { INCIDENT_TYPE_KO } from "./labels";

/** 현장 사고 보고. 배송 상태를 바꾸지 않고 운영자 검토 대상으로 남긴다. */
export function IncidentForm({ jobId, tags }: { jobId: string; tags: string[] }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="min-h-11 rounded-[var(--radius-button)] border border-warm px-4 text-sm text-warm">
        사고·예외 보고
      </button>
    );
  }

  return (
    <form
      className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-warm bg-card p-4"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        setBusy(true);
        const result = await fieldRequest("/api/v1/incidents", "POST", {
          jobId,
          tagId: String(form.get("tagId") ?? "") || undefined,
          type: String(form.get("type")),
          severity: Number(form.get("severity")),
          description: String(form.get("description") ?? ""),
        });
        setBusy(false);
        setMessage(result.ok ? "보고했습니다. 운영자가 확인합니다." : fieldErrorText(result.code));
        if (result.ok) event.currentTarget.reset();
      }}
    >
      <h2 className="font-semibold">사고·예외 보고</h2>
      <select name="type" required className="min-h-11 rounded-[var(--radius-button)] border border-line bg-bg px-2">
        {Object.entries(INCIDENT_TYPE_KO).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      <select name="tagId" className="min-h-11 rounded-[var(--radius-button)] border border-line bg-bg px-2">
        <option value="">주문 전체</option>
        {tags.map((tag) => (
          <option key={tag} value={tag}>
            {tag}
          </option>
        ))}
      </select>
      <select name="severity" defaultValue="2" className="min-h-11 rounded-[var(--radius-button)] border border-line bg-bg px-2">
        <option value="1">낮음</option>
        <option value="2">보통</option>
        <option value="3">긴급</option>
      </select>
      <textarea
        name="description"
        required
        maxLength={2000}
        rows={3}
        placeholder="상황을 적어 주세요"
        className="rounded-[var(--radius-button)] border border-line bg-bg p-3"
      />
      <button type="submit" disabled={busy} className="min-h-12 rounded-[var(--radius-button)] bg-warm px-4 font-semibold text-bg disabled:opacity-50">
        보고
      </button>
      {message ? <p role="status" className="text-sm">{message}</p> : null}
    </form>
  );
}
