import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ContentView } from "@/components/content-view";
import { RouteList } from "@/components/route-list";
import { PageView } from "@/components/page-view";
import { getRequestContext, resolveLocale } from "@/lib/request-context";
import { localizedAlternates } from "@/lib/seo";
import { loadPublicCatalog, openRouteTypes } from "@/server/catalog";
import { getContent, listContent } from "@/server/content";

/** 결제 전에 반드시 보여 줘야 하는 필수 안내 (01 문서 4절). */
const REQUIRED_NOTICES = ["bag-size-rules", "prohibited-items"] as const;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const { t } = await getRequestContext(locale);
  return { title: t("luggage.title"), description: t("luggage.intro"), alternates: localizedAlternates(locale, "luggage") };
}

export default async function LuggagePage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = await resolveLocale(params);
  const { t } = await getRequestContext(locale);
  const catalog = await loadPublicCatalog();
  const guides = ((await listContent("guide", locale)) ?? []).filter((g) => ["checkout-day", "arrival-day", "hotel-move"].includes(g.slug));
  const [howItWorks, ...notices] = await Promise.all([
    getContent("how-it-works", locale),
    ...REQUIRED_NOTICES.map((slug) => getContent(slug, locale)),
  ]);
  // 필수 안내가 이 언어로 승인되지 않았거나 불러오지 못하면 예약 진입을 막는다.
  const bookingAllowed = notices.every((notice) => notice.status === "ok");

  return (
    <div className="service-page customer-inner-page">
      <PageView locale={locale} />
      <section className="photo-hero service-page__hero">
        <Image
          src="/images/editorial-airport.jpg"
          alt=""
          width={1800}
          height={1200}
          loading="eager"
          sizes="(min-width: 768px) 50vw, 100vw"
          className="photo-hero__image object-[65%_center]"
        />
        <div className="photo-hero__content">
          <span className="photo-hero__eyebrow">JEJU · SERVICE GUIDE</span>
          <h1>{t("luggage.title")}</h1>
          <p>{t("luggage.intro")}</p>
        </div>
      </section>

      <section aria-labelledby="routes-title" className="service-page__routes">
        <div className="landing-section__heading"><div><span className="landing-kicker">CHOOSE YOUR JOURNEY</span><h2 id="routes-title">{t("home.routes.title")}</h2></div></div>
        <RouteList t={t} open={openRouteTypes(catalog)} locale={locale} />
      </section>

      {guides.length > 0 ? (
        <section aria-labelledby="scenarios-title" className="service-page__scenarios">
          <div className="landing-section__heading"><div><span className="landing-kicker">TRAVEL YOUR WAY</span><h2 id="scenarios-title">{t("luggage.scenarios")}</h2></div></div>
          <div className="service-page__scenario-grid">{guides.map((guide, index) =>
            guide.result.status === "ok" ? (
              <Link
                key={guide.slug}
                href={`/${locale}/guide/${guide.slug}`}
                data-testid="scenario-link"
                className="service-page__scenario-card"
              >
                
                <span>0{index + 1}</span><strong>{guide.result.translation.title}</strong><b aria-hidden="true">↗</b>
              </Link>
            ) : null,
          )}</div>
        </section>
      ) : null}

      <section className="service-page__how customer-card">
        <div className="service-page__how-photo"><Image src="/images/editorial-luggage.jpg" alt="" width={1200} height={1600} sizes="(min-width: 768px) 40vw, 100vw" /></div>
        <div className="service-page__how-text"><span className="landing-kicker">HOW IT WORKS</span>
        <ContentView result={howItWorks!} t={t} testId="content-how-it-works" />
        </div>
      </section>

      <section aria-labelledby="rules-title" className="service-page__rules">
        <div className="landing-section__heading"><div><span className="landing-kicker">BEFORE YOU BOOK</span><h2 id="rules-title">{t("luggage.rules")}</h2></div></div>
        <div className="service-page__rules-grid">
        {notices.map((notice, index) => (
          <div key={REQUIRED_NOTICES[index]} className="customer-card p-5">
            <span className="landing-kicker">0{index + 1} / IMPORTANT</span>
            <ContentView result={notice} t={t} headingLevel={3} testId={`content-${REQUIRED_NOTICES[index]}`} />
          </div>
        ))}
        </div>
      </section>

      {bookingAllowed ? (
        <Link
          href={`/${locale}/luggage/book`}
          data-testid="booking-cta"
          className="customer-action service-page__cta"
        >
          {t("home.search.submit")}
        </Link>
      ) : (
        <p role="note" data-testid="booking-blocked" className="text-center text-sm text-warm">
          {t("luggage.bookingBlocked")}
        </p>
      )}
    </div>
  );
}
