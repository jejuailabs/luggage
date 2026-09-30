import { z } from "zod";
import { STAFF_ROLES } from "@luggage/domain";
import { fail, failFromDb, newRequestId, ok } from "@/server/api";
import { requireAdmin } from "@/server/admin";
import { getServerConfig } from "@/lib/env";
import { createSupabaseServiceClient } from "@/server/service-client";

export const dynamic = "force-dynamic";
const schema = z.object({ email: z.email().max(254), role: z.enum(STAFF_ROLES), scopeId: z.string().uuid().nullable() }).strict();

export async function POST(request: Request) {
  const requestId = newRequestId();
  const gate = await requireAdmin(request, requestId);
  if (!gate.ok) return gate.response;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || (parsed.data.role === "hotel_staff") !== Boolean(parsed.data.scopeId)) return fail("VALIDATION_FAILED", requestId);
  const service = createSupabaseServiceClient();
  if (!service) return fail("PROVIDER_UNAVAILABLE", requestId);
  const { appUrl } = getServerConfig();
  const { data, error } = await service.auth.admin.inviteUserByEmail(parsed.data.email.toLowerCase(), { redirectTo: `${appUrl}/auth/callback?next=/ko/account` });
  if (error || !data.user) return fail(error?.message?.toLowerCase().includes("already") ? "CONFLICT" : "PROVIDER_UNAVAILABLE", requestId);
  const grant = await gate.auth.client.rpc("admin_set_member_role", { p_user_id: data.user.id, p_role: parsed.data.role, p_scope_id: parsed.data.scopeId, p_enabled: true });
  if (grant.error) return failFromDb(grant.error, requestId);
  return ok({ invited: true, userId: data.user.id }, requestId, { status: 201 });
}
