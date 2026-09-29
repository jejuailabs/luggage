import { z } from "zod";

/** 04 문서 3절의 오류 코드. 고객에게는 messageKey로 번역된 문구만 보여 준다. */
export const ERROR_CODES = {
  VALIDATION_FAILED: 400,
  SESSION_REQUIRED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  IDEMPOTENCY_CONFLICT: 409,
  CAPACITY_UNAVAILABLE: 422,
  BUSINESS_RULE_VIOLATION: 422,
  RATE_LIMITED: 429,
  PROVIDER_UNAVAILABLE: 503,
  INTERNAL_ERROR: 500,
} as const;
export type ErrorCode = keyof typeof ERROR_CODES;

export const metaSchema = z.object({
  requestId: z.string().uuid(),
  serverTime: z.string().datetime().optional(),
});
export type Meta = z.infer<typeof metaSchema>;

export const errorBodySchema = z.object({
  error: z.object({
    code: z.enum(Object.keys(ERROR_CODES) as [ErrorCode, ...ErrorCode[]]),
    messageKey: z.string(),
    fieldErrors: z.record(z.string(), z.string()).optional(),
    retryable: z.boolean(),
  }),
  meta: metaSchema,
});
export type ErrorBody = z.infer<typeof errorBodySchema>;

export function successBody<T>(data: T, requestId: string, now = new Date()) {
  return { data, meta: { requestId, serverTime: now.toISOString() } };
}

export function errorBody(
  code: ErrorCode,
  requestId: string,
  options: { messageKey?: string; fieldErrors?: Record<string, string>; retryable?: boolean } = {},
): { status: number; body: ErrorBody } {
  return {
    status: ERROR_CODES[code],
    body: {
      error: {
        code,
        messageKey: options.messageKey ?? `error.${code}`,
        ...(options.fieldErrors ? { fieldErrors: options.fieldErrors } : {}),
        retryable: options.retryable ?? (code === "PROVIDER_UNAVAILABLE" || code === "RATE_LIMITED"),
      },
      meta: { requestId },
    },
  };
}

export const healthSchema = z.object({
  status: z.literal("ok"),
  appEnv: z.enum(["local", "preview", "staging", "production"]),
  integrations: z.record(z.string(), z.enum(["mock", "sandbox", "live"])),
});
export type Health = z.infer<typeof healthSchema>;
