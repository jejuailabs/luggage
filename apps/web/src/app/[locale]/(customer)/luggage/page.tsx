import type { Metadata } from "next";
import Link from "next/link";
import { ContentView } from "@/components/content-view";
import { RouteList } from "@/components/route-list";
import { getRequestContext, resolveLocale } from "@/lib/request-context";
import { localizedAlternates } from "@/lib/seo";
import { loadPublicCatalog, openRouteTypes } from "@/server/catalog";
import { getContent } from "@/server/content";

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
  const [howItWorks, ...notices] = await Promise.all([
    getContent("how-it-works", locale),
    ...REQUIRED_NOTICES.map((slug) => getContent(slug, locale)),
  ]);
  // 필수 안내가 이 언어로 승인되지 않았거나 불러오지 못하면 예약 진입을 막는다.
  const bookingAllowed = notices.every((notice) => notice.status === "ok");

  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-[var(--radius-card)] bg-sea px-4 py-6">
        <h1 className="text-[26px] font-bold leading-tight">{t("luggage.title")}</h1>
        <p className="mt-2 text-muted">{t("luggage.intro")}</p>
      </section>

      <section aria-labelledby="routes-title">
        <h2 id="routes-title" className="mb-2 text-lg font-semibold">
          {t("home.routes.title")}
        </h2>
        <RouteList t={t} open={openRouteTypes(catalog)} />
      </section>

      <section className="rounded-[var(--radius-card)] border border-line bg-card p-4">
        <ContentView result={howItWorks!} t={t} testId="content-how-it-works" />
      </section>

      <section aria-labelledby="rules-title" className="flex flex-col gap-3">
        <h2 id="rules-title" className="text-lg font-semibold">
          {t("luggage.rules")}
        </h2>
        {notices.map((notice, index) => (
          <div key={REQUIRED_NOTICES[index]} className="rounded-[var(--radius-card)] border border-line bg-card p-4">
            <ContentView result={notice} t={t} headingLevel={3} testId={`content-${REQUIRED_NOTICES[index]}`} />
          </div>
        ))}
      </section>

      {bookingAllowed ? (
        <Link
          href={`/${locale}/luggage/book`}
          data-testid="booking-cta"
          className="flex min-h-12 items-center justify-center rounded-[var(--radius-button)] bg-primary px-4 font-semibold text-on-primary"
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
