import { z } from "zod";
import { fail, failFromDb, newRequestId, ok } from "@/server/api";
import { requireSession } from "@/server/session-gate";

export const dynamic = "force-dynamic";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const bodySchema = z.object({ partnerId: z.string().uuid(), periodStart: date, periodEnd: date }).strict();

/** 정산 초안 생성 (재무). 기간 안의 적격 수수료·환수 항목을 한 번만 담는다. */
export async function POST(request: Request) {
  const requestId = newRequestId();
  const gate = await requireSession(request, requestId);
  if (!gate.ok) return gate.response;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || parsed.data.periodEnd < parsed.data.periodStart) return fail("VALIDATION_FAILED", requestId);
  const { data, error } = await gate.auth.client
    .rpc("create_settlement_draft", {
      p_partner_id: parsed.data.partnerId,
      p_period_start: parsed.data.periodStart,
      p_period_end: parsed.data.periodEnd,
    })
    .single<{ id: string; total_minor: number; status: string }>();
  if (error || !data) return failFromDb(error, requestId);
  return ok({ batchId: data.id, totalMinor: data.total_minor, status: data.status }, requestId, { status: 201 });
}
