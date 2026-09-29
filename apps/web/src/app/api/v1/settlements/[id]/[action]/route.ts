import { z } from "zod";
import { fail, failFromDb, newRequestId, ok } from "@/server/api";
import { requireSession } from "@/server/session-gate";

export const dynamic = "force-dynamic";

const paidSchema = z.object({ payoutReference: z.string().trim().min(1).max(120) }).strict();

/**
 * 정산 확정(confirm)·지급 기록(paid) (재무).
 * 지급은 실제 이체 증빙 참조가 있어야 기록된다. 자동 송금은 검증된 공급사 연동 후 별도로 켠다.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string; action: string }> }) {
  const requestId = newRequestId();
  const gate = await requireSession(request, requestId);
  if (!gate.ok) return gate.response;
  const { id, action } = await params;
  if (!z.string().uuid().safeParse(id).success) return fail("NOT_FOUND", requestId);

  if (action === "confirm") {
    const { data, error } = await gate.auth.client.rpc("confirm_settlement", { p_batch_id: id }).single<{ status: string }>();
    if (error || !data) return failFromDb(error, requestId);
    return ok({ status: data.status }, requestId);
  }
  if (action === "paid") {
    const parsed = paidSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return fail("VALIDATION_FAILED", requestId);
    const { data, error } = await gate.auth.client
      .rpc("mark_settlement_paid", { p_batch_id: id, p_payout_reference: parsed.data.payoutReference })
      .single<{ status: string }>();
    if (error || !data) return failFromDb(error, requestId);
    return ok({ status: data.status }, requestId);
  }
  return fail("NOT_FOUND", requestId);
}
