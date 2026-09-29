import { cookies } from "next/headers";
import { z } from "zod";
import { LOCALES } from "@luggage/i18n";
import { fail, failFromDb, isSameOrigin, newRequestId, ok } from "@/server/api";
import { getAuthContext } from "@/server/auth";
import { ATTRIBUTION_COOKIE, parseAttribution } from "@/server/attribution";
import { getOrderView } from "@/server/orders";

export const dynamic = "force-dynamic";

const bodySchema = z
  .object({
    quoteId: z.string().uuid(),
    contact: z
      .object({
        name: z.string().trim().min(1).max(80),
        email: z.string().trim().max(254).optional(),
        phone: z.string().trim().max(24).optional(),
        wechat: z.string().trim().max(40).optional(),
      })
      .strict(),
    locale: z.enum(LOCALES),
    acceptedPolicies: z.array(z.string().max(80)).max(10),
  })
  .strict();

/**
 * 주문 생성 (견적 재검증 → 용량 홀드). Idempotency-Key 헤더가 필수다.
 * 같은 키·같은 본문은 같은 주문, 같은 키·다른 본문은 409.
 */
export async function POST(request: Request) {
  const requestId = newRequestId();
  const authorization = request.headers.get("authorization");
  if (!authorization && !isSameOrigin(request)) return fail("FORBIDDEN", requestId, { messageKey: "error.crossOrigin" });

  const idempotencyKey = request.headers.get("idempotency-key");
  if (!idempotencyKey || !/^[A-Za-z0-9_-]{8,128}$/.test(idempotencyKey)) {
    return fail("VALIDATION_FAILED", requestId, { fieldErrors: { "Idempotency-Key": "error.idempotencyKeyRequired" } });
  }
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("VALIDATION_FAILED", requestId);

  const auth = await getAuthContext({ authorization });
  if (!auth.user || !auth.client) return fail("SESSION_REQUIRED", requestId);

  const { contact, ...body } = parsed.data;
  // 유입 귀속은 주문 생성 트랜잭션에서 확정된다 (결제 후 URL·쿠키 변경으로 바뀌지 않음).
  const attribution = parseAttribution((await cookies()).get(ATTRIBUTION_COOKIE)?.value);
  const { data, error } = await auth.client
    .rpc("create_order_with_attribution", {
      p_quote_id: body.quoteId,
      p_idempotency_key: idempotencyKey,
      p_contact: contact,
      p_locale: body.locale,
      p_accepted_policies: body.acceptedPolicies,
      p_attribution: attribution,
    })
    .single<{ id: string }>();
  if (error || !data) return failFromDb(error, requestId);

  const view = await getOrderView(auth.client, data.id);
  if (!view) return fail("PROVIDER_UNAVAILABLE", requestId);
  return ok(view, requestId, { status: 201 });
}
