import Link from "next/link";
import type { Locale } from "@luggage/i18n";

const COPY = {
  ko: { blocked: "지금은 실제 예약을 끝까지 진행할 수 없어요. 같은 과정을 시뮬레이션으로 끝까지 체험해 보세요.", general: "예약·결제·짐 인계까지 전체 과정을 미리 체험해 보세요.", staff: "업무 계정이 없어도 호텔·기사·운영 화면 흐름을 시뮬레이션으로 볼 수 있어요.", cta: "시뮬레이션 체험" },
  "zh-CN": { blocked: "目前还无法完成真实预约。您可以通过模拟演示体验完整流程。", general: "提前体验预约、付款到行李交付的完整流程。", staff: "没有工作账号也可以通过模拟演示查看酒店、司机、运营流程。", cta: "模拟体验" },
  en: { blocked: "Real bookings can't be completed yet. Try the same journey end to end as a simulation.", general: "Preview the whole journey from booking and payment to bag handoff.", staff: "No staff account? See the hotel, driver and ops flow as a simulation.", cta: "Try simulation" },
} as const;

/** 실제 흐름이 외부 설정 때문에 막힐 때 시뮬레이션(/demo)으로 이어 주는 안내. */
export function DemoEntry({ locale, kind = "general", route, hotel, role }: { locale: Locale; kind?: "blocked" | "general" | "staff"; route?: string; hotel?: string; role?: string }) {
  const t = COPY[locale];
  const query = new URLSearchParams();
  if (route) query.set("route", route);
  if (hotel) query.set("hotel", hotel);
  if (role) query.set("role", role);
  const suffix = query.size ? `?${query}` : "";
  return (
    <div className="sim-entry pf-scope" data-testid="demo-entry">
      <span aria-hidden="true">🧪</span>
      <p>{t[kind]}</p>
      <Link href={`/${locale}/demo${suffix}`} className="pf-btn pf-btn--coral">{t.cta} →</Link>
    </div>
  );
}
