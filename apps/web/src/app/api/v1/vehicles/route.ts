import { z } from "zod";
import { fail, newRequestId, ok } from "@/server/api";
import { dbErrorCode } from "@/server/admin";
import { requireSession } from "@/server/session-gate";

export const dynamic = "force-dynamic";

const bodySchema = z
  .object({
    label: z.string().trim().min(1).max(60),
    telematicsDeviceId: z
      .string()
      .regex(/^[A-Za-z0-9_.:-]{1,80}$/)
      .optional(),
  })
  .strict();

/** 차량 등록 (admin). 관제 단말 ID를 넣으면 웹훅 위치가 이 차량으로 연결된다. */
export async function POST(request: Request) {
  const requestId = newRequestId();
  const gate = await requireSession(request, requestId);
  if (!gate.ok) return gate.response;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("VALIDATION_FAILED", requestId);
  const { data, error } = await gate.auth.client
    .from("vehicles")
    .insert({ label: parsed.data.label, telematics_device_id: parsed.data.telematicsDeviceId ?? null })
    .select("id")
    .single();
  if (error || !data) return fail(dbErrorCode(error), requestId);
  return ok({ vehicleId: data.id }, requestId, { status: 201 });
}
