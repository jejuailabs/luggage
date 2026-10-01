import type { RouteType } from "@luggage/domain";
import type { Locale } from "@luggage/i18n";
import type { BasePrices } from "@/server/public-info";

const COPY = {
  ko: { title: "노선별 기본 요금", note: "짐 1개 · 부가세 포함", standard: "보통 짐", large: "대형 짐", routes: { hotel_to_airport: "숙소 → 공항", airport_to_hotel: "공항 → 숙소", hotel_to_hotel: "숙소 → 숙소" }, quote: "견적 문의" },
  "zh-CN": { title: "各路线基本价格", note: "每件 · 含增值税", standard: "普通行李", large: "大件行李", routes: { hotel_to_airport: "住宿 → 机场", airport_to_hotel: "机场 → 住宿", hotel_to_hotel: "住宿 → 住宿" }, quote: "咨询报价" },
  en: { title: "Base price by route", note: "Per bag · VAT included", standard: "Standard", large: "Large", routes: { hotel_to_airport: "Stay → Airport", airport_to_hotel: "Airport → Stay", hotel_to_hotel: "Stay → Stay" }, quote: "Ask for a quote" },
} as const;

/** 예약 화면 상단의 노선별 기본 요금표. 금액은 DB 요금 규칙에서 읽고, 없으면 견적 문의로 표시한다. */
export function RoutePrices({ locale, prices, current }: { locale: Locale; prices: BasePrices; current?: string }) {
  const t = COPY[locale];
  const won = (value: number) => new Intl.NumberFormat(locale, { style: "currency", currency: "KRW" }).format(value);
  return (
    <section className="route-prices" aria-labelledby="route-prices-title" data-testid="route-prices">
      <div className="route-prices__head"><h2 id="route-prices-title">🏷️ {t.title}</h2><small>{t.note}</small></div>
      <ul>
        {(Object.keys(t.routes) as RouteType[]).map((route) => {
          const price = prices[route];
          return (
            <li key={route} aria-current={current === route ? "true" : undefined}>
              <strong>{t.routes[route]}</strong>
              {price?.standard ? <span>{t.standard} <b>{won(price.standard)}</b></span> : <span>{t.quote}</span>}
              {price?.large ? <span>{t.large} <b>{won(price.large)}</b></span> : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
