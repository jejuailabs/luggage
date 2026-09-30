import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ContentView } from "@/components/content-view";
import { PageView } from "@/components/page-view";
import { getRequestContext, resolveLocale } from "@/lib/request-context";
import { localizedAlternates } from "@/lib/seo";
import { getContent, getContentRecord } from "@/server/content";

type Params = Promise<{ locale: string; slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const { slug } = await params;
  const result = await getContent(slug, locale);
  return {
    title: result.status === "ok" ? result.translation.title : undefined,
    alternates: localizedAlternates(locale, `guide/${slug}`),
  };
}

export default async function Page({ params }: { params: Params }) {
  const locale = await resolveLocale(params);
  const { slug } = await params;
  const record = await getContentRecord(slug);
  if (record === null || (record && record.kind !== "guide")) notFound();
  const { t } = await getRequestContext(locale);
  const result = await getContent(slug, locale);
  const image = slug === "hotel-move" ? "/images/editorial-hotel.jpg" : slug === "arrival-day" ? "/images/editorial-island.jpg" : slug === "how-it-works" ? "/images/editorial-luggage.jpg" : "/images/editorial-airport.jpg";
  return (
    <div className="editorial-page customer-inner-page">
      <PageView locale={locale} />
      <div className="editorial-page__visual"><Image src={image} alt="" fill priority sizes="(min-width: 768px) 1160px, 100vw" /><span>JEJU CONNECT · TRAVEL GUIDE</span></div>
      <section className="editorial-page__article customer-card">
        <ContentView result={result} t={t} headingLevel={1} testId="content-page" />
      </section>
      {record?.relatedRoute ? (
        <Link
          href={`/${locale}/hotels`}
          data-testid="guide-cta"
          className="customer-action editorial-page__cta"
        >
          {t("guide.cta")} · {t(`route.${record.relatedRoute}`)}
        </Link>
      ) : null}
    </div>
  );
}
