import { z } from "zod";
import { fail, newRequestId, ok } from "@/server/api";
import { dbErrorCode, requireAdmin } from "@/server/admin";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ status: z.enum(["draft", "active", "suspended", "archived"]) }).strict();

/** 호텔 상태 변경 (판매 노출·중지·보관). 변경은 audit_events에 자동 기록된다. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = newRequestId();
  const gate = await requireAdmin(request, requestId);
  if (!gate.ok) return gate.response;
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return fail("NOT_FOUND", requestId);

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("VALIDATION_FAILED", requestId);

  const { data, error } = await gate.auth.client
    .from("hotels")
    .update({ status: parsed.data.status })
    .eq("id", id)
    .select("id, status")
    .maybeSingle();
  if (error) return fail(dbErrorCode(error), requestId);
  if (!data) return fail("NOT_FOUND", requestId);
  return ok(data, requestId);
}
