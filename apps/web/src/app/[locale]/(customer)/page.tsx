import Link from "next/link";
import type { Metadata } from "next";
import { RouteList } from "@/components/route-list";
import { ThemePreferencePicker } from "@/components/theme-controls";
import { getRequestContext, resolveLocale } from "@/lib/request-context";
import { getViewer } from "@/server/auth";
import { localizedAlternates } from "@/lib/seo";
import { loadPublicCatalog, openRouteTypes } from "@/server/catalog";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  return { alternates: localizedAlternates(await resolveLocale(params), "") };
}

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = await resolveLocale(params);
  const { t, themePreference } = await getRequestContext(locale);
  const signedIn = Boolean((await getViewer()).user);
  const catalog = await loadPublicCatalog();

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-[var(--radius-card)] bg-sea px-4 py-6">
        <h1 className="text-[26px] font-bold leading-tight">{t("home.headline")}</h1>
        <p className="mt-2 text-muted">{t("home.subheadline")}</p>
      </section>

      <section aria-labelledby="search-title" className="rounded-[var(--radius-card)] border border-line bg-card p-4">
        <h2 id="search-title" className="text-lg font-semibold">
          {t("home.search.title")}
        </h2>
        <form action={`/${locale}/hotels`} method="get" className="mt-3 flex flex-col gap-3" role="search">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">{t("home.search.hotel")}</span>
            <input
              name="q"
              type="search"
              enterKeyHint="search"
              placeholder={t("home.search.hotelPlaceholder")}
              data-testid="home-hotel-search"
              className="min-h-11 rounded-[var(--radius-button)] border border-line bg-bg px-3"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">
              {t("home.search.date")} <span className="text-muted">({t("time.kstLabel")})</span>
            </span>
            <input
              name="date"
              type="date"
              disabled
              aria-describedby="search-unavailable"
              className="min-h-11 rounded-[var(--radius-button)] border border-line bg-bg px-3 disabled:opacity-60"
            />
          </label>
          <button
            type="submit"
            className="min-h-12 rounded-[var(--radius-button)] bg-primary px-4 font-semibold text-on-primary"
          >
            {t("hotels.search.submit")}
          </button>
          <p id="search-unavailable" className="text-center text-sm text-muted">
            {t("home.search.unavailable")}
          </p>
        </form>
      </section>

      <section aria-labelledby="routes-title">
        <div className="mb-2 flex items-center justify-between">
          <h2 id="routes-title" className="text-lg font-semibold">
            {t("home.routes.title")}
          </h2>
          <Link href={`/${locale}/luggage`} className="inline-flex min-h-11 items-center text-sm font-medium text-primary">
            {t("luggage.howItWorks")} →
          </Link>
        </div>
        <RouteList t={t} open={openRouteTypes(catalog)} />
      </section>

      <section
        aria-labelledby="notice-title"
        className="rounded-[var(--radius-card)] border border-line border-l-4 border-l-warm bg-card p-4"
      >
        <h2 id="notice-title" className="font-semibold">
          {t("home.notice.title")}
        </h2>
        <p className="mt-1 text-sm text-muted">{t("home.notice.body")}</p>
      </section>

      <section aria-labelledby="trust-title" className="rounded-[var(--radius-card)] border border-line bg-card p-4">
        <h2 id="trust-title" className="font-semibold">
          {t("home.trust.title")}
        </h2>
        <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-sm">
          <li>{t("home.trust.perBag")}</li>
          <li>{t("home.trust.noKoreanPhone")}</li>
          <li>{t("home.trust.support")}</li>
        </ul>
      </section>

      <section className="rounded-[var(--radius-card)] border border-line bg-card p-4">
        <ThemePreferencePicker
          initial={themePreference}
          syncToAccount={signedIn}
          labels={{
            label: t("theme.label"),
            light: t("theme.light"),
            dark: t("theme.dark"),
            system: t("theme.system"),
          }}
        />
      </section>
    </div>
  );
}
