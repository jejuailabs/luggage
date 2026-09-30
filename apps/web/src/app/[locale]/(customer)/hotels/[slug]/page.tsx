import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import type { Locale } from "@luggage/i18n";
import { getRequestContext, resolveLocale } from "@/lib/request-context";
import { PageView } from "@/components/page-view";
import { localizedAlternates } from "@/lib/seo";
import { loadPublicCatalog, toPublicHotel } from "@/server/catalog";
import { routeChoicesForHotel } from "@/server/slots";

type Params = Promise<{ locale: string; slug: string }>;

async function findHotel(slug: string, locale: Locale) {
  const catalog = await loadPublicCatalog();
  const hotel = catalog?.hotels.find((h) => h.slug === slug);
  if (!catalog || !hotel) return null;
  return { ...toPublicHotel(hotel, catalog, locale), routes: routeChoicesForHotel(catalog, hotel).map((c) => c.routeType) };
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const { slug } = await params;
  const hotel = await findHotel(slug, locale);
  return { title: hotel?.name, alternates: localizedAlternates(locale, `hotels/${slug}`) };
}

export default async function HotelPage({ params }: { params: Params }) {
  const locale = await resolveLocale(params);
  const { slug } = await params;
  const hotel = await findHotel(slug, locale);
  if (!hotel) notFound();
  const { t } = await getRequestContext(locale);

  return (
    <div className="hotel-detail-page customer-inner-page">
      <PageView locale={locale} event="hotel_selected" hotel={hotel.slug} />
      <section className="hotel-detail-hero">
        <Image src="/images/editorial-island.jpg" alt="" fill priority sizes="(min-width: 768px) 1160px, 100vw" />
        <div className="hotel-detail-hero__shade" />
        <div className="hotel-detail-hero__content">
          <Link href={`/${locale}/hotels`} className="hotel-detail-hero__back">← {t("hotels.title")}</Link>
          <span className="landing-kicker">JEJU CONNECT · HOTEL PARTNER</span>
          <h1>{hotel.name}</h1>
          {hotel.name !== hotel.nameKo ? <p lang="ko">{hotel.nameKo}</p> : null}
          <span className="hotel-detail-hero__zone">◎ {hotel.zone}</span>
        </div>
        <div className="hotel-detail-hero__glass"><small>JEJU · LUGGAGE DELIVERY</small><strong>{hotel.routes.length}</strong><span>{t("home.routes.title")}</span></div>
        <small className="hotel-detail-hero__image-note">{locale === "ko" ? "여행 이미지 · 실제 숙소 사진 아님" : locale === "zh-CN" ? "旅行配图 · 非住宿实拍" : "Travel image · not a photo of this stay"}</small>
      </section>
      <dl className="hotel-detail-facts" aria-label={t("hotels.title")}>
        <div><span aria-hidden="true">◎</span><dt>{t("hotels.zone")}</dt><dd>{hotel.zone}</dd></div>
        <div><span aria-hidden="true">⌖</span><dt>{t("hotels.address")}</dt><dd lang="ko">{hotel.addressKo}</dd></div>
        <div><span aria-hidden="true">◷</span><dt>{t("hotels.frontDesk")}</dt><dd data-testid="hotel-front-desk">{hotel.frontDesk ? t("hotels.frontDeskHours", hotel.frontDesk) : t("hotels.frontDeskUnknown")}</dd></div>
      </dl>
      <section className="hotel-detail-routes" aria-labelledby="hotel-route-heading">
        <div className="landing-section__heading"><div><span className="landing-kicker">CHOOSE YOUR JOURNEY</span><h2 id="hotel-route-heading">{t("home.routes.title")}</h2></div><Link href={`/${locale}/luggage`}>{t("luggage.howItWorks")} ↗</Link></div>
        {hotel.routes.length ? <div className="hotel-detail-routes__grid">{hotel.routes.map((route, index) => (
          <Link key={route} href={`/${locale}/luggage/book?hotel=${encodeURIComponent(hotel.slug)}&route=${route}`} data-testid={`hotel-book-${route}`} className="hotel-detail-route">
            
            <span className="hotel-detail-route__number">0{index + 1}</span>
            <span className="hotel-detail-route__content"><small>{t("route.status.open")}</small><strong>{t(`route.${route}`)}</strong><span>{t("hotels.bookFromHere")} <b aria-hidden="true">↗</b></span></span>
          </Link>
        ))}</div> : <p className="customer-card p-5 text-muted">{t("booking.noRoutes")}</p>}
      </section>
      {hotel.handoffNote ? <section className="hotel-detail-note"><span className="landing-kicker">HANDOFF INFORMATION</span><h2>{t("hotels.frontDesk")}</h2><p>{hotel.handoffNote}</p></section> : null}
    </div>
  );
}
