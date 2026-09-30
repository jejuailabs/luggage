import { z } from "zod";
import { fail, failFromDb, isSameOrigin, newRequestId, ok } from "@/server/api";
import { getAuthContext } from "@/server/auth";
import { loadPublicCatalog } from "@/server/catalog";
import { toQuoteDto, type QuoteRow } from "@/server/quote-dto";

export const dynamic = "force-dynamic";

const slug = z.string().regex(/^[a-z0-9][a-z0-9-]*$/);
const bodySchema = z
  .object({
    slotId: z.string().uuid(),
    originHotel: slug.optional(),
    destinationHotel: slug.optional(),
    bags: z.object({ standard: z.number().int().min(0).max(50), large: z.number().int().min(0).max(50) }).strict(),
    flightNumber: z.string().trim().max(10).optional(),
    flightDepartsAt: z.string().datetime({ offset: true }).optional(),
    // 공항→숙소: 항공편 도착 시각
    flightArrivesAt: z.string().datetime({ offset: true }).optional(),
  })
  .strict();


/** 서버 견적. 금액은 DB 요금 규칙에서 계산하며 클라이언트 금액을 받지 않는다. */
export async function POST(request: Request) {
  const requestId = newRequestId();
  const authorization = request.headers.get("authorization");
  if (!authorization && !isSameOrigin(request)) return fail("FORBIDDEN", requestId, { messageKey: "error.crossOrigin" });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("VALIDATION_FAILED", requestId);
  const body = parsed.data;

  const auth = await getAuthContext({ authorization });
  if (!auth.user || !auth.client) return fail("SESSION_REQUIRED", requestId);

  const catalog = await loadPublicCatalog();
  if (!catalog) return fail("PROVIDER_UNAVAILABLE", requestId);
  const hotelId = (value: string | undefined) => (value ? catalog.hotels.find((h) => h.slug === value)?.id ?? null : null);
  const originHotelId = hotelId(body.originHotel);
  const destinationHotelId = hotelId(body.destinationHotel);
  if ((body.originHotel && !originHotelId) || (body.destinationHotel && !destinationHotelId)) {
    return fail("NOT_FOUND", requestId);
  }

  const { data, error } = await auth.client
    .rpc("create_quote", {
      p_slot_id: body.slotId,
      p_origin_hotel_id: originHotelId,
      p_destination_hotel_id: destinationHotelId,
      p_bag_counts: body.bags,
      p_flight_number: body.flightNumber ?? null,
      p_flight_departs_at: body.flightDepartsAt ?? null,
      p_flight_arrives_at: body.flightArrivesAt ?? null,
    })
    .single<QuoteRow>();
  if (error || !data) return failFromDb(error, requestId);

  return ok(
    toQuoteDto(data),
    requestId,
    { status: 201 },
  );
}
