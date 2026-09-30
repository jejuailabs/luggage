import type { Metadata } from "next";
import Link from "next/link";
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
    <div className="editorial-page editorial-page--legal customer-inner-page"><div className="editorial-page__visual"><span>JEJU CONNECT · INFORMATION</span></div><section className="editorial-page__article customer-card"><ContentView result={result} t={t} headingLevel={1} testId="content-page" /></section><Link href={`/${locale}/luggage`} className="editorial-page__return">← {locale === "ko" ? "서비스 안내로 돌아가기" : locale === "zh-CN" ? "返回服务介绍" : "Back to service guide"}</Link></div>
  );
}
