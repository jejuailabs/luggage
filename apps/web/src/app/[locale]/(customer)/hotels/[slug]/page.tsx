import type { Metadata } from "next";
import Link from "next/link";
import { PfHero } from "@/components/pf-hero";
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
      <PfHero
        chip={`🏨 ${hotel.zone}`}
        title={hotel.name}
        subtitle={hotel.name !== hotel.nameKo ? <span lang="ko">{hotel.nameKo}</span> : undefined}
        tone="mint"
        image="/images/editorial-island.jpg"
        imageNote={locale === "ko" ? "여행 이미지 · 실제 숙소 사진 아님" : locale === "zh-CN" ? "旅行配图 · 非住宿实拍" : "Travel image · not a photo of this stay"}
        back={{ href: `/${locale}/luggage/book`, label: t("booking.title") }}
      >
        <span className="pf-chip pf-chip--open">{hotel.routes.length} · {t("home.routes.title")}</span>
      </PfHero>
      <dl className="hotel-detail-facts" aria-label={t("hotels.title")}>
        <div><span aria-hidden="true">◎</span><dt>{t("hotels.zone")}</dt><dd>{hotel.zone}</dd></div>
        <div><span aria-hidden="true">⌖</span><dt>{t("hotels.address")}</dt><dd lang="ko">{hotel.addressKo}</dd></div>
        <div><span aria-hidden="true">◷</span><dt>{t("hotels.frontDesk")}</dt><dd data-testid="hotel-front-desk">{hotel.frontDesk ? t("hotels.frontDeskHours", hotel.frontDesk) : t("hotels.frontDeskUnknown")}</dd></div>
      </dl>
      <section className="hotel-detail-routes" aria-labelledby="hotel-route-heading">
        <div className="landing-section__heading"><div><span className="landing-kicker">CHOOSE YOUR JOURNEY</span><h2 id="hotel-route-heading">{t("home.routes.title")}</h2></div><Link href={`/${locale}/luggage`}>{t("luggage.howItWorks")} ↗</Link></div>
        {hotel.routes.length ? <div className="hotel-detail-routes__grid">{hotel.routes.map((route) => (
          <Link key={route} href={`/${locale}/luggage/book?hotel=${encodeURIComponent(hotel.slug)}&route=${route}`} data-testid={`hotel-book-${route}`} className="hotel-detail-route">
            
            <span className="hotel-detail-route__number" aria-hidden="true">{route === "hotel_to_airport" ? "🏨→✈️" : route === "airport_to_hotel" ? "✈️→🏨" : "🏨→🏡"}</span>
            <span className="hotel-detail-route__content"><small>{t("route.status.open")}</small><strong>{t(`route.${route}`)}</strong><span>{t("hotels.bookFromHere")} <b aria-hidden="true">↗</b></span></span>
          </Link>
        ))}</div> : <p className="customer-card p-5 text-muted">{t("booking.noRoutes")}</p>}
      </section>
      {hotel.handoffNote ? <section className="hotel-detail-note"><span className="landing-kicker">HANDOFF INFORMATION</span><h2>{t("hotels.frontDesk")}</h2><p>{hotel.handoffNote}</p></section> : null}
    </div>
  );
}
