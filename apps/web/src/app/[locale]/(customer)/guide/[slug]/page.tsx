import type { Metadata } from "next";
import Link from "next/link";
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
  return (
    <div className="flex flex-col gap-4">
      <PageView locale={locale} />
      <section className="rounded-[var(--radius-card)] border border-line bg-card p-4">
        <ContentView result={result} t={t} headingLevel={1} testId="content-page" />
      </section>
      {record?.relatedRoute ? (
        <Link
          href={`/${locale}/hotels`}
          data-testid="guide-cta"
          className="flex min-h-12 items-center justify-center rounded-[var(--radius-button)] bg-primary px-4 font-semibold text-on-primary"
        >
          {t("guide.cta")} · {t(`route.${record.relatedRoute}`)}
        </Link>
      ) : null}
    </div>
  );
}
