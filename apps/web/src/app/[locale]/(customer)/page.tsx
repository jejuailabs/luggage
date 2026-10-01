import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { PageView } from "@/components/page-view";
import { ThemePreferencePicker } from "@/components/theme-controls";
import { getRequestContext, resolveLocale } from "@/lib/request-context";
import { getViewer } from "@/server/auth";
import { localizedAlternates } from "@/lib/seo";
import { loadPublicCatalog, openRouteTypes } from "@/server/catalog";
import { searchHotels } from "@/server/catalog";
import { DemoEntry } from "@/components/demo/demo-entry";
import { AirportPointCard } from "@/components/airport-point-card";
import { loadAirportPoint, loadBasePrices } from "@/server/public-info";
import { StaySearch } from "@/components/stay-search";
import { cookies } from "next/headers";
import { HERO_EXPERIMENT_COOKIE, parseHeroExperiment } from "@/server/experiment";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  return { alternates: localizedAlternates(await resolveLocale(params), "") };
}

const routes = [
  { type: "hotel_to_airport", from: "🏨", to: "✈️", tone: "sky" },
  { type: "airport_to_hotel", from: "✈️", to: "🏨", tone: "coral" },
  { type: "hotel_to_hotel", from: "🏨", to: "🏡", tone: "mint" },
] as const;

/** 홈 전용 짧은 문구. 기존 i18n 키로 표현되지 않는 장식·안내 문구만 둔다. */
const COPY = {
  ko: {
    hello: "제주 여행, 짐은 저희가 👋",
    photoTag: "제주 · Jeju Island",
    photoMeta: "숙소·공항 사이 짐배송",
    searchHint: "숙소 이름을 입력하면 바로 예약하거나 견적을 받을 수 있어요",
    routeCta: "이 노선으로 예약",
    perBag: "짐 1개 기준", standard: "보통", large: "대형", priceNote: "기본 요금은 부가세 포함 금액이에요. 날짜와 짐 수량을 넣으면 결제 전에 최종 금액을 보여 드려요.",
    quote: "견적 문의 가능",
    journeyTitle: "내 짐의 하루",
    journeyHint: "짐마다 태그와 사진으로 기록해요",
    steps: ["숙소에 맡기기", "QR 확인·수거", "안전하게 이동", "공항에서 받기"],
    ticketTitle: "예약증 미리보기",
    ticketSample: "예시",
    ticketFrom: "숙소",
    ticketTo: "제주공항",
    ticketPickup: "수거",
    ticketHandoff: "인계",
    ticketBags: "짐 2개",
    ticketNote: "예약하면 이런 예약증과 QR을 받아요",
    trackTitle: "배송 차량 위치 보기",
    trackBody: "지도에서 짐을 실은 차량의 최근 위치를 확인해요. (짐 자체 GPS가 아니에요)",
    trackDemo: "시연 보기",
    trackProgress: "이동 중 · 시연",
    faq: "궁금한 점이 있나요?",
    faqBody: "자주 묻는 질문과 문의하기",
  },
  "zh-CN": {
    hello: "济州旅行，行李交给我们 👋",
    photoTag: "济州 · Jeju Island",
    photoMeta: "住宿与机场之间的行李配送",
    searchHint: "输入住宿名称即可预约或获取报价",
    routeCta: "预约此路线",
    perBag: "每件价格", standard: "普通", large: "大件", priceNote: "基本价格已含增值税。填写日期和行李数量后，付款前会显示最终金额。",
    quote: "可咨询报价",
    journeyTitle: "行李的一天",
    journeyHint: "每件行李都有标签和照片记录",
    steps: ["寄存在住宿", "扫码确认取件", "安全运送", "机场取回"],
    ticketTitle: "预约凭证预览",
    ticketSample: "示例",
    ticketFrom: "住宿",
    ticketTo: "济州机场",
    ticketPickup: "取件",
    ticketHandoff: "交付",
    ticketBags: "2件行李",
    ticketNote: "预约后您将收到这样的凭证和二维码",
    trackTitle: "查看配送车辆位置",
    trackBody: "在地图上查看运送行李车辆的最近位置。（并非行李本身的GPS）",
    trackDemo: "查看演示",
    trackProgress: "运送中 · 演示",
    faq: "有疑问吗？",
    faqBody: "常见问题与咨询",
  },
  en: {
    hello: "Explore Jeju, we'll carry the bags 👋",
    photoTag: "Jeju Island",
    photoMeta: "Bag delivery between stays and airport",
    searchHint: "Type your stay to book now or ask for a quote",
    routeCta: "Book this route",
    perBag: "Per bag", standard: "Standard", large: "Large", priceNote: "Base prices include VAT. Enter your date and bags to see the final total before you pay.",
    quote: "Quote inquiry",
    journeyTitle: "A day in your bag's life",
    journeyHint: "Every bag is tagged and photographed",
    steps: ["Drop at your stay", "QR check & pickup", "Safe transfer", "Collect at airport"],
    ticketTitle: "Voucher preview",
    ticketSample: "Sample",
    ticketFrom: "Stay",
    ticketTo: "Jeju Airport",
    ticketPickup: "Pickup",
    ticketHandoff: "Handoff",
    ticketBags: "2 bags",
    ticketNote: "After booking you get a voucher and QR like this",
    trackTitle: "See the delivery vehicle",
    trackBody: "Check the latest position of the vehicle carrying your bags. (Not a GPS on the bag itself.)",
    trackDemo: "View demo",
    trackProgress: "In transit · demo",
    faq: "Have a question?",
    faqBody: "FAQ and contact us",
  },
} as const;

