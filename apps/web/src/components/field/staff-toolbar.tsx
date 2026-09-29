"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { clearFieldStorage } from "@/lib/field-client";

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

type PushState = "unsupported" | "off" | "on" | "denied" | "busy";

/**
 * 업무 화면 도구: 알림함, 이 기기 알림 켜기(목적을 먼저 설명하고 요청), 로그아웃(기기 데이터 정리).
 * iOS는 홈 화면에 설치한 뒤에만 웹 푸시를 받을 수 있다.
 */
export function StaffToolbar({ locale, unread }: { locale: string; unread: number }) {
  const router = useRouter();
  const [push, setPush] = useState<PushState>("busy");
  const publicKey = process.env.NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY;

  useEffect(() => {
    (async () => {
      if (!publicKey || !("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        setPush("unsupported");
        return;
      }
      if (Notification.permission === "denied") return setPush("denied");
      const registration = await navigator.serviceWorker.getRegistration();
      const existing = await registration?.pushManager.getSubscription();
      setPush(existing ? "on" : "off");
    })().catch(() => setPush("unsupported"));
  }, [publicKey]);

  async function enablePush() {
    setPush("busy");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return setPush(permission === "denied" ? "denied" : "off");
      const registration = (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.register("/sw.js"));
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey!),
      });
      const response = await fetch("/api/v1/push/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });
      setPush(response.ok ? "on" : "off");
    } catch {
      setPush("off");
    }
  }

  async function signOut() {
    try {
      const registration = await navigator.serviceWorker?.getRegistration();
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await fetch("/api/v1/push/subscriptions", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        }).catch(() => undefined);
        await subscription.unsubscribe().catch(() => undefined);
      }
    } catch {
      // 무시하고 로그아웃을 계속한다.
    }
    await clearFieldStorage();
    await fetch("/api/v1/sessions", { method: "DELETE" }).catch(() => undefined);
    router.replace(`/${locale}/driver`);
    router.refresh();
  }

  const button = "inline-flex min-h-11 items-center rounded-[var(--radius-button)] border border-line px-3 text-sm";
  return (
    <div className="flex flex-wrap items-center gap-2 print:hidden" lang="ko" data-testid="staff-toolbar">
      <Link href={`/${locale}/notifications`} className={button}>
        알림함{unread > 0 ? ` (${unread})` : ""}
      </Link>
      {push === "off" ? (
        <button type="button" className={button} onClick={enablePush} title="배정·사고·문의를 이 기기로 알려 드립니다">
          이 기기 알림 켜기
        </button>
      ) : push === "on" ? (
        <span className="text-xs text-muted">알림 켜짐</span>
      ) : push === "denied" ? (
        <span className="text-xs text-muted">알림 차단됨 (브라우저 설정)</span>
      ) : push === "unsupported" ? (
        <span className="text-xs text-muted">이 브라우저는 알림 미지원 (iOS는 홈 화면 설치 후)</span>
      ) : null}
      <button type="button" className={button} onClick={signOut} data-testid="staff-sign-out">
        로그아웃
      </button>
    </div>
  );
}
