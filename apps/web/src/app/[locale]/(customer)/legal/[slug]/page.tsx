import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ContentView } from "@/components/content-view";
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
    alternates: localizedAlternates(locale, `legal/${slug}`),
  };
}

export default async function Page({ params }: { params: Params }) {
  const locale = await resolveLocale(params);
  const { slug } = await params;
  const record = await getContentRecord(slug);
  if (record === null || (record && record.kind !== "legal")) notFound();
  const { t } = await getRequestContext(locale);
  const result = await getContent(slug, locale);
  return (
    <section className="rounded-[var(--radius-card)] border border-line bg-card p-4">
      <ContentView result={result} t={t} headingLevel={1} testId="content-page" />
    </section>
  );
}
