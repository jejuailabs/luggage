import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isLocale, LOCALE_COOKIE, negotiateLocale } from "@luggage/i18n";
import { ATTRIBUTION_COOKIE, ATTRIBUTION_MAX_AGE_SECONDS, parseAttribution, serializeAttribution } from "@/server/attribution";

/**
 * 1) 언어 접두어가 없는 요청을 쿠키 → Accept-Language → zh-CN 순으로 보낸다.
 * 2) Supabase 세션 쿠키를 갱신한다 (서버 컴포넌트는 쿠키를 쓸 수 없으므로 여기서 처리).
 * 3) 캠페인 링크(?cid=코드&ch=채널)의 유입을 쿠키에 남긴다. 호텔 QR 제휴 코드는 유지한다.
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const firstSegment = pathname.split("/")[1];
  if (!isLocale(firstSegment)) {
    const cookieLocale = request.cookies.get(LOCALE_COOKIE)?.value;
    const locale = isLocale(cookieLocale) ? cookieLocale : negotiateLocale(request.headers.get("accept-language"));
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
    url.search = search;
    return NextResponse.redirect(url);
  }

  const response = await refreshSupabaseSession(request);
  captureCampaign(request, response);
  return response;
}

const CAMPAIGN_CHANNELS = new Set(["search", "xiaohongshu", "share", "direct"]);

function captureCampaign(request: NextRequest, response: NextResponse) {
  const cid = request.nextUrl.searchParams.get("cid");
  if (!cid || !/^[A-Za-z0-9_-]{1,40}$/.test(cid)) return;
  const channelParam = request.nextUrl.searchParams.get("ch") ?? "search";
  const channel = CAMPAIGN_CHANNELS.has(channelParam) ? channelParam : "search";
  const current = parseAttribution(request.cookies.get(ATTRIBUTION_COOKIE)?.value);
  response.cookies.set(
    ATTRIBUTION_COOKIE,
    serializeAttribution({
      // 호텔 QR로 들어온 기록이 있으면 제휴 귀속을 그대로 둔다.
      partnerCode: current.partnerCode,
      channel: current.partnerCode ? current.channel : (channel as "search" | "xiaohongshu" | "share" | "direct"),
      campaign: cid,
      landing: request.nextUrl.pathname.slice(0, 200),
    }),
    { path: "/", maxAge: ATTRIBUTION_MAX_AGE_SECONDS, sameSite: "lax", httpOnly: true, secure: request.nextUrl.protocol === "https:" },
  );
}

async function refreshSupabaseSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  // 세션 쿠키가 없으면 Auth 서버를 호출하지 않는다.
  const hasSessionCookie = request.cookies.getAll().some((cookie) => cookie.name.startsWith("sb-"));
  if (!url || !key || !hasSessionCookie) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
      },
    },
  });
  await supabase.auth.getClaims();
  return response;
}

export const config = {
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};
