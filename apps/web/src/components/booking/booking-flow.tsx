"use client";

import { DemoEntry } from "@/components/demo/demo-entry";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { RouteType } from "@luggage/domain";
import { createTranslator, formatKst, formatMoney, getMessages, type Locale, type MessageKey } from "@luggage/i18n";

interface Slot {
  slotId: string;
  pickup: { startsAt: string; endsAt: string };
  delivery: { startsAt: string; endsAt: string };
  remainingUnits: number;
}

interface Quote {
  quoteId: string;
  lineItems: { size: "standard" | "large"; quantity: number; amountMinor: number }[];
  discountMinor: number;
  totalMinor: number;
  taxIncludedMinor: number;
  currency: string;
  expiresAt: string;
}

type Bags = { standard: number; large: number };

const MAX_BAGS = 8;

/** 한국 기준 오늘 + n일 (YYYY-MM-DD). */
function kstDate(offsetDays: number): string {
  return new Date(Date.now() + 9 * 3600_000 + offsetDays * 86_400_000).toISOString().slice(0, 10);
}

function newIdempotencyKey(): string {
  return crypto.randomUUID().replaceAll("-", "");
}

async function postJson(url: string, body: unknown, headers: Record<string, string> = {}) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  const json = await response.json().catch(() => null);
  return { ok: response.ok, data: json?.data, messageKey: json?.error?.messageKey as string | undefined };
}

