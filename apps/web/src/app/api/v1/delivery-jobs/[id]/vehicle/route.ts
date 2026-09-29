import { z } from "zod";
import { fail, failFromDb, newRequestId, ok } from "@/server/api";
import { requireSession } from "@/server/session-gate";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ vehicleId: z.string().uuid().nullable() }).strict();

/** 작업 차량 지정 (dispatcher). 관제 단말 위치가 이 작업에 연결된다. */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = newRequestId();
  const gate = await requireSession(request, requestId);
  if (!gate.ok) return gate.response;
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return fail("NOT_FOUND", requestId);
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("VALIDATION_FAILED", requestId);
  const { error } = await gate.auth.client.rpc("set_job_vehicle", { p_job_id: id, p_vehicle_id: parsed.data.vehicleId });
  if (error) return failFromDb(error, requestId);
  return ok({ vehicleId: parsed.data.vehicleId }, requestId);
}
