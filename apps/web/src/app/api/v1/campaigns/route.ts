import { z } from "zod";
import { fail, newRequestId, ok } from "@/server/api";
import { dbErrorCode } from "@/server/admin";
import { requireSession } from "@/server/session-gate";

export const dynamic = "force-dynamic";

const bodySchema = z
  .object({
    code: z.string().regex(/^[A-Za-z0-9_-]{1,40}$/),
    channel: z.enum(["search", "xiaohongshu", "share", "direct"]),
    name: z.string().trim().min(1).max(120),
    postUrl: z.string().url().startsWith("https://").optional(),
    publishedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    keywords: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
    landingPath: z.string().regex(/^\/[A-Za-z0-9/_-]*$/).max(200),
  })
  .strict();

/** 캠페인 기록 (content_editor). 자동 게시·수집은 하지 않고 소재·링크·랜딩만 남긴다. */
export async function POST(request: Request) {
  const requestId = newRequestId();
  const gate = await requireSession(request, requestId);
  if (!gate.ok) return gate.response;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("VALIDATION_FAILED", requestId);
  const body = parsed.data;
  const { data, error } = await gate.auth.client
    .from("marketing_campaigns")
    .insert({
      code: body.code,
      channel: body.channel,
      name: body.name,
      post_url: body.postUrl ?? null,
      published_on: body.publishedOn ?? null,
      keywords: body.keywords,
      landing_path: body.landingPath,
      owner_id: gate.auth.user.id,
    })
    .select("id, code")
    .single();
  // RLS 거부(42501)는 403, 코드 중복(23505)은 409
  if (error || !data) return fail(dbErrorCode(error), requestId);
  return ok({ campaignId: data.id, code: data.code }, requestId, { status: 201 });
}
