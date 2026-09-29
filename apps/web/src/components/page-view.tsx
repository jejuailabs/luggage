"use client";

import { useEffect } from "react";

/**
 * 공개 페이지 조회 1건을 기록한다 (식별자·연락처 없음). 차단돼도 화면 동작에 영향이 없다.
 */
export function PageView({ locale, event = "landing_viewed", hotel }: { locale: string; event?: "landing_viewed" | "hotel_selected"; hotel?: string }) {
  useEffect(() => {
    const body = JSON.stringify({ event, locale, path: window.location.pathname.slice(0, 120), hotel });
    try {
      if (!navigator.sendBeacon?.("/api/v1/analytics", new Blob([body], { type: "application/json" }))) {
        void fetch("/api/v1/analytics", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
      }
    } catch {
      // 기록 실패는 무시한다.
    }
  }, [event, locale, hotel]);
  return null;
}
