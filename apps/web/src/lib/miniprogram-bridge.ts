"use client";

/**
 * 미니프로그램 web-view ↔ 네이티브 페이지 연결.
 * 위챗 JS-SDK는 미니프로그램 실행 환경에서만 불러온다 (일반 브라우저에서는 외부 스크립트를 싣지 않는다).
 */
const SDK_URL = "https://res.wx.qq.com/open/js/jweixin-1.6.0.js";

interface WxMiniProgram {
  navigateTo(options: { url: string; fail?: (error: unknown) => void }): void;
}

declare global {
  interface Window {
    wx?: { miniProgram?: WxMiniProgram };
  }
}

let loading: Promise<WxMiniProgram | null> | null = null;

export function isMiniProgramRuntime(): boolean {
  return typeof document !== "undefined" && document.documentElement.dataset.runtime === "wechat_miniprogram";
}

function loadSdk(): Promise<WxMiniProgram | null> {
  if (window.wx?.miniProgram) return Promise.resolve(window.wx.miniProgram);
  loading ??= new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = SDK_URL;
    script.async = true;
    script.onload = () => resolve(window.wx?.miniProgram ?? null);
    script.onerror = () => resolve(null);
    document.head.appendChild(script);
  });
  return loading;
}

/** 미니프로그램 네이티브 페이지로 이동한다. 실패하면 false. */
export async function navigateToMiniProgramPage(page: string, query: Record<string, string>): Promise<boolean> {
  if (!isMiniProgramRuntime() || !/^\/pages\/[a-z]+\/[a-z]+$/.test(page)) return false;
  const miniProgram = await loadSdk();
  if (!miniProgram) return false;
  const url = `${page}?${new URLSearchParams(query).toString()}`;
  return new Promise((resolve) => {
    try {
      miniProgram.navigateTo({ url, fail: () => resolve(false) });
      resolve(true);
    } catch {
      resolve(false);
    }
  });
}
