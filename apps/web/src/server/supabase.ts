import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { getServerConfig } from "@/lib/env";

/** 쿠키 세션을 쓰는 서버 클라이언트 (웹). Supabase가 설정되지 않았으면 null. */
export async function createSupabaseServerClient(): Promise<SupabaseClient | null> {
  const supabase = getServerConfig().supabase;
  if (!supabase) return null;
  const cookieStore = await cookies();
  return createServerClient(supabase.url, supabase.publishableKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          // 서버 컴포넌트 렌더 중에는 쿠키를 쓸 수 없다. 갱신은 proxy와 route handler가 맡는다.
        }
      },
    },
  });
}

/** Bearer 토큰을 쓰는 클라이언트 (미니프로그램·향후 클라이언트). RLS는 토큰 사용자 기준으로 적용된다. */
export function createSupabaseTokenClient(accessToken: string): SupabaseClient | null {
  const supabase = getServerConfig().supabase;
  if (!supabase) return null;
  return createClient(supabase.url, supabase.publishableKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
