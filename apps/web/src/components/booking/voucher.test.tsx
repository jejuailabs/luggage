import { renderToStaticMarkup } from "react-dom/server";
import QRCode from "qrcode";
import { describe, expect, it, vi } from "vitest";
import { createTranslator } from "@luggage/i18n";
import type { OrderView } from "@/server/orders";
import { Voucher } from "./voucher";

const order: OrderView = {
  id: "00000000-0000-4000-8000-000000000001",
  publicCode: "JCABCDEFGH",
  reservationStatus: "confirmed",
  holdExpiresAt: null,
  routeType: "hotel_to_airport",
  originHotel: { slug: "sample-hotel-jeju-city", nameKo: "예시 호텔 제주시점" },
  destinationHotel: null,
  slot: {
    pickupStartsAt: "2026-10-01T00:00:00Z",
    pickupEndsAt: "2026-10-01T02:00:00Z",
    deliveryStartsAt: "2026-10-01T05:00:00Z",
    deliveryEndsAt: "2026-10-01T07:00:00Z",
  },
  flight: { number: "KE1234", departsAt: "2026-10-01T11:00:00Z", arrivesAt: null },
  bags: [{ size: "standard", quantity: 2, unitAmountMinor: 15000, amountMinor: 30000 }],
  totalMinor: 30000,
  taxIncludedMinor: 2727,
  currency: "KRW",
  contact: { name: "王小明", email: "wang@example.com", phone: "+8613800138000" },
  locale: "zh-CN",
  createdAt: "2026-09-29T00:00:00Z",
  payment: { summary: "paid", latestAttempt: null },
  refund: null,
};

const bags = [
  { seq: 1, size: "standard", tagId: "TABCDEFGHJK", status: "registered" },
  { seq: 2, size: "standard", tagId: "TMNPQRSTUVW", status: "registered" },
];

async function render() {
  const element = await Voucher({ order, bags, locale: "zh-CN", t: createTranslator("zh-CN"), checkedAt: new Date("2026-09-29T03:00:00Z") });
  return renderToStaticMarkup(element);
}

describe("Voucher", () => {
  it("encodes only the reference number in the QR code", async () => {
    const spy = vi.spyOn(QRCode, "toString");
    await render();
    expect(spy).toHaveBeenCalledWith("JCABCDEFGH", expect.anything());
    spy.mockRestore();
  });

  it("never renders the customer's contact details", async () => {
    const html = await render();
    for (const secret of ["王小明", "wang@example.com", "+8613800138000"]) expect(html).not.toContain(secret);
  });

  it("shows a Korean card for hotel staff with the pickup window in Korea time", async () => {
    const html = await render();
    expect(html).toContain('lang="ko"');
    expect(html).toContain("예약번호 JCABCDEFGH · 짐 2개");
    expect(html).toContain("09:00–11:00 (한국 시간)");
  });

  it("lists each bag with its tag and the last server confirmation time", async () => {
    const html = await render();
    expect(html).toContain("第 1/2 件");
    expect(html).toContain("标签 TMNPQRSTUVW");
    expect(html).toContain("最后与服务器确认");
  });
});
