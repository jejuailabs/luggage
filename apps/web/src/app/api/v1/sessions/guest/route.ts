import { fail, isSameOrigin, newRequestId, ok } from "@/server/api";
import { getAuthContext } from "@/server/auth";

export const dynamic = "force-dynamic";

/**
 * 비회원(guest) 소유 세션을 만든다. Supabase anonymous auth 사용자이며 쿠키 세션으로 유지된다.
 * 이미 세션이 있으면 그대로 돌려준다 (중복 클릭·재시도 안전).
 */
export async function POST(request: Request) {
  const requestId = newRequestId();
  if (!isSameOrigin(request)) return fail("FORBIDDEN", requestId, { messageKey: "error.crossOrigin" });

  const auth = await getAuthContext();
  if (!auth.available || !auth.client) {
    return fail("PROVIDER_UNAVAILABLE", requestId, { messageKey: "error.authUnavailable" });
  }
  if (auth.user) return ok({ userId: auth.user.id, isAnonymous: auth.user.isAnonymous, created: false }, requestId);

  const { data, error } = await auth.client.auth.signInAnonymously();
  if (error || !data.user) {
    // 프로젝트에서 anonymous sign-in이 꺼져 있거나 제한에 걸린 경우
    return fail("PROVIDER_UNAVAILABLE", requestId, { messageKey: "error.guestSessionUnavailable" });
  }
  return ok({ userId: data.user.id, isAnonymous: true, created: true }, requestId, { status: 201 });
}
