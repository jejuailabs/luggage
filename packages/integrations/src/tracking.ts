import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Tracking 어댑터 (04 문서 7절). 특정 관제 업체에 묶이지 않는 표준 웹훅 형식이다.
 *
 * 요청: POST, 본문 JSON
 *   { "deviceId": "DEV-001", "latitude": 33.4996, "longitude": 126.5312, "accuracyM": 12, "observedAt": "2026-09-29T01:00:00Z" }
 * 헤더:
 *   x-tracking-timestamp: 요청 시각 (Unix 초)
 *   x-tracking-signature: hex(HMAC-SHA256(secret, `${timestamp}.${rawBody}`))
 *
 * 다른 형식을 보내는 업체는 이 형식으로 바꾸는 작은 매핑 어댑터를 추가한다. 좌표는 WGS84.
 */
export interface TelematicsPoint {
  deviceId: string;
  latitude: number;
  longitude: number;
  accuracyM: number | null;
  observedAt: string;
}

export class TrackingWebhookError extends Error {
  override name = "TrackingWebhookError";
}

const MAX_SKEW_SECONDS = 300;

export function signTrackingPayload(secret: string, timestamp: number, rawBody: string): string {
  return createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
}

export function parseTelematicsWebhook(secret: string, headers: Headers, rawBody: string, now: Date = new Date()): TelematicsPoint {
  if (secret.length < 16) throw new TrackingWebhookError("secret not configured");
  const timestamp = Number(headers.get("x-tracking-timestamp"));
  const signature = headers.get("x-tracking-signature") ?? "";
  if (!Number.isFinite(timestamp) || Math.abs(now.getTime() / 1000 - timestamp) > MAX_SKEW_SECONDS) {
    throw new TrackingWebhookError("stale request");
  }
  const expected = signTrackingPayload(secret, timestamp, rawBody);
  if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    throw new TrackingWebhookError("invalid signature");
  }
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    throw new TrackingWebhookError("invalid body");
  }
  const { deviceId, latitude, longitude, accuracyM, observedAt } = body;
  if (
    typeof deviceId !== "string" ||
    !/^[A-Za-z0-9_.:-]{1,80}$/.test(deviceId) ||
    typeof latitude !== "number" ||
    latitude < -90 ||
    latitude > 90 ||
    typeof longitude !== "number" ||
    longitude < -180 ||
    longitude > 180 ||
    typeof observedAt !== "string" ||
    Number.isNaN(Date.parse(observedAt))
  ) {
    throw new TrackingWebhookError("invalid point");
  }
  return {
    deviceId,
    latitude,
    longitude,
    accuracyM: typeof accuracyM === "number" && accuracyM >= 0 ? Math.round(accuracyM) : null,
    observedAt: new Date(observedAt).toISOString(),
  };
}

/** 고객 길찾기 앱 링크 (WGS84). 고덕·바이두는 좌표계를 명시한다. 구글 지도는 쓰지 않는다. */
export function mapDeepLinks(latitude: number, longitude: number, label: string) {
  const name = encodeURIComponent(label);
  return {
    amap: `https://uri.amap.com/marker?position=${longitude},${latitude}&name=${name}&coordinate=wgs84&callnative=1`,
    baidu: `https://api.map.baidu.com/marker?location=${latitude},${longitude}&title=${name}&content=${name}&coord_type=wgs84&output=html`,
    apple: `https://maps.apple.com/?ll=${latitude},${longitude}&q=${name}`,
  };
}
