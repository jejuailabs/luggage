"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import type { Locale } from "@luggage/i18n";
import { DEMO_COPY, type RouteType } from "./demo-copy";

const STORAGE_KEY = "jc-demo-journey-v1";
type Saved = { ref?: string; route?: RouteType; status?: number; date?: string; refund?: string };

function read(): string | null {
  try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
}
const subscribe = (callback: () => void) => { window.addEventListener("storage", callback); return () => window.removeEventListener("storage", callback); };

/** 이 브라우저에서 진행한 시뮬레이션 예약을 '내 짐'에 보여 준다. 실제 주문이 아님을 표시한다. */
export function SimBookingCard({ locale, emptyFallback }: { locale: Locale; emptyFallback: React.ReactNode }) {
  const raw = useSyncExternalStore(subscribe, read, () => null);
  const t = DEMO_COPY[locale];
  let saved: Saved | null = null;
  try { saved = raw ? (JSON.parse(raw) as Saved) : null; } catch { saved = null; }
  if (!saved?.ref || saved.status === undefined || saved.status < 0) return <>{emptyFallback}</>;
  const status = saved.refund && saved.refund !== "none" ? t.refundState[saved.refund as "requested" | "refunded"] : t.statuses[saved.status];
  const progress = Math.round(((saved.status + 1) / 6) * 100);
  return (
    <Link href={`/${locale}/demo`} className="sim-booking-card pf-scope" data-testid="sim-booking-card">
      <span className="pf-sim-badge">🧪 {t.badge}</span>
      <strong>{saved.ref}</strong>
      <span>{saved.route ? t.routes[saved.route] : ""} · {saved.date}</span>
      <span className="sim-booking-card__status">{status}</span>
      <span className="pf-progress" aria-hidden="true"><span style={{ width: `${progress}%`, animation: "none" }} /></span>
    </Link>
  );
}
