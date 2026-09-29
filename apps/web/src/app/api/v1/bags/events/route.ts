import { z } from "zod";
import { fail, failFromDb, newRequestId, ok } from "@/server/api";
import { requireSession } from "@/server/session-gate";

export const dynamic = "force-dynamic";

const bodySchema = z
  .object({
    tagId: z.string().trim().min(3).max(20),
    jobId: z.string().uuid(),
    eventType: z.enum([
      "origin_received",
      "collected",
      "loaded",
      "arrived",
      "ready_for_handoff",
      "exception_reported",
      "exception_resolved",
      "return_started",
      "returned",
    ]),
    // 오프라인 재전송에도 같은 값을 쓴다 (서버가 중복을 막는다).
    clientEventId: z.string().min(8).max(128),
    deviceOccurredAt: z.string().datetime({ offset: true }).optional(),
    expectedVersion: z.number().int().positive().optional(),
    evidenceIds: z.array(z.string().uuid()).max(10).default([]),
    note: z.string().trim().max(1000).optional(),
  })
  .strict();

/** 짐 인계 이벤트 (호텔 접수·기사 수거·적재·도착·인계 준비·예외·반환). 권한·전이는 DB가 검사한다. */
export async function POST(request: Request) {
  const requestId = newRequestId();
  const gate = await requireSession(request, requestId);
  if (!gate.ok) return gate.response;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("VALIDATION_FAILED", requestId);
  const body = parsed.data;

  const { data, error } = await gate.auth.client
    .rpc("record_bag_event", {
      p_tag_id: body.tagId,
      p_job_id: body.jobId,
      p_event_type: body.eventType,
      p_client_event_id: body.clientEventId,
      p_device_occurred_at: body.deviceOccurredAt ?? null,
      p_expected_version: body.expectedVersion ?? null,
      p_evidence_ids: body.evidenceIds,
      p_note: body.note ?? null,
    })
    .single<{ id: string; to_status: string; server_received_at: string }>();
  if (error || !data) return failFromDb(error, requestId);
  return ok({ eventId: data.id, bagStatus: data.to_status, serverReceivedAt: data.server_received_at }, requestId, { status: 201 });
}
