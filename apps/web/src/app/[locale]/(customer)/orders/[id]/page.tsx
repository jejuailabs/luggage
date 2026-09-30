import type { Metadata } from "next";
import Link from "next/link";
import { formatKst, formatMoney, type MessageKey } from "@luggage/i18n";
import { HandoffCode } from "@/components/booking/handoff-code";
import { OrderActions } from "@/components/booking/order-actions";
import { SupportForm } from "@/components/support/support-form";
import { VehicleLocation } from "@/components/booking/vehicle-location";
import { Voucher, type VoucherBag } from "@/components/booking/voucher";
import { getRequestContext, resolveLocale } from "@/lib/request-context";
import { NO_INDEX } from "@/lib/seo";
import { getViewer } from "@/server/auth";
import { getOrderView } from "@/server/orders";
import { createSupabaseServiceClient } from "@/server/service-client";

export const metadata: Metadata = { robots: NO_INDEX };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function OrderPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const locale = await resolveLocale(params);
  const { id } = await params;
  const { t, runtime } = await getRequestContext(locale);
  const viewer = await getViewer();
  // 소유 세션이 있어야 한다. 주문 번호만으로는 열리지 않는다 (RLS).
  const order = UUID.test(id) && viewer.client && viewer.user ? await getOrderView(viewer.client, id) : null;

  const panel = "customer-card p-5";
  // 예약증은 서버가 확정한 주문에만 보여 준다 (결제창 복귀만으로는 표시하지 않는다).
  const bags: VoucherBag[] =
    order?.reservationStatus === "confirmed" && viewer.client
      ? (
          (await viewer.client.from("bags").select("seq, size, tag_id, bag_status").eq("order_id", order.id).order("seq")).data ?? []
        ).map((b) => ({ seq: b.seq, size: b.size, tagId: b.tag_id, status: b.bag_status }))
      : [];
  // 짐별 마지막 서버 기록 시각 (배송 조회)
  const lastEvents = new Map<string, string>();
  if (order && bags.length > 0 && viewer.client) {
    const { data: events } = await viewer.client
      .from("bag_events")
      .select("bag_id, server_received_at, bags!inner(tag_id)")
      .eq("order_id", order.id)
      .order("server_received_at", { ascending: false });
    for (const event of (events ?? []) as unknown as { server_received_at: string; bags: { tag_id: string } }[]) {
      if (!lastEvents.has(event.bags.tag_id)) lastEvents.set(event.bags.tag_id, event.server_received_at);
    }
  }
  if (!order) {
    return (
      <div className="order-page customer-inner-page"><section className="order-page__empty customer-card" data-testid="order-not-found"><span className="landing-kicker">JEJU · YOUR JOURNEY</span><h1>{t("order.title")}</h1><p>{t("order.notFound")}</p><div className="empty-page-actions"><Link href={`/${locale}/account`}>{locale === "ko" ? "내 짐 확인" : locale === "zh-CN" ? "查看我的行李" : "My bags"} ↗</Link><Link href={`/${locale}/help`}>{t("nav.help")} ↗</Link></div></section></div>
    );
  }

  const handoffAt = order.routeType === "airport_to_hotel" ? order.slot.pickupStartsAt : order.slot.deliveryStartsAt;
  const airportHandoffs: { id: string; name: string; floor: string | null; directions: string | null; photoUrl: string | null }[] = [];
  if (order.reservationStatus === "confirmed" && order.routeType !== "hotel_to_hotel" && viewer.client) {
    const { data: owned } = await viewer.client.from("orders").select("route_offering_id").eq("id", order.id).maybeSingle();
    const service = createSupabaseServiceClient();
    if (owned && service) {
      const { data: offering } = await service.from("route_offerings").select("origin_zone_id, destination_zone_id").eq("id", owned.route_offering_id).maybeSingle();
      const zoneId = order.routeType === "airport_to_hotel" ? offering?.origin_zone_id : offering?.destination_zone_id;
      if (zoneId) {
        const { data: places } = await service.from("handoff_locations").select("id, name_ko, floor, photo_path, valid_from, valid_until, handoff_location_translations(locale, name, directions)").eq("zone_id", zoneId).eq("status", "active").in("type", ["airport_counter", "airport_meeting_point"]);
        for (const place of places ?? []) {
          if (Date.parse(place.valid_from) > Date.parse(handoffAt) || place.valid_until && Date.parse(place.valid_until) <= Date.parse(handoffAt)) continue;
          const translation = place.handoff_location_translations?.find((row) => row.locale === locale);
          const signed = place.photo_path ? await service.storage.from("evidence").createSignedUrl(place.photo_path, 600) : null;
          airportHandoffs.push({ id: place.id, name: translation?.name ?? place.name_ko, floor: place.floor, directions: translation?.directions ?? null, photoUrl: signed?.data?.signedUrl ?? null });
        }
      }
    }
  }

  const time = (iso: string) => formatKst(new Date(iso), locale, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const dateTime = (iso: string) => formatKst(new Date(iso), locale, { dateStyle: "medium", timeStyle: "short", hourCycle: "h23" });
  const money = (amount: number) => formatMoney(amount, order.currency, locale);

  return (
    <div className="order-page customer-inner-page" data-testid="order-page">
      <section className="order-page__summary customer-card overflow-hidden">
        <div className="px-5 py-5">
        <span className="landing-kicker">JEJU · BOOKING STATUS</span>
        <p className="text-sm text-muted">{t("order.code")}</p>
        <p className="mt-1 text-2xl font-extrabold tracking-wide" data-testid="order-code">
          {order.publicCode}
        </p>
        <p className="mt-4 inline-flex rounded-full bg-sea px-3 py-1 text-sm font-bold text-primary" data-testid="order-status" data-status={order.reservationStatus}>
          {t(`order.status.${order.reservationStatus}` as MessageKey)}
        </p>
        <p className="text-sm text-muted" data-testid="payment-summary" data-summary={order.payment.summary}>
          {t(`payment.summary.${order.payment.summary}` as MessageKey)}
        </p>
        </div>
      </section>

      {order.reservationStatus === "held" && order.holdExpiresAt ? (
        <p role="status" className={`${panel} border-l-4 border-l-warm text-sm`}>
          {t("order.holdNotice", { time: dateTime(order.holdExpiresAt) })}
        </p>
      ) : null}
      {order.reservationStatus === "expired" ? (
        <p role="status" className={`${panel} text-sm`}>
          {t("order.expiredNotice")}
        </p>
      ) : null}

      {order.refund ? (
        <section className={`${panel} text-sm`} data-testid="refund-status">
          <h2 className="font-semibold">{t("refund.title")}</h2>
          <p className="mt-1">
            {t(`refund.status.${order.refund.requestStatus}` as MessageKey)} · {money(order.refund.amountMinor)}
          </p>
          {order.refund.executionStatus ? (
            <p className="text-muted">{t(`refund.execution.${order.refund.executionStatus}` as MessageKey)}</p>
          ) : null}
        </section>
      ) : null}

      {order.reservationStatus === "confirmed" && bags.length > 0 ? (
        <Voucher order={order} bags={bags} locale={locale} t={t} checkedAt={new Date()} />
      ) : null}

      {airportHandoffs.length > 0 ? <section className={`${panel} grid gap-3`} data-testid="airport-handoff-location"><h2 className="customer-section-heading">{locale === "ko" ? "공항 인계 장소" : locale === "zh-CN" ? "机场行李交接地点" : "Airport luggage handoff"}</h2>{airportHandoffs.map((place) => <div key={place.id} className="grid gap-2 rounded-xl border border-line bg-bg p-4"><strong>{place.name}{place.floor ? ` · ${place.floor}` : ""}</strong>{place.directions ? <p className="text-sm text-muted">{place.directions}</p> : null}{place.photoUrl ? <a href={place.photoUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-primary underline">{locale === "ko" ? "장소 사진 보기" : locale === "zh-CN" ? "查看地点照片" : "View location photo"}</a> : null}</div>)}</section> : null}

      {bags.length > 0 ? (
        <section className={`${panel} flex flex-col gap-3`} data-testid="delivery-status">
          <h2 className="customer-section-heading">{t("delivery.title")}</h2>
          <p className="text-sm text-muted">
            {t("delivery.progress", {
              delivered: bags.filter((b) => b.status === "delivered").length,
              total: bags.filter((b) => b.status !== "cancelled_before_pickup").length,
            })}
          </p>
          <ul className="flex flex-col gap-2 text-sm">
            {bags.map((bag) => {
              const last = lastEvents.get(bag.tagId);
              return (
                <li key={bag.tagId} className="flex flex-col rounded-xl border border-line bg-bg px-4 py-3" data-status={bag.status}>
                  <span className="flex justify-between gap-2">
                    <span>{t("delivery.bagLine", { seq: bag.seq, size: t(`booking.bag.${bag.size}` as MessageKey) })}</span>
                    <span className="font-medium">{t(`bag.status.${bag.status}` as MessageKey)}</span>
                  </span>
                  <span className="text-xs text-muted">
                    {last ? t("delivery.lastUpdate", { time: dateTime(last) }) : t("delivery.noUpdate")}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
      {order.reservationStatus === "confirmed" && viewer.client ? (
        <VehicleLocation client={viewer.client} orderId={order.id} locale={locale} t={t} />
      ) : null}
      {order.reservationStatus === "confirmed" ? <Link href={`/${locale}/account/track?order=${order.id}`} className="tracking-page__order-link">{locale === "ko" ? "지도에서 내 짐 위치 보기" : locale === "zh-CN" ? "在地图查看行李位置" : "Track my bags on map"} ↗</Link> : null}
      {order.reservationStatus === "confirmed" && bags.length > 0 ? (
        <HandoffCode locale={locale} orderId={order.id} ready={bags.some((b) => b.status === "ready_for_handoff")} />
      ) : null}

      <OrderActions
        locale={locale}
        orderId={order.id}
        runtime={runtime}
        reservationStatus={order.reservationStatus}
        paymentSummary={order.payment.summary}
        latestAttemptStatus={order.payment.latestAttempt?.status ?? null}
        hasRefundRequest={Boolean(order.refund && order.refund.requestStatus !== "rejected")}
      />

      <dl className={`${panel} order-page__details grid grid-cols-1 gap-3 text-sm`}>
        <div>
          <dt className="text-muted">{t(order.routeType === "airport_to_hotel" ? "order.pickupAirport" : "order.pickup")}</dt>
          <dd className="font-medium">
            {order.originHotel ? `${order.originHotel.nameKo} · ` : ""}{formatKst(new Date(order.slot.pickupStartsAt), locale, { dateStyle: "medium" })}{" "}
            {time(order.slot.pickupStartsAt)}–{time(order.slot.pickupEndsAt)} ({t("time.kstLabel")})
          </dd>
        </div>
        <div>
          <dt className="text-muted">{t(order.routeType === "hotel_to_airport" ? "order.delivery" : "order.deliveryHotel")}</dt>
          <dd className="font-medium">
            {order.destinationHotel ? `${order.destinationHotel.nameKo} · ` : ""}
            {time(order.slot.deliveryStartsAt)}–{time(order.slot.deliveryEndsAt)} ({t("time.kstLabel")})
          </dd>
        </div>
        {order.flight.departsAt || order.flight.arrivesAt ? (
          <div>
            <dt className="text-muted">{t("order.flight")}</dt>
            <dd className="font-medium">
              {order.flight.number ?? ""} {dateTime((order.flight.departsAt ?? order.flight.arrivesAt)!)}
            </dd>
          </div>
        ) : null}
        <div>
          <dt className="text-muted">{t("order.bags")}</dt>
          <dd className="font-medium">
            {order.bags.map((bag) => `${t(`booking.bag.${bag.size}` as MessageKey)} × ${bag.quantity}`).join(", ")}
          </dd>
        </div>
        <div>
          <dt className="text-muted">{t("order.total")}</dt>
          <dd className="text-lg font-bold">{money(order.totalMinor)}</dd>
        </div>
      </dl>
      <SupportForm locale={locale} orderId={order.id} />
    </div>
  );
}
