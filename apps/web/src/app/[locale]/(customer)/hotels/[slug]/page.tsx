import type { Metadata } from "next";
import Link from "next/link";
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
    <div className="flex flex-col gap-4">
      <PageView locale={locale} event="hotel_selected" hotel={hotel.slug} />
      <section className="rounded-[var(--radius-card)] bg-sea px-4 py-6">
        <h1 className="text-2xl font-bold">{hotel.name}</h1>
        {hotel.name !== hotel.nameKo ? (
          <p lang="ko" className="mt-1 text-muted">
            {hotel.nameKo}
          </p>
        ) : null}
      </section>
      <dl className="grid grid-cols-1 gap-3 rounded-[var(--radius-card)] border border-line bg-card p-4 text-sm">
        <div>
          <dt className="text-muted">{t("hotels.zone")}</dt>
          <dd className="font-medium">{hotel.zone}</dd>
        </div>
        <div>
          <dt className="text-muted">{t("hotels.address")}</dt>
          <dd lang="ko" className="font-medium">
            {hotel.addressKo}
          </dd>
        </div>
        <div>
          <dt className="text-muted">{t("hotels.frontDesk")}</dt>
          <dd className="font-medium" data-testid="hotel-front-desk">
            {hotel.frontDesk ? t("hotels.frontDeskHours", hotel.frontDesk) : t("hotels.frontDeskUnknown")}
          </dd>
        </div>
      </dl>
      {hotel.handoffNote ? <p className="whitespace-pre-line text-sm">{hotel.handoffNote}</p> : null}
      <div className="flex flex-col gap-2">
        {hotel.routes.map((route) => (
          <Link
            key={route}
            href={`/${locale}/luggage/book?hotel=${encodeURIComponent(hotel.slug)}&route=${route}`}
            data-testid={`hotel-book-${route}`}
            className="flex min-h-12 items-center justify-center rounded-[var(--radius-button)] bg-primary px-4 font-semibold text-on-primary"
          >
            {t("hotels.bookFromHere")} · {t(`route.${route}`)}
          </Link>
        ))}
      </div>
    </div>
  );
}
