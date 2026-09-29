"use client";

import { useEffect } from "react";

/**
 * 서비스 워커 등록 (운영 빌드에서만). 새 버전은 강제 새로고침하지 않고 다음 방문 때 적용된다
 * — 결제·인계 도중 화면이 바뀌지 않게 한다.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      // 등록 실패는 화면 동작에 영향이 없다.
    });
  }, []);
  return null;
}
