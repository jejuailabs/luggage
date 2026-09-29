import "server-only";
import { z } from "zod";

/** 유입 쿠키: 랜딩(호텔 QR·캠페인)에서 설정, 주문 생성 때 서버가 읽어 귀속을 확정한다. */
export const ATTRIBUTION_COOKIE = "luggage_attr";
export const ATTRIBUTION_MAX_AGE_SECONDS = 30 * 24 * 3600;

const schema = z.object({
  partnerCode: z
    .string()
    .regex(/^[A-Z0-9]{4,16}$/)
    .optional(),
  channel: z.enum(["hotel_qr", "search", "xiaohongshu", "share", "direct"]).optional(),
  campaign: z
    .string()
    .regex(/^[A-Za-z0-9_-]{1,40}$/)
    .optional(),
  landing: z.string().max(200).optional(),
});
export type Attribution = z.infer<typeof schema>;

/** 변조된 쿠키는 무시한다 (귀속은 DB가 코드 유효성을 다시 확인한다). 개인정보는 담지 않는다. */
export function parseAttribution(raw: string | undefined): Attribution {
  if (!raw) return {};
  try {
    const parsed = schema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : {};
  } catch {
    return {};
  }
}

export function serializeAttribution(value: Attribution): string {
  return JSON.stringify(schema.parse(value));
}
