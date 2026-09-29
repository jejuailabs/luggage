import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getServerConfig } from "@/lib/env";

/** fixture 모드 제휴 코드 (supabase/seed.sql과 같음). */
const FIXTURE_CODES: Record<string, string> = { SAMPLE01: "sample-hotel-jeju-city" };

/** 공개 제휴 코드 → 호텔 slug. 유효하지 않으면 null. 계약·정산 정보는 다루지 않는다. */
export async function resolvePartnerCode(code: string): Promise<string | null> {
  const normalized = code.trim().toUpperCase();
  if (!/^[A-Z0-9]{4,16}$/.test(normalized)) return null;
  const config = getServerConfig();
  if (config.publicDataSource === "fixture") return FIXTURE_CODES[normalized] ?? null;
  if (!config.supabase) return null;
  const client = createClient(config.supabase.url, config.supabase.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data } = await client.rpc("resolve_partner_code", { p_code: normalized }).maybeSingle<{ hotel_slug: string }>();
  return data?.hotel_slug ?? null;
}
