import type { Metadata } from "next";
import Image from "next/image";
import { StaySearch } from "@/components/stay-search";
import { getRequestContext, resolveLocale } from "@/lib/request-context";
import { localizedAlternates } from "@/lib/seo";
import { loadPublicCatalog, searchHotels } from "@/server/catalog";
import { listJejuTourStays } from "@/server/tour-stays";

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ q?: string | string[]; stay?: string | string[]; route?: string | string[] }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const { t } = await getRequestContext(locale);
  return { title: t("hotels.title"), alternates: localizedAlternates(locale, "hotels") };
}

export default async function HotelsPage({ params, searchParams }: Props) {
  const locale = await resolveLocale(params);
  const { t } = await getRequestContext(locale);
  const search = await searchParams;
  const raw = search.q;
  const query = (Array.isArray(raw) ? raw[0] : raw)?.slice(0, 80) ?? "";
  const selectedStay = Array.isArray(search.stay) ? search.stay[0] : search.stay;
  const selectedRoute = Array.isArray(search.route) ? search.route[0] : search.route;
  const [catalog, stays] = await Promise.all([loadPublicCatalog(), listJejuTourStays()]);
  const hotels = catalog ? searchHotels(catalog, "", locale, 1000) : [];

  return (
    <div className="hotel-search-page customer-inner-page">
      <header className="photo-hero hotel-search-hero">
        <Image
          src="/images/editorial-hotel.jpg"
          alt=""
          width={1800}
          height={1200}
          loading="eager"
          sizes="(min-width: 768px) 50vw, 100vw"
          className="photo-hero__image"
        />
        <div className="photo-hero__content">
          <span className="photo-hero__eyebrow">JEJU · HOTELS</span>
          <h1>{t("hotels.title")}</h1>
        </div>
      </header>
      <StaySearch locale={locale} hotels={hotels} initialStays={stays} initialQuery={query} initialStayId={selectedStay} initialRoute={selectedRoute} />
    </div>
  );
}
