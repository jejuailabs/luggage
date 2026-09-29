import { z } from "zod";
import { fail, failFromDb, newRequestId, ok } from "@/server/api";
import { requireSession } from "@/server/session-gate";

export const dynamic = "force-dynamic";

/**
 * 고객 수령 코드 발급 (주문 소유자, 온라인 전용). 원문 코드는 이 응답에서만 보이고 서버에는 해시만 남는다.
 * 다시 발급하면 이전 코드는 무효가 된다.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = newRequestId();
  const gate = await requireSession(request, requestId);
  if (!gate.ok) return gate.response;
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return fail("NOT_FOUND", requestId);
  const { data, error } = await gate.auth.client
    .rpc("issue_handoff_challenge", { p_order_id: id })
    .single<{ code: string; expires_at: string; bag_count: number }>();
  if (error || !data) return failFromDb(error, requestId);
  return ok({ code: data.code, expiresAt: data.expires_at, bagCount: data.bag_count }, requestId, {
    status: 201,
    headers: { "Cache-Control": "no-store" },
  });
}
