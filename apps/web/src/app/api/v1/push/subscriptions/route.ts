import { z } from "zod";
import { fail, newRequestId, ok } from "@/server/api";
import { dbErrorCode } from "@/server/admin";
import { requireSession } from "@/server/session-gate";

export const dynamic = "force-dynamic";

const subscriptionSchema = z
  .object({
    endpoint: z.string().url().startsWith("https://").max(1000),
    keys: z.object({ p256dh: z.string().min(10).max(200), auth: z.string().min(8).max(100) }),
  })
  .passthrough();

/** 이 기기의 웹 푸시 구독 저장 (본인). 같은 endpoint는 다시 저장해도 한 건. */
export async function POST(request: Request) {
  const requestId = newRequestId();
  const gate = await requireSession(request, requestId);
  if (!gate.ok) return gate.response;
  const parsed = subscriptionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("VALIDATION_FAILED", requestId);
  const { client, user } = gate.auth;
  await client.from("push_subscriptions").delete().eq("endpoint", parsed.data.endpoint);
  const { error } = await client.from("push_subscriptions").insert({
    user_id: user.id,
    endpoint: parsed.data.endpoint,
    p256dh: parsed.data.keys.p256dh,
    auth: parsed.data.keys.auth,
  });
  if (error) return fail(dbErrorCode(error), requestId);
  return ok({ subscribed: true }, requestId, { status: 201 });
}

/** 구독 해제 (로그아웃·알림 끄기). */
export async function DELETE(request: Request) {
  const requestId = newRequestId();
  const gate = await requireSession(request, requestId);
  if (!gate.ok) return gate.response;
  const parsed = z.object({ endpoint: z.string().url() }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("VALIDATION_FAILED", requestId);
  await gate.auth.client.from("push_subscriptions").delete().eq("endpoint", parsed.data.endpoint);
  return ok({ subscribed: false }, requestId);
}
