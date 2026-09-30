import { NextResponse } from "next/server";
import { isLocale } from "@luggage/i18n";
import { ATTRIBUTION_COOKIE, ATTRIBUTION_MAX_AGE_SECONDS, serializeAttribution } from "@/server/attribution";
import { resolvePartnerCode } from "@/server/partner-codes";

export const dynamic = "force-dynamic";

/**
 * 호텔 QR 랜딩: /{locale}/h/{제휴코드}
 * 유효한 코드면 유입 쿠키(제휴 코드·hotel_qr)를 남기고 해당 지점이 선택된 호텔 화면으로 보낸다.
 * 귀속은 주문 생성 때 서버가 확정하며, 결제 후 이 쿠키를 바꿔도 달라지지 않는다.
 */
export async function GET(request: Request, { params }: { params: Promise<{ locale: string; code: string }> }) {
  const { locale: rawLocale, code } = await params;
  const locale = isLocale(rawLocale) ? rawLocale : "zh-CN";
  const hotelSlug = await resolvePartnerCode(code);
  const target = new URL(hotelSlug ? `/${locale}/luggage/book?hotel=${encodeURIComponent(hotelSlug)}` : `/${locale}/luggage/book`, request.url);
  const response = NextResponse.redirect(target, 302);
  if (hotelSlug) {
    response.cookies.set(
      ATTRIBUTION_COOKIE,
      serializeAttribution({ partnerCode: code.trim().toUpperCase(), channel: "hotel_qr", landing: `/${locale}/h/${code.trim().toUpperCase()}` }),
      { path: "/", maxAge: ATTRIBUTION_MAX_AGE_SECONDS, sameSite: "lax", httpOnly: true, secure: target.protocol === "https:" },
    );
  }
  response.headers.set("Cache-Control", "no-store");
  return response;
}
