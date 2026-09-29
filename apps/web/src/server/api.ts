import "server-only";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { errorBody, successBody, type ErrorCode } from "@luggage/contracts";

export function newRequestId(): string {
  return randomUUID();
}

export function ok<T>(data: T, requestId: string, init?: ResponseInit) {
  return NextResponse.json(successBody(data, requestId), {
    ...init,
    headers: { "Cache-Control": "no-store", ...init?.headers },
  });
}

export function fail(code: ErrorCode, requestId: string, options?: Parameters<typeof errorBody>[2]) {
  const { status, body } = errorBody(code, requestId, options);
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

/**
 * 쿠키 세션을 바꾸는 요청의 CSRF 방어. Origin이 요청 호스트와 같아야 한다.
 * Bearer 토큰 요청은 쿠키를 쓰지 않으므로 이 검사가 필요 없다.
 */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  // request.url은 서버가 정규화한 주소(예: localhost)일 수 있으므로 실제 요청 호스트 헤더와 비교한다.
  // Vercel은 x-forwarded-host를 플랫폼에서 설정한다.
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
