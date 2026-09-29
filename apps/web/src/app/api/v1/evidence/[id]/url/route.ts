import { z } from "zod";
import { fail, newRequestId, ok } from "@/server/api";
import { getAuthContext } from "@/server/auth";
import { createSupabaseServiceClient } from "@/server/service-client";

export const dynamic = "force-dynamic";

/** 인계 사진 열람용 60초 서명 URL. RLS로 이 주문과 관련된 사람인지 먼저 확인한다. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = newRequestId();
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return fail("NOT_FOUND", requestId);
  const auth = await getAuthContext({ authorization: request.headers.get("authorization") });
  if (!auth.user || !auth.client) return fail("SESSION_REQUIRED", requestId);

  const { data: evidence } = await auth.client.from("evidence_files").select("storage_path").eq("id", id).maybeSingle();
  if (!evidence) return fail("NOT_FOUND", requestId);
  const service = createSupabaseServiceClient();
  if (!service) return fail("PROVIDER_UNAVAILABLE", requestId);
  const { data, error } = await service.storage.from("evidence").createSignedUrl(evidence.storage_path, 60);
  if (error || !data) return fail("NOT_FOUND", requestId);
  return ok({ url: data.signedUrl, expiresInSeconds: 60 }, requestId, { headers: { "Cache-Control": "no-store" } });
}
