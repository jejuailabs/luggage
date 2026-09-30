import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { PfHero } from "@/components/pf-hero";
import { PreviewJourney } from "@/components/demo/preview-journey";
import { ContentView } from "@/components/content-view";
import { PageView } from "@/components/page-view";
import { getRequestContext, resolveLocale } from "@/lib/request-context";
import { localizedAlternates } from "@/lib/seo";
import { getContent, listContent } from "@/server/content";

/** 결제 전에 반드시 보여 줘야 하는 필수 안내 (01 문서 4절). */
const REQUIRED_NOTICES = ["bag-size-rules", "prohibited-items", "cancellation-refund", "damage-compensation"] as const;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const { t } = await getRequestContext(locale);
  return { title: t("luggage.title"), description: t("luggage.intro"), alternates: localizedAlternates(locale, "luggage") };
}

export default async function LuggagePage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = await resolveLocale(params);
  const { t } = await getRequestContext(locale);
  const guides = ((await listContent("guide", locale)) ?? []).filter((g) => ["checkout-day", "arrival-day", "hotel-move"].includes(g.slug));
  const [howItWorks, ...notices] = await Promise.all([
    getContent("how-it-works", locale),
    ...REQUIRED_NOTICES.map((slug) => getContent(slug, locale)),
  ]);
  // 필수 안내가 이 언어로 승인되지 않았거나 불러오지 못하면 예약 진입을 막는다.
  const bookingAllowed = notices.every((notice) => notice.status === "ok");
  const howLines = howItWorks.status === "ok" ? howItWorks.translation.body.split(/\r?\n/).map((line) => line.trim()).filter(Boolean) : [];
  const howSteps = howLines.map((line) => line.replace(/^(?:\[예시\]|【示例】|\[Sample\])\s*/i, "").match(/^(\d{1,2})[.)]\s*(.+)$/));
  const structuredHow = howSteps.length >= 2 && howSteps.every((step) => step !== null);
  const howCopy = {
    ko: { label: "예약부터 수령까지", steps: "단계별 이용 안내", sample: "이용 예시", step: "단계", cta: "짐 배송 예약하기", chip: "👀 이용 미리보기", previewTitle: "짐배송, 미리 따라가 보기", previewIntro: "상황을 고르면 예시 값이 채워져 있어요. 다음 버튼만 눌러 예약부터 짐 찾기까지 확인해 보세요." },
    "zh-CN": { label: "从预约到领取", steps: "服务流程", sample: "服务示例", step: "步骤", cta: "预约行李配送", chip: "👀 服务预览", previewTitle: "先跟着体验一遍行李配送", previewIntro: "选择场景后已填好示例信息，只需点击下一步，即可看到从预约到取回行李的全过程。" },
    en: { label: "From booking to collection", steps: "How it works", sample: "Example journey", step: "Step", cta: "Book luggage delivery", chip: "👀 Preview", previewTitle: "Walk through a delivery", previewIntro: "Pick a situation — sample details are already filled in. Just tap Next to see everything from booking to collecting your bags." },
  }[locale];
  const isSample = howItWorks.status === "ok" && /^(?:\[예시\]|【示例】|\[Sample\])/i.test(howItWorks.translation.body);

  return (
    <div className="service-page customer-inner-page">
      <PageView locale={locale} />
      <PfHero chip={howCopy.chip} title={howCopy.previewTitle} subtitle={howCopy.previewIntro} tone="sky" emoji="👀" />
      <PreviewJourney locale={locale} />


      {guides.length > 0 ? (
        <section aria-labelledby="scenarios-title" className="service-page__scenarios">
          <div className="landing-section__heading"><div><span className="landing-kicker">TRAVEL YOUR WAY</span><h2 id="scenarios-title">{t("luggage.scenarios")}</h2></div></div>
          <div className="service-page__scenario-grid">{guides.map((guide, index) =>
            guide.result.status === "ok" ? (
              <Link
                key={guide.slug}
                href={`/${locale}/guide/${guide.slug}`}
                data-testid="scenario-link"
                className="service-page__scenario-card"
              >
                <span className="service-page__scenario-emoji" aria-hidden="true">{["🧳", "🛬", "🏨"][index]}</span>
                <span>0{index + 1}</span><strong>{guide.result.translation.title}</strong><b aria-hidden="true">↗</b>
              </Link>
            ) : null,
          )}</div>
        </section>
      ) : null}

      <section className="service-page__how customer-card" aria-labelledby="how-title">
        <div className="service-page__how-photo"><Image src="/images/editorial-luggage.jpg" alt="" width={1200} height={1600} sizes="(min-width: 768px) 40vw, 100vw" /><span className="pf-sticker pf-sticker--sun" aria-hidden="true">HOW TO</span></div>
        <div className="service-page__how-text"><span className="landing-kicker">HOW IT WORKS</span>
          {structuredHow && howItWorks.status === "ok" ? <article data-testid="content-how-it-works" data-content-status={howItWorks.fallback ? "fallback" : "ok"} lang={howItWorks.translation.locale}>
            {howItWorks.fallback ? <p className="service-page__how-fallback" data-testid="content-fallback-notice">{t("content.fallbackNotice", { language: howItWorks.translation.locale })}</p> : null}
            <div className="service-page__how-heading"><div><span>{howCopy.label}</span><h2 id="how-title">{howItWorks.translation.title}</h2><p>{howCopy.steps}</p></div><b>{String(howSteps.length).padStart(2, "0")} {locale === "ko" ? "단계" : locale === "zh-CN" ? "个步骤" : "STEPS"}</b></div>
            {isSample ? <span className="service-page__how-sample">{howCopy.sample}</span> : null}
            <ol className="service-page__how-steps">{howSteps.map((step, index) => <li key={`${step![1]}-${index}`}><span className="service-page__how-number">{String(index + 1).padStart(2, "0")}</span><div><small>{howCopy.step} {index + 1}</small><strong>{step![2]}</strong></div></li>)}</ol>
            {bookingAllowed ? <Link href={`/${locale}/luggage/book`} className="service-page__how-link">{howCopy.cta} <span aria-hidden="true">↗</span></Link> : null}
          </article> : <div id="how-title"><ContentView result={howItWorks} t={t} testId="content-how-it-works" /></div>}
        </div>
      </section>

      <section aria-labelledby="rules-title" className="service-page__rules" id="required-notices">
        <div className="landing-section__heading"><div><span className="landing-kicker">BEFORE YOU BOOK</span><h2 id="rules-title">{t("luggage.rules")}</h2></div></div>
        <div className="service-page__rules-grid">
        {notices.map((notice, index) => (
          <div key={REQUIRED_NOTICES[index]} className="customer-card p-5">
            <span className="service-page__rule-icon" aria-hidden="true">{["📏", "🚫", "↩️", "🛡️"][index] ?? "📌"}</span>
            <ContentView result={notice} t={t} headingLevel={3} testId={`content-${REQUIRED_NOTICES[index]}`} />
          </div>
        ))}
        </div>
      </section>

      {bookingAllowed ? (
        <Link
          href={`/${locale}/luggage/book`}
          data-testid="booking-cta"
          className="customer-action service-page__cta"
        >
          {t("home.search.submit")}
        </Link>
      ) : (
        <p role="note" data-testid="booking-blocked" className="text-center text-sm text-warm">
          {t("luggage.bookingBlocked")}
        </p>
      )}
    </div>
  );
}
