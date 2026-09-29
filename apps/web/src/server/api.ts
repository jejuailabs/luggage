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

/** DB 함수가 올린 업무 오류 코드 ('LUGGAGE:<CODE>'). 고객 문구 키는 booking.error.<CODE>다. */
export const BUSINESS_ERROR_CODES = [
  "SESSION_REQUIRED",
  "SLOT_NOT_FOUND",
  "ROUTE_NOT_AVAILABLE",
  "BOOKING_CUTOFF_PASSED",
  "ORIGIN_HOTEL_INVALID",
  "DESTINATION_HOTEL_INVALID",
  "FLIGHT_NUMBER_INVALID",
  "FLIGHT_REQUIRED",
  "FLIGHT_TOO_EARLY",
  "BAGS_INVALID",
  "PRICE_UNAVAILABLE",
  "CAPACITY_UNAVAILABLE",
  "QUOTE_NOT_FOUND",
  "QUOTE_EXPIRED",
  "QUOTE_ALREADY_ORDERED",
  "IDEMPOTENCY_CONFLICT",
  "ORDER_NOT_FOUND",
  "ORDER_NOT_PAYABLE",
  "CONTACT_INVALID",
  "POLICY_ACCEPTANCE_REQUIRED",
  "ORDER_NOT_CANCELLABLE",
  "CANCELLATION_WINDOW_CLOSED",
  "REFUND_NOT_FOUND",
  "REFUND_NOT_APPROVABLE",
  "REFUND_EXCEEDS_CAPTURED",
  "FORBIDDEN",
  "NOT_FOUND",
  "TAG_NOT_FOUND",
  "JOB_NOT_FOUND",
  "JOB_CANCELLED",
  "JOB_NOT_ASSIGNABLE",
  "DRIVER_INVALID",
  "BAG_NOT_IN_JOB",
  "VERSION_CONFLICT",
  "INVALID_TRANSITION",
  "EVIDENCE_REQUIRED",
  "EVIDENCE_INVALID",
  "EVIDENCE_LIMIT",
  "HANDOFF_NOT_READY",
  "HANDOFF_CODE_INVALID",
  "HANDOFF_CODE_EXPIRED",
  "HANDOFF_CODE_LOCKED",
  "SUPPORT_INVALID",
  "SUPPORT_LIMIT",
  "SETTLEMENT_NOT_CONFIRMABLE",
  "SETTLEMENT_NOT_PAYABLE",
  "PAYOUT_REFERENCE_REQUIRED",
  "HANDOFF_NOT_APPLICABLE",
  "FLIGHT_TOO_LATE",
  "VALIDATION_FAILED",
  "PAY_TICKET_INVALID",
] as const;
export type BusinessErrorCode = (typeof BUSINESS_ERROR_CODES)[number];

export function businessErrorCode(error: { message?: string } | null): BusinessErrorCode | null {
  const match = error?.message?.match(/^LUGGAGE:([A-Z_]+)$/);
  const code = match?.[1];
  return code && (BUSINESS_ERROR_CODES as readonly string[]).includes(code) ? (code as BusinessErrorCode) : null;
}

/** DB 오류를 API 응답으로 바꾼다. 내부 메시지·SQL은 노출하지 않는다. */
export function failFromDb(error: { message?: string; code?: string } | null, requestId: string) {
  const business = businessErrorCode(error);
  if (business === "SESSION_REQUIRED") return fail("SESSION_REQUIRED", requestId);
  if (business === "FORBIDDEN") return fail("FORBIDDEN", requestId);
  if (business === "REFUND_NOT_FOUND" || business === "NOT_FOUND" || business === "JOB_NOT_FOUND" || business === "TAG_NOT_FOUND") {
    return fail("NOT_FOUND", requestId, { messageKey: `field.error.${business}` });
  }
  if (business === "VALIDATION_FAILED") return fail("VALIDATION_FAILED", requestId);
  if (business === "VERSION_CONFLICT") return fail("CONFLICT", requestId, { messageKey: `field.error.${business}` });
  if (business === "IDEMPOTENCY_CONFLICT") return fail("IDEMPOTENCY_CONFLICT", requestId);
  if (business === "QUOTE_ALREADY_ORDERED") return fail("CONFLICT", requestId, { messageKey: `booking.error.${business}` });
  if (business === "QUOTE_NOT_FOUND" || business === "ORDER_NOT_FOUND" || business === "SLOT_NOT_FOUND") {
    return fail("NOT_FOUND", requestId, { messageKey: `booking.error.${business}` });
  }
  if (business === "CAPACITY_UNAVAILABLE") {
    return fail("CAPACITY_UNAVAILABLE", requestId, { messageKey: "booking.error.CAPACITY_UNAVAILABLE" });
  }
  if (business) return fail("BUSINESS_RULE_VIOLATION", requestId, { messageKey: `booking.error.${business}` });
  if (error?.code === "42501") return fail("FORBIDDEN", requestId);
  return fail("PROVIDER_UNAVAILABLE", requestId);
}
