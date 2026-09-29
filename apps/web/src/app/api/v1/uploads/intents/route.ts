import { z } from "zod";
import { fail, failFromDb, newRequestId, ok } from "@/server/api";
import { createSupabaseServiceClient } from "@/server/service-client";
import { requireSession } from "@/server/session-gate";

export const dynamic = "force-dynamic";

const bodySchema = z
  .object({
    jobId: z.string().uuid(),
    tagId: z.string().trim().max(20).optional(),
    purpose: z.enum(["collection_photo", "damage_photo", "handoff_photo", "return_photo"]),
    contentType: z.enum(["image/jpeg", "image/webp"]),
    sizeBytes: z.number().int().min(1).max(5_242_880),
  })
  .strict();

/**
 * 인계 사진 업로드 권한. DB가 배정·범위를 확인하고 경로를 정한 뒤, 서버가 짧게 유효한 서명 업로드 URL을 발급한다.
 * 파일은 비공개 버킷에 저장되며 공개 URL은 만들지 않는다.
 */
export async function POST(request: Request) {
  const requestId = newRequestId();
  const gate = await requireSession(request, requestId);
  if (!gate.ok) return gate.response;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("VALIDATION_FAILED", requestId);
  const body = parsed.data;

  const service = createSupabaseServiceClient();
  if (!service) return fail("PROVIDER_UNAVAILABLE", requestId, { messageKey: "field.error.UPLOAD_UNAVAILABLE" });

  const { data: evidence, error } = await gate.auth.client
    .rpc("create_evidence_intent", {
      p_job_id: body.jobId,
      p_tag_id: body.tagId ?? null,
      p_purpose: body.purpose,
      p_content_type: body.contentType,
      p_size_bytes: body.sizeBytes,
    })
    .single<{ id: string; storage_path: string }>();
  if (error || !evidence) return failFromDb(error, requestId);

  const { data: signed, error: signError } = await service.storage.from("evidence").createSignedUploadUrl(evidence.storage_path);
  if (signError || !signed) return fail("PROVIDER_UNAVAILABLE", requestId, { messageKey: "field.error.UPLOAD_UNAVAILABLE" });
  return ok({ evidenceId: evidence.id, path: evidence.storage_path, token: signed.token, signedUrl: signed.signedUrl }, requestId, {
    status: 201,
  });
}
