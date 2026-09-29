import { z } from "zod";
import { fail, newRequestId, ok } from "@/server/api";
import { getAuthContext } from "@/server/auth";
import { getOrderView } from "@/server/orders";

export const dynamic = "force-dynamic";

/** 주문 현재 상태. 소유 세션(또는 권한 있는 업무자)만 조회한다. 번호만으로는 열리지 않는다. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = newRequestId();
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return fail("NOT_FOUND", requestId);
  const auth = await getAuthContext({ authorization: request.headers.get("authorization") });
  if (!auth.user || !auth.client) return fail("SESSION_REQUIRED", requestId);
  const view = await getOrderView(auth.client, id);
  if (view === undefined) return fail("PROVIDER_UNAVAILABLE", requestId);
  if (view === null) return fail("NOT_FOUND", requestId);
  return ok(view, requestId);
}
