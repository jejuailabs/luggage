"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { Locale } from "@luggage/i18n";
import type { PublicHotel } from "@/server/catalog";
import type { TourStay } from "@/server/tour-stays";

type Choice = { kind: "hotel"; id: string; name: string; address: string; slug: string } | { kind: "tour"; id: string; name: string; address: string } | { kind: "manual"; id: string; name: string };
const ROUTES = ["hotel_to_airport", "airport_to_hotel", "hotel_to_hotel"] as const;
type InquiryBags = { s: number; m: number; l: number };

const copy = {
  ko: {
    placeholder: "숙소 이름을 입력하세요",
    search: "숙소 검색",
    all: "전체 숙소",
    count: (n: number) => n === 0 ? "숙소가 없습니다" : `${n}곳 검색 가능`,
    noResults: "일치하는 숙소가 없습니다. 다른 이름으로 검색해 주세요.",
    manual: "이 이름으로 견적 요청",
    requestTitle: "이 숙소에서 짐 배송 견적 요청",
    requestIntro: "숙소 앞 수거·전달 등 원하는 방법을 남겨 주세요. 가능 여부와 요금을 확인해 답변합니다.",
    originStay: "출발 숙소",
    arrivalStay: "도착 숙소",
    otherStay: "도착 숙소 이름을 입력하세요",
    sameStay: "출발 숙소와 다른 도착 숙소를 입력해 주세요.",
    selectOtherStay: "이 숙소로 지정",
    serviceRoute: "배송 경로",
    bagSection: "보내는 짐",
    bagGuide: "크기별 수량을 선택해 주세요. 정확한 규격과 요금은 상담 후 안내합니다.",
    bagNames: ["S · 작은 짐", "M · 일반 캐리어", "L · 큰 짐"],
    summary: "요청 내용",
    summaryPrice: "요금은 확인 후 안내",
    summaryHint: "희망 일정입니다. 접수 후 가능 시간과 요금을 확인해 답변합니다.",
    pickupPlace: "수거지",
    deliveryPlace: "전달지",
    notSet: "입력 전",
    bagLimit: "짐은 1~8개로 선택해 주세요.",
    route: "이동 경로",
    routes: ["숙소 → 공항", "공항 → 숙소", "숙소 → 숙소"],
    handoff: "짐 인계 방식",
    handoffs: ["숙소 앞에서 만나기", "프런트에서 인계", "다른 장소 협의"],
    pickupAt: "짐 수거 희망 일시 · 한국 시간",
    deliveryAt: "짐 전달 희망 일시 · 한국 시간",
    invalidTime: "수거·전달 일시를 확인해 주세요. 전달은 수거 이후여야 합니다.",
    bags: "짐 개수",
    contact: "연락처 (위챗 ID 또는 이메일)",
    notes: "추가 요청사항",
    send: "견적 요청 보내기",
    sending: "보내는 중…",
    failed: "요청을 보내지 못했습니다. 잠시 후 다시 시도해 주세요.",
    unavailable: "관광공사 숙소 목록을 불러오지 못했습니다. 등록 숙소는 계속 검색할 수 있습니다.",
    source: "숙소 정보: 한국관광공사 관광정보 API",
  },
  "zh-CN": {
    placeholder: "输入住宿名称",
    search: "搜索住宿",
    all: "全部住宿",
    count: (n: number) => `可搜索 ${n} 家住宿`,
    noResults: "没有匹配的住宿，请尝试其他名称。",
    manual: "用此名称咨询报价",
    requestTitle: "咨询此住宿的行李配送价格",
    requestIntro: "可选择在住宿门前交接。请留下您的需求，我们会确认服务和价格后回复。",
    originStay: "出发住宿",
    arrivalStay: "送达住宿",
    otherStay: "输入送达住宿名称",
    sameStay: "请填写不同的送达住宿。",
    selectOtherStay: "选择此住宿",
    serviceRoute: "配送路线",
    bagSection: "行李数量",
    bagGuide: "请选择各尺寸数量。具体规格和价格将在确认后告知。",
    bagNames: ["S · 小件", "M · 普通行李箱", "L · 大件"],
    summary: "需求概要",
    summaryPrice: "确认后告知价格",
    summaryHint: "提交的是期望时间；我们会确认可用时间和价格后回复。",
    pickupPlace: "取件地点",
    deliveryPlace: "送达地点",
    notSet: "待填写",
    bagLimit: "请选择 1–8 件行李。",
    route: "配送路线",
    routes: ["住宿 → 机场", "机场 → 住宿", "住宿 → 住宿"],
    handoff: "交接方式",
    handoffs: ["住宿门前见面", "前台交接", "商议其他地点"],
    pickupAt: "期望取件日期与时间 · 韩国时间",
    deliveryAt: "期望送达日期与时间 · 韩国时间",
    invalidTime: "请检查取件和送达时间；送达时间须晚于取件时间。",
    bags: "行李件数",
    contact: "联系方式（微信号或邮箱）",
    notes: "其他要求",
    send: "发送询价",
    sending: "发送中…",
    failed: "发送失败，请稍后重试。",
    unavailable: "暂时无法加载旅游住宿信息。已登记的住宿仍可搜索。",
    source: "住宿资料：韩国观光公社旅游信息 API",
  },
  en: {
    placeholder: "Enter your stay name",
    search: "Search stays",
    all: "All stays",
    count: (n: number) => `${n} stays searchable`,
    noResults: "No matching stays. Try another name.",
    manual: "Request a quote for this name",
    requestTitle: "Request a luggage delivery quote for this stay",
    requestIntro: "Tell us how you would like to hand over your bags, including pickup outside the stay. We will confirm availability and price.",
    originStay: "Pickup stay",
    arrivalStay: "Delivery stay",
    otherStay: "Enter the delivery stay",
    sameStay: "Choose a different delivery stay.",
    selectOtherStay: "Use this stay",
    serviceRoute: "Delivery route",
    bagSection: "Your bags",
    bagGuide: "Choose a count for each size. We will confirm dimensions and price before booking.",
    bagNames: ["S · Small bag", "M · Standard suitcase", "L · Large bag"],
    summary: "Request summary",
    summaryPrice: "Price confirmed after review",
    summaryHint: "These are preferred times. We will confirm availability and price before booking.",
    pickupPlace: "Pickup point",
    deliveryPlace: "Delivery point",
    notSet: "Not set",
    bagLimit: "Choose 1–8 bags.",
    route: "Route",
    routes: ["Stay → airport", "Airport → stay", "Stay → stay"],
    handoff: "Handover",
    handoffs: ["Meet outside the stay", "At the front desk", "Arrange another location"],
    pickupAt: "Preferred pickup date and time · Korea time",
    deliveryAt: "Preferred delivery date and time · Korea time",
    invalidTime: "Check the pickup and delivery times. Delivery must be after pickup.",
    bags: "Number of bags",
    contact: "Contact (WeChat ID or email)",
    notes: "Other details",
    send: "Send quote request",
    sending: "Sending…",
    failed: "Could not send the request. Please try again.",
    unavailable: "Tourism stay listings are temporarily unavailable. Registered stays remain searchable.",
    source: "Stay data: Korea Tourism Organization Tour API",
  },
} as const;

