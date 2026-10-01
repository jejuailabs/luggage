import type { Metadata } from "next";
import Link from "next/link";
import { formatKst, formatMoney, type MessageKey } from "@luggage/i18n";
import { PfHero } from "@/components/pf-hero";
import { SimBookingCard } from "@/components/demo/sim-booking-card";
import { AccountActions } from "@/components/account/account-actions";
import { NO_INDEX } from "@/lib/seo";
import { getRequestContext, resolveLocale } from "@/lib/request-context";
import { getViewer } from "@/server/auth";

export const metadata: Metadata = { robots: NO_INDEX };
const ticketLabels = {
  ko: { open: "접수됨", pending_customer: "고객 답변 대기", resolved: "처리 완료" },
  "zh-CN": { open: "已受理", pending_customer: "等待您的回复", resolved: "已解决" },
  en: { open: "Open", pending_customer: "Awaiting your reply", resolved: "Resolved" },
} as const;

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const locale = await resolveLocale(params);
  const { t } = await getRequestContext(locale);
  const viewer = await getViewer();
  const authenticated = Boolean(viewer.user && !viewer.user.isAnonymous);
  const [{ data: orders }, { data: tickets }] = viewer.user && viewer.client ? await Promise.all([
    viewer.client.from("orders").select("id, public_code, reservation_status, route_type, total_minor, currency, created_at").order("created_at", { ascending: false }).limit(12),
    viewer.client.from("support_tickets").select("id, subject, status, created_at").order("created_at", { ascending: false }).limit(6),
  ]) : [{ data: [] }, { data: [] }];
  const copy = locale === "ko" ? { title: "내 여정, 내 짐", subtitle: "예약부터 수령까지 한곳에서 확인하세요.", tracker: "내 짐 현재 위치", trackerText: "지도에서 배송 차량의 최근 위치를 확인하고, GPS 이동 화면을 체험해 보세요.", track: "위치 보기", demo: "GPS 추적 해보기", orders: "내 예약", noOrders: "아직 예약이 없습니다.", book: "예약하기", inquiries: "내 문의", noInquiries: "문의 내역이 없습니다.", account: "계정 관리", signup: "회원가입", login: "로그인", guest: "회원 계정을 만들면 다른 기기에서도 내 여정을 확인할 수 있습니다. 이 기기에서 만든 비회원 예약은 가입 시 이어집니다.", status: "상태", help: "고객지원" } : locale === "zh-CN" ? { title: "我的旅程与行李", subtitle: "从预约到领取，所有进度都在这里。", tracker: "我的行李位置", trackerText: "在地图查看配送车辆最近位置，或体验 GPS 行程演示。", track: "查看位置", demo: "体验 GPS 追踪", orders: "我的订单", noOrders: "还没有订单。", book: "立即预约", inquiries: "我的咨询", noInquiries: "没有咨询记录。", account: "账户管理", signup: "注册", login: "登录", guest: "注册后可在其他设备查看行程。本设备的游客订单会继续保留。", status: "状态", help: "客户支持" } : { title: "My journey & bags", subtitle: "Track everything from booking to handover.", tracker: "Where are my bags?", trackerText: "See the last reported delivery vehicle position on a map, or try the GPS journey demo.", track: "View location", demo: "Try GPS tracking", orders: "My bookings", noOrders: "No bookings yet.", book: "Book now", inquiries: "My requests", noInquiries: "No requests yet.", account: "Account settings", signup: "Sign up", login: "Log in", guest: "Create an account to see your journey on other devices. Guest bookings on this device stay linked.", status: "Status", help: "Help desk" };
  return (
    <div className="account-page customer-inner-page">
      <PfHero chip={locale === "ko" ? "🧳 마이페이지" : locale === "zh-CN" ? "🧳 我的页面" : "🧳 My page"} title={copy.title} subtitle={copy.subtitle} tone="coral" emoji="👋" />
      <section className="account-tracker"><div><span className="account-page__icon" aria-hidden="true">📍</span><h2>{copy.tracker}</h2><p>{copy.trackerText}</p></div><Link href={`/${locale}/account/track${orders?.[0] ? `?order=${orders[0].id}` : ""}`} className="account-tracker__link">{orders?.[0] ? copy.track : copy.demo} <span aria-hidden="true">↗</span></Link></section>
      {!authenticated ? <section className="account-page__join"><div><span className="account-page__icon" aria-hidden="true">👤</span><h2>{copy.account}</h2><p>{copy.guest}</p></div><div><Link href={`/${locale}/account/signup`}>{copy.signup} ↗</Link><Link href={`/${locale}/account/login`}>{copy.login}</Link></div></section> : null}
      <section className="account-page__panel customer-card"><span className="account-page__icon" aria-hidden="true">🎫</span><h2>{copy.orders}</h2>{orders?.length ? <ul className="account-page__list">{orders.map((order) => <li key={order.id}><Link href={`/${locale}/orders/${order.id}`}><span><strong>{order.public_code}</strong><small>{formatKst(new Date(order.created_at), locale, { dateStyle: "medium" })} · {copy.status}: {t(`order.status.${order.reservation_status}` as MessageKey)}</small></span><span>{formatMoney(order.total_minor, order.currency, locale)} ↗</span></Link></li>)}</ul> : <SimBookingCard locale={locale} emptyFallback={<><div className="account-page__empty"><p>{copy.noOrders}</p><Link href={`/${locale}/luggage/book`}>{copy.book} ↗</Link></div></>} />}</section>
      <section className="account-page__panel customer-card"><span className="account-page__icon" aria-hidden="true">💬</span><h2>{copy.inquiries}</h2>{tickets?.length ? <ul className="account-page__list">{tickets.map((ticket) => <li key={ticket.id}><Link href={`/${locale}/help/requests/${ticket.id}`}><span><strong>{ticket.subject}</strong><small>{formatKst(new Date(ticket.created_at), locale, { dateStyle: "medium" })} · {ticketLabels[locale][ticket.status as keyof typeof ticketLabels["ko"]] ?? ticket.status}</small></span><span>↗</span></Link></li>)}</ul> : <p>{copy.noInquiries}</p>}<Link href={`/${locale}/help`} className="account-page__secondary">{copy.help} ↗</Link></section>
      {authenticated && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ? <section className="account-page__panel customer-card"><span className="account-page__icon" aria-hidden="true">⚙️</span><h2>{copy.account}</h2><AccountActions locale={locale} /></section> : null}
    </div>
  );
}
