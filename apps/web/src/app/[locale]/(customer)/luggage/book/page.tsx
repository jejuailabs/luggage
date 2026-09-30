import type { Metadata } from "next";
import Link from "next/link";
import { ROUTE_TYPES, type RouteType } from "@luggage/domain";
import { BookingFlow } from "@/components/booking/booking-flow";
import { PfHero } from "@/components/pf-hero";
import { JourneySimulator } from "@/components/demo/journey-simulator";
import { DemoEntry } from "@/components/demo/demo-entry";
import { StaySearch } from "@/components/stay-search";
import { getRequestContext, resolveLocale } from "@/lib/request-context";
import { NO_INDEX } from "@/lib/seo";
import { loadPublicCatalog, searchHotels, toPublicHotel } from "@/server/catalog";
import { getContent } from "@/server/content";
import { routeChoicesForHotel } from "@/server/slots";
import { listJejuTourStays } from "@/server/tour-stays";

const REQUIRED_POLICIES = ["bag-size-rules", "prohibited-items", "cancellation-refund", "damage-compensation"] as const;
export const metadata: Metadata = { robots: NO_INDEX };

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ hotel?: string | string[]; route?: string | string[]; stay?: string | string[]; q?: string | string[] }>;
};
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export default async function BookPage({ params, searchParams }: Props) {
  const locale = await resolveLocale(params);
  const { t } = await getRequestContext(locale);
  const query = await searchParams;
  const hotelSlug = first(query.hotel);
  const requestedRoute = first(query.route);
  const catalog = await loadPublicCatalog();
  const hotelRecord = catalog?.hotels.find((h) => h.slug === hotelSlug);
  const hotel = catalog && hotelRecord ? toPublicHotel(hotelRecord, catalog, locale) : null;
  const choices = catalog && hotelRecord ? routeChoicesForHotel(catalog, hotelRecord) : [];
  const choice = requestedRoute && (ROUTE_TYPES as readonly string[]).includes(requestedRoute)
    ? choices.find((c) => c.routeType === requestedRoute)
    : choices[0];
  const notices = hotel ? await Promise.all(REQUIRED_POLICIES.map((slug) => getContent(slug, locale, { strict: true }))) : [];
  const policies = notices.flatMap((notice, index) =>
    notice.status === "ok" && !notice.fallback ? [{ slug: REQUIRED_POLICIES[index]!, title: notice.translation.title }] : [],
  );
  const canBook = Boolean(hotel && choice && policies.length === REQUIRED_POLICIES.length);
  const stays = canBook ? null : await listJejuTourStays();
  const hotels = catalog ? searchHotels(catalog, "", locale, 1000) : [];
  const copy = {
    ko: { eyebrow: "JEJU CONNECT / RESERVATION", intro: "출발지와 도착지, 일정과 짐을 한 번에 알려주세요.", steps: ["배송 정보 입력", "확인 및 결제", "예약 완료"], chip: "🎫 짐배송 예약", simulated: "지금은 온라인 결제 연동 준비 중이라 아래에서 같은 예약 과정을 시뮬레이션으로 진행할 수 있어요. 실제 예약·결제는 되지 않아요.", inquiry: "실제 견적 문의 보내기", unavailable: "온라인 예약이 준비되지 않은 노선·숙소는 요청 내용을 확인한 뒤 가능 여부와 요금을 안내합니다." },
    "zh-CN": { eyebrow: "JEJU CONNECT / RESERVATION", intro: "填写交接地点、时间和行李数量。", steps: ["填写配送信息", "确认并付款", "预约完成"], chip: "🎫 预约行李配送", simulated: "在线付款正在准备中，您可以在下方以模拟方式体验同样的预约流程，不会产生真实预约或付款。", inquiry: "提交真实报价咨询", unavailable: "暂不能在线预约的路线或住宿，可提交需求，我们确认服务与价格后回复。" },
    en: { eyebrow: "JEJU CONNECT / RESERVATION", intro: "Tell us where and when to collect your bags, and how many you have.", steps: ["Delivery details", "Review and pay", "Booking complete"], chip: "🎫 Book bag delivery", simulated: "Online payment is being set up, so you can walk through the same booking as a simulation below. No real booking or payment is made.", inquiry: "Send a real quote request", unavailable: "For stays or routes not yet bookable online, send a request and we will confirm availability and price." },
  }[locale];

  return (
    <div className="reservation-page">
      <PfHero chip={copy.chip} title={t("booking.title")} subtitle={copy.intro} tone="sun" emoji="🧳" />
      <ol className="reservation-progress" aria-label={t("booking.title")}>
        {copy.steps.map((step, index) => <li key={step} className={index === 0 ? "is-current" : ""} aria-current={index === 0 ? "step" : undefined}><span>0{index + 1}</span><strong>{step}</strong></li>)}
      </ol>

      {canBook && catalog && hotel && choice ? <div className="reservation-page__booking">
        <nav aria-label={t("booking.chooseRoute")} className="booking-route-choices grid grid-cols-3 gap-2">
          {choices.map((c) => <Link key={c.routeType} href={`/${locale}/luggage/book?hotel=${encodeURIComponent(hotel.slug)}&route=${c.routeType}`} aria-current={c.routeType === choice.routeType ? "page" : undefined} data-testid={`route-choice-${c.routeType}`} className="customer-card flex min-h-16 items-center justify-center px-2 text-center text-xs font-semibold leading-snug aria-[current=page]:border-primary aria-[current=page]:bg-sea aria-[current=page]:text-primary sm:text-sm">{t(`route.${c.routeType as RouteType}`)}</Link>)}
        </nav>
        <BookingFlow key={choice.routeType} locale={locale} hotel={{ slug: hotel.slug, name: hotel.name }} routeType={choice.routeType} destinations={choice.destinations.map((d) => { const view = toPublicHotel(d, catalog, locale); return { slug: view.slug, name: view.name }; })} policies={policies} />
      </div> : <div className="reservation-page__inquiry">
        {hotel ? <p className="reservation-page__notice" data-testid="booking-blocked">🧪 {copy.simulated}</p> : null}
        {hotel ? <JourneySimulator embedded locale={locale} hotels={hotels.map((h) => ({ slug: h.slug, name: h.name }))} stays={(stays ?? []).map((stay) => ({ id: stay.id, name: stay.name }))} initialRoute={(ROUTE_TYPES as readonly string[]).includes(requestedRoute ?? "") ? requestedRoute as RouteType : "hotel_to_airport"} initialHotel={hotel.slug} /> : null}
        {hotel ? <h2 className="reservation-page__inquiry-title">✉️ {copy.inquiry}</h2> : null}
        <StaySearch locale={locale} hotels={hotels} initialStays={stays} initialQuery={first(query.q) ?? (hotel?.name ?? "")} initialStayId={first(query.stay)} initialHotelSlug={hotel?.slug} initialRoute={requestedRoute} />
        {hotel ? null : <DemoEntry locale={locale} kind="general" route={requestedRoute} />}
      </div>}
    </div>
  );
}
