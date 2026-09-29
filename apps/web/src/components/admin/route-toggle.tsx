"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { adminFetch } from "./admin-fetch";
import { ADMIN_LABELS } from "./labels";

export function RouteToggle({ routeId, enabled, label }: { routeId: string; enabled: boolean; label: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label={label}
        disabled={pending}
        onClick={async () => {
          setPending(true);
          setError(false);
          const result = await adminFetch(`/api/v1/admin/route-offerings/${routeId}`, "PATCH", { enabled: !enabled });
          setPending(false);
          if (!result.ok) setError(true);
          router.refresh();
        }}
        className="min-h-11 min-w-24 rounded-[var(--radius-button)] border border-line px-3 text-sm aria-checked:border-primary aria-checked:bg-sea aria-checked:font-semibold"
      >
        {enabled ? ADMIN_LABELS.enabled : ADMIN_LABELS.disabled}
      </button>
      {error ? (
        <span role="alert" className="text-xs text-warm">
          {ADMIN_LABELS.saveFailed}
        </span>
      ) : null}
    </div>
  );
}
