import { z } from "zod";
import { fail, failFromDb, newRequestId, ok } from "@/server/api";
import { requireSession } from "@/server/session-gate";

export const dynamic = "force-dynamic";

const bodySchema = z
  .object({
    body: z.string().trim().min(1).max(4000),
    // 고객은 customer만. internal(내부 메모)은 지원 담당만 쓸 수 있다 (DB 검사).
    visibility: z.enum(["customer", "internal"]).default("customer"),
    clientMessageId: z.string().min(8).max(128),
  })
  .strict();

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = newRequestId();
  const gate = await requireSession(request, requestId);
  if (!gate.ok) return gate.response;
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return fail("NOT_FOUND", requestId);
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("VALIDATION_FAILED", requestId);
  const { data, error } = await gate.auth.client
    .rpc("add_support_message", {
      p_ticket_id: id,
      p_body: parsed.data.body,
      p_visibility: parsed.data.visibility,
      p_client_message_id: parsed.data.clientMessageId,
    })
    .single<{ id: string }>();
  if (error || !data) return failFromDb(error, requestId);
  return ok({ messageId: data.id }, requestId, { status: 201 });
}
