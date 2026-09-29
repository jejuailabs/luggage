"use client";

import { useEffect } from "react";
import { detectRuntimeEnvironment } from "@luggage/domain";

declare global {
  interface Window {
    __wxjs_environment?: string;
  }
}

/**
 * 서버가 User-Agent로 넣은 data-runtime 값을 클라이언트 신호로 보정한다.
 * 미니프로그램 web-view는 JS-SDK 준비 후에 __wxjs_environment가 채워진다.
 */
export function RuntimeEnvironmentMarker() {
  useEffect(() => {
    const update = () => {
      document.documentElement.dataset.runtime = detectRuntimeEnvironment({
        userAgent: navigator.userAgent,
        wxjsEnvironment: window.__wxjs_environment,
      });
    };
    update();
    document.addEventListener("WeixinJSBridgeReady", update);
    return () => document.removeEventListener("WeixinJSBridgeReady", update);
  }, []);
  return null;
}
