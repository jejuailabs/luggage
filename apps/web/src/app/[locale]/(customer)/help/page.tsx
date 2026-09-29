import type { Metadata } from "next";
import { ContentView } from "@/components/content-view";
import { SupportForm } from "@/components/support/support-form";
import { getRequestContext, resolveLocale } from "@/lib/request-context";
import { localizedAlternates } from "@/lib/seo";
import { listContent } from "@/server/content";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const { t } = await getRequestContext(locale);
  return { title: t("help.title"), alternates: localizedAlternates(locale, "help") };
}

export default async function HelpPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = await resolveLocale(params);
  const { t } = await getRequestContext(locale);
  const faqs = await listContent("faq", locale);

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-[var(--radius-card)] border border-line bg-card p-4">
        <h1 className="text-xl font-bold">{t("help.title")}</h1>
        <p className="mt-2 text-muted">{t("help.body")}</p>
      </section>
      <section aria-labelledby="faq-title" className="flex flex-col gap-3">
        <h2 id="faq-title" className="text-lg font-semibold">
          {t("faq.title")}
        </h2>
        {faqs === null ? (
          <p className="text-muted">{t("content.unavailable")}</p>
        ) : faqs.length === 0 ? (
          <p className="text-muted">{t("content.empty")}</p>
        ) : (
          faqs.map((faq) => (
            <div key={faq.slug} className="rounded-[var(--radius-card)] border border-line bg-card p-4" data-testid="faq-item">
              <ContentView result={faq.result} t={t} headingLevel={3} />
            </div>
          ))
        )}
      </section>
      <SupportForm locale={locale} />
    </div>
  );
}
