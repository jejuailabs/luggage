import QRCode from "qrcode";
import { formatKst, type Locale, type MessageKey, type Translate } from "@luggage/i18n";
import type { OrderView } from "@/server/orders";
import { PrintButton } from "./print-button";

export interface VoucherBag {
  seq: number;
  size: string;
  tagId: string;
  status: string;
}

/**
 * 호텔 직원에게 보여 줄 한국어 안내 (고객 언어와 무관하게 한국어 고정 — 현장 직원용).
 * 주문번호는 참조용이며 조회 권한을 주지 않는다.
 */
function staffCardKo(order: OrderView, bagCount: number): string[] {
  const time = (iso: string) => formatKst(new Date(iso), "ko", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const date = formatKst(new Date(order.slot.pickupStartsAt), "ko", { month: "long", day: "numeric", weekday: "short" });
  const header = ["[짐배송 예약 고객]", `예약번호 ${order.publicCode} · 짐 ${bagCount}개`];
  const delivery = `${date} ${time(order.slot.deliveryStartsAt)}–${time(order.slot.deliveryEndsAt)} (한국 시간)`;
  if (order.routeType === "airport_to_hotel") {
    return [
      ...header,
      `공항에서 받은 짐이 ${delivery}에 호텔에 도착합니다.`,
      "기사가 도착하면 짐마다 태그를 확인하고 인수(보관) 처리해 주세요.",
    ];
  }
  const lines = [
    ...header,
    `기사 수거: ${date} ${time(order.slot.pickupStartsAt)}–${time(order.slot.pickupEndsAt)} (한국 시간)`,
    "짐을 받아 프런트에 보관해 주세요. 기사가 짐마다 QR을 확인한 뒤 수거합니다.",
  ];
  if (order.routeType === "hotel_to_hotel" && order.destinationHotel) {
    lines.push(`도착 숙소: ${order.destinationHotel.nameKo} · ${delivery}`);
  }
  return lines;
}

/**
 * 예약증. 서버가 확정한 주문에만 보여 준다. QR에는 참조 번호만 담는다 (개인정보·접근 권한 없음).
 */
export async function Voucher({
  order,
  bags,
  locale,
  t,
  checkedAt,
}: {
  order: OrderView;
  bags: VoucherBag[];
  locale: Locale;
  t: Translate;
  checkedAt: Date;
}) {
  const qrSvg = await QRCode.toString(order.publicCode, { type: "svg", margin: 2, errorCorrectionLevel: "M" });
  const total = bags.length;

  return (
    <section
      className="flex flex-col gap-4 rounded-[var(--radius-card)] border border-line bg-card p-4 print:border-0"
      aria-labelledby="voucher-title"
      data-testid="voucher"
    >
      <h2 id="voucher-title" className="text-lg font-bold">
        {t("voucher.title")}
      </h2>
      <p className="text-sm">{t("voucher.qrLabel")}</p>
      {/* 스캔 안정성을 위해 테마와 관계없이 밝은 바탕을 쓴다. */}
      <div className="mx-auto w-56 rounded-[var(--radius-button)] bg-white p-3" aria-label={order.publicCode}>
        <div dangerouslySetInnerHTML={{ __html: qrSvg }} />
        <p className="mt-1 text-center font-mono text-lg font-bold tracking-widest text-black">{order.publicCode}</p>
      </div>

      <div className="rounded-[var(--radius-button)] border border-line bg-sea p-3" lang="ko" data-testid="voucher-staff-card">
        <p className="mb-1 text-xs text-muted" lang={locale}>
          {t("voucher.staffCard")}
        </p>
        {staffCardKo(order, total).map((line) => (
          <p key={line} className="text-sm font-medium">
            {line}
          </p>
        ))}
      </div>

      <div>
        <h3 className="mb-2 font-semibold">{t("voucher.bagsTitle")}</h3>
        <ul className="flex flex-col gap-2" data-testid="voucher-bags">
          {bags.map((bag) => (
            <li key={bag.tagId} className="flex items-center justify-between rounded-[var(--radius-button)] border border-line px-3 py-2 text-sm">
              <span>
                {t("voucher.bagLine", {
                  seq: bag.seq,
                  total,
                  size: t(`booking.bag.${bag.size}` as MessageKey),
                })}
              </span>
              <span className="font-mono text-xs text-muted">{t("voucher.tag", { tag: bag.tagId })}</span>
            </li>
          ))}
        </ul>
      </div>

      <p className="text-xs text-muted" data-testid="voucher-checked-at">
        {t("voucher.lastChecked", {
          time: formatKst(checkedAt, locale, { dateStyle: "medium", timeStyle: "short", hourCycle: "h23" }),
        })}
      </p>
      <p className="text-xs text-muted">{t("voucher.offlineNote")}</p>
      <PrintButton label={t("voucher.save")} />
    </section>
  );
}
