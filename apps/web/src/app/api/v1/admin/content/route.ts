import { z } from "zod";
import { fail, newRequestId, ok } from "@/server/api";
import { dbErrorCode, requireAdmin } from "@/server/admin";

export const dynamic = "force-dynamic";

const schema = z.object({
  slug: z.string().regex(/^[a-z0-9][a-z0-9-]*$/).max(80),
  kind: z.enum(["guide", "faq", "notice", "legal"]),
  criticality: z.enum(["general", "critical"]),
  sourceLocale: z.enum(["ko", "zh-CN", "en"]),
}).strict();

/** 문서 식별자를 초안으로 만든다. 문구와 게시 결정은 별도 단계다. */
export async function POST(request: Request) {
  const requestId = newRequestId();
  const gate = await requireAdmin(request, requestId);
  if (!gate.ok) return gate.response;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("VALIDATION_FAILED", requestId);
  const { data, error } = await gate.auth.client.from("content_items").insert({
    slug: parsed.data.slug,
    kind: parsed.data.kind,
    criticality: parsed.data.criticality,
    source_locale: parsed.data.sourceLocale,
  }).select("id, slug").single();
  if (error || !data) return fail(dbErrorCode(error), requestId);
  return ok(data, requestId, { status: 201 });
}
