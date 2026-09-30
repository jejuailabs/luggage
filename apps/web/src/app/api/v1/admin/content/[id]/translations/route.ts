import { z } from "zod";
import { fail, newRequestId, ok } from "@/server/api";
import { dbErrorCode, requireAdmin } from "@/server/admin";

export const dynamic = "force-dynamic";

const schema = z.object({
  locale: z.enum(["ko", "zh-CN", "en"]),
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(20_000),
}).strict();

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = newRequestId();
  const gate = await requireAdmin(request, requestId);
  if (!gate.ok) return gate.response;
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return fail("VALIDATION_FAILED", requestId);
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("VALIDATION_FAILED", requestId);
  const { data: item, error: itemError } = await gate.auth.client.from("content_items").select("source_version").eq("id", id).maybeSingle();
  if (itemError || !item) return fail(itemError ? dbErrorCode(itemError) : "NOT_FOUND", requestId);
  const { data, error } = await gate.auth.client.from("content_translations").insert({
    content_id: id,
    locale: parsed.data.locale,
    title: parsed.data.title,
    body: parsed.data.body,
    based_on_version: item.source_version,
    status: "draft",
  }).select("id, locale, status").single();
  if (error || !data) return fail(dbErrorCode(error), requestId);
  return ok(data, requestId, { status: 201 });
}
