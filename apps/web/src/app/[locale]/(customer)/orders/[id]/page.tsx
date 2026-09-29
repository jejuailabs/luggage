import type { Metadata } from "next";
import { formatKst, formatMoney, type MessageKey } from "@luggage/i18n";
import { OrderActions } from "@/components/booking/order-actions";
import { Voucher, type VoucherBag } from "@/components/booking/voucher";
import { getRequestContext, resolveLocale } from "@/lib/request-context";
import { NO_INDEX } from "@/lib/seo";
import { getViewer } from "@/server/auth";
import { getOrderView } from "@/server/orders";

export const metadata: Metadata = { robots: NO_INDEX };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function OrderPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const locale = await resolveLocale(params);
  const { id } = await params;
  const { t, runtime } = await getRequestContext(locale);
  const viewer = await getViewer();
  // 소유 세션이 있어야 한다. 주문 번호만으로는 열리지 않는다 (RLS).
  const order = UUID.test(id) && viewer.client && viewer.user ? await getOrderView(viewer.client, id) : null;

  const panel = "rounded-[var(--radius-card)] border border-line bg-card p-4";
  // 예약증은 서버가 확정한 주문에만 보여 준다 (결제창 복귀만으로는 표시하지 않는다).
  const bags: VoucherBag[] =
    order?.reservationStatus === "confirmed" && viewer.client
      ? (
          (await viewer.client.from("bags").select("seq, size, tag_id, bag_status").eq("order_id", order.id).order("seq")).data ?? []
        ).map((b) => ({ seq: b.seq, size: b.size, tagId: b.tag_id, status: b.bag_status }))
      : [];
  if (!order) {
    return (
      <section className={panel} data-testid="order-not-found">
        <h1 className="text-xl font-bold">{t("order.title")}</h1>
        <p className="mt-2 text-muted">{t("order.notFound")}</p>
      </section>
    );
  }

  const time = (iso: string) => formatKst(new Date(iso), locale, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const dateTime = (iso: string) => formatKst(new Date(iso), locale, { dateStyle: "medium", timeStyle: "short", hourCycle: "h23" });
  const money = (amount: number) => formatMoney(amount, order.currency, locale);

  return (
    <div className="flex flex-col gap-4" data-testid="order-page">
      <section className="rounded-[var(--radius-card)] bg-sea px-4 py-5">
        <p className="text-sm text-muted">{t("order.code")}</p>
        <p className="text-2xl font-bold tracking-wider" data-testid="order-code">
          {order.publicCode}
        </p>
        <p className="mt-2 font-semibold" data-testid="order-status" data-status={order.reservationStatus}>
          {t(`order.status.${order.reservationStatus}` as MessageKey)}
        </p>
        <p className="text-sm text-muted" data-testid="payment-summary" data-summary={order.payment.summary}>
          {t(`payment.summary.${order.payment.summary}` as MessageKey)}
        </p>
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

      <OrderActions
        locale={locale}
        orderId={order.id}
        runtime={runtime}
        reservationStatus={order.reservationStatus}
        paymentSummary={order.payment.summary}
        latestAttemptStatus={order.payment.latestAttempt?.status ?? null}
        hasRefundRequest={Boolean(order.refund && order.refund.requestStatus !== "rejected")}
      />

      <dl className={`${panel} grid grid-cols-1 gap-3 text-sm`}>
        <div>
          <dt className="text-muted">{t("order.pickup")}</dt>
          <dd className="font-medium">
            {order.originHotel?.nameKo} · {formatKst(new Date(order.slot.pickupStartsAt), locale, { dateStyle: "medium" })}{" "}
            {time(order.slot.pickupStartsAt)}–{time(order.slot.pickupEndsAt)} ({t("time.kstLabel")})
          </dd>
        </div>
        <div>
          <dt className="text-muted">{t("order.delivery")}</dt>
          <dd className="font-medium">
            {time(order.slot.deliveryStartsAt)}–{time(order.slot.deliveryEndsAt)} ({t("time.kstLabel")})
          </dd>
        </div>
        {order.flight.departsAt ? (
          <div>
            <dt className="text-muted">{t("order.flight")}</dt>
            <dd className="font-medium">
              {order.flight.number ?? ""} {dateTime(order.flight.departsAt)}
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
    </div>
  );
}
