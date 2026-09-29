import type { Metadata } from "next";
import { HotelCard } from "@/components/hotel-card";
import { getRequestContext, resolveLocale } from "@/lib/request-context";
import { localizedAlternates } from "@/lib/seo";
import { loadPublicCatalog, searchHotels } from "@/server/catalog";

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ q?: string | string[] }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const { t } = await getRequestContext(locale);
  return { title: t("hotels.title"), alternates: localizedAlternates(locale, "hotels") };
}

export default async function HotelsPage({ params, searchParams }: Props) {
  const locale = await resolveLocale(params);
  const { t } = await getRequestContext(locale);
  const raw = (await searchParams).q;
  const query = (Array.isArray(raw) ? raw[0] : raw)?.slice(0, 80) ?? "";
  const catalog = await loadPublicCatalog();
  const results = catalog ? searchHotels(catalog, query, locale) : null;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold">{t("hotels.title")}</h1>
      <form method="get" role="search" className="flex gap-2">
        <label className="flex-1">
          <span className="sr-only">{t("home.search.hotel")}</span>
          <input
            name="q"
            type="search"
            defaultValue={query}
            enterKeyHint="search"
            placeholder={t("home.search.hotelPlaceholder")}
            className="min-h-11 w-full rounded-[var(--radius-button)] border border-line bg-card px-3"
          />
        </label>
        <button type="submit" className="min-h-11 rounded-[var(--radius-button)] bg-primary px-4 font-semibold text-on-primary">
          {t("hotels.search.submit")}
        </button>
      </form>
      {results === null ? (
        <p className="text-muted">{t("content.unavailable")}</p>
      ) : (
        <>
          <p className="text-sm text-muted" aria-live="polite" data-testid="hotel-result-count">
            {t("hotels.search.resultCount", { count: results.length })}
          </p>
          {results.length === 0 ? (
            <p className="text-muted">{t("hotels.search.noResult")}</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {results.map((hotel) => (
                <li key={hotel.slug}>
                  <HotelCard hotel={hotel} locale={locale} t={t} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
