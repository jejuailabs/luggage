import { z } from "zod";
import { LOCALES } from "@luggage/i18n";
import { fail, isSameOrigin, newRequestId, ok } from "@/server/api";
import { getAuthContext } from "@/server/auth";

export const dynamic = "force-dynamic";

const bodySchema = z
  .object({
    locale: z.enum(LOCALES).optional(),
    theme: z.enum(["light", "dark", "system"]).optional(),
  })
  .strict()
  .refine((value) => value.locale !== undefined || value.theme !== undefined, { message: "empty" });

/** 언어·테마 선호를 계정에 저장한다. 기기 쿠키가 우선이며 계정 값은 새 기기의 기본값이 된다. */
export async function PATCH(request: Request) {
  const requestId = newRequestId();
  const authorization = request.headers.get("authorization");
  if (!authorization && !isSameOrigin(request)) return fail("FORBIDDEN", requestId, { messageKey: "error.crossOrigin" });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("VALIDATION_FAILED", requestId);

  const auth = await getAuthContext({ authorization });
  if (!auth.user || !auth.client) return fail("SESSION_REQUIRED", requestId);

  const { data, error } = await auth.client
    .from("profiles")
    .update(parsed.data)
    .eq("user_id", auth.user.id)
    .select("locale, theme")
    .maybeSingle();
  if (error || !data) return fail("PROVIDER_UNAVAILABLE", requestId);
  return ok({ locale: data.locale, theme: data.theme }, requestId);
}
