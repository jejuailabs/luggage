import { fail, newRequestId, ok } from "@/server/api";
import { isAuthorizedJob } from "@/server/jobs";
import { createSupabaseServiceClient } from "@/server/service-client";

export const dynamic = "force-dynamic";

/** 미결제 홀드 만료 (스케줄러). 한 번에 최대 200건, 재실행 안전. */
export async function GET(request: Request) {
  const requestId = newRequestId();
  if (!isAuthorizedJob(request)) return fail("FORBIDDEN", requestId);
  const service = createSupabaseServiceClient();
  if (!service) return fail("PROVIDER_UNAVAILABLE", requestId);
  const { data, error } = await service.rpc("expire_holds", { p_limit: 200 });
  if (error) return fail("PROVIDER_UNAVAILABLE", requestId);
  return ok({ expired: data }, requestId);
}
