import "server-only";
import { fail, isSameOrigin } from "./api";
import { getAuthContext, type AuthContext } from "./auth";

type AdminAuth = AuthContext & { client: NonNullable<AuthContext["client"]> };
type AdminResult = { ok: true; auth: AdminAuth } | { ok: false; response: Response };

/**
 * 관리 API 공통 관문: 쿠키 요청은 동일 출처, 로그인, admin 역할.
 * 최종 권한은 DB RLS가 다시 검사한다 (역할이 바뀌어도 우회 불가).
 */
export async function requireAdmin(request: Request, requestId: string): Promise<AdminResult> {
  const authorization = request.headers.get("authorization");
  if (!authorization && !isSameOrigin(request)) {
    return { ok: false, response: fail("FORBIDDEN", requestId, { messageKey: "error.crossOrigin" }) };
  }
  const auth = await getAuthContext({ authorization });
  if (!auth.user || !auth.client) return { ok: false, response: fail("SESSION_REQUIRED", requestId) };
  if (!auth.roles.some((r) => r.role === "admin")) return { ok: false, response: fail("FORBIDDEN", requestId) };
  return { ok: true, auth: { ...auth, client: auth.client } };
}

/** Postgres 오류 코드를 API 오류로 바꾼다. 내부 메시지는 노출하지 않는다. */
export function dbErrorCode(error: { code?: string } | null): "CONFLICT" | "VALIDATION_FAILED" | "FORBIDDEN" | "PROVIDER_UNAVAILABLE" {
  switch (error?.code) {
    case "23505":
    case "23P01":
      return "CONFLICT";
    case "23514":
    case "23503":
    case "22P02":
      return "VALIDATION_FAILED";
    case "42501":
      return "FORBIDDEN";
    default:
      return "PROVIDER_UNAVAILABLE";
  }
}
