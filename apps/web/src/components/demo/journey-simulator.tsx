"use client";
/* eslint-disable @next/next/no-img-element -- QR data URLs are generated in the browser. */

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import type { Locale } from "@luggage/i18n";
import { RealMap } from "@/components/account/real-map";
import { DEMO_COPY, type RouteType } from "./demo-copy";

// 시뮬레이션 전용. 서버·DB·결제·알림을 호출하지 않으며 상태는 이 브라우저에만 남는다.
const STORAGE_KEY = "jc-demo-journey-v1";
const PRICE = { standard: 15000, large: 20000 };
const COUPONS: Record<string, number> = { WELCOME10: 10 };
const SLOTS: Record<RouteType, [string, string][]> = {
  hotel_to_airport: [["09:00–11:00", "14:00–16:00"], ["12:00–14:00", "17:00–19:00"]],
  airport_to_hotel: [["10:00–12:00", "16:00–18:00"], ["13:00–15:00", "19:00–21:00"]],
  hotel_to_hotel: [["10:00–12:00", "16:00–18:00"], ["12:00–14:00", "18:00–20:00"]],
};

export type Role = "customer" | "hotel" | "driver" | "ops";
type ActionKey = "store" | "pickup" | "depart" | "arrive" | "handoff" | "hotelReceive" | "airportCollect";
type Step = { key: ActionKey; role: Role; to: number };
const FLOWS: Record<RouteType, Step[]> = {
  hotel_to_airport: [{ key: "store", role: "hotel", to: 1 }, { key: "pickup", role: "driver", to: 2 }, { key: "depart", role: "driver", to: 3 }, { key: "arrive", role: "driver", to: 4 }, { key: "handoff", role: "driver", to: 5 }],
  hotel_to_hotel: [{ key: "store", role: "hotel", to: 1 }, { key: "pickup", role: "driver", to: 2 }, { key: "depart", role: "driver", to: 3 }, { key: "hotelReceive", role: "hotel", to: 5 }],
  airport_to_hotel: [{ key: "airportCollect", role: "driver", to: 2 }, { key: "depart", role: "driver", to: 3 }, { key: "hotelReceive", role: "hotel", to: 5 }],
};

interface Log { at: string; text: string }
interface State {
  step: number;
  route: RouteType;
  hotel: string;
  destHotel: string;
  date: string;
  slot: number;
  standard: number;
  large: number;
  flight: string;
  flightTime: string;
  couponInput: string;
  coupon: string;
  name: string;
  email: string;
  wechat: string;
  agreed: boolean;
  method: "wechat" | "alipay" | "card";
  ref: string;
  tags: string[];
  code: string;
  status: number;
  flowIndex: number;
  scanned: string[];
  progress: number;
  notifs: Log[];
  events: Log[];
  incident: boolean;
  refund: "none" | "requested" | "refunded";
  role: Role;
  recovery: { email: string; sent: string; input: string; ok: boolean };
}

function random(alphabet: string, length: number) {
  const values = crypto.getRandomValues(new Uint32Array(length));
  return Array.from(values, (value) => alphabet[value % alphabet.length]).join("");
}
const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function tomorrowKst() {
  const now = new Date(Date.now() + 9 * 3600_000 + 24 * 3600_000);
  return now.toISOString().slice(0, 10);
}

function initial(route: RouteType, hotel: string, destHotel: string): State {
  return {
    step: 0, route, hotel, destHotel, date: tomorrowKst(), slot: 0, standard: 1, large: 1, flight: "KE1234", flightTime: "19:00",
    couponInput: "", coupon: "", name: "", email: "", wechat: "", agreed: false, method: "wechat",
    ref: "", tags: [], code: "", status: -1, flowIndex: 0, scanned: [], progress: 0, notifs: [], events: [],
    incident: false, refund: "none", role: "customer", recovery: { email: "", sent: "", input: "", ok: false },
  };
}

