import type { Locale } from "@luggage/i18n";
import { RealMap } from "@/components/account/real-map";
import { JEJU_AIRPORT, type AirportPoint } from "@/server/public-info";

const COPY = {
  ko: { title: "공항 짐 인계 장소", hours: "운영 시간", kst: "한국 시간", place: "장소", pending: "인계 장소와 운영 시간은 예약증에 표시되고, 출발 전날 알림으로 다시 안내해요.", note: "장소가 바뀌면 영향을 받는 예약에 바로 알려 드려요.", airport: "제주국제공항" },
  "zh-CN": { title: "机场行李交付地点", hours: "服务时间", kst: "韩国时间", place: "地点", pending: "交付地点和服务时间会显示在预约凭证上，出发前一天还会再次通知。", note: "地点如有变更，会立即通知受影响的预约。", airport: "济州国际机场" },
  en: { title: "Airport bag handoff point", hours: "Hours", kst: "Korea time", place: "Location", pending: "The handoff point and hours appear on your voucher, and we remind you the day before.", note: "If the point changes, we notify every affected booking right away.", airport: "Jeju International Airport" },
} as const;

/** 홈의 공항 인계 장소 카드: 운영 설정의 활성 장소·운영 시간과 지도를 보여 준다. */
export function AirportPointCard({ locale, point }: { locale: Locale; point: AirportPoint | null }) {
  const t = COPY[locale];
  const location = point ? { latitude: point.latitude, longitude: point.longitude } : JEJU_AIRPORT;
  return (
    <section className="pf-card airport-card" aria-labelledby="airport-card-title" data-testid="airport-point">
      <div className="airport-card__map">
        <div className="tracking-map__canvas">
          <RealMap demo={false} location={location} progress={0} labels={{ pickup: t.airport, airport: t.airport, demo: t.title, live: point?.name ?? t.airport, unavailable: t.airport }} />
        </div>
      </div>
      <div className="airport-card__body">
        <h2 id="airport-card-title">✈️ {t.title}</h2>
        {point ? (
          <dl>
            <div><dt>{t.place}</dt><dd><strong>{point.name}</strong>{point.floor || point.directions ? <span>{[point.floor, point.directions].filter(Boolean).join(" · ")}</span> : null}</dd></div>
            {point.openingHours ? <div><dt>{t.hours}</dt><dd><strong>{point.openingHours}</strong><span>{t.kst}</span></dd></div> : null}
          </dl>
        ) : <p className="airport-card__pending">{t.pending}</p>}
        <p className="airport-card__note">🔔 {t.note}</p>
      </div>
    </section>
  );
}
