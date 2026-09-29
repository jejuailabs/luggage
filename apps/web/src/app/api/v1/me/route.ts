import { fail, newRequestId, ok } from "@/server/api";
import { getAuthContext } from "@/server/auth";

export const dynamic = "force-dynamic";

/** 내 계정 요약. 웹 쿠키 또는 Authorization: Bearer 토큰으로 인증한다. */
export async function GET(request: Request) {
  const requestId = newRequestId();
  const auth = await getAuthContext({ authorization: request.headers.get("authorization") });
  if (!auth.user || !auth.client) return fail("SESSION_REQUIRED", requestId);

  const { data: profile } = await auth.client
    .from("profiles")
    .select("display_name, locale, theme")
    .eq("user_id", auth.user.id)
    .maybeSingle();

  return ok(
    {
      userId: auth.user.id,
      isAnonymous: auth.user.isAnonymous,
      profile: profile
        ? { displayName: profile.display_name, locale: profile.locale, theme: profile.theme }
        : null,
      roles: auth.roles,
    },
    requestId,
  );
}
