"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { fieldErrorText, fieldRequest } from "@/lib/field-client";

export function AssignDriver({
  jobId,
  currentDriverId,
  drivers,
}: {
  jobId: string;
  currentDriverId: string | null;
  drivers: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-1">
      <select
        aria-label="기사 배정"
        value={currentDriverId ?? ""}
        disabled={busy}
        onChange={async (event) => {
          if (!event.target.value) return;
          setBusy(true);
          setError(null);
          const result = await fieldRequest(`/api/v1/delivery-jobs/${jobId}/assignment`, "PUT", { driverId: event.target.value });
          setBusy(false);
          if (!result.ok) setError(fieldErrorText(result.code));
          router.refresh();
        }}
        className="min-h-11 rounded-[var(--radius-button)] border border-line bg-card px-2 text-sm"
      >
        <option value="">미배정</option>
        {drivers.map((driver) => (
          <option key={driver.id} value={driver.id}>
            {driver.name}
          </option>
        ))}
      </select>
      {error ? (
        <span role="alert" className="text-xs text-warm">
          {error}
        </span>
      ) : null}
    </div>
  );
}
