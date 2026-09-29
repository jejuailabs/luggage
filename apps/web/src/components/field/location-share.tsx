"use client";

import { useEffect, useRef, useState } from "react";
import { fieldErrorText, fieldRequest } from "@/lib/field-client";

const SEND_INTERVAL_MS = 30_000;

const LOCATION_ERRORS: Record<string, string> = {
  TRACKING_NOT_ACTIVE: "진행 중인 작업이 아니라 위치를 보내지 않습니다.",
  LOCATION_STALE: "기기 시각이 맞지 않습니다. 시간 자동 설정을 확인하세요.",
  LOCATION_INACCURATE: "위치 정확도가 낮습니다. 실외로 나가 다시 시도하세요.",
};

/**
 * 작업 중 차량 위치 공유. 이 화면이 열려 있는 동안만 보낸다 (PWA는 백그라운드 연속 수집을 보장하지 않음).
 * 고객에게는 ‘배송 차량의 최근 위치’로만 보이며 짐 자체 GPS가 아니다. 거부해도 작업은 계속할 수 있다.
 */
export function LocationShare({ jobId }: { jobId: string }) {
  const [on, setOn] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const lastSent = useRef(0);

  useEffect(() => {
    if (!on) return;
    const watch = navigator.geolocation.watchPosition(
      async (position) => {
        const now = Date.now();
        if (now - lastSent.current < SEND_INTERVAL_MS) return;
        lastSent.current = now;
        const result = await fieldRequest<{ result: string }>("/api/v1/tracking/driver-location", "POST", {
          jobId,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracyM: position.coords.accuracy,
          observedAt: new Date(position.timestamp).toISOString(),
        });
        const time = new Intl.DateTimeFormat("ko", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "Asia/Seoul" }).format(new Date());
        if (result.ok) setStatus(`위치 전송 중 · 마지막 ${time}`);
        else setStatus(result.network ? "네트워크 없음 — 연결되면 다시 보냅니다" : (LOCATION_ERRORS[result.code] ?? fieldErrorText(result.code)));
      },
      (error) => {
        setStatus(error.code === error.PERMISSION_DENIED ? "위치 권한이 거부됐습니다. 작업은 계속할 수 있습니다." : "위치를 가져오지 못했습니다.");
        if (error.code === error.PERMISSION_DENIED) setOn(false);
      },
      { enableHighAccuracy: true, maximumAge: 15_000, timeout: 20_000 },
    );
    return () => navigator.geolocation.clearWatch(watch);
  }, [on, jobId]);

  return (
    <section className="flex flex-col gap-2 rounded-[var(--radius-card)] border border-line bg-card p-4" lang="ko" data-testid="location-share">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold">차량 위치 공유</h2>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          onClick={() => {
            if (!on && !("geolocation" in navigator)) {
              setStatus("이 기기는 위치를 지원하지 않습니다.");
              return;
            }
            setStatus(on ? "위치 공유를 껐습니다." : "위치를 확인하고 있습니다…");
            setOn(!on);
          }}
          className="min-h-11 min-w-20 rounded-[var(--radius-button)] border border-line px-3 text-sm aria-checked:border-primary aria-checked:bg-sea"
        >
          {on ? "켜짐" : "꺼짐"}
        </button>
      </div>
      <p className="text-xs text-muted">
        고객에게 배송 차량의 대략 위치와 마지막 확인 시각을 보여 줍니다. 이 화면이 열려 있는 동안만 30초마다 보내며, 작업이 끝나면 고객 표시가 사라집니다.
      </p>
      {status ? (
        <p role="status" className="text-sm">
          {status}
        </p>
      ) : null}
    </section>
  );
}
