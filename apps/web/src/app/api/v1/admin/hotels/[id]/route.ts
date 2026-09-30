import { z } from "zod";
import { fail, newRequestId, ok } from "@/server/api";
import { dbErrorCode, requireAdmin } from "@/server/admin";

export const dynamic = "force-dynamic";

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const bodySchema = z.object({ status: z.enum(["draft", "active", "suspended", "archived"]).optional(), partnerId: z.string().uuid().nullable().optional(), nameKo: z.string().trim().min(1).max(120).optional(), addressKo: z.string().trim().min(1).max(300).optional(), zoneId: z.string().uuid().optional(), frontDeskOpensAt: time.nullable().optional(), frontDeskClosesAt: time.nullable().optional() }).strict().refine((value) => Object.values(value).some((field) => field !== undefined)).refine((value) => (value.frontDeskOpensAt === undefined) === (value.frontDeskClosesAt === undefined), { path: ["frontDeskClosesAt"] });

/** 호텔 상태 변경 (판매 노출·중지·보관). 변경은 audit_events에 자동 기록된다. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = newRequestId();
  const gate = await requireAdmin(request, requestId);
  if (!gate.ok) return gate.response;
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return fail("NOT_FOUND", requestId);

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("VALIDATION_FAILED", requestId);

  const { data, error } = await gate.auth.client
    .from("hotels")
    .update({ ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}), ...(parsed.data.partnerId !== undefined ? { partner_id: parsed.data.partnerId } : {}), ...(parsed.data.nameKo !== undefined ? { name_ko: parsed.data.nameKo } : {}), ...(parsed.data.addressKo !== undefined ? { address_ko: parsed.data.addressKo } : {}), ...(parsed.data.zoneId !== undefined ? { zone_id: parsed.data.zoneId } : {}), ...(parsed.data.frontDeskOpensAt !== undefined ? { front_desk_opens_at: parsed.data.frontDeskOpensAt } : {}), ...(parsed.data.frontDeskClosesAt !== undefined ? { front_desk_closes_at: parsed.data.frontDeskClosesAt } : {}) })
    .eq("id", id)
    .select("id, status, partner_id")
    .maybeSingle();
  if (error) return fail(dbErrorCode(error), requestId);
  if (!data) return fail("NOT_FOUND", requestId);
  return ok(data, requestId);
}
