import { z } from "zod";
import { fail, newRequestId, ok } from "@/server/api";
import { dbErrorCode, requireAdmin } from "@/server/admin";

export const dynamic = "force-dynamic";
const uuid = z.string().uuid();
const instant = z.string().datetime({ offset: true });
const status = z.enum(["draft", "active", "suspended", "archived"]);
const schema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("create"), code: z.string().regex(/^[a-z0-9][a-z0-9-]*$/).max(80), type: z.enum(["airport_counter", "airport_meeting_point"]), zoneId: uuid, nameKo: z.string().trim().min(1).max(120), floor: z.string().trim().max(80).nullable(), landmarkKo: z.string().trim().max(200).nullable(), validFrom: instant, validUntil: instant.nullable() }).strict(),
  z.object({ kind: z.literal("details"), id: uuid, nameKo: z.string().trim().min(1).max(120), floor: z.string().trim().max(80).nullable(), landmarkKo: z.string().trim().max(200).nullable(), validFrom: instant, validUntil: instant.nullable() }).strict(),
  z.object({ kind: z.literal("status"), id: uuid, status }).strict(),
  z.object({ kind: z.literal("translation"), id: uuid, locale: z.enum(["zh-CN", "en"]), name: z.string().trim().min(1).max(120), directions: z.string().trim().max(1000).nullable() }).strict(),
]);

export async function POST(request: Request) {
  const requestId = newRequestId();
  const gate = await requireAdmin(request, requestId);
  if (!gate.ok) return gate.response;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("VALIDATION_FAILED", requestId);
  const value = parsed.data;
  const client = gate.auth.client;
  if (value.kind === "create") {
    const { data: zone } = await client.from("service_zones").select("kind").eq("id", value.zoneId).maybeSingle();
    if (zone?.kind !== "airport") return fail("VALIDATION_FAILED", requestId);
    const { data, error } = await client.from("handoff_locations").insert({ code: value.code, type: value.type, zone_id: value.zoneId, name_ko: value.nameKo, floor: value.floor, landmark_ko: value.landmarkKo, valid_from: value.validFrom, valid_until: value.validUntil, status: "draft" }).select("id, code, status").single();
    return error ? fail(dbErrorCode(error), requestId) : ok(data, requestId, { status: 201 });
  }
  if (value.kind === "translation") {
    const { data, error } = await client.from("handoff_location_translations").upsert({ location_id: value.id, locale: value.locale, name: value.name, directions: value.directions }, { onConflict: "location_id,locale" }).select("id, locale").single();
    return error ? fail(dbErrorCode(error), requestId) : ok(data, requestId);
  }
  if (value.kind === "status" && value.status === "active") {
    const [location, translations] = await Promise.all([
      client.from("handoff_locations").select("floor, landmark_ko, photo_path").eq("id", value.id).maybeSingle(),
      client.from("handoff_location_translations").select("locale, directions").eq("location_id", value.id).in("locale", ["zh-CN", "en"]),
    ]);
    if (location.error || translations.error) return fail(dbErrorCode(location.error ?? translations.error), requestId);
    if (!location.data?.floor || !location.data.photo_path || !["zh-CN", "en"].every((locale) => translations.data?.some((row) => row.locale === locale && row.directions))) return fail("VALIDATION_FAILED", requestId);
  }
  const patch = value.kind === "status" ? { status: value.status } : { name_ko: value.nameKo, floor: value.floor, landmark_ko: value.landmarkKo, valid_from: value.validFrom, valid_until: value.validUntil };
  const { data, error } = await client.from("handoff_locations").update(patch).eq("id", value.id).select("id, code, status").maybeSingle();
  return error ? fail(dbErrorCode(error), requestId) : data ? ok(data, requestId) : fail("NOT_FOUND", requestId);
}