const STEP_ICONS = ["🧳", "🏷️", "🚐", "✈️"];

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = await resolveLocale(params);
  const { t, themePreference } = await getRequestContext(locale);
  const signedIn = Boolean((await getViewer()).user);
  const [catalog, prices, airportPoint] = await Promise.all([loadPublicCatalog(), loadBasePrices(), loadAirportPoint(locale)]);
  const won = (value: number) => new Intl.NumberFormat(locale, { style: "currency", currency: "KRW" }).format(value);
  const open = openRouteTypes(catalog);
  const hotels = catalog ? searchHotels(catalog, "", locale, 1000) : [];
  const heroVariant = parseHeroExperiment((await cookies()).get(HERO_EXPERIMENT_COOKIE)?.value)?.variant ?? "A";
  const alternateHero = { ko: { title: "짐은 맡기고, 제주는 더 가볍게.", button: "이용 가능 숙소 찾기" }, "zh-CN": { title: "放下行李，轻松游济州。", button: "查找可用住宿" }, en: { title: "Leave your bags. Explore Jeju freely.", button: "Find a pickup hotel" } }[locale];
  const c = COPY[locale];

  return (
    <div className="playful-home">
      <PageView locale={locale} />
      <svg className="pf-flightpath" viewBox="0 0 400 900" preserveAspectRatio="none" aria-hidden="true">
        <path d="M360 40 C 260 160, 420 260, 250 360 S 40 520, 160 640 S 380 760, 300 880" />
      </svg>

      <section className="pf-hero" aria-labelledby="home-title">
        <div className="pf-hero__copy">
          <p className="pf-hello">{c.hello}</p>
          <h1 id="home-title">{heroVariant === "B" ? alternateHero.title : t("home.headline")}</h1>
          <p className="pf-sub">{t("home.subheadline")}</p>
          <div className="pf-hero__actions">
            <Link href={`/${locale}/luggage/book`} className="pf-btn pf-btn--coral">{heroVariant === "B" ? alternateHero.button : t("nav.book")} <span aria-hidden="true">→</span></Link>
            <Link href={`/${locale}/luggage`} className="pf-btn pf-btn--ghost">{t("luggage.howItWorks")}</Link>
          </div>
        </div>
        <Link href={`/${locale}/luggage/book`} className="pf-photo">
          <Image src="/images/editorial-island.jpg" alt="" width={1800} height={1200} priority sizes="(min-width: 900px) 520px, 100vw" />
          <span className="pf-sticker pf-sticker--sun" aria-hidden="true">KST</span>
          <span className="pf-photo__badge">JEJU</span>
          <span className="pf-photo__label"><strong>{c.photoTag}</strong><small>{c.photoMeta}</small></span>
          <span className="pf-photo__go" aria-hidden="true">→</span>
        </Link>
      </section>

      <section className="pf-card pf-search" aria-labelledby="search-title">
        <div className="pf-search__head">
          <span className="pf-icon pf-icon--sky" aria-hidden="true">🔍</span>
          <div><h2 id="search-title">{t("home.search.title")}</h2><p>{c.searchHint}</p></div>
        </div>
        <StaySearch locale={locale} hotels={hotels} compact />
      </section>

      <section className="pf-section" aria-labelledby="routes-title">
        <div className="pf-section__head">
          <h2 id="routes-title"><span className="pf-plane" aria-hidden="true">✈</span> {t("home.routes.title")}</h2>
          <Link href={`/${locale}/luggage`}>{t("luggage.howItWorks")} →</Link>
        </div>
        <div className="pf-routes">
          {routes.map((route) => (
            <Link key={route.type} href={`/${locale}/luggage/book?route=${route.type}`} className={`pf-route pf-route--${route.tone}`}>
              <span className="pf-route__icons" aria-hidden="true"><span>{route.from}</span><i /><span>{route.to}</span></span>
              <strong>{t(`route.${route.type}`)}</strong>
              <span className={`pf-chip ${open.has(route.type) ? "pf-chip--open" : ""}`}>{open.has(route.type) ? t("route.status.open") : c.quote}</span>
              {prices[route.type]?.standard ? (
                <span className="pf-route__price">
                  <small>{c.perBag}</small>
                  <span>{c.standard} <b>{won(prices[route.type]!.standard!)}</b></span>
                  {prices[route.type]?.large ? <span>{c.large} <b>{won(prices[route.type]!.large!)}</b></span> : null}
                </span>
              ) : null}
              <span className="pf-route__cta">{c.routeCta} →</span>
            </Link>
          ))}
        </div>
      </section>
      <p className="pf-price-note">💡 {c.priceNote}</p>

      <AirportPointCard locale={locale} point={airportPoint} />

      <div className="pf-duo">
        <section className="pf-card pf-journey" aria-labelledby="journey-title">
          <div className="pf-journey__bar"><h2 id="journey-title">{c.journeyTitle}</h2><span aria-hidden="true">⋯</span></div>
          <ol className="pf-steps">
            {c.steps.map((step, index) => (
              <li key={step}>
                <span className="pf-steps__day">{`0${index + 1}`}</span>
                <span className="pf-steps__icon" aria-hidden="true">{STEP_ICONS[index]}</span>
                <span className="pf-steps__label">{step}</span>
              </li>
            ))}
          </ol>
          <p className="pf-journey__hint">🏷️ {c.journeyHint}</p>
        </section>

        <section className="pf-ticket" aria-labelledby="ticket-title">
          <div className="pf-ticket__top">
            <h2 id="ticket-title">{c.ticketTitle}</h2>
            <span className="pf-sticker pf-sticker--inline">{c.ticketSample}</span>
          </div>
          <div className="pf-ticket__route">
            <div><small>{c.ticketPickup}</small><strong>10:00</strong><span>{c.ticketFrom}</span></div>
            <span className="pf-ticket__plane" aria-hidden="true">🧳 ✈</span>
            <div className="pf-ticket__end"><small>{c.ticketHandoff}</small><strong>15:00</strong><span>{c.ticketTo}</span></div>
          </div>
          <div className="pf-ticket__stub">
            <span>JC·SAMPLE</span><span>{c.ticketBags}</span><span className="pf-ticket__qr" aria-hidden="true" />
          </div>
          <p className="pf-ticket__note">{c.ticketNote}</p>
        </section>
      </div>

      <section className="pf-section" aria-labelledby="trust-title">
        <div className="pf-section__head"><h2 id="trust-title">{t("home.trust.title")}</h2></div>
        <ul className="pf-trust">
          <li className="pf-trust--sun"><span aria-hidden="true">📱</span>{t("home.trust.noKoreanPhone")}</li>
          <li className="pf-trust--lilac"><span aria-hidden="true">🏷️</span>{t("home.trust.perBag")}</li>
          <li className="pf-trust--mint"><span aria-hidden="true">💬</span>{t("home.trust.support")}</li>
        </ul>
        <p className="pf-notice">🕒 {t("home.notice.body")}</p>
      </section>

      <div className="pf-duo">
        <Link href={`/${locale}/account/track`} className="pf-card pf-track">
          <span className="pf-icon pf-icon--mint" aria-hidden="true">📍</span>
          <div className="pf-track__body">
            <strong>{c.trackTitle}</strong>
            <p>{c.trackBody}</p>
            <div className="pf-progress" aria-hidden="true"><span /></div>
            <small>{c.trackProgress}</small>
          </div>
          <span className="pf-track__go">{c.trackDemo} →</span>
        </Link>
        <Link href={`/${locale}/help`} className="pf-card pf-help">
          <span className="pf-icon pf-icon--lilac" aria-hidden="true">💡</span>
          <div><strong>{c.faq}</strong><p>{c.faqBody}</p></div>
          <span className="pf-help__go" aria-hidden="true">→</span>
        </Link>
      </div>

      <DemoEntry locale={locale} />

      <section className="pf-banner">
        <Image src="/images/editorial-lagoon.jpg" alt="" width={1800} height={1200} sizes="(min-width: 900px) 1120px, 100vw" />
        <div>
          <span className="pf-sticker pf-sticker--coral" aria-hidden="true">GO!</span>
          <h2>{t("home.headline")}</h2>
          <Link href={`/${locale}/luggage/book`} className="pf-btn pf-btn--white">{t("nav.book")} →</Link>
        </div>
      </section>

      <section className="pf-settings"><ThemePreferencePicker initial={themePreference} syncToAccount={signedIn} labels={{ label: t("theme.label"), light: t("theme.light"), dark: t("theme.dark"), system: t("theme.system") }} /></section>
    </div>
  );
}
