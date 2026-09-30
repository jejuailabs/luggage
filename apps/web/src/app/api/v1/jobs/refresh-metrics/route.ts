import { fail, newRequestId, ok } from "@/server/api";
import { isAuthorizedJob } from "@/server/jobs";
import { createSupabaseServiceClient } from "@/server/service-client";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = newRequestId();
  if (!isAuthorizedJob(request)) return fail("FORBIDDEN", requestId);
  const service = createSupabaseServiceClient();
  if (!service) return fail("PROVIDER_UNAVAILABLE", requestId);
  const todayKst = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
  const from = new Date(Date.now() + 9 * 3600_000 - 46 * 86_400_000).toISOString().slice(0, 10);
  const to = new Date(Date.now() + 9 * 3600_000 - 86_400_000).toISOString().slice(0, 10);
  const { data, error } = await service.rpc("refresh_analytics_daily_summary", { p_from: from, p_to: to });
  if (error) return fail("PROVIDER_UNAVAILABLE", requestId);
  return ok({ from, to, todayKst, rows: data }, requestId);
}
