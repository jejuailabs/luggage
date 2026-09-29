import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { successBody, type Health } from "@luggage/contracts";
import { getServerConfig } from "@/lib/env";

export const dynamic = "force-dynamic";

/** 설정 검증 결과와 연동 모드만 알린다. 비밀값·연결 문자열은 반환하지 않는다. */
export function GET() {
  const config = getServerConfig();
  const data: Health = { status: "ok", appEnv: config.appEnv, integrations: config.integrations };
  return NextResponse.json(successBody(data, randomUUID()), { headers: { "Cache-Control": "no-store" } });
}
