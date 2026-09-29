"use client";

import { useEffect, useRef, useState } from "react";

interface BarcodeDetectorLike {
  detect(source: HTMLVideoElement): Promise<{ rawValue: string }[]>;
}

declare global {
  interface Window {
    BarcodeDetector?: new (options: { formats: string[] }) => BarcodeDetectorLike;
  }
}

/**
 * 태그 입력: 카메라 QR 스캔(지원 브라우저) 또는 직접 입력.
 * 카메라 권한을 거부해도 직접 입력으로 계속할 수 있다.
 */
export function TagInput({ onTag, disabled }: { onTag: (tag: string) => void; disabled?: boolean }) {
  const [value, setValue] = useState("");
  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const supported = typeof window !== "undefined" && "BarcodeDetector" in window && !!navigator.mediaDevices;

  useEffect(() => {
    if (!scanning) return;
    let stream: MediaStream | null = null;
    let stopped = false;
    const detector = new window.BarcodeDetector!({ formats: ["qr_code"] });
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        const video = videoRef.current!;
        video.srcObject = stream;
        await video.play();
        while (!stopped) {
          const codes = await detector.detect(video).catch(() => []);
          const raw = codes[0]?.rawValue?.trim().toUpperCase();
          if (raw) {
            onTag(raw);
            setScanning(false);
            break;
          }
          await new Promise((r) => setTimeout(r, 250));
        }
      } catch {
        setCameraError("카메라를 쓸 수 없습니다. 태그를 직접 입력하세요.");
        setScanning(false);
      }
    })();
    return () => {
      stopped = true;
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [scanning, onTag]);

  return (
    <div className="flex flex-col gap-2">
      {scanning ? <video ref={videoRef} className="aspect-square w-full rounded-[var(--radius-button)] bg-black" muted playsInline /> : null}
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          const tag = value.trim().toUpperCase();
          if (tag) {
            onTag(tag);
            setValue("");
          }
        }}
      >
        <label className="flex-1">
          <span className="sr-only">태그 번호</span>
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="태그 번호 (T로 시작)"
            autoCapitalize="characters"
            disabled={disabled}
            className="min-h-11 w-full rounded-[var(--radius-button)] border border-line bg-bg px-3 font-mono"
            data-testid="tag-input"
          />
        </label>
        <button type="submit" disabled={disabled} className="min-h-11 rounded-[var(--radius-button)] border border-line px-3 text-sm">
          확인
        </button>
        {supported ? (
          <button
            type="button"
            disabled={disabled}
            onClick={() => setScanning((s) => !s)}
            className="min-h-11 rounded-[var(--radius-button)] border border-line px-3 text-sm"
          >
            {scanning ? "스캔 중지" : "QR 스캔"}
          </button>
        ) : null}
      </form>
      {cameraError ? <p className="text-xs text-warm">{cameraError}</p> : null}
    </div>
  );
}
