import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { LOCALES } from "@luggage/i18n";
import { getServerConfig } from "@/lib/env";
import { ATTRIBUTION_COOKIE, parseAttribution } from "@/server/attribution";

export const dynamic = "force-dynamic";

const bodySchema = z
  .object({
    event: z.enum(["landing_viewed", "hotel_selected"]),
    locale: z.enum(LOCALES),
    path: z.string().max(120).regex(/^\/[A-Za-z0-9/_-]*$/),
    hotel: z
      .string()
      .regex(/^[a-z0-9][a-z0-9-]*$/)
      .optional(),
  })
  .strict();

/**
 * 공개 페이지 조회 기록 (식별자 없음). 실패해도 화면·거래에 영향이 없도록 항상 204를 돌려준다.
 * 결제·인계 지표는 서버 트리거가 따로 기록한다.
 */
export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  const config = getServerConfig();
  if (parsed.success && config.supabase && config.publicDataSource !== "fixture") {
    const attribution = parseAttribution((await cookies()).get(ATTRIBUTION_COOKIE)?.value);
    const client = createClient(config.supabase.url, config.supabase.publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    await client
      .rpc("track_public_event", {
        p_event_type: parsed.data.event,
        p_locale: parsed.data.locale,
        p_route_type: null,
        p_hotel_slug: parsed.data.hotel ?? null,
        p_channel: attribution.channel ?? null,
        p_campaign: attribution.campaign ?? null,
        p_path: parsed.data.path,
      })
      .then(
        () => undefined,
        () => undefined,
      );
  }
  return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}
