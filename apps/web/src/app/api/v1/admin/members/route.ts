import { z } from "zod";
import { STAFF_ROLES } from "@luggage/domain";
import { fail, failFromDb, newRequestId, ok } from "@/server/api";
import { requireAdmin } from "@/server/admin";

const schema = z.object({
  userId: z.string().uuid(),
  role: z.enum(STAFF_ROLES),
  scopeId: z.string().uuid().nullable(),
  enabled: z.boolean(),
}).strict();

export async function GET(request: Request) {
  const requestId = newRequestId();
  const gate = await requireAdmin(request, requestId);
  if (!gate.ok) return gate.response;
  const { data, error } = await gate.auth.client.rpc("admin_list_members");
  if (error) return failFromDb(error, requestId);
  return ok({ members: data ?? [] }, requestId);
}

export async function POST(request: Request) {
  const requestId = newRequestId();
  const gate = await requireAdmin(request, requestId);
  if (!gate.ok) return gate.response;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("VALIDATION_FAILED", requestId);
  const { data, error } = await gate.auth.client.rpc("admin_set_member_role", {
    p_user_id: parsed.data.userId,
    p_role: parsed.data.role,
    p_scope_id: parsed.data.scopeId,
    p_enabled: parsed.data.enabled,
  });
  if (error) return failFromDb(error, requestId);
  return ok({ saved: Boolean(data) }, requestId);
}