export function JourneySimulator({ locale, hotels, stays = [], initialRoute, initialHotel, initialRole = "customer", embedded = false }: { locale: Locale; hotels: { slug: string; name: string }[]; stays?: { id: string; name: string }[]; initialRoute: RouteType; initialHotel?: string; initialRole?: Role; embedded?: boolean }) {
  const t = DEMO_COPY[locale];
  const registered = useMemo(() => (hotels.length ? hotels : [{ slug: "sample-a", name: `${t.sampleHotel} A` }, { slug: "sample-b", name: `${t.sampleHotel} B` }]), [hotels, t.sampleHotel]);
  const hotelList = useMemo(() => [...registered, ...stays.filter((stay) => !registered.some((hotel) => hotel.name === stay.name)).map((stay) => ({ slug: `stay-${stay.id}`, name: stay.name }))], [registered, stays]);
  const fallbackHotel = hotelList.find((hotel) => hotel.slug === initialHotel)?.slug ?? hotelList[0]!.slug;
  const fallbackDest = hotelList.find((hotel) => hotel.slug !== fallbackHotel)?.slug ?? fallbackHotel;
  const [state, setState] = useState<State>(() => ({ ...initial(initialRoute, fallbackHotel, fallbackDest), role: initialRole }));
  const [loaded, setLoaded] = useState(false);
  const [paying, setPaying] = useState<"idle" | "sheet" | "verifying">("idle");
  const [auto, setAuto] = useState(false);
  const [codeInput, setCodeInput] = useState("");
  const [codeError, setCodeError] = useState(false);
  const [couponError, setCouponError] = useState(false);
  const [qr, setQr] = useState<Record<string, string>>({});
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  /* eslint-disable react-hooks/set-state-in-effect -- restore this browser's saved simulation once after mount. */
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      const parsed = saved ? (JSON.parse(saved) as Partial<State>) : null;
      // 예약 화면에 끼워 넣은 경우, 다른 숙소로 진행하던 시뮬레이션이면 새로 시작한다.
      const sameStay = !embedded || !initialHotel || parsed?.hotel === initialHotel;
      if (parsed && sameStay) setState({ ...initial(initialRoute, fallbackHotel, fallbackDest), ...parsed, role: initialRole });
    } catch { /* storage unavailable: start fresh */ }
    setLoaded(true);
  }, [initialRoute, fallbackHotel, fallbackDest, initialRole, embedded, initialHotel]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!loaded) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* ignore */ }
  }, [state, loaded]);

  useEffect(() => {
    let cancelled = false;
    Promise.all(state.tags.map(async (tag) => [tag, await QRCode.toDataURL(tag, { margin: 1, width: 160 })] as const)).then((pairs) => {
      if (!cancelled) setQr(Object.fromEntries(pairs));
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [state.tags]);

  // 이동 중 지도 진행
  useEffect(() => {
    if (state.status !== 3 || state.progress >= 1) return;
    const timer = setInterval(() => setState((current) => ({ ...current, progress: Math.min(1, current.progress + 0.02) })), 120);
    return () => clearInterval(timer);
  }, [state.status, state.progress]);

  const clock = useCallback(() => new Intl.DateTimeFormat(locale, { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit" }).format(new Date()), [locale]);
  const money = useCallback((value: number) => new Intl.NumberFormat(locale, { style: "currency", currency: "KRW" }).format(value), [locale]);
  const update = (patch: Partial<State>) => setState((current) => ({ ...current, ...patch }));

  const hotelName = (slug: string) => hotelList.find((hotel) => hotel.slug === slug)?.name ?? slug;
  const origin = state.route === "airport_to_hotel" ? t.airport : hotelName(state.hotel);
  const destination = state.route === "hotel_to_airport" ? t.airport : state.route === "hotel_to_hotel" ? hotelName(state.destHotel) : hotelName(state.hotel);
  const [pickupWindow, deliveryWindow] = SLOTS[state.route][state.slot] ?? SLOTS[state.route][0]!;
  const bagCount = state.standard + state.large;
  const subtotal = state.standard * PRICE.standard + state.large * PRICE.large;
  // 서버 규칙과 같게: 정률 할인, 최대 5,000원, 할인 후 최소 결제 1,000원.
  const discount = state.coupon ? Math.min(Math.floor(subtotal * (COUPONS[state.coupon] ?? 0) / 100), 5000, Math.max(subtotal - 1000, 0)) : 0;
  const total = subtotal - discount;
  const vat = Math.round(total * 10 / 110);
  const flow = FLOWS[state.route];
  const nextStep = state.status >= 0 && state.refund === "none" ? flow[state.flowIndex] : undefined;
  const visibleStatuses = useMemo(() => [0, ...FLOWS[state.route].map((step) => step.to)], [state.route]);
  const needsFlight = state.route !== "hotel_to_hotel";
  const detailsValid = bagCount > 0 && (!needsFlight || state.flight.trim().length >= 3) && (state.route !== "hotel_to_hotel" || state.hotel !== state.destHotel);
  const reviewValid = state.name.trim() && /.+@.+\..+/.test(state.email) && state.agreed;

  function applyCoupon() {
    const code = state.couponInput.trim().toUpperCase();
    if (COUPONS[code]) { update({ coupon: code }); setCouponError(false); } else { update({ coupon: "" }); setCouponError(true); }
  }

  function confirmPayment() {
    setPaying("verifying");
    setTimeout(() => {
      const tags = Array.from({ length: bagCount }, () => `T${random(UPPER, 10)}`);
      const at = clock();
      setState((current) => ({
        ...current, step: 3, status: 0, flowIndex: 0, ref: `JC${random(UPPER, 8)}`, tags, code: random("0123456789", 6),
        notifs: [{ at, text: t.notifs[0]! }], events: [{ at, text: `${t.statuses[0]} · ${t.methods[current.method]} ${money(total)}` }],
      }));
      setPaying("idle");
    }, 1800);
  }

  const perform = useCallback((step: Step, fromAuto = false) => {
    const current = stateRef.current;
    if (step.key === "handoff" && !fromAuto && codeInput.trim() !== current.code) { setCodeError(true); return; }
    setCodeError(false);
    const at = clock();
    const text = DEMO_COPY[locale].actions[step.key];
    const notif = DEMO_COPY[locale].notifs[step.to];
    setState((prev) => ({
      ...prev,
      status: step.to,
      flowIndex: prev.flowIndex + 1,
      progress: step.to === 3 ? 0 : step.to > 3 ? 1 : prev.progress,
      scanned: step.key === "pickup" || step.key === "airportCollect" ? prev.tags : prev.scanned,
      events: [...prev.events, { at, text: `${DEMO_COPY[locale].roles[step.role]} · ${text}` }],
      notifs: notif ? [...prev.notifs, { at, text: notif }] : prev.notifs,
    }));
  }, [clock, codeInput, locale]);

  // 자동 진행
  useEffect(() => {
    if (!auto) return;
    const timer = setTimeout(() => {
      const current = stateRef.current;
      if (current.step === 0) update({ step: 1 });
      else if (current.step === 1) update({ name: current.name || "Li Na", email: current.email || "sample@example.invalid", agreed: true, step: 2 });
      else if (current.step === 2 && paying === "idle") confirmPayment();
      else if (current.step === 3) {
        const step = FLOWS[current.route][current.flowIndex];
        if (!step || current.refund !== "none") { setAuto(false); return; }
        if (current.status === 3 && current.progress < 1) return;
        update({ role: step.role });
        perform(step, true);
      }
    }, 1500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- tick on state changes only.
  }, [auto, state, paying]);

  function reset() {
    setAuto(false);
    setPaying("idle");
    setCodeInput("");
    setState(initial(state.route, state.hotel, state.destHotel));
  }

  function reportDelay() {
    const at = clock();
    update({ incident: true, events: [...state.events, { at, text: `${t.roles.ops} · ${t.incident}` }], notifs: [...state.notifs, { at, text: t.delayNotif }] });
  }
  function requestRefund() {
    const at = clock();
    update({ refund: "requested", events: [...state.events, { at, text: `${t.roles.customer} · ${t.cancel}` }], notifs: [...state.notifs, { at, text: t.refundRequested }] });
  }
  function approveRefund() {
    const at = clock();
    update({ refund: "refunded", events: [...state.events, { at, text: `${t.roles.ops} · ${t.approveRefund}` }], notifs: [...state.notifs, { at, text: t.refunded }] });
  }
  function sendRecovery() {
    const code = random("0123456789", 6);
    update({ recovery: { ...state.recovery, sent: code, ok: false }, notifs: [...state.notifs, { at: clock(), text: `${t.recoveryNotif}: ${code}` }] });
  }

  const actionButton = (role: Role) => {
    if (!nextStep) return null;
    if (nextStep.role !== role) {
      return <p className="sim-wait">{t.waiting}: <button type="button" onClick={() => update({ role: nextStep.role })}>{t.roles[nextStep.role]} →</button></p>;
    }
    const blocked = state.status === 3 && state.progress < 1 && nextStep.key !== "depart";
    return (
      <div className="sim-action">
        {nextStep.key === "handoff" ? (
          <label className="sim-field">{t.enterCode}<input inputMode="numeric" maxLength={6} value={codeInput} onChange={(event) => setCodeInput(event.target.value)} placeholder="000000" /></label>
        ) : null}
        {codeError ? <p className="sim-error">{t.wrongCode}</p> : null}
        <button type="button" className="pf-btn pf-btn--coral" disabled={blocked} onClick={() => perform(nextStep)}>{t.actions[nextStep.key]}</button>
      </div>
    );
  };

  const statusTimeline = (
    <ol className="sim-timeline">
      {visibleStatuses.map((status) => (
        <li key={status} className={state.status >= status ? "is-done" : ""} aria-current={state.status === status ? "step" : undefined}>
          <span aria-hidden="true">{state.status > status || state.status === 5 ? "✓" : ""}</span>{t.statuses[status]}
        </li>
      ))}
    </ol>
  );

  const map = state.status >= 2 && state.status < 5 ? (
    <div className="sim-map">
      <strong>{t.mapTitle}</strong>
      <div className="tracking-map__canvas"><RealMap demo progress={state.route === "airport_to_hotel" ? 1 - state.progress : state.progress} labels={{ pickup: t.pickup, airport: t.airport, demo: t.badge, live: t.mapTitle, unavailable: "Map unavailable" }} /></div>
    </div>
  ) : null;

  return (
    <div className="sim">
      <header className={embedded ? "sim-head sim-head--embedded" : "sim-head"}>
        <span className="pf-sim-badge">🧪 {t.badge}</span>
        {embedded ? null : <><h1>{t.title}</h1><p>{t.intro}</p></>}
        <div className="sim-head__actions">
          <button type="button" className="pf-btn pf-btn--coral" onClick={() => setAuto(!auto)}>{auto ? `⏸ ${t.autoStop}` : `▶ ${t.auto}`}</button>
          <button type="button" className="pf-btn pf-btn--ghost" onClick={reset}>↺ {t.reset}</button>
        </div>
      </header>

      <ol className="sim-steps">
        {t.steps.map((label, index) => <li key={label} className={state.step === index ? "is-current" : state.step > index ? "is-done" : ""}><span>{state.step > index ? "✓" : index + 1}</span>{label}</li>)}
      </ol>

      <div className={state.step < 3 ? "sim-booking" : undefined}>
      <div className="sim-booking__main">
      {state.step === 0 ? (
        <section className="sim-card sim-search">
          <div className="sim-fromto" aria-hidden="true">
            <div><small>FROM</small><b>{state.route === "airport_to_hotel" ? "✈️" : "🏨"}</b><span>{origin}</span></div>
            <i>⇄</i>
            <div><small>TO</small><b>{state.route === "hotel_to_airport" ? "✈️" : "🏨"}</b><span>{destination}</span></div>
          </div>
          <fieldset className="sim-routes"><legend>{t.route}</legend>
            {(Object.keys(t.routes) as RouteType[]).map((route) => (
              <button key={route} type="button" aria-pressed={state.route === route} onClick={() => update({ route, slot: 0 })}>{t.routes[route]}</button>
            ))}
          </fieldset>
          <div className="sim-grid">
            <label className="sim-field">{state.route === "airport_to_hotel" ? t.arrivalHotel : t.hotel}
              <HotelPicker hotels={hotelList} value={state.hotel} onChange={(hotel) => update({ hotel })} placeholder={t.searchStay} />
            </label>
            {state.route === "hotel_to_hotel" ? (
              <label className="sim-field">{t.destHotel}
                <HotelPicker hotels={hotelList} value={state.destHotel} onChange={(destHotel) => update({ destHotel })} placeholder={t.searchStay} />
              </label>
            ) : null}
            <label className="sim-field">{t.date}<input type="date" value={state.date} onChange={(event) => update({ date: event.target.value })} /></label>
          </div>
          <fieldset className="sim-slots"><legend>{t.slot}</legend>
            {SLOTS[state.route].map(([pickup, delivery], index) => (
              <button key={pickup} type="button" aria-pressed={state.slot === index} onClick={() => update({ slot: index })}><small>{t.pickup}</small> {pickup} <span aria-hidden="true">→</span> <small>{t.delivery}</small> {delivery}</button>
            ))}
          </fieldset>
          <div className="sim-bags"><strong>{t.bags}</strong>
            {(["standard", "large"] as const).map((size) => (
              <div key={size}><span>{t[size]}</span>
                <button type="button" aria-label="-" disabled={state[size] === 0} onClick={() => update({ [size]: state[size] - 1 })}>−</button>
                <b>{state[size]}</b>
                <button type="button" aria-label="+" disabled={bagCount >= 8} onClick={() => update({ [size]: state[size] + 1 })}>+</button>
              </div>
            ))}
          </div>
          {needsFlight ? (
            <div className="sim-grid">
              <label className="sim-field">{t.flight}<input value={state.flight} onChange={(event) => update({ flight: event.target.value.toUpperCase() })} /></label>
              <label className="sim-field">{t.flightTime}<input type="time" value={state.flightTime} onChange={(event) => update({ flightTime: event.target.value })} /></label>
            </div>
          ) : null}
          <div className="sim-nav"><button type="button" className="pf-btn pf-btn--coral" disabled={!detailsValid} onClick={() => update({ step: 1 })}>{t.next} →</button></div>
        </section>
      ) : null}

      {state.step === 1 ? (
        <section className="sim-card">
          <div className="sim-summary">
            <p><b>{origin}</b> <span aria-hidden="true">→</span> <b>{destination}</b></p>
            <p>{state.date} · {t.pickup} {pickupWindow} · {t.delivery} {deliveryWindow} ({t.kst})</p>
          </div>
          <h2>{t.quote}</h2>
          <dl className="sim-price">
            {state.standard ? <div><dt>{t.standard} × {state.standard}</dt><dd>{money(state.standard * PRICE.standard)}</dd></div> : null}
            {state.large ? <div><dt>{t.large} × {state.large}</dt><dd>{money(state.large * PRICE.large)}</dd></div> : null}
            <div><dt>{t.subtotal}</dt><dd>{money(subtotal)}</dd></div>
            {discount ? <div className="is-discount"><dt>{t.discount} ({state.coupon})</dt><dd>−{money(discount)}</dd></div> : null}
            <div className="is-total"><dt>{t.total}</dt><dd>{money(total)}</dd></div>
          </dl>
          <p className="sim-muted">{t.vat} {money(vat)}</p>
          <div className="sim-coupon">
            <label className="sim-field">{t.coupon}<input value={state.couponInput} onChange={(event) => update({ couponInput: event.target.value })} placeholder="WELCOME10" /></label>
            <button type="button" className="pf-btn pf-btn--ghost" onClick={applyCoupon}>{t.couponApply}</button>
          </div>
          <p className={couponError ? "sim-error" : "sim-muted"}>{couponError ? t.couponBad : state.coupon ? `✓ ${t.couponOk}` : t.couponHint}</p>
          <h2>{t.contact}</h2>
          <p className="sim-muted">{t.contactHint}</p>
          <div className="sim-grid">
            <label className="sim-field">{t.name}<input value={state.name} onChange={(event) => update({ name: event.target.value })} autoComplete="off" /></label>
            <label className="sim-field">{t.email}<input type="email" value={state.email} onChange={(event) => update({ email: event.target.value })} placeholder="name@example.com" autoComplete="off" /></label>
            <label className="sim-field">{t.wechat}<input value={state.wechat} onChange={(event) => update({ wechat: event.target.value })} autoComplete="off" /></label>
          </div>
          <h2>{t.policies}</h2>
          <ul className="sim-policies">{t.policyItems.map((item) => <li key={item}>{item}</li>)}</ul>
          <p className="sim-muted">{t.policyNote}</p>
          <label className="sim-check"><input type="checkbox" checked={state.agreed} onChange={(event) => update({ agreed: event.target.checked })} /> {t.agree}</label>
          <div className="sim-nav">
            <button type="button" className="pf-btn pf-btn--ghost" onClick={() => update({ step: 0 })}>← {t.back}</button>
            <button type="button" className="pf-btn pf-btn--coral" disabled={!reviewValid} onClick={() => update({ step: 2 })}>{t.next} →</button>
          </div>
        </section>
      ) : null}

      {state.step === 2 ? (
        <section className="sim-card">
          <h2>{t.payTitle}</h2>
          <div className="sim-methods">
            {(Object.keys(t.methods) as State["method"][]).map((method) => (
              <button key={method} type="button" aria-pressed={state.method === method} className={`sim-method sim-method--${method}`} onClick={() => update({ method })}>{t.methods[method]}</button>
            ))}
          </div>
          <p className="sim-muted">{t.miniProgram}</p>
          <div className="sim-nav">
            <button type="button" className="pf-btn pf-btn--ghost" onClick={() => update({ step: 1 })}>← {t.back}</button>
            <button type="button" className="pf-btn pf-btn--coral" onClick={() => setPaying("sheet")}>{money(total)} {t.payNow}</button>
          </div>
        </section>
      ) : null}

      </div>
      {state.step < 3 ? (
        <aside className="sim-ticket" aria-label={t.quote}>
          <div className="sim-ticket__head"><span>🎫 {t.quote}</span><span className="pf-sim-badge">🧪</span></div>
          <div className="sim-ticket__route"><b>{origin}</b><i aria-hidden="true">✈</i><b>{destination}</b></div>
          <dl>
            <div><dt>{t.date}</dt><dd>{state.date}</dd></div>
            <div><dt>{t.pickup}</dt><dd>{pickupWindow}</dd></div>
            <div><dt>{t.delivery}</dt><dd>{deliveryWindow}</dd></div>
            <div><dt>{t.bags}</dt><dd>{bagCount}</dd></div>
            {discount ? <div><dt>{t.discount}</dt><dd>−{money(discount)}</dd></div> : null}
          </dl>
          <div className="sim-ticket__total"><span>{t.total}</span><strong>{money(total)}</strong></div>
          <small>{t.vat} {money(vat)} · {t.kst}</small>
        </aside>
      ) : null}
      </div>

      {paying !== "idle" ? (
        <div className="sim-sheet" role="dialog" aria-modal="true" aria-label={t.sheetTitle}>
          <div className={`sim-sheet__panel sim-sheet__panel--${state.method}`}>
            <span className="pf-sim-badge">🧪 {t.badge}</span>
            <strong>{t.methods[state.method]}</strong>
            <p className="sim-sheet__amount">{money(total)}</p>
            {paying === "sheet" ? (
              <>
                <button type="button" className="pf-btn pf-btn--coral" onClick={confirmPayment}>{t.sheetTitle}</button>
                <button type="button" className="sim-link" onClick={() => setPaying("idle")}>✕</button>
              </>
            ) : (
              <><span className="sim-spinner" aria-hidden="true" /><p>{t.verifying}</p><small>{t.verifyNote}</small></>
            )}
          </div>
        </div>
      ) : null}

      {state.step === 3 ? (
        <>
          <nav className="sim-roles" aria-label="role">
            {(Object.keys(t.roles) as Role[]).map((role) => (
              <button key={role} type="button" aria-pressed={state.role === role} onClick={() => update({ role })}>
                {t.roles[role]}{nextStep?.role === role ? <i aria-hidden="true" /> : null}
              </button>
            ))}
          </nav>
          <div className="sim-layout">
            <div className="sim-main">
              {state.role === "customer" ? (
                <section className="sim-card">
                  <p className="sim-ok">✓ {t.paid}</p>
                  <div className="sim-voucher">
                    <div className="sim-voucher__top"><span>{t.voucher}</span><b>{state.ref}</b></div>
                    <p className="sim-voucher__route"><b>{origin}</b> <span aria-hidden="true">→</span> <b>{destination}</b></p>
                    <p>{state.date} · {t.pickup} {pickupWindow} · {t.delivery} {deliveryWindow} ({t.kst})</p>
                    <div className="sim-tags">{state.tags.map((tag) => <figure key={tag}>{qr[tag] ? <img src={qr[tag]} alt={`${t.tag} ${tag}`} width={96} height={96} /> : <span className="sim-qr-ph" />}<figcaption>{tag}</figcaption></figure>)}</div>
                    <small>{t.qrNote}</small>
                  </div>
                  {statusTimeline}
                  {state.route === "hotel_to_airport" ? (
                    <div className="sim-code">{state.status >= 4 && state.status < 5 ? <><span>{t.handoffCode}</span><b>{state.code}</b><small>{t.codeHint}</small></> : <small>{state.status >= 5 ? t.done : t.codeLater}</small>}</div>
                  ) : state.status >= 5 ? <p className="sim-ok">{t.done}</p> : null}
                  {map}
                  {state.status <= 1 && state.refund === "none" ? <button type="button" className="pf-btn pf-btn--ghost" onClick={requestRefund}>{t.cancel}</button> : null}
                  {state.status > 1 && state.refund === "none" && state.status < 5 ? <p className="sim-muted">{t.cancelClosed}</p> : null}
                  {state.refund !== "none" ? <p className="sim-ok">{t.cancel}: {t.refundState[state.refund]}</p> : null}
                  <details className="sim-recovery">
                    <summary>{t.recovery}</summary>
                    <div className="sim-coupon">
                      <label className="sim-field">{t.email}<input type="email" value={state.recovery.email || state.email} onChange={(event) => update({ recovery: { ...state.recovery, email: event.target.value } })} /></label>
                      <button type="button" className="pf-btn pf-btn--ghost" onClick={sendRecovery}>{t.recoverySend}</button>
                    </div>
                    {state.recovery.sent ? (
                      <div className="sim-coupon">
                        <label className="sim-field">{t.recoveryCode}<input inputMode="numeric" value={state.recovery.input} onChange={(event) => update({ recovery: { ...state.recovery, input: event.target.value } })} /></label>
                        <button type="button" className="pf-btn pf-btn--ghost" onClick={() => update({ recovery: { ...state.recovery, ok: state.recovery.input.trim() === state.recovery.sent } })}>{t.recoveryVerify}</button>
                      </div>
                    ) : null}
                    {state.recovery.ok ? <p className="sim-ok">✓ {t.recoveryOk}</p> : null}
                  </details>
                </section>
              ) : null}

              {state.role === "hotel" || state.role === "driver" ? (
                <section className="sim-card">
                  <div className="sim-job">
                    <span className="sim-job__role">{state.role === "hotel" ? "🏨" : "🚐"} {t.roles[state.role]}</span>
                    <b>{state.ref}</b>
                    <p>{origin} → {destination}</p>
                    <p className="sim-muted">{state.date} · {t.pickup} {pickupWindow} · {t.delivery} {deliveryWindow} ({t.kst})</p>
                    {state.role === "driver" ? <p className="sim-muted">{t.driverName} · {t.vehicle}</p> : null}
                  </div>
                  <ul className="sim-baglist">
                    {state.tags.map((tag) => (
                      <li key={tag}><span>🏷️ {tag}</span>{state.scanned.includes(tag) ? <em>✓ {t.scanned} · 📷 {t.photo}</em> : null}</li>
                    ))}
                  </ul>
                  {statusTimeline}
                  {state.role === "driver" ? map : null}
                  {actionButton(state.role)}
                  {state.status >= 5 ? <p className="sim-ok">{t.done}</p> : null}
                </section>
              ) : null}

              {state.role === "ops" ? (
                <section className="sim-card">
                  <h2>{t.ops}</h2>
                  <div className="sim-metrics">
                    {[1, state.status >= 2 && state.status < 5 ? 1 : 0, state.status >= 5 ? (state.incident ? "0%" : "100%") : "—", state.incident ? 1 : 0].map((value, index) => (
                      <div key={t.metrics[index]}><b>{value}</b><span>{t.metrics[index]}</span></div>
                    ))}
                  </div>
                  <div className="sim-job">
                    <b>{state.ref}</b> <span className="pf-chip">{state.refund !== "none" ? t.refundState[state.refund] : t.statuses[state.status]}</span>
                    <p>{origin} → {destination} · {bagCount} · {money(total)}</p>
                    <p className="sim-muted">{t.dispatch}: {t.driverName} · {t.vehicle}</p>
                  </div>
                  <div className="sim-nav">
                    {state.status >= 1 && state.status < 5 && !state.incident && state.refund === "none" ? <button type="button" className="pf-btn pf-btn--ghost" onClick={reportDelay}>⚠️ {t.incident}</button> : null}
                    {state.refund === "requested" ? <button type="button" className="pf-btn pf-btn--coral" onClick={approveRefund}>{t.approveRefund}</button> : null}
                  </div>
                  {state.incident ? <p className="sim-muted">{t.incidentLogged}</p> : null}
                  {nextStep ? <p className="sim-wait">{t.waiting}: <button type="button" onClick={() => update({ role: nextStep.role })}>{t.roles[nextStep.role]} →</button></p> : null}
                </section>
              ) : null}
            </div>

            <aside className="sim-side">
              <section className="sim-card sim-feed">
                <h2>💬 {t.notifTitle}</h2>
                <small>{t.notifChannel}</small>
                <ul>{[...state.notifs].reverse().map((notif, index) => <li key={`${notif.at}-${index}`}><time>{notif.at}</time>{notif.text}</li>)}</ul>
              </section>
              <section className="sim-card sim-feed sim-feed--events">
                <h2>🗂 {t.events}</h2>
                <ul>{[...state.events].reverse().map((event, index) => <li key={`${event.at}-${index}`}><time>{event.at}</time>{event.text}</li>)}</ul>
              </section>
            </aside>
          </div>
        </>
      ) : null}
    </div>
  );
}

function HotelPicker({ hotels, value, onChange, placeholder }: { hotels: { slug: string; name: string }[]; value: string; onChange: (slug: string) => void; placeholder: string }) {
  const selected = hotels.find((hotel) => hotel.slug === value);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const listId = useId();
  const needle = query.trim().toLowerCase();
  const matches = (needle ? hotels.filter((hotel) => hotel.name.toLowerCase().includes(needle)) : hotels).slice(0, 8);
  return (
    <div className="sim-picker">
      <input
        value={open ? query : selected?.name ?? ""}
        placeholder={placeholder}
        onFocus={() => { setOpen(true); setQuery(""); }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onChange={(event) => setQuery(event.target.value)}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        autoComplete="off"
      />
      {open ? (
        <ul role="listbox" id={listId}>
          {matches.map((hotel) => (
            <li key={hotel.slug}><button type="button" role="option" aria-selected={hotel.slug === value} onMouseDown={(event) => event.preventDefault()} onClick={() => { onChange(hotel.slug); setOpen(false); }}>{hotel.name}</button></li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
