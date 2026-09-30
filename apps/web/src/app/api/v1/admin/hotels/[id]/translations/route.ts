import { z } from "zod";
import { fail, newRequestId, ok } from "@/server/api";
import { dbErrorCode, requireAdmin } from "@/server/admin";

export const dynamic = "force-dynamic";
const schema = z.object({ locale: z.enum(["zh-CN", "en"]), name: z.string().trim().min(1).max(120), aliases: z.array(z.string().trim().min(1).max(60)).max(10), handoffNote: z.string().trim().max(1000).nullable() }).strict();

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = newRequestId();
  const gate = await requireAdmin(request, requestId);
  if (!gate.ok) return gate.response;
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return fail("NOT_FOUND", requestId);
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("VALIDATION_FAILED", requestId);
  const { data, error } = await gate.auth.client.from("hotel_translations").upsert({ hotel_id: id, locale: parsed.data.locale, name: parsed.data.name, aliases: parsed.data.aliases, handoff_note: parsed.data.handoffNote }, { onConflict: "hotel_id,locale" }).select("id, locale, name").single();
  return error ? fail(dbErrorCode(error), requestId) : ok(data, requestId);
}
