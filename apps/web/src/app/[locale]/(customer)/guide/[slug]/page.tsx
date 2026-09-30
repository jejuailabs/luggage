import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ContentView } from "@/components/content-view";
import { PageView } from "@/components/page-view";
import { getRequestContext, resolveLocale } from "@/lib/request-context";
import { localizedAlternates } from "@/lib/seo";
import { getContent, getContentRecord, listContent } from "@/server/content";

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
  const related = ((await listContent("guide", locale)) ?? []).filter((item) => ["arrival-day", "checkout-day", "hotel-move"].includes(item.slug) && item.slug !== slug && item.result.status === "ok");
  const image = slug === "hotel-move" ? "/images/editorial-hotel.jpg" : slug === "arrival-day" ? "/images/editorial-island.jpg" : slug === "how-it-works" ? "/images/editorial-luggage.jpg" : "/images/editorial-airport.jpg";
  const copy = {
    ko: { eyebrow: "여행을 가볍게", journey: "이 여정의 짐 이동", leave: "짐 맡기는 곳", receive: "짐 받는 곳", airport: "제주공항", stay: "숙소", note: "가능 시간과 정확한 인계 장소는 예약 화면에서 확인하세요.", next: "이제 여행을 시작하세요", nextText: "짐 이동 가능 여부와 일정을 확인하고 예약을 진행하세요.", related: "다른 여행 상황", relatedText: "일정에 맞는 짐 배송 방법을 살펴보세요.", more: "자세히 보기", process: "전체 이용방법 보기", sample: "이용 예시" },
    "zh-CN": { eyebrow: "轻松出行", journey: "这趟旅程的行李路线", leave: "交付行李", receive: "领取行李", airport: "济州机场", stay: "住宿", note: "可用时间及准确交接地点请以预约页面为准。", next: "轻松开始旅程", nextText: "查看行李配送是否可用，选择时间并继续预约。", related: "更多旅行场景", relatedText: "找到适合行程的行李配送方式。", more: "查看详情", process: "查看完整流程", sample: "服务示例" },
    en: { eyebrow: "Travel lighter", journey: "Your bag's journey", leave: "Hand over", receive: "Collect at", airport: "Jeju Airport", stay: "Your stay", note: "Check available times and the exact handover point on the booking page.", next: "Start exploring", nextText: "Check availability and timing, then continue to booking.", related: "More travel moments", relatedText: "Find the luggage route that fits your plans.", more: "Explore guide", process: "See how it works", sample: "Example journey" },
  }[locale];
  const point = (kind: "start" | "end") => record?.relatedRoute === "airport_to_hotel"
    ? kind === "start" ? copy.airport : copy.stay
    : record?.relatedRoute === "hotel_to_airport"
      ? kind === "start" ? copy.stay : copy.airport
      : copy.stay;
  const isSample = result.status === "ok" && /^(?:\[예시\]|【示例】|\[Sample\])/i.test(result.translation.body);
  return (
    <div className="guide-page customer-inner-page">
      <PageView locale={locale} />
      <section className="guide-page__hero">
        <div className="guide-page__intro">
          <Link href={`/${locale}/luggage`} className="guide-page__back">← {t("luggage.title")}</Link>
          <span className="pf-hero2__chip">🗺️ {copy.eyebrow}</span>
          {isSample ? <span className="guide-page__sample">{copy.sample}</span> : null}
          <ContentView result={result} t={t} headingLevel={1} testId="content-page" />
          {record?.relatedRoute ? <div className="guide-page__route-tag">{t(`route.${record.relatedRoute}`)}</div> : null}
        </div>
        <div className="guide-page__photo"><Image src={image} alt="" fill priority sizes="(min-width: 900px) 48vw, 100vw" /><span className="pf-sticker pf-sticker--sun" aria-hidden="true">TRAVEL LIGHT</span></div>
      </section>
      {record?.relatedRoute ? <section className="guide-page__journey" aria-labelledby="guide-journey-title">
        <div className="guide-page__section-heading"><span className="pf-hero2__chip">🧳 JOURNEY</span><h2 id="guide-journey-title">{copy.journey}</h2></div>
        <div className="guide-page__path"><div><span>01 / {copy.leave}</span><strong>{point("start")}</strong></div><span className="guide-page__path-arrow" aria-hidden="true">→</span><div><span>02 / {copy.receive}</span><strong>{point("end")}</strong></div></div>
        <p>{copy.note}</p>
      </section> : null}
      {record?.relatedRoute ? <section className="guide-page__action"><div><span aria-hidden="true" className="guide-page__action-emoji">🚀</span><h2>{copy.next}</h2><p>{copy.nextText}</p></div><Link href={`/${locale}/luggage/book?route=${record.relatedRoute}`} data-testid="guide-cta" className="guide-page__cta">{t("guide.cta")} · {t(`route.${record.relatedRoute}`)} <span aria-hidden="true">↗</span></Link></section> : null}
      {related.length ? <section className="guide-page__related" aria-labelledby="guide-related-title"><div className="guide-page__section-heading"><span className="pf-hero2__chip">✨ MORE</span><h2 id="guide-related-title">{copy.related}</h2><p>{copy.relatedText}</p></div><div className="guide-page__related-grid">{related.map((item, index) => item.result.status === "ok" ? <Link key={item.slug} href={`/${locale}/guide/${item.slug}`} className="guide-page__related-card"><span>0{index + 1}</span><strong>{item.result.translation.title}</strong><small>{copy.more} ↗</small></Link> : null)}</div><Link href={`/${locale}/luggage`} className="guide-page__process-link">{copy.process} ↗</Link></section> : null}
    </div>
  );
}
