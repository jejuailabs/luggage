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
import { StaySearch } from "@/components/stay-search";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  return { alternates: localizedAlternates(await resolveLocale(params), "") };
}

const routes = ["hotel_to_airport", "airport_to_hotel", "hotel_to_hotel"] as const;

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = await resolveLocale(params);
  const { t, themePreference } = await getRequestContext(locale);
  const signedIn = Boolean((await getViewer()).user);
  const catalog = await loadPublicCatalog();
  const open = openRouteTypes(catalog);
  const hotels = catalog ? searchHotels(catalog, "", locale, 1000) : [];

  return (
    <div className="landing-page">
      <PageView locale={locale} />
      <section className="landing-hero" aria-labelledby="home-title">
        <Image src="/images/editorial-island.jpg" alt="" width={1800} height={1200} priority sizes="100vw" className="landing-hero__image" />
        <div className="landing-hero__shade" />
        <div className="landing-hero__copy">
          <span className="landing-hero__eyebrow">JEJU CONNECT · TRAVEL LIGHT</span>
          <h1 id="home-title">{t("home.headline")}</h1>
          <p>{t("home.subheadline")}</p>
          <div className="landing-hero__actions">
            <Link href={`/${locale}/hotels`} className="landing-pill landing-pill--white">{t("nav.book")} <span aria-hidden="true">↗</span></Link>
            <Link href={`/${locale}/luggage`} className="landing-pill landing-pill--glass">{t("luggage.howItWorks")} <span aria-hidden="true">↗</span></Link>
          </div>
        </div>
        <span className="landing-hero__caption">01 / A LIGHTER WAY TO TRAVEL</span>
      </section>

      <section className="landing-search" aria-labelledby="search-title">
        <div><span className="landing-kicker">BEGIN YOUR JOURNEY</span><h2 id="search-title">{t("home.search.title")}</h2></div>
        <StaySearch locale={locale} hotels={hotels} compact />
      </section>

      <section className="landing-section landing-destinations" aria-labelledby="routes-title">
        <div className="landing-section__heading"><div><span className="landing-kicker">MAKE ROOM FOR THE JOURNEY</span><h2 id="routes-title">{t("home.routes.title")}</h2></div><Link href={`/${locale}/luggage`}>{t("luggage.howItWorks")} ↗</Link></div>
        <div className="editorial-routes">
          {routes.map((route, index) => (
            <Link key={route} href={`/${locale}/hotels?route=${route}`} className="editorial-route">
              <span className="editorial-route__index">0{index + 1}</span>
              <strong>{t(`route.${route}`)}</strong>
              <small>{open.has(route) ? t("route.status.open") : locale === "ko" ? "견적 문의 가능" : locale === "zh-CN" ? "可咨询报价" : "Quote inquiry"}</small>
              <span className="editorial-route__arrow" aria-hidden="true">↗</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="editorial-feature" aria-labelledby="trust-title">
        <div className="editorial-feature__image"><Image src="/images/editorial-luggage.jpg" alt="" width={1200} height={1600} sizes="(min-width: 768px) 48vw, 100vw" /></div>
        <div className="editorial-feature__copy"><span className="landing-kicker">TRAVEL WITH CONFIDENCE</span><h2 id="trust-title">{t("home.trust.title")}</h2><p>{t("home.notice.body")}</p>
          <ol><li><span>01</span>{t("home.trust.noKoreanPhone")}</li><li><span>02</span>{t("home.trust.perBag")}</li><li><span>03</span>{t("home.trust.support")}</li></ol>
          <Link href={`/${locale}/luggage`} className="landing-text-link">{t("luggage.howItWorks")} ↗</Link>
        </div>
      </section>

      <section className="landing-section editorial-process" aria-labelledby="steps-title">
        <div className="landing-section__heading"><div><span className="landing-kicker">A SIMPLE, CONSIDERED SERVICE</span><h2 id="steps-title">{t("home.steps.title")}</h2></div></div>
        <div className="editorial-process__grid">
          <div><span>01 / RESERVE</span><strong>{t("home.trust.noKoreanPhone")}</strong><p>{t("nav.book")}</p></div>
          <div><span>02 / HAND OVER</span><strong>{t("home.trust.perBag")}</strong><p>{t("home.routes.title")}</p></div>
          <div><span>03 / ARRIVE</span><strong>{t("home.trust.support")}</strong><p>{t("nav.orders")}</p></div>
        </div>
      </section>

      <section className="landing-banner"><Image src="/images/editorial-lagoon.jpg" alt="" width={1800} height={1200} sizes="100vw" /><div><span className="landing-kicker">YOUR DAY, UNBURDENED</span><h2>{t("home.headline")}</h2><p>{t("home.subheadline")}</p><Link href={`/${locale}/hotels`} className="landing-pill landing-pill--white">{t("nav.book")} ↗</Link></div></section>
      <section className="landing-settings"><ThemePreferencePicker initial={themePreference} syncToAccount={signedIn} labels={{ label: t("theme.label"), light: t("theme.light"), dark: t("theme.dark"), system: t("theme.system") }} /></section>
    </div>
  );
}
