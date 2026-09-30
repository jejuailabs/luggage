import { z } from "zod";
import { fail, failFromDb, isSameOrigin, newRequestId, ok } from "@/server/api";
import { getAuthContext } from "@/server/auth";

export const dynamic = "force-dynamic";
const schema = z.object({ reason: z.string().trim().min(1).max(500) }).strict();

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = newRequestId();
  const authorization = request.headers.get("authorization");
  if (!authorization && !isSameOrigin(request)) return fail("FORBIDDEN", requestId);
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return fail("NOT_FOUND", requestId);
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("VALIDATION_FAILED", requestId);
  const auth = await getAuthContext({ authorization });
  if (!auth.user || !auth.client) return fail("SESSION_REQUIRED", requestId);
  if (!auth.roles.some((role) => role.role === "admin" || role.role === "hotel_staff")) return fail("FORBIDDEN", requestId);
  const { data, error } = await auth.client.rpc("reissue_bag_tag", { p_bag_id: id, p_reason: parsed.data.reason }).single<{ id: string; tag_id: string; version: number }>();
  return error || !data ? failFromDb(error, requestId) : ok({ id: data.id, tagId: data.tag_id, version: data.version }, requestId);
}
