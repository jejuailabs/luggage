import { z } from "zod";
import { fail, newRequestId, ok } from "@/server/api";
import { dbErrorCode, requireAdmin } from "@/server/admin";

export const dynamic = "force-dynamic";

const uuid = z.string().uuid();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const dateTime = z.string().datetime({ offset: true });
const status = z.enum(["draft", "active", "suspended", "archived"]);
const schema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("zone"), code: z.string().regex(/^[a-z0-9][a-z0-9-]*$/).max(50), nameKo: z.string().trim().min(1).max(80), nameZh: z.string().trim().max(80), nameEn: z.string().trim().max(80), sortOrder: z.number().int().min(0).max(9999) }).strict(),
  z.object({ kind: z.literal("price"), routeOfferingId: uuid, bagSize: z.enum(["standard", "large"]), amount: z.number().int().min(0).max(10_000_000), validFrom: date, validUntil: date.nullable() }).strict(),
  z.object({ kind: z.literal("slot"), routeOfferingId: uuid, serviceDate: date, pickupStartsAt: dateTime, pickupEndsAt: dateTime, deliveryStartsAt: dateTime, deliveryEndsAt: dateTime, bookingCutoffAt: dateTime, maxUnits: z.number().int().min(0).max(100_000) }).strict(),
  z.object({ kind: z.literal("zoneStatus"), id: uuid, status }).strict(),
  z.object({ kind: z.literal("priceStatus"), id: uuid, status }).strict(),
  z.object({ kind: z.literal("priceRange"), id: uuid, validUntil: date.nullable() }).strict(),
  z.object({ kind: z.literal("slotStatus"), id: uuid, status }).strict(),
  z.object({ kind: z.literal("capacity"), slotId: uuid, maxUnits: z.number().int().min(0).max(100_000) }).strict(),
]);

export async function POST(request: Request) {
  const requestId = newRequestId();
  const gate = await requireAdmin(request, requestId);
  if (!gate.ok) return gate.response;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("VALIDATION_FAILED", requestId);
  const value = parsed.data;
  const client = gate.auth.client;
  if (value.kind === "zone") {
    const { data, error } = await client.from("service_zones").insert({ code: value.code, kind: "area", name_ko: value.nameKo, display_names: { "zh-CN": value.nameZh, en: value.nameEn }, sort_order: value.sortOrder, status: "draft" }).select("id, code, status").single();
    return error ? fail(dbErrorCode(error), requestId) : ok(data, requestId, { status: 201 });
  }
  if (value.kind === "price") {
    const { data, error } = await client.from("price_rules").insert({ route_offering_id: value.routeOfferingId, bag_size: value.bagSize, unit_amount_minor: value.amount, valid_from: value.validFrom, valid_until: value.validUntil, status: "draft" }).select("id, status").single();
    return error ? fail(dbErrorCode(error), requestId) : ok(data, requestId, { status: 201 });
  }
  if (value.kind === "slot") {
    const times = [value.bookingCutoffAt, value.pickupStartsAt, value.pickupEndsAt, value.deliveryStartsAt, value.deliveryEndsAt].map(Date.parse);
    if (times.some(Number.isNaN) || times.some((time, index) => index > 0 && time < (times[index - 1] ?? Number.POSITIVE_INFINITY))) return fail("VALIDATION_FAILED", requestId);
    const { data: slot, error } = await client.from("service_slots").insert({ route_offering_id: value.routeOfferingId, service_date: value.serviceDate, pickup_starts_at: value.pickupStartsAt, pickup_ends_at: value.pickupEndsAt, delivery_starts_at: value.deliveryStartsAt, delivery_ends_at: value.deliveryEndsAt, booking_cutoff_at: value.bookingCutoffAt, status: "draft" }).select("id, status").single();
    if (error || !slot) return fail(dbErrorCode(error), requestId);
    const bucket = await client.from("capacity_buckets").insert({ slot_id: slot.id, max_units: value.maxUnits });
    if (bucket.error) return fail(dbErrorCode(bucket.error), requestId);
    return ok(slot, requestId, { status: 201 });
  }
  if (value.kind === "capacity") {
    const { data, error } = await client.from("capacity_buckets").update({ max_units: value.maxUnits }).eq("slot_id", value.slotId).select("slot_id, max_units, held_units, committed_units").maybeSingle();
    return error ? fail(dbErrorCode(error), requestId) : data ? ok(data, requestId) : fail("NOT_FOUND", requestId);
  }
  if (value.kind === "priceRange") {
    const { data, error } = await client.from("price_rules").update({ valid_until: value.validUntil }).eq("id", value.id).select("id, valid_from, valid_until").maybeSingle();
    return error ? fail(dbErrorCode(error), requestId) : data ? ok(data, requestId) : fail("NOT_FOUND", requestId);
  }
  if (value.kind === "slotStatus" && value.status === "active") {
    const { data: bucket, error: bucketError } = await client.from("capacity_buckets").select("id").eq("slot_id", value.id).maybeSingle();
    if (bucketError) return fail(dbErrorCode(bucketError), requestId);
    if (!bucket) return fail("VALIDATION_FAILED", requestId);
  }
  const table = value.kind === "zoneStatus" ? "service_zones" : value.kind === "priceStatus" ? "price_rules" : "service_slots";
  const { data, error } = await client.from(table).update({ status: value.status }).eq("id", value.id).select("id, status").maybeSingle();
  return error ? fail(dbErrorCode(error), requestId) : data ? ok(data, requestId) : fail("NOT_FOUND", requestId);
}
