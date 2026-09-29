"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { fieldErrorText, fieldRequest } from "@/lib/field-client";

export function VehicleSelect({ jobId, current, vehicles }: { jobId: string; current: string | null; vehicles: { id: string; label: string }[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  if (vehicles.length === 0) return null;
  return (
    <div className="flex flex-col gap-1">
      <select
        aria-label="차량 지정"
        value={current ?? ""}
        onChange={async (event) => {
          const result = await fieldRequest(`/api/v1/delivery-jobs/${jobId}/vehicle`, "PUT", { vehicleId: event.target.value || null });
          setError(result.ok ? null : fieldErrorText(result.code));
          router.refresh();
        }}
        className="min-h-11 rounded-[var(--radius-button)] border border-line bg-card px-2 text-sm"
      >
        <option value="">차량 미지정</option>
        {vehicles.map((v) => (
          <option key={v.id} value={v.id}>
            {v.label}
          </option>
        ))}
      </select>
      {error ? <span role="alert" className="text-xs text-warm">{error}</span> : null}
    </div>
  );
}

export function VehicleForm() {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={async (event) => {
        event.preventDefault();
        const formElement = event.currentTarget;
        const form = new FormData(formElement);
        const device = String(form.get("device") ?? "").trim();
        const result = await fieldRequest("/api/v1/vehicles", "POST", {
          label: String(form.get("label") ?? "").trim(),
          telematicsDeviceId: device || undefined,
        });
        setMessage(result.ok ? "등록했습니다." : result.code === "CONFLICT" ? "이미 등록된 단말 ID입니다." : fieldErrorText(result.code));
        if (result.ok) formElement.reset();
        router.refresh();
      }}
    >
      <input name="label" required maxLength={60} placeholder="차량 이름 (예: 1호차)" className="min-h-11 rounded-[var(--radius-button)] border border-line bg-bg px-3" />
      <input name="device" placeholder="관제 단말 ID (선택)" className="min-h-11 rounded-[var(--radius-button)] border border-line bg-bg px-3 font-mono" />
      <button type="submit" className="min-h-11 rounded-[var(--radius-button)] bg-primary px-3 text-sm font-semibold text-on-primary">
        차량 등록
      </button>
      {message ? <p role="status" className="w-full text-sm">{message}</p> : null}
    </form>
  );
}
