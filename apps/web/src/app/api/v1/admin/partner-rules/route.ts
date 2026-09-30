import { z } from "zod";
import { fail, newRequestId, ok } from "@/server/api";
import { dbErrorCode, requireFinance } from "@/server/admin";

export const dynamic = "force-dynamic";
const uuid = z.string().uuid();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const status = z.enum(["draft", "active", "suspended", "archived"]);
const route = z.enum(["hotel_to_airport", "airport_to_hotel", "hotel_to_hotel"]);
const schema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("code"), code: z.string().regex(/^[A-Z0-9]{4,16}$/), partnerId: uuid, hotelId: uuid, routes: z.array(route).min(1).max(3), validFrom: date, validUntil: date.nullable() }).strict(),
  z.object({ kind: z.literal("commission"), partnerId: uuid, mode: z.enum(["flat_per_order", "percent_of_total"]), amountMinor: z.number().int().min(0).max(10_000_000).nullable(), rateBp: z.number().int().min(0).max(10_000).nullable(), validFrom: date, validUntil: date.nullable() }).strict(),
  z.object({ kind: z.literal("codeStatus"), id: uuid, status }).strict(),
  z.object({ kind: z.literal("commissionStatus"), id: uuid, status }).strict(),
  z.object({ kind: z.literal("commissionEnd"), id: uuid, validUntil: date.nullable() }).strict(),
]);

export async function POST(request: Request) {
  const requestId = newRequestId();
  const gate = await requireFinance(request, requestId);
  if (!gate.ok) return gate.response;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("VALIDATION_FAILED", requestId);
  const value = parsed.data;
  const client = gate.auth.client;
  if (value.kind === "code") {
    const { data: hotel, error: hotelError } = await client.from("hotels").select("partner_id").eq("id", value.hotelId).maybeSingle();
    if (hotelError) return fail(dbErrorCode(hotelError), requestId);
    if (hotel?.partner_id !== value.partnerId) return fail("VALIDATION_FAILED", requestId);
    const { data, error } = await client.from("partner_codes").insert({ code: value.code, partner_id: value.partnerId, hotel_id: value.hotelId, applicable_routes: value.routes, valid_from: value.validFrom, valid_until: value.validUntil, status: "draft" }).select("id, code, status").single();
    return error ? fail(dbErrorCode(error), requestId) : ok(data, requestId, { status: 201 });
  }
  if (value.kind === "commission") {
    if ((value.mode === "flat_per_order" && (value.amountMinor === null || value.rateBp !== null)) || (value.mode === "percent_of_total" && (value.rateBp === null || value.amountMinor !== null))) return fail("VALIDATION_FAILED", requestId);
    const { data, error } = await client.from("commission_rules").insert({ partner_id: value.partnerId, kind: value.mode, amount_minor: value.amountMinor, rate_bp: value.rateBp, valid_from: value.validFrom, valid_until: value.validUntil, status: "draft" }).select("id, status").single();
    return error ? fail(dbErrorCode(error), requestId) : ok(data, requestId, { status: 201 });
  }
  const table = value.kind === "codeStatus" ? "partner_codes" : "commission_rules";
  const patch = value.kind === "commissionEnd" ? { valid_until: value.validUntil } : { status: value.status };
  const { data, error } = await client.from(table).update(patch).eq("id", value.id).select("id, status").maybeSingle();
  return error ? fail(dbErrorCode(error), requestId) : data ? ok(data, requestId) : fail("NOT_FOUND", requestId);
}
