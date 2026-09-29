import "server-only";
import { timingSafeEqual } from "node:crypto";
import { getServerConfig } from "@/lib/env";

/**
 * 스케줄 작업 인증. Vercel Cron은 Authorization: Bearer <CRON_SECRET>을 보낸다.
 * 작업은 중복·지연 실행에 안전해야 하며(DB 함수가 보장) 정각 실행을 가정하지 않는다.
 */
export function isAuthorizedJob(request: Request): boolean {
  const secret = getServerConfig().secrets.cron;
  if (!secret) return false;
  const header = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  return header.length === expected.length && timingSafeEqual(Buffer.from(header), Buffer.from(expected));
}
