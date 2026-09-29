import { fail, newRequestId, ok } from "@/server/api";
import { isAuthorizedJob } from "@/server/jobs";
import { createSupabaseServiceClient } from "@/server/service-client";

export const dynamic = "force-dynamic";

/** 차량 위치 보존 기간(7일) 정리 (스케줄러, 하루 1회). */
export async function GET(request: Request) {
  const requestId = newRequestId();
  if (!isAuthorizedJob(request)) return fail("FORBIDDEN", requestId);
  const service = createSupabaseServiceClient();
  if (!service) return fail("PROVIDER_UNAVAILABLE", requestId);
  const { data, error } = await service.rpc("purge_vehicle_locations", { p_keep_days: 7 });
  if (error) return fail("PROVIDER_UNAVAILABLE", requestId);
  return ok({ purged: data }, requestId);
}
