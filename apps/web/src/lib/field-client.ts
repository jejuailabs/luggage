"use client";

import { createBrowserClient } from "@supabase/ssr";
import { clearAll, deleteItem, getAll, putItem } from "./local-store";

/** 현장 화면(기사·호텔·운영) 오류 문구. 업무 화면은 한국어다. */
export const FIELD_ERRORS: Record<string, string> = {
  FORBIDDEN: "이 작업에 대한 권한이 없습니다. 배정·소속을 확인하세요.",
  TAG_NOT_FOUND: "등록되지 않은 태그입니다.",
  JOB_NOT_FOUND: "작업을 찾을 수 없습니다.",
  JOB_CANCELLED: "취소된 작업입니다. 운영자에게 확인하세요.",
  JOB_NOT_ASSIGNABLE: "배정할 수 없는 작업입니다.",
  DRIVER_INVALID: "기사 역할이 없는 계정입니다.",
  BAG_NOT_IN_JOB: "다른 작업의 짐입니다. 현재 주문에 붙이지 마세요.",
  VERSION_CONFLICT: "다른 기기에서 먼저 변경됐습니다. 화면을 새로고침하세요.",
  INVALID_TRANSITION: "지금 상태에서는 할 수 없는 단계입니다.",
  EVIDENCE_REQUIRED: "사진 또는 사유를 남겨야 합니다.",
  EVIDENCE_INVALID: "이 작업의 사진이 아닙니다.",
  EVIDENCE_LIMIT: "이 작업의 사진 수 한도를 넘었습니다.",
  HANDOFF_CODE_INVALID: "수령 코드가 맞지 않습니다.",
  HANDOFF_CODE_EXPIRED: "수령 코드가 없거나 만료됐습니다. 고객에게 새 코드를 요청하세요.",
  HANDOFF_CODE_LOCKED: "시도 횟수를 넘었습니다. 고객에게 새 코드를 요청하세요.",
  UPLOAD_UNAVAILABLE: "사진 저장소를 지금 쓸 수 없습니다. 사유를 입력해 진행하세요.",
  SESSION_REQUIRED: "다시 로그인하세요.",
  NETWORK: "네트워크가 없습니다.",
  generic: "처리하지 못했습니다. 잠시 후 다시 시도하세요.",
};

export type FieldResult<T = unknown> = { ok: true; data: T } | { ok: false; code: string; network?: boolean };

export function newClientId(): string {
  return crypto.randomUUID().replaceAll("-", "");
}

export function fieldErrorText(code: string): string {
  return FIELD_ERRORS[code] ?? FIELD_ERRORS.generic!;
}

export async function fieldRequest<T>(url: string, method: "POST" | "PUT", body: unknown): Promise<FieldResult<T>> {
  let response: Response;
  try {
    response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  } catch {
    return { ok: false, code: "NETWORK", network: true };
  }
  const json = await response.json().catch(() => null);
  if (response.ok) return { ok: true, data: json?.data as T };
  const key: string | undefined = json?.error?.messageKey;
  const code = key?.split(".").pop() ?? json?.error?.code ?? "generic";
  return { ok: false, code };
}

// 오프라인 재전송 큐 (IndexedDB) ------------------------------------------------
// 스캔·상태 이벤트만 담는다. 같은 clientEventId로 재전송하므로 서버에서 중복되지 않는다.
// 수령 코드 검증·최종 인계는 온라인 전용이라 큐에 넣지 않는다.

export interface PendingEvent {
  clientEventId: string;
  body: Record<string, unknown>;
  queuedAt: string;
}

export async function readQueue(): Promise<PendingEvent[]> {
  try {
    const items = await getAll<PendingEvent>("queue");
    return items.sort((a, b) => a.queuedAt.localeCompare(b.queuedAt));
  } catch {
    return [];
  }
}

/** 같은 clientEventId는 한 건만 남는다. 저장 실패는 호출자에게 알린다 (화면에서 미전송 유지). */
export async function enqueue(event: PendingEvent): Promise<void> {
  await putItem("queue", event.clientEventId, event);
}

/** 대기 중 이벤트를 순서대로 다시 보낸다. 서버가 거절한 이벤트는 큐에서 빼고 결과를 돌려준다. */
export async function flushQueue(): Promise<{ sent: number; rejected: { event: PendingEvent; code: string }[] }> {
  const rejected: { event: PendingEvent; code: string }[] = [];
  let sent = 0;
  for (const item of await readQueue()) {
    const result = await fieldRequest("/api/v1/bags/events", "POST", item.body);
    if (result.ok) {
      sent += 1;
      await deleteItem("queue", item.clientEventId);
    } else if (!result.network) {
      rejected.push({ event: item, code: result.code });
      await deleteItem("queue", item.clientEventId);
    }
  }
  return { sent, rejected };
}

/** 로그아웃·배정 해제 시 기기에 남은 현장 데이터(대기 기록·작업·예약증 사본)를 지운다. */
export async function clearFieldStorage(): Promise<void> {
  try {
    await clearAll();
    localStorage.removeItem("luggage-active-driver-id");
  } catch {
    // 무시
  }
}

// 사진 -------------------------------------------------------------------

/** 긴 변 1600px JPEG로 다시 그린다. 캔버스 재인코딩으로 EXIF(위치 등)가 제거된다. */
export async function compressPhoto(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("encode failed"))), "image/jpeg", 0.8),
  );
}

/** 업로드 권한 발급 → 비공개 버킷에 서명 URL로 업로드. 성공하면 증빙 ID를 돌려준다. */
export async function uploadEvidence(input: {
  jobId: string;
  tagId?: string;
  purpose: "collection_photo" | "damage_photo" | "handoff_photo" | "return_photo";
  file: File;
}): Promise<FieldResult<{ evidenceId: string }>> {
  const blob = await compressPhoto(input.file);
  const intent = await fieldRequest<{ evidenceId: string; path: string; token: string }>("/api/v1/uploads/intents", "POST", {
    jobId: input.jobId,
    tagId: input.tagId,
    purpose: input.purpose,
    contentType: "image/jpeg",
    sizeBytes: blob.size,
  });
  if (!intent.ok) return intent;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return { ok: false, code: "UPLOAD_UNAVAILABLE" };
  const { error } = await createBrowserClient(url, key)
    .storage.from("evidence")
    .uploadToSignedUrl(intent.data.path, intent.data.token, blob, { contentType: "image/jpeg" });
  if (error) return { ok: false, code: "UPLOAD_UNAVAILABLE" };
  return { ok: true, data: { evidenceId: intent.data.evidenceId } };
}
