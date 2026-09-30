import { z } from "zod";
import { dbErrorCode, requireAdmin } from "@/server/admin";
import { fail, newRequestId, ok } from "@/server/api";

const schema = z.object({ status: z.enum(["draft", "active", "suspended", "archived"]) }).strict();

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = newRequestId();
  const gate = await requireAdmin(request, requestId);
  if (!gate.ok) return gate.response;
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return fail("VALIDATION_FAILED", requestId);
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("VALIDATION_FAILED", requestId);
  const { data, error } = await gate.auth.client.from("hotel_partners")
    .update({ status: parsed.data.status }).eq("id", id).select("id, name, status").maybeSingle();
  if (error) return fail(dbErrorCode(error), requestId);
  if (!data) return fail("NOT_FOUND", requestId);
  return ok(data, requestId);
}
