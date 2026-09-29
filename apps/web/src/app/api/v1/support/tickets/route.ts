import { z } from "zod";
import { LOCALES } from "@luggage/i18n";
import { fail, failFromDb, newRequestId, ok } from "@/server/api";
import { requireSession } from "@/server/session-gate";

export const dynamic = "force-dynamic";

const bodySchema = z
  .object({
    orderId: z.string().uuid().optional(),
    locale: z.enum(LOCALES),
    subject: z.string().trim().min(1).max(200),
    body: z.string().trim().min(1).max(4000),
    clientMessageId: z.string().min(8).max(128),
  })
  .strict();

/** 고객 문의 접수. 주문을 지정하면 소유자만 가능하다. 같은 clientMessageId는 같은 문의. */
export async function POST(request: Request) {
  const requestId = newRequestId();
  const gate = await requireSession(request, requestId);
  if (!gate.ok) return gate.response;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("VALIDATION_FAILED", requestId);
  const body = parsed.data;
  const { data, error } = await gate.auth.client
    .rpc("create_support_ticket", {
      p_order_id: body.orderId ?? null,
      p_locale: body.locale,
      p_subject: body.subject,
      p_body: body.body,
      p_client_message_id: body.clientMessageId,
    })
    .single<{ id: string; status: string }>();
  if (error || !data) return failFromDb(error, requestId);
  return ok({ ticketId: data.id, status: data.status }, requestId, { status: 201 });
}
