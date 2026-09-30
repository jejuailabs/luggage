import { z } from "zod";
import { fail, failFromDb, newRequestId, ok } from "@/server/api";
import { requireSession } from "@/server/session-gate";

export const dynamic = "force-dynamic";

const schema = z.object({ originalEventId: z.string().uuid(), toStatus: z.enum(["registered", "at_origin", "collected", "in_transit", "ready_for_handoff", "exception_hold"]), reason: z.string().trim().min(10).max(1000), expectedVersion: z.number().int().positive(), clientEventId: z.string().min(8).max(128) }).strict();

export async function POST(request: Request) {
  const requestId = newRequestId();
  const gate = await requireSession(request, requestId);
  if (!gate.ok) return gate.response;
  if (!gate.auth.roles.some((role) => role.role === "dispatcher")) return fail("FORBIDDEN", requestId);
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("VALIDATION_FAILED", requestId);
  const { data, error } = await gate.auth.client.rpc("correct_bag_status", {
    p_original_event_id: parsed.data.originalEventId, p_to_status: parsed.data.toStatus,
    p_reason: parsed.data.reason, p_expected_version: parsed.data.expectedVersion,
    p_client_event_id: parsed.data.clientEventId,
  });
  if (error || !data) return failFromDb(error, requestId);
  return ok({ eventId: data.id, fromStatus: data.from_status, toStatus: data.to_status }, requestId, { status: 201 });
}
