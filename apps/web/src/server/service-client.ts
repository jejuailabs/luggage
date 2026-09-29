import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getServerConfig } from "@/lib/env";

/**
 * service_role 클라이언트. 웹훅·스케줄 작업처럼 사용자 세션이 없는 서버 작업에서만 쓴다.
 * 비밀값이 없으면 null — 호출 쪽은 503으로 응답하고 결제를 확정하지 않는다.
 */
export function createSupabaseServiceClient(): SupabaseClient | null {
  const config = getServerConfig();
  if (!config.supabase || !config.secrets.supabaseServer) return null;
  return createClient(config.supabase.url, config.secrets.supabaseServer, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
