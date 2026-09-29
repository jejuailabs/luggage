import { z } from "zod";
import { fail, failFromDb, newRequestId, ok } from "@/server/api";
import { requireSession } from "@/server/session-gate";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ driverId: z.string().uuid() }).strict();

/** 기사 배정·재배정 (dispatcher). 이전 기사 권한은 같은 트랜잭션에서 종료된다. */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = newRequestId();
  const gate = await requireSession(request, requestId);
  if (!gate.ok) return gate.response;
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return fail("NOT_FOUND", requestId);
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("VALIDATION_FAILED", requestId);

  const { data, error } = await gate.auth.client
    .rpc("assign_driver", { p_job_id: id, p_driver_id: parsed.data.driverId })
    .single<{ id: string; driver_id: string; assigned_at: string }>();
  if (error || !data) return failFromDb(error, requestId);
  return ok({ assignmentId: data.id, driverId: data.driver_id, assignedAt: data.assigned_at }, requestId);
}
