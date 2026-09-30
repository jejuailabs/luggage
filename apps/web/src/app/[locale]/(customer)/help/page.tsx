import type { Metadata } from "next";
import { PfHero } from "@/components/pf-hero";
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
    <div className="help-page customer-inner-page">
      <PfHero chip={locale === "ko" ? "💬 고객지원" : locale === "zh-CN" ? "💬 客服中心" : "💬 Help desk"} title={t("help.title")} subtitle={t("help.body")} tone="lilac" emoji="🙋">
        <a href="#support-form" className="pf-btn pf-btn--coral">{locale === "ko" ? "문의 남기기" : locale === "zh-CN" ? "提交咨询" : "Ask us"} →</a>
      </PfHero>
      <section aria-labelledby="faq-title" className="help-page__faq">
        <div className="landing-section__heading"><div><span className="landing-kicker">ANSWERS FOR YOUR JOURNEY</span><h2 id="faq-title">{t("faq.title")}</h2></div></div>
        <div className="help-page__faq-grid">
        {faqs === null ? (
          <p className="text-muted">{t("content.unavailable")}</p>
        ) : faqs.length === 0 ? (
          <p className="text-muted">{t("content.empty")}</p>
        ) : (
          faqs.map((faq) => (
            <div key={faq.slug} className="customer-card help-page__faq-card" data-testid="faq-item">
              <span aria-hidden="true" className="help-page__faq-icon">💡</span>
              <ContentView result={faq.result} t={t} headingLevel={3} />
            </div>
          ))
        )}
        </div>
      </section>
      <div className="help-page__support" id="support-form"><SupportForm locale={locale} /></div>
    </div>
  );
}
