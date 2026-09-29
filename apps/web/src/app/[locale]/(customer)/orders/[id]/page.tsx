import type { Metadata } from "next";
import { formatKst, formatMoney, type MessageKey } from "@luggage/i18n";
import { getRequestContext, resolveLocale } from "@/lib/request-context";
import { NO_INDEX } from "@/lib/seo";
import { getViewer } from "@/server/auth";
import { getOrderView } from "@/server/orders";

export const metadata: Metadata = { robots: NO_INDEX };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function OrderPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const locale = await resolveLocale(params);
  const { id } = await params;
  const { t } = await getRequestContext(locale);
  const viewer = await getViewer();
  // 소유 세션이 있어야 한다. 주문 번호만으로는 열리지 않는다 (RLS).
  const order = UUID.test(id) && viewer.client && viewer.user ? await getOrderView(viewer.client, id) : null;

  const panel = "rounded-[var(--radius-card)] border border-line bg-card p-4";
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
