import { z } from "zod";
import { ROUTE_TYPES } from "@luggage/domain";
import { fail, newRequestId, ok } from "@/server/api";
import { loadPublicCatalog } from "@/server/catalog";
import { findOffering, listAvailableSlots } from "@/server/slots";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  hotel: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
  routeType: z.enum(ROUTE_TYPES),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

/** 호텔·노선·날짜(한국 기준)의 예약 가능한 슬롯. */
export async function GET(request: Request) {
  const requestId = newRequestId();
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const parsed = querySchema.safeParse(params);
  if (!parsed.success) return fail("VALIDATION_FAILED", requestId);

  const catalog = await loadPublicCatalog();
  if (!catalog) return fail("PROVIDER_UNAVAILABLE", requestId);
  const hotel = catalog.hotels.find((h) => h.slug === parsed.data.hotel);
  if (!hotel) return fail("NOT_FOUND", requestId);
  const offering = findOffering(catalog, parsed.data.routeType, hotel);
  if (!offering) return ok({ routeOfferingId: null, slots: [] }, requestId);

  const slots = await listAvailableSlots(offering.id, parsed.data.date);
  if (!slots) return fail("PROVIDER_UNAVAILABLE", requestId);
  return ok({ routeOfferingId: offering.id, slots }, requestId);
}
