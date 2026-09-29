import { z } from "zod";
import { fail, newRequestId, ok } from "@/server/api";
import { dbErrorCode, requireAdmin } from "@/server/admin";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ enabled: z.boolean() }).strict();

/** 노선 판매 켜기/끄기. 같은 값으로 다시 요청해도 결과가 같다 (멱등). */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = newRequestId();
  const gate = await requireAdmin(request, requestId);
  if (!gate.ok) return gate.response;
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return fail("NOT_FOUND", requestId);

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("VALIDATION_FAILED", requestId);

  const { data, error } = await gate.auth.client
    .from("route_offerings")
    .update({ enabled: parsed.data.enabled })
    .eq("id", id)
    .select("id, enabled")
    .maybeSingle();
  if (error) return fail(dbErrorCode(error), requestId);
  if (!data) return fail("NOT_FOUND", requestId);
  return ok(data, requestId);
}
