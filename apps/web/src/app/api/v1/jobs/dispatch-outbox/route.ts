import { fail, newRequestId, ok } from "@/server/api";
import { isAuthorizedJob } from "@/server/jobs";
import { dispatchOutbox } from "@/server/notify";
import { createSupabaseServiceClient } from "@/server/service-client";

export const dynamic = "force-dynamic";

/** outbox 처리 (스케줄러): 업무자 알림함 기록 + 웹 푸시. 중복·지연 실행에 안전하다 (lease·멱등 키). */
export async function GET(request: Request) {
  const requestId = newRequestId();
  if (!isAuthorizedJob(request)) return fail("FORBIDDEN", requestId);
  const service = createSupabaseServiceClient();
  if (!service) return fail("PROVIDER_UNAVAILABLE", requestId);
  try {
    return ok(await dispatchOutbox(service), requestId);
  } catch {
    return fail("PROVIDER_UNAVAILABLE", requestId);
  }
}
