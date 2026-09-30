import { randomUUID } from "node:crypto";
import { z } from "zod";
import { fail, newRequestId, ok } from "@/server/api";
import { dbErrorCode, requireAdmin } from "@/server/admin";
import { createSupabaseServiceClient } from "@/server/service-client";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = newRequestId();
  const gate = await requireAdmin(request, requestId);
  if (!gate.ok) return gate.response;
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return fail("NOT_FOUND", requestId);
  const form = await request.formData().catch(() => null);
  const file = form?.get("photo");
  if (!(file instanceof File) || file.type !== "image/jpeg" || file.size < 1 || file.size > 5_242_880) return fail("VALIDATION_FAILED", requestId);
  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes.includes(Buffer.from("Exif\0\0"))) return fail("VALIDATION_FAILED", requestId);
  const { data: location, error: loadError } = await gate.auth.client.from("handoff_locations").select("id, photo_path").eq("id", id).maybeSingle();
  if (loadError) return fail(dbErrorCode(loadError), requestId);
  if (!location) return fail("NOT_FOUND", requestId);
  const service = createSupabaseServiceClient();
  if (!service) return fail("PROVIDER_UNAVAILABLE", requestId);
  const storagePath = `handoff/${id}/${randomUUID()}.jpg`;
  const uploaded = await service.storage.from("evidence").upload(storagePath, bytes, { contentType: "image/jpeg", upsert: false });
  if (uploaded.error) return fail("PROVIDER_UNAVAILABLE", requestId);
  const saved = await gate.auth.client.from("handoff_locations").update({ photo_path: storagePath }).eq("id", id).select("id, photo_path").single();
  if (saved.error) { await service.storage.from("evidence").remove([storagePath]); return fail(dbErrorCode(saved.error), requestId); }
  if (location.photo_path) await service.storage.from("evidence").remove([location.photo_path]);
  return ok({ id, photoSaved: true }, requestId);
}