const normalize = (value: string) => value.normalize("NFKC").toLocaleLowerCase().replace(/\s+/g, "");

export function StaySearch({ locale, hotels, initialStays, initialQuery = "", initialStayId, initialHotelSlug, initialRoute, compact = false }: {
  locale: Locale;
  hotels: PublicHotel[];
  initialStays?: TourStay[] | null;
  initialQuery?: string;
  initialStayId?: string;
  initialHotelSlug?: string;
  initialRoute?: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const t = copy[locale];
  const [stays, setStays] = useState<TourStay[] | null>(initialStays ?? null);
  const [query, setQuery] = useState(initialQuery);
  const [open, setOpen] = useState(Boolean(initialQuery.trim() && !initialHotelSlug));
  const [active, setActive] = useState(0);
  const [selectedId, setSelectedId] = useState(initialStayId ?? "");
  const [selectedChoice, setSelectedChoice] = useState<Choice | null>(() => {
    const hotel = hotels.find((item) => item.slug === initialHotelSlug);
    return hotel ? { kind: "hotel", id: hotel.slug, slug: hotel.slug, name: hotel.name, address: hotel.addressKo } : null;
  });
  const [routeType, setRouteType] = useState(ROUTES.includes(initialRoute as (typeof ROUTES)[number]) ? initialRoute! : "hotel_to_airport");
  const [bagCounts, setBagCounts] = useState<InquiryBags>({ s: 0, m: 1, l: 0 });
  const [pickupAt, setPickupAt] = useState("");
  const [deliveryAt, setDeliveryAt] = useState("");
  const [destinationText, setDestinationText] = useState("");
  const [destinationChoice, setDestinationChoice] = useState<Choice | null>(null);
  const [destinationOpen, setDestinationOpen] = useState(false);
  const [destinationActive, setDestinationActive] = useState(0);
  const [validationError, setValidationError] = useState("");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [messageId] = useState(() => crypto.randomUUID());

  useEffect(() => {
    if (initialStays !== undefined) return;
    let cancelled = false;
    fetch("/api/v1/tour-stays")
      .then((response) => response.ok ? response.json() : null)
      .then((json) => { if (!cancelled) setStays(json?.data?.stays ?? []); })
      .catch(() => { if (!cancelled) setStays([]); });
    return () => { cancelled = true; };
  }, [initialStays]);

  const choices = useMemo<Choice[]>(() => [
    ...hotels.map((hotel) => ({ kind: "hotel" as const, id: hotel.slug, slug: hotel.slug, name: hotel.name, address: hotel.addressKo })),
    ...(stays ?? []).map((stay) => ({ kind: "tour" as const, id: stay.id, name: stay.name, address: stay.address })),
  ], [hotels, stays]);
  const matches = useMemo<Choice[]>(() => {
    const needle = normalize(query.trim());
    if (!needle) return [];
    const found = choices.filter((choice) => normalize(choice.name).includes(needle));
    return found.some((choice) => normalize(choice.name) === needle) ? found : [...found, { kind: "manual", id: query.trim(), name: query.trim() }];
  }, [choices, query]);
  const selected = selectedChoice ?? stays?.find((stay) => stay.id === selectedId) ?? null;
  const destinationMatches = useMemo(() => destinationText.trim()
    ? choices.filter((choice) => normalize(choice.name).includes(normalize(destinationText.trim())) && normalize(choice.name) !== normalize(selected?.name ?? "")).slice(0, 8)
    : [], [choices, destinationText, selected]);
  const totalBags = bagCounts.s + bagCounts.m + bagCounts.l;
  const place = (at: "pickup" | "delivery") => {
    if (at === "pickup") return routeType === "airport_to_hotel" ? (locale === "ko" ? "제주공항" : locale === "zh-CN" ? "济州机场" : "Jeju Airport") : selected?.name ?? t.notSet;
    return routeType === "hotel_to_airport" ? (locale === "ko" ? "제주공항" : locale === "zh-CN" ? "济州机场" : "Jeju Airport") : routeType === "airport_to_hotel" ? selected?.name ?? t.notSet : destinationText.trim() || t.notSet;
  };

  function choose(choice: Choice) {
    setQuery(choice.name);
    setOpen(false);
    if (choice.kind === "hotel" && compact) {
      router.push(`/${locale}/luggage/book?hotel=${encodeURIComponent(choice.slug)}&route=${routeType}`);
    } else if (choice.kind === "hotel") {
      router.push(`/${locale}/luggage/book?hotel=${encodeURIComponent(choice.slug)}&route=${routeType}`);
    } else if (choice.kind === "manual" && compact) {
      router.push(`/${locale}/luggage/book?q=${encodeURIComponent(choice.name)}&route=${routeType}`);
    } else if (choice.kind === "manual") {
      setSelectedChoice(choice);
      setSelectedId("");
    } else if (compact) {
      router.push(`/${locale}/luggage/book?stay=${encodeURIComponent(choice.id)}&route=${routeType}`);
    } else {
      setSelectedChoice(choice);
      setSelectedId(choice.id);
      router.replace(`/${locale}/luggage/book?stay=${encodeURIComponent(choice.id)}&route=${routeType}`, { scroll: false });
    }
  }

  async function submitInquiry(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const form = new FormData(event.currentTarget);
    const route = String(form.get("route") ?? "");
    const handoff = String(form.get("handoff") ?? "");
    const pickupAt = String(form.get("pickupAt") ?? "");
    const deliveryAt = String(form.get("deliveryAt") ?? "");
    const contact = String(form.get("contact") ?? "").trim();
    const notes = String(form.get("notes") ?? "").trim();
    const destination = route === "hotel_to_hotel"
      ? destinationChoice && normalize(destinationChoice.name) === normalize(destinationText.trim())
        ? destinationChoice
        : { kind: "manual" as const, id: destinationText.trim(), name: destinationText.trim() }
      : null;
    if (route === "hotel_to_hotel" && (!destination?.name || normalize(destination.name) === normalize(selected.name))) {
      setValidationError(t.sameStay);
      return;
    }
    if (!pickupAt || !deliveryAt || deliveryAt <= pickupAt || pickupAt < new Date(Date.now() + 9 * 60 * 60_000).toISOString().slice(0, 16)) {
      setValidationError(t.invalidTime);
      return;
    }
    if (totalBags < 1 || totalBags > 8) {
      setValidationError(t.bagLimit);
      return;
    }
    setValidationError("");
    setBusy(true);
    setFailed(false);
    try {
      const session = await fetch("/api/v1/sessions/guest", { method: "POST" });
      if (!session.ok) throw new Error("session");
      const response = await fetch("/api/v1/support/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locale,
          subject: `[견적 요청] ${selected.name}${destination ? ` → ${destination.name}` : ""}`,
          body: `경로: ${route}\n출발 숙소: ${route === "airport_to_hotel" ? "제주공항" : selected.name}\n출발 숙소 식별값: ${route === "airport_to_hotel" ? "airport" : selected.id}\n도착 숙소: ${route === "hotel_to_airport" ? "제주공항" : route === "airport_to_hotel" ? selected.name : destination?.name}\n도착 숙소 식별값: ${route === "hotel_to_airport" ? "airport" : route === "airport_to_hotel" ? selected.id : destination?.id}\n짐 수거 희망 일시 (KST): ${pickupAt}\n짐 전달 희망 일시 (KST): ${deliveryAt}\n인계: ${handoff}\n짐: S ${bagCounts.s} / M ${bagCounts.m} / L ${bagCounts.l} (총 ${totalBags}개)\n연락: ${contact}\n요청: ${notes}`,
          clientMessageId: messageId,
        }),
      });
      const json = await response.json();
      if (!response.ok || !json?.data?.ticketId) throw new Error("ticket");
      router.push(`/${locale}/help/requests/${json.data.ticketId}`);
    } catch {
      setFailed(true);
      setBusy(false);
    }
  }

  return (
    <div className={`stay-search ${compact ? "stay-search--compact" : ""}`}>
      {!compact ? <fieldset className="stay-search__route-switch">
        <legend>{t.serviceRoute}</legend>
        <div>{ROUTES.map((value, index) => <label key={value} className={routeType === value ? "is-selected" : ""}><input type="radio" name="serviceRoute" value={value} checked={routeType === value} onChange={() => { setRouteType(value); setValidationError(""); }} /><span>{t.routes[index]}</span></label>)}</div>
      </fieldset> : null}
      <div className="stay-search__field">
        <label htmlFor={compact ? "home-stay-search" : "directory-stay-search"}>{t.search}</label>
        <input
          id={compact ? "home-stay-search" : "directory-stay-search"}
          type="search"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={compact ? "home-stay-options" : "directory-stay-options"}
          aria-activedescendant={open && matches[active] ? `stay-option-${compact ? "home" : "directory"}-${active}` : undefined}
          data-testid={compact ? "home-hotel-search" : "hotel-directory-search"}
          value={query}
          maxLength={80}
          onChange={(event) => { setQuery(event.target.value); setActive(0); setOpen(Boolean(event.target.value.trim())); setSelectedId(""); setSelectedChoice(null); }}
          onFocus={() => { if (query.trim()) setOpen(true); }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" && matches.length) { event.preventDefault(); setOpen(true); setActive((current) => Math.min(current + 1, matches.length - 1)); }
            if (event.key === "ArrowUp" && matches.length) { event.preventDefault(); setActive((current) => Math.max(current - 1, 0)); }
            if (event.key === "Enter" && compact) { event.preventDefault(); router.push(`/${locale}/luggage/book?q=${encodeURIComponent(query)}&route=${routeType}`); }
            else if (event.key === "Enter" && open && matches[active]) { event.preventDefault(); choose(matches[active]); }
            if (event.key === "Escape") setOpen(false);
          }}
          placeholder={t.placeholder}
          autoComplete="off"
        />
      </div>
      {query.trim() && matches.length === 0 ? <p className="stay-search__count" aria-live="polite" data-testid="hotel-result-count">{t.count(0)}</p> : null}
      {open ? <div id={compact ? "home-stay-options" : "directory-stay-options"} className="stay-search__options" role="listbox" aria-label={t.all}>
        {matches.length ? matches.map((choice, index) => <button
          key={`${choice.kind}-${choice.id}`}
          id={`stay-option-${compact ? "home" : "directory"}-${index}`}
          type="button"
          role="option"
          aria-selected={index === active}
          className={index === active ? "is-active" : ""}
          onMouseEnter={() => setActive(index)}
          onClick={() => choose(choice)}
          data-testid="hotel-result"
        ><strong>{choice.name}</strong>{choice.kind === "manual" ? <small>{t.manual}</small> : null}</button>) : <p>{t.noResults}</p>}
      </div> : null}
      {!stays && initialStays === null ? <p className="stay-search__note">{t.unavailable}</p> : null}
      {!compact && selected ? <section className="stay-search__inquiry" aria-labelledby="stay-quote-title">
        <span className="landing-kicker">PERSONAL QUOTE</span>
        <h2 id="stay-quote-title">{t.bagSection} · {t.requestTitle}</h2>
        <p><strong>{routeType === "airport_to_hotel" ? t.arrivalStay : t.originStay}: {selected.name}</strong></p>
        <p>{t.requestIntro}</p>
        <div className="stay-search__inquiry-layout"><form id="stay-inquiry-form" onSubmit={submitInquiry}>
          <input type="hidden" name="route" value={routeType} />
          <label>{t.handoff}<select name="handoff" required>{t.handoffs.map((label) => <option key={label}>{label}</option>)}</select></label>
          {routeType === "hotel_to_hotel" ? <div className="stay-search__destination stay-search__wide">
            <label htmlFor="destination-stay">{t.arrivalStay}</label>
            <input id="destination-stay" name="destinationStay" type="search" value={destinationText} onChange={(event) => { setDestinationText(event.target.value); setDestinationChoice(null); setDestinationOpen(true); setDestinationActive(0); setValidationError(""); }} onFocus={() => setDestinationOpen(true)} onBlur={() => window.setTimeout(() => setDestinationOpen(false), 120)} onKeyDown={(event) => {
              if (event.key === "ArrowDown" && destinationMatches.length) { event.preventDefault(); setDestinationOpen(true); setDestinationActive((current) => Math.min(current + 1, destinationMatches.length - 1)); }
              if (event.key === "ArrowUp" && destinationMatches.length) { event.preventDefault(); setDestinationActive((current) => Math.max(current - 1, 0)); }
              if (event.key === "Enter" && destinationOpen && destinationMatches[destinationActive]) { event.preventDefault(); const choice = destinationMatches[destinationActive]; setDestinationChoice(choice); setDestinationText(choice.name); setDestinationOpen(false); }
              if (event.key === "Escape") setDestinationOpen(false);
            }} placeholder={t.otherStay} autoComplete="off" maxLength={80} required aria-expanded={destinationOpen && destinationMatches.length > 0} aria-controls="destination-stay-options" aria-activedescendant={destinationOpen && destinationMatches[destinationActive] ? `destination-option-${destinationActive}` : undefined} role="combobox" />
            {destinationOpen && destinationMatches.length > 0 ? <div id="destination-stay-options" className="stay-search__destination-options" role="listbox" aria-label={t.arrivalStay}>
              {destinationMatches.map((choice, index) => <button key={`${choice.kind}-${choice.id}`} id={`destination-option-${index}`} type="button" role="option" aria-selected={index === destinationActive} onMouseEnter={() => setDestinationActive(index)} onMouseDown={(event) => event.preventDefault()} onClick={() => { setDestinationChoice(choice); setDestinationText(choice.name); setDestinationOpen(false); }}><strong>{choice.name}</strong><span>{t.selectOtherStay}</span></button>)}
            </div> : null}
          </div> : null}
          <label>{t.pickupAt}<input name="pickupAt" type="datetime-local" value={pickupAt} onChange={(event) => setPickupAt(event.target.value)} required /></label>
          <label>{t.deliveryAt}<input name="deliveryAt" type="datetime-local" value={deliveryAt} onChange={(event) => setDeliveryAt(event.target.value)} required /></label>
          <fieldset className="stay-search__bag-sizes stay-search__wide"><legend>{t.bagSection}</legend><p>{t.bagGuide}</p>
            {(["s", "m", "l"] as const).map((size, index) => <div key={size} className="stay-search__bag-row"><strong>{t.bagNames[index]}</strong><div className="stay-search__bag-controls"><button type="button" aria-label={`${t.bagNames[index]} −`} disabled={bagCounts[size] === 0} onClick={() => setBagCounts((current) => ({ ...current, [size]: current[size] - 1 }))}>−</button><output data-testid={`inquiry-bag-${size}`}>{bagCounts[size]}</output><button type="button" aria-label={`${t.bagNames[index]} +`} disabled={totalBags >= 8} onClick={() => setBagCounts((current) => ({ ...current, [size]: current[size] + 1 }))}>+</button></div></div>)}
          </fieldset>
          <label>{t.contact}<input name="contact" type="text" maxLength={160} required /></label>
          <label className="stay-search__wide">{t.notes}<textarea name="notes" rows={3} maxLength={1000} /></label>
        </form><aside className="stay-search__summary" aria-label={t.summary} aria-live="polite"><span className="landing-kicker">YOUR REQUEST</span><h3>{t.summary}</h3><dl><div><dt>{t.bags}</dt><dd>{totalBags}</dd></div><div><dt>{t.pickupPlace}</dt><dd>{place("pickup")}</dd></div><div><dt>{t.pickupAt}</dt><dd>{pickupAt || t.notSet}</dd></div><div><dt>{t.deliveryPlace}</dt><dd>{place("delivery")}</dd></div><div><dt>{t.deliveryAt}</dt><dd>{deliveryAt || t.notSet}</dd></div></dl><div className="stay-search__summary-total"><span>{t.summaryPrice}</span></div><p>{t.summaryHint}</p><button type="submit" form="stay-inquiry-form" className="customer-action" disabled={busy || totalBags === 0}>{busy ? t.sending : t.send} ↗</button></aside></div>
        {validationError ? <p role="alert">{validationError}</p> : null}
        {failed ? <p role="alert">{t.failed}</p> : null}
      </section> : null}
      {!compact && stays?.length ? <small className="stay-search__source">{t.source}</small> : null}
    </div>
  );
}
