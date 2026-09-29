import { z } from "zod";
import { fail, failFromDb, newRequestId, ok } from "@/server/api";
import { requireSession } from "@/server/session-gate";

export const dynamic = "force-dynamic";

const bodySchema = z
  .object({
    jobId: z.string().uuid(),
    code: z.string().regex(/^\d{6}$/),
    tagIds: z.array(z.string().trim().min(3).max(20)).min(1).max(20),
    clientEventId: z.string().min(8).max(128),
  })
  .strict();

/**
 * 공항 인계 완료: 고객 수령 코드 검증 후 선택한 짐만 delivered로 기록한다 (배정 기사·운영자).
 * 네트워크가 없으면 완료할 수 없다 (서버 확인이 곧 완료).
 */
export async function POST(request: Request) {
  const requestId = newRequestId();
  const gate = await requireSession(request, requestId);
  if (!gate.ok) return gate.response;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("VALIDATION_FAILED", requestId);

  const { data, error } = await gate.auth.client.rpc("verify_handoff", {
    p_job_id: parsed.data.jobId,
    p_code: parsed.data.code,
    p_tag_ids: parsed.data.tagIds,
    p_client_event_id: parsed.data.clientEventId,
  });
  if (error) return failFromDb(error, requestId);
  if (data === -1) {
    return fail("BUSINESS_RULE_VIOLATION", requestId, { messageKey: "field.error.HANDOFF_CODE_INVALID" });
  }
  return ok({ deliveredCount: data }, requestId);
}
