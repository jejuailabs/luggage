import { z } from "zod";
import { fail, failFromDb, newRequestId, ok } from "@/server/api";
import { requireSession } from "@/server/session-gate";

export const dynamic = "force-dynamic";

const bodySchema = z
  .object({
    jobId: z.string().uuid(),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    accuracyM: z.number().min(0).max(100000),
    observedAt: z.string().datetime({ offset: true }),
  })
  .strict();

/**
 * 기사 기기 위치 (작업 화면이 열린 동안). 배정·활성 작업·시각·정확도·전송 간격은 DB가 검사한다.
 * 짐 자체 위치가 아니라 배송 차량 위치로만 쓴다.
 */
export async function POST(request: Request) {
  const requestId = newRequestId();
  const gate = await requireSession(request, requestId);
  if (!gate.ok) return gate.response;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("VALIDATION_FAILED", requestId);
  const { data, error } = await gate.auth.client.rpc("record_driver_location", {
    p_job_id: parsed.data.jobId,
    p_latitude: Number(parsed.data.latitude.toFixed(6)),
    p_longitude: Number(parsed.data.longitude.toFixed(6)),
    p_accuracy_m: Math.round(parsed.data.accuracyM),
    p_observed_at: parsed.data.observedAt,
  });
  if (error) return failFromDb(error, requestId);
  return ok({ result: data }, requestId);
}
