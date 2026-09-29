import { z } from "zod";
import { fail, failFromDb, newRequestId, ok } from "@/server/api";
import { requireSession } from "@/server/session-gate";

export const dynamic = "force-dynamic";

const bodySchema = z
  .object({
    jobId: z.string().uuid(),
    tagId: z.string().trim().max(20).optional(),
    type: z.enum([
      "missing_at_origin",
      "damage",
      "quantity_mismatch",
      "vehicle_breakdown",
      "delay",
      "flight_change",
      "customer_no_show",
      "partial_missing",
      "lost",
      "location_change",
      "other",
    ]),
    severity: z.number().int().min(1).max(3).default(2),
    description: z.string().trim().min(1).max(2000),
  })
  .strict();

/** 현장 사고 보고 (배정 기사·출발 호텔·운영자). 배송 상태와 별개로 추적한다. */
export async function POST(request: Request) {
  const requestId = newRequestId();
  const gate = await requireSession(request, requestId);
  if (!gate.ok) return gate.response;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("VALIDATION_FAILED", requestId);
  const body = parsed.data;
  const { data, error } = await gate.auth.client
    .rpc("report_incident", {
      p_job_id: body.jobId,
      p_tag_id: body.tagId ?? null,
      p_type: body.type,
      p_severity: body.severity,
      p_description: body.description,
    })
    .single<{ id: string; status: string }>();
  if (error || !data) return failFromDb(error, requestId);
  return ok({ incidentId: data.id, status: data.status }, requestId, { status: 201 });
}