export function BookingFlow({
  locale,
  hotel,
  routeType,
  destinations = [],
  policies,
}: {
  locale: Locale;
  /** 숙소→공항·숙소→숙소는 출발 호텔, 공항→숙소는 도착 호텔 */
  hotel: { slug: string; name: string };
  routeType: RouteType;
  /** 숙소→숙소에서 고를 수 있는 도착 호텔 */
  destinations?: { slug: string; name: string }[];
  policies: { slug: string; title: string }[];
}) {
  const t = useMemo(() => createTranslator(locale), [locale]);
  const messages = getMessages(locale);
  const router = useRouter();

  const [date, setDate] = useState(kstDate(1));
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [slotId, setSlotId] = useState<string | null>(null);
  const [bags, setBags] = useState<Bags>({ standard: 1, large: 0 });
  const [flightNumber, setFlightNumber] = useState("");
  const [flightDate, setFlightDate] = useState(kstDate(1));
  const [flightTime, setFlightTime] = useState("");
  const [destination, setDestination] = useState(destinations[0]?.slug ?? "");
  const needsFlight = routeType !== "hotel_to_hotel";
  const [quote, setQuote] = useState<Quote | null>(null);
  const [couponCode, setCouponCode] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null);
  const [accepted, setAccepted] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 기본 날짜에 슬롯이 없으면(예: 내일 마감이 지난 저녁) 사용자가 날짜를 고르기 전까지 다음 날로 넘긴다.
  const autoAdvance = useRef({ userChose: false, steps: 0 });

  const errorText = (key: string | undefined) =>
    key && key in messages ? t(key as MessageKey) : t("booking.error.generic");
  const time = (iso: string) => formatKst(new Date(iso), locale, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const money = (amount: number, currency: string) => formatMoney(amount, currency, locale);
  // 입력이 바뀌면 이전 견적은 쓸 수 없다.
  const invalidateQuote = () => {
    setQuote(null);
    setIdempotencyKey(null);
  };

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({ hotel: hotel.slug, routeType, date });
    if (routeType === "hotel_to_hotel") {
      if (!destination) return;
      params.set("destinationHotel", destination);
    }
    fetch(`/api/v1/service-slots?${params}`)
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        const list: Slot[] = json?.data?.slots ?? [];
        if (list.length === 0 && !autoAdvance.current.userChose && autoAdvance.current.steps < 3) {
          autoAdvance.current.steps += 1;
          const next = new Date(`${date}T00:00:00Z`);
          next.setUTCDate(next.getUTCDate() + 1);
          const nextDate = next.toISOString().slice(0, 10);
          setDate(nextDate);
          setFlightDate(nextDate);
          return;
        }
        setSlots(list);
        setSlotId((current) => (list.some((s) => s.slotId === current) ? current : (list[0]?.slotId ?? null)));
      })
      .catch(() => !cancelled && setSlots([]));
    return () => {
      cancelled = true;
    };
  }, [date, hotel.slug, routeType, destination]);

  const totalBags = bags.standard + bags.large;
  const selectedSlot = slots?.find((slot) => slot.slotId === slotId);
  const destinationName = destinations.find((item) => item.slug === destination)?.name;
  const summaryCopy = {
    ko: { title: "예약 내용", pickup: "수거지", delivery: "전달지", schedule: "배송 일정", bags: "짐 수량", amount: "예상 요금", pending: "정보 입력 후 계산", airport: "제주공항", unit: "개" },
    "zh-CN": { title: "预约概要", pickup: "取件地点", delivery: "送达地点", schedule: "配送时间", bags: "行李数量", amount: "预计费用", pending: "填写后计算", airport: "济州机场", unit: "件" },
    en: { title: "Booking summary", pickup: "Pickup", delivery: "Delivery", schedule: "Schedule", bags: "Bags", amount: "Estimated price", pending: "Calculate after details", airport: "Jeju Airport", unit: "" },
  }[locale];
  const canQuote = Boolean(slotId) && totalBags > 0 && (!needsFlight || Boolean(flightTime)) && !busy;

  async function requestQuote() {
    setBusy(true);
    setError(null);
    // 비회원 소유 세션 (이미 있으면 그대로 유지)
    const session = await postJson("/api/v1/sessions/guest", {});
    if (!session.ok) {
      setBusy(false);
      setError(errorText(undefined));
      return;
    }
    const result = await postJson("/api/v1/quotes", {
      slotId,
      originHotel: routeType === "airport_to_hotel" ? undefined : hotel.slug,
      destinationHotel: routeType === "airport_to_hotel" ? hotel.slug : routeType === "hotel_to_hotel" ? destination : undefined,
      bags,
      flightNumber: needsFlight ? flightNumber.trim() || undefined : undefined,
      flightDepartsAt: routeType === "hotel_to_airport" ? `${flightDate}T${flightTime}:00+09:00` : undefined,
      flightArrivesAt: routeType === "airport_to_hotel" ? `${flightDate}T${flightTime}:00+09:00` : undefined,
    });
    setBusy(false);
    if (!result.ok) {
      setError(errorText(result.messageKey));
      return;
    }
    setQuote(result.data);
    setIdempotencyKey(newIdempotencyKey());
  }

  /** 쿠폰 적용·해제. 할인과 세액은 서버가 다시 계산한 견적으로 교체한다. */
  async function applyCoupon(code: string) {
    if (!quote) return;
    setBusy(true);
    setError(null);
    const result = await postJson(`/api/v1/quotes/${quote.quoteId}/coupon`, { code });
    setBusy(false);
    if (!result.ok) {
      setError(errorText(result.messageKey));
      return;
    }
    setQuote(result.data);
    setIdempotencyKey(newIdempotencyKey());
  }

  async function submitOrder(form: FormData) {
    if (!quote || !idempotencyKey) return;
    setBusy(true);
    setError(null);
    const text = (name: string) => String(form.get(name) ?? "").trim() || undefined;
    const result = await postJson(
      "/api/v1/orders",
      {
        quoteId: quote.quoteId,
        contact: { name: text("name") ?? "", email: text("email"), phone: text("phone"), wechat: text("wechat") },
        locale,
        acceptedPolicies: [...accepted],
      },
      { "Idempotency-Key": idempotencyKey },
    );
    if (!result.ok) {
      setBusy(false);
      setError(errorText(result.messageKey));
      return;
    }
    router.push(`/${locale}/orders/${result.data.id}`);
  }

  const card = "customer-card flex flex-col gap-4 p-5";
  const input = "customer-input min-h-12 w-full px-3";

  return (
    <div className="booking-layout" data-testid="booking-flow"><div className="booking-layout__main">
      <section className={card} aria-labelledby="step-slot">
        <h2 id="step-slot" className="customer-section-heading">
          {t("booking.step.slot")}
        </h2>
        {routeType === "hotel_to_hotel" ? (
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">{t("booking.destinationHotel")}</span>
            <select
              value={destination}
              onChange={(e) => {
                setDestination(e.target.value);
                invalidateQuote();
              }}
              className={input}
              data-testid="booking-destination"
            >
              {destinations.map((d) => (
                <option key={d.slug} value={d.slug}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">{t("booking.date")}</span>
          <input
            type="date"
            value={date}
            min={kstDate(0)}
            max={kstDate(60)}
            onChange={(e) => {
              autoAdvance.current.userChose = true;
              setDate(e.target.value);
              setFlightDate(e.target.value);
              invalidateQuote();
            }}
            className={input}
            data-testid="booking-date"
          />
        </label>
        {slots === null ? (
          <p className="text-sm text-muted">{t("booking.working")}</p>
        ) : slots.length === 0 ? (
          <p className="text-sm text-muted" data-testid="booking-no-slots">
            {t("booking.noSlots")}
          </p>
        ) : (
          <fieldset className="flex flex-col gap-2">
            <legend className="sr-only">{t("booking.step.slot")}</legend>
            {slots.map((slot) => (
              <label
                key={slot.slotId}
                className="flex min-h-12 items-center gap-3 rounded-[var(--radius-button)] border border-line px-3 has-[:checked]:border-primary has-[:checked]:bg-sea"
              >
                <input
                  type="radio"
                  name="slot"
                  value={slot.slotId}
                  checked={slotId === slot.slotId}
                  onChange={() => {
                    setSlotId(slot.slotId);
                    invalidateQuote();
                  }}
                  data-testid="booking-slot"
                />
                <span className="text-sm">
                  {t(routeType === "hotel_to_airport" ? "booking.slotOption" : `booking.slotOption.${routeType}`, {
                    pickup: `${time(slot.pickup.startsAt)}–${time(slot.pickup.endsAt)}`,
                    delivery: `${time(slot.delivery.startsAt)}–${time(slot.delivery.endsAt)}`,
                  })}
                </span>
              </label>
            ))}
          </fieldset>
        )}
      </section>

      <section className={card} aria-labelledby="step-bags">
        <h2 id="step-bags" className="customer-section-heading">
          {t("booking.step.bags")}
        </h2>
        {(["standard", "large"] as const).map((size) => {
          const label = t(`booking.bag.${size}`);
          return (
            <div key={size} className="flex items-center justify-between gap-3">
              <span className="text-sm">{label}</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  aria-label={t("booking.decrease", { item: label })}
                  disabled={bags[size] === 0}
                  onClick={() => {
                    setBags({ ...bags, [size]: bags[size] - 1 });
                    invalidateQuote();
                  }}
                  className="min-h-11 min-w-11 rounded-[var(--radius-button)] border border-line text-lg disabled:opacity-40"
                >
                  −
                </button>
                <output className="w-6 text-center font-semibold" data-testid={`bag-count-${size}`}>
                  {bags[size]}
                </output>
                <button
                  type="button"
                  aria-label={t("booking.increase", { item: label })}
                  disabled={totalBags >= MAX_BAGS}
                  onClick={() => {
                    setBags({ ...bags, [size]: bags[size] + 1 });
                    invalidateQuote();
                  }}
                  className="min-h-11 min-w-11 rounded-[var(--radius-button)] border border-line text-lg disabled:opacity-40"
                >
                  +
                </button>
              </div>
            </div>
          );
        })}
      </section>

      {needsFlight ? (
      <section className={card} aria-labelledby="step-flight">
        <h2 id="step-flight" className="customer-section-heading">
          {t("booking.step.flight")}
        </h2>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">{t("booking.flightNumber")}</span>
          <input
            value={flightNumber}
            onChange={(e) => {
              setFlightNumber(e.target.value.toUpperCase());
              invalidateQuote();
            }}
            placeholder={t("booking.flightNumberHint")}
            autoCapitalize="characters"
            maxLength={10}
            className={input}
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">
              {t(routeType === "airport_to_hotel" ? "booking.flightArrivalDate" : "booking.flightDate")}
            </span>
            <input
              type="date"
              value={flightDate}
              min={date}
              onChange={(e) => {
                setFlightDate(e.target.value);
                invalidateQuote();
              }}
              className={input}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">
              {t(routeType === "airport_to_hotel" ? "booking.flightArrivalTime" : "booking.flightTime")}
            </span>
            <input
              type="time"
              value={flightTime}
              onChange={(e) => {
                setFlightTime(e.target.value);
                invalidateQuote();
              }}
              className={input}
              data-testid="booking-flight-time"
            />
          </label>
        </div>
      </section>
      ) : null}

      {error ? (
        <p role="alert" className="rounded-[var(--radius-button)] border border-warm px-3 py-2 text-sm" data-testid="booking-error">
          {error}
        </p>
      ) : null}
      {error ? <DemoEntry locale={locale} kind="blocked" route={routeType} hotel={hotel.slug} /> : null}

      {quote ? (
        <>
          <section className={card} aria-labelledby="step-quote" data-testid="booking-quote">
            <h2 id="step-quote" className="customer-section-heading">
              {t("booking.step.quote")}
            </h2>
            <ul className="flex flex-col gap-1 text-sm">
              {quote.lineItems.map((item) => (
                <li key={item.size} className="flex justify-between">
                  <span>
                    {t(`booking.bag.${item.size}`)} × {item.quantity}
                  </span>
                  <span>{money(item.amountMinor, quote.currency)}</span>
                </li>
              ))}
            </ul>
            {quote.discountMinor > 0 ? (
              <p className="flex justify-between text-sm font-semibold" data-testid="booking-discount">
                <span>{t("booking.coupon.discount")}</span>
                <span>−{money(quote.discountMinor, quote.currency)}</span>
              </p>
            ) : null}
            <form
              className="booking-coupon"
              onSubmit={(event) => {
                event.preventDefault();
                void applyCoupon(couponCode);
              }}
            >
              <label className="booking-coupon__field">
                <span>{t("booking.coupon.label")}</span>
                <input value={couponCode} onChange={(event) => setCouponCode(event.target.value.toUpperCase())} maxLength={20} autoComplete="off" data-testid="booking-coupon-input" />
              </label>
              <button type="submit" className="pf-btn pf-btn--ghost" disabled={busy || !couponCode.trim()}>{t("booking.coupon.apply")}</button>
              {quote.discountMinor > 0 ? <button type="button" className="booking-coupon__remove" disabled={busy} onClick={() => { setCouponCode(""); void applyCoupon(""); }}>{t("booking.coupon.remove")}</button> : null}
            </form>
            <p className="text-xs text-muted">{quote.discountMinor > 0 ? `✓ ${t("booking.coupon.applied")} · ` : ""}{t("booking.coupon.rule")}</p>
            <p className="flex justify-between border-t border-line pt-2 text-lg font-bold">
              <span>{t("booking.total")}</span>
              <span data-testid="booking-total">{money(quote.totalMinor, quote.currency)}</span>
            </p>
            <p className="text-xs text-muted">{t("booking.taxIncluded", { tax: money(quote.taxIncludedMinor, quote.currency) })}</p>
            <p className="text-xs text-muted">{t("booking.quoteExpires", { time: time(quote.expiresAt) })}</p>
          </section>

          <form
            className={card}
            aria-labelledby="step-contact"
            onSubmit={(event) => {
              event.preventDefault();
              void submitOrder(new FormData(event.currentTarget));
            }}
          >
            <h2 id="step-contact" className="font-semibold">
              {t("booking.step.contact")}
            </h2>
            <p className="text-xs text-muted">{t("booking.contactHint")}</p>
            {(
              [
                ["name", "booking.name", "text", "name"],
                ["email", "booking.email", "email", "email"],
                ["phone", "booking.phone", "tel", "tel"],
                ["wechat", "booking.wechat", "text", "off"],
              ] as const
            ).map(([name, label, type, autoComplete]) => (
              <label key={name} className="flex flex-col gap-1">
                <span className="text-sm font-medium">{t(label)}</span>
                <input
                  name={name}
                  type={type}
                  autoComplete={autoComplete}
                  required={name === "name"}
                  maxLength={name === "email" ? 254 : 80}
                  className={input}
                  data-testid={`contact-${name}`}
                />
              </label>
            ))}
            <fieldset className="flex flex-col gap-2">
              {policies.map((policy) => (
                <label key={policy.slug} className="flex min-h-11 items-start gap-3 text-sm">
                  <input
                    type="checkbox"
                    className="mt-1 size-5"
                    checked={accepted.has(policy.slug)}
                    onChange={(e) => {
                      const next = new Set(accepted);
                      if (e.target.checked) next.add(policy.slug);
                      else next.delete(policy.slug);
                      setAccepted(next);
                    }}
                    data-testid={`accept-${policy.slug}`}
                  />
                  <span>
                    {t("booking.acceptPolicy", { title: policy.title })}{" "}
                    <a href={`/${locale}/legal/${policy.slug}`} target="_blank" rel="noopener" className="text-primary underline">
                      ↗
                    </a>
                  </span>
                </label>
              ))}
            </fieldset>
            <button
              type="submit"
              disabled={busy || accepted.size < policies.length}
              data-testid="booking-submit"
              className="customer-action min-h-12 px-5 font-semibold disabled:opacity-50"
            >
              {busy ? t("booking.working") : t("booking.submit")}
            </button>
          </form>
        </>
      ) : null}
      </div><aside className="booking-layout__summary" aria-label={summaryCopy.title}>
        <span className="landing-kicker">YOUR JOURNEY</span>
        <h2>{summaryCopy.title}</h2>
        <dl>
          <div><dt>{summaryCopy.pickup}</dt><dd>{routeType === "airport_to_hotel" ? summaryCopy.airport : hotel.name}</dd></div>
          <div><dt>{summaryCopy.delivery}</dt><dd>{routeType === "hotel_to_airport" ? summaryCopy.airport : routeType === "hotel_to_hotel" ? destinationName ?? "—" : hotel.name}</dd></div>
          <div><dt>{summaryCopy.schedule}</dt><dd>{selectedSlot ? `${date} · ${time(selectedSlot.pickup.startsAt)}–${time(selectedSlot.delivery.endsAt)}` : date}</dd></div>
          <div><dt>{summaryCopy.bags}</dt><dd>{totalBags}{summaryCopy.unit}</dd></div>
        </dl>
        <div className="booking-layout__price"><small>{summaryCopy.amount}</small><strong>{quote ? money(quote.totalMinor, quote.currency) : summaryCopy.pending}</strong></div>
        {!quote ? <button
          type="button"
          disabled={!canQuote}
          onClick={requestQuote}
          data-testid="booking-get-quote"
          className="customer-action"
        >{busy ? t("booking.working") : t("booking.getQuote")} ↗</button> : null}
      </aside></div>
  );
}
