import "server-only";
import { fail, isSameOrigin } from "./api";
import { getAuthContext, type AuthContext } from "./auth";

type SessionAuth = AuthContext & {
  user: NonNullable<AuthContext["user"]>;
  client: NonNullable<AuthContext["client"]>;
};

/**
 * 변경 요청 공통 관문: 쿠키 세션이면 동일 출처, Bearer 토큰이면 토큰 검증.
 * 세부 권한(배정·범위·소유)은 DB 함수와 RLS가 검사한다.
 */
export async function requireSession(
  request: Request,
  requestId: string,
): Promise<{ ok: true; auth: SessionAuth } | { ok: false; response: Response }> {
  const authorization = request.headers.get("authorization");
  if (!authorization && !isSameOrigin(request)) {
    return { ok: false, response: fail("FORBIDDEN", requestId, { messageKey: "error.crossOrigin" }) };
  }
  const auth = await getAuthContext({ authorization });
  if (!auth.user || !auth.client) return { ok: false, response: fail("SESSION_REQUIRED", requestId) };
  return { ok: true, auth: { ...auth, user: auth.user, client: auth.client } };
}
