import { fail, newRequestId, ok } from "@/server/api";
import { isAuthorizedJob } from "@/server/jobs";
import { createSupabaseServiceClient } from "@/server/service-client";

export const dynamic = "force-dynamic";

/** Expired private photo purge. Open incidents and unsettled claims defer deletion. */
export async function GET(request: Request) {
  const requestId = newRequestId();
  if (!isAuthorizedJob(request)) return fail("FORBIDDEN", requestId);
  const service = createSupabaseServiceClient();
  if (!service) return fail("PROVIDER_UNAVAILABLE", requestId);
  const { data: expired, error } = await service.from("evidence_files")
    .select("id, order_id, storage_path")
    .lt("retention_until", new Date().toISOString())
    .order("retention_until")
    .limit(50);
  if (error) return fail("PROVIDER_UNAVAILABLE", requestId);
  if (!expired?.length) return ok({ scanned: 0, deleted: 0, deferred: 0, failed: 0 }, requestId);
  const orderIds = [...new Set(expired.map((row) => row.order_id))];
  const [incidents, claims] = await Promise.all([
    service.from("incidents").select("order_id").in("order_id", orderIds).neq("status", "resolved"),
    service.from("compensation_claims").select("order_id").in("order_id", orderIds).in("status", ["submitted", "under_review", "approved"]),
  ]);
  if (incidents.error || claims.error) return fail("PROVIDER_UNAVAILABLE", requestId);
  const hold = new Set([...(incidents.data ?? []), ...(claims.data ?? [])].map((row) => row.order_id));
  let deleted = 0; let deferred = 0; let failed = 0;
  for (const file of expired) {
    if (hold.has(file.order_id)) { deferred++; continue; }
    const removed = await service.storage.from("evidence").remove([file.storage_path]);
    if (removed.error) { failed++; continue; }
    const result = await service.from("evidence_files").delete().eq("id", file.id).lt("retention_until", new Date().toISOString());
    if (result.error) { failed++; continue; }
    deleted++;
  }
  return ok({ scanned: expired.length, deleted, deferred, failed }, requestId);
}
