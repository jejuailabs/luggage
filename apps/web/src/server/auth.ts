import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { STAFF_ROLES, type RoleGrant, type StaffRole } from "@luggage/domain";
import { createSupabaseServerClient, createSupabaseTokenClient } from "./supabase";

export interface AuthContext {
  /** Supabase 설정이 없으면 false. 인증이 필요한 기능은 사용할 수 없다. */
  available: boolean;
  user: { id: string; isAnonymous: boolean } | null;
  roles: RoleGrant[];
  client: SupabaseClient | null;
}

function bearerToken(authorization: string | null | undefined): string | null {
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

/**
 * 요청 사용자를 확인한다. Authorization: Bearer 토큰이 있으면 우선하고, 없으면 웹 쿠키 세션을 쓴다.
 * getUser()는 Auth 서버에 토큰을 검증하므로 위조된 쿠키를 신뢰하지 않는다.
 */
export async function getAuthContext(options: { authorization?: string | null } = {}): Promise<AuthContext> {
  const token = bearerToken(options.authorization);
  const client = token ? createSupabaseTokenClient(token) : await createSupabaseServerClient();
  if (!client) return { available: false, user: null, roles: [], client: null };

  const { data, error } = token ? await client.auth.getUser(token) : await client.auth.getUser();
  if (error || !data.user) return { available: true, user: null, roles: [], client };

  const user = { id: data.user.id, isAnonymous: Boolean(data.user.is_anonymous) };
  if (user.isAnonymous) return { available: true, user, roles: [], client };

  // RLS가 본인 행만 돌려준다.
  const { data: rows } = await client.from("role_assignments").select("role, scope_type, scope_id");
  const roles: RoleGrant[] = (rows ?? [])
    .filter((row): row is { role: StaffRole; scope_type: "global" | "hotel"; scope_id: string | null } =>
      (STAFF_ROLES as readonly string[]).includes(row.role),
    )
    .map((row) => ({ role: row.role, scopeType: row.scope_type, scopeId: row.scope_id }));
  return { available: true, user, roles, client };
}
