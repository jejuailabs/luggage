import { z } from "zod";
import { dbErrorCode, requireAdmin } from "@/server/admin";
import { fail, newRequestId, ok } from "@/server/api";

const schema = z.object({ name: z.string().trim().min(1).max(120), contractReference: z.string().trim().max(200).optional() }).strict();

export async function POST(request: Request) {
  const requestId = newRequestId();
  const gate = await requireAdmin(request, requestId);
  if (!gate.ok) return gate.response;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("VALIDATION_FAILED", requestId);
  const { data, error } = await gate.auth.client.from("hotel_partners")
    .insert({ name: parsed.data.name, contract_reference: parsed.data.contractReference || null, status: "draft" })
    .select("id, name, status").single();
  if (error || !data) return fail(dbErrorCode(error), requestId);
  return ok(data, requestId, { status: 201 });
}
