import type { Metadata } from "next";
import Link from "next/link";
import { TrackingMap } from "@/components/account/tracking-map";
import { resolveLocale } from "@/lib/request-context";
import { NO_INDEX } from "@/lib/seo";
import { getViewer } from "@/server/auth";
import { getOrderView } from "@/server/orders";

export const metadata: Metadata = { robots: NO_INDEX };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const copy = {
  ko: { back: "마이페이지", title: "내 짐 현재 위치", demo: "GPS 추적 해보기", order: "예약", noLocation: "이 주문의 차량 위치 기록이 아직 없습니다. 위치가 전송되면 이 화면에서 확인할 수 있습니다.", viewOrder: "예약 상세 보기" },
  "zh-CN": { back: "我的页面", title: "我的行李位置", demo: "体验 GPS 追踪", order: "订单", noLocation: "这笔订单尚无车辆位置记录。位置上传后可在此查看。", viewOrder: "查看订单" },
  en: { back: "My page", title: "Where are my bags?", demo: "Try GPS tracking", order: "Booking", noLocation: "No vehicle position has been reported for this order yet. It will appear here when available.", viewOrder: "View booking" },
} as const;

export default async function TrackPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ order?: string }> }) {
  const locale = await resolveLocale(params);
  const t = copy[locale];
  const { order: orderId } = await searchParams;
  const viewer = await getViewer();
  const order = orderId && UUID.test(orderId) && viewer.client && viewer.user ? await getOrderView(viewer.client, orderId) : null;
  const { data } = order && viewer.client ? await viewer.client.rpc("latest_vehicle_location", { p_order_id: order.id }).maybeSingle<{ latitude: number; longitude: number; observed_at: string; stale: boolean }>() : { data: null };
  const location = data ? { latitude: Number(data.latitude), longitude: Number(data.longitude), observedAt: data.observed_at, stale: data.stale } : null;
  return <div className="tracking-page customer-inner-page">
    <Link href={`/${locale}/account`} className="tracking-page__back">← {t.back}</Link>
    <header><span className="landing-kicker">YOUR JOURNEY, IN VIEW</span><h1>{order ? `${t.order} ${order.publicCode}` : t.demo}</h1><p>{t.title}</p></header>
    {location ? <TrackingMap locale={locale} location={location} /> : <><TrackingMap locale={locale} demo />{order ? <p className="tracking-page__notice">{t.noLocation}</p> : null}</>}
    {order ? <Link href={`/${locale}/orders/${order.id}`} className="tracking-page__order-link">{t.viewOrder} ↗</Link> : null}
  </div>;
}
