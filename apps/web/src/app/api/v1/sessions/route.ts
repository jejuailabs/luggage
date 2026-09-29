import { fail, isSameOrigin, newRequestId, ok } from "@/server/api";
import { createSupabaseServerClient } from "@/server/supabase";

export const dynamic = "force-dynamic";

/** 현재 기기의 세션을 끝낸다. */
export async function DELETE(request: Request) {
  const requestId = newRequestId();
  if (!isSameOrigin(request)) return fail("FORBIDDEN", requestId, { messageKey: "error.crossOrigin" });
  const client = await createSupabaseServerClient();
  if (client) await client.auth.signOut({ scope: "local" });
  return ok({ signedOut: true }, requestId);
}
