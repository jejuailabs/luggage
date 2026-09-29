"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { adminFetch } from "./admin-fetch";
import { ADMIN_LABELS } from "./labels";

const STATUSES = ["draft", "active", "suspended", "archived"] as const;

export function HotelStatusSelect({ hotelId, status }: { hotelId: string; status: (typeof STATUSES)[number] }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  return (
    <div className="flex flex-col gap-1">
      <select
        aria-label={`${ADMIN_LABELS.hotels} 상태`}
        value={status}
        disabled={pending}
        onChange={async (event) => {
          setPending(true);
          setError(false);
          const result = await adminFetch(`/api/v1/admin/hotels/${hotelId}`, "PATCH", { status: event.target.value });
          setPending(false);
          if (!result.ok) setError(true);
          router.refresh();
        }}
        className="min-h-11 rounded-[var(--radius-button)] border border-line bg-card px-2 text-sm"
      >
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {ADMIN_LABELS.status[s]}
          </option>
        ))}
      </select>
      {error ? (
        <span role="alert" className="text-xs text-warm">
          {ADMIN_LABELS.saveFailed}
        </span>
      ) : null}
    </div>
  );
}
