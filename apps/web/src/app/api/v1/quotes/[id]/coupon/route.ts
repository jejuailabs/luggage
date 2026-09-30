import { z } from "zod";
import { fail, failFromDb, isSameOrigin, newRequestId, ok } from "@/server/api";
import { getAuthContext } from "@/server/auth";
import { toQuoteDto, type QuoteRow } from "@/server/quote-dto";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ code: z.string().trim().max(24).default("") }).strict();

/** 견적에 쿠폰을 적용하거나(code) 해제한다(빈 문자열). 할인·세액은 DB가 다시 계산한다. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = newRequestId();
  const authorization = request.headers.get("authorization");
  if (!authorization && !isSameOrigin(request)) return fail("FORBIDDEN", requestId, { messageKey: "error.crossOrigin" });
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return fail("NOT_FOUND", requestId);
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("VALIDATION_FAILED", requestId);

  const auth = await getAuthContext({ authorization });
  if (!auth.user || !auth.client) return fail("SESSION_REQUIRED", requestId);
  const { data, error } = await auth.client
    .rpc("apply_quote_coupon", { p_quote_id: id, p_code: parsed.data.code })
    .single<QuoteRow>();
  if (error || !data) return failFromDb(error, requestId);
  return ok(toQuoteDto(data), requestId);
}
