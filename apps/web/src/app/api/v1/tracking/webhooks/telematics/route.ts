import { parseTelematicsWebhook, TrackingWebhookError } from "@luggage/integrations";
import { getServerConfig } from "@/lib/env";
import { fail, failFromDb, newRequestId, ok } from "@/server/api";
import { createSupabaseServiceClient } from "@/server/service-client";

export const dynamic = "force-dynamic";

/**
 * 차량 관제 단말 웹훅 (업체 중립 표준 형식, packages/integrations/src/tracking.ts).
 * 서명·시각 검증 후 단말이 붙은 차량의 활성 작업에만 기록한다.
 */
export async function POST(request: Request) {
  const requestId = newRequestId();
  const secret = getServerConfig().secrets.trackingWebhook;
  if (!secret) return fail("NOT_FOUND", requestId);
  const rawBody = await request.text();
  let point;
  try {
    point = parseTelematicsWebhook(secret, request.headers, rawBody);
  } catch (error) {
    if (error instanceof TrackingWebhookError) return fail("FORBIDDEN", requestId);
    throw error;
  }
  const service = createSupabaseServiceClient();
  if (!service) return fail("PROVIDER_UNAVAILABLE", requestId);
  const { data, error } = await service.rpc("ingest_telematics_location", {
    p_device_id: point.deviceId,
    p_latitude: point.latitude,
    p_longitude: point.longitude,
    p_accuracy_m: point.accuracyM,
    p_observed_at: point.observedAt,
  });
  if (error) return failFromDb(error, requestId);
  return ok({ recordedJobs: data }, requestId);
}
