import { z } from "zod";
import { fail, newRequestId, ok } from "@/server/api";
import { dbErrorCode, requireAdmin } from "@/server/admin";

export const dynamic = "force-dynamic";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("save"), title: z.string().trim().min(1).max(200), body: z.string().trim().min(1).max(20_000) }).strict(),
  z.object({ action: z.literal("review") }).strict(),
  z.object({ action: z.literal("publish") }).strict(),
  z.object({ action: z.literal("archive") }).strict(),
]);

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; locale: string }> }) {
  const requestId = newRequestId();
  const gate = await requireAdmin(request, requestId);
  if (!gate.ok) return gate.response;
  const { id, locale } = await params;
  if (!z.string().uuid().safeParse(id).success || !z.enum(["ko", "zh-CN", "en"]).safeParse(locale).success) return fail("VALIDATION_FAILED", requestId);
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("VALIDATION_FAILED", requestId);
  const client = gate.auth.client;
  const [{ data: item, error: itemError }, { data: translation, error: translationError }] = await Promise.all([
    client.from("content_items").select("source_version").eq("id", id).maybeSingle(),
    client.from("content_translations").select("id, status, title, body, needs_review, based_on_version").eq("content_id", id).eq("locale", locale).maybeSingle(),
  ]);
  if (itemError || translationError) return fail(dbErrorCode(itemError ?? translationError), requestId);
  if (!item || !translation) return fail("NOT_FOUND", requestId);

  const action = parsed.data.action;
  if (action === "publish" && (translation.status !== "review" || translation.needs_review || translation.based_on_version !== item.source_version || !translation.body.trim())) {
    return fail("CONFLICT", requestId);
  }
  if (action === "review" && (translation.status !== "draft" && translation.status !== "review" || !translation.body.trim())) return fail("CONFLICT", requestId);
  if (action === "archive" && translation.status === "archived") return ok({ id: translation.id, status: "archived" }, requestId);

  const patch = action === "save"
    ? { title: parsed.data.title, body: parsed.data.body, status: "draft", published_at: null, needs_review: false, based_on_version: item.source_version }
    : action === "review"
      ? { status: "review", published_at: null, needs_review: false, based_on_version: item.source_version }
      : action === "publish"
        ? { status: "published", published_at: new Date().toISOString() }
        : { status: "archived", published_at: null };
  const { data, error } = await client.from("content_translations").update(patch).eq("id", translation.id).select("id, locale, status, needs_review").single();
  if (error || !data) return fail(dbErrorCode(error), requestId);
  return ok(data, requestId);
}
