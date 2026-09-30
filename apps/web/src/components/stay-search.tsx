"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { Locale } from "@luggage/i18n";
import type { PublicHotel } from "@/server/catalog";
import type { TourStay } from "@/server/tour-stays";

type Choice = { kind: "hotel"; id: string; name: string; address: string; slug: string } | { kind: "tour"; id: string; name: string; address: string };

const copy = {
  ko: {
    placeholder: "숙소 이름을 입력하세요",
    search: "숙소 검색",
    all: "전체 숙소",
    count: (n: number) => n === 0 ? "숙소가 없습니다" : `${n}곳 검색 가능`,
    noResults: "일치하는 숙소가 없습니다. 다른 이름으로 검색해 주세요.",
    requestTitle: "이 숙소에서 짐 배송 견적 요청",
    requestIntro: "숙소 앞 수거·전달 등 원하는 방법을 남겨 주세요. 가능 여부와 요금을 확인해 답변합니다.",
    route: "이동 경로",
    routes: ["숙소 → 공항", "공항 → 숙소", "숙소 → 숙소"],
    handoff: "짐 인계 방식",
    handoffs: ["숙소 앞에서 만나기", "프런트에서 인계", "다른 장소 협의"],
    date: "희망 날짜",
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
    requestTitle: "咨询此住宿的行李配送价格",
    requestIntro: "可选择在住宿门前交接。请留下您的需求，我们会确认服务和价格后回复。",
    route: "配送路线",
    routes: ["住宿 → 机场", "机场 → 住宿", "住宿 → 住宿"],
    handoff: "交接方式",
    handoffs: ["住宿门前见面", "前台交接", "商议其他地点"],
    date: "期望日期",
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
    requestTitle: "Request a luggage delivery quote for this stay",
    requestIntro: "Tell us how you would like to hand over your bags, including pickup outside the stay. We will confirm availability and price.",
    route: "Route",
    routes: ["Stay → airport", "Airport → stay", "Stay → stay"],
    handoff: "Handover",
    handoffs: ["Meet outside the stay", "At the front desk", "Arrange another location"],
    date: "Preferred date",
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

export function StaySearch({ locale, hotels, initialStays, initialQuery = "", initialStayId, initialRoute, compact = false }: {
  locale: Locale;
  hotels: PublicHotel[];
  initialStays?: TourStay[] | null;
  initialQuery?: string;
  initialStayId?: string;
  initialRoute?: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const t = copy[locale];
  const [stays, setStays] = useState<TourStay[] | null>(initialStays ?? null);
  const [query, setQuery] = useState(initialQuery);
  const [open, setOpen] = useState(Boolean(initialQuery.trim()));
  const [active, setActive] = useState(0);
  const [selectedId, setSelectedId] = useState(initialStayId ?? "");
  const [selectedChoice, setSelectedChoice] = useState<Choice | null>(null);
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
  const matches = useMemo(() => {
    const needle = normalize(query.trim());
    return needle ? choices.filter((choice) => normalize(choice.name).includes(needle)) : [];
  }, [choices, query]);
  const selected = selectedChoice ?? stays?.find((stay) => stay.id === selectedId) ?? null;
  const routeIndex = ["hotel_to_airport", "airport_to_hotel", "hotel_to_hotel"].indexOf(initialRoute ?? "");

  function choose(choice: Choice) {
    setQuery(choice.name);
    setOpen(false);
    if (choice.kind === "hotel" && !initialRoute) {
      router.push(`/${locale}/luggage/book?hotel=${encodeURIComponent(choice.slug)}`);
    } else if (choice.kind === "hotel") {
      setSelectedChoice(choice);
      setSelectedId("");
    } else if (compact) {
      router.push(`/${locale}/hotels?stay=${encodeURIComponent(choice.id)}`);
    } else {
      setSelectedId(choice.id);
      router.replace(`/${locale}/hotels?stay=${encodeURIComponent(choice.id)}${initialRoute ? `&route=${initialRoute}` : ""}`, { scroll: false });
    }
  }

  async function submitInquiry(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const form = new FormData(event.currentTarget);
    const route = String(form.get("route") ?? "");
    const handoff = String(form.get("handoff") ?? "");
    const date = String(form.get("date") ?? "");
    const bags = String(form.get("bags") ?? "");
    const contact = String(form.get("contact") ?? "").trim();
    const notes = String(form.get("notes") ?? "").trim();
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
          subject: `[견적 요청] ${selected.name}`,
          body: `숙소: ${selected.name}\n숙소 식별값: ${selected.id}\n경로: ${route}\n인계: ${handoff}\n날짜: ${date}\n짐: ${bags}\n연락: ${contact}\n요청: ${notes}`,
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
          onChange={(event) => { setQuery(event.target.value); setActive(0); setOpen(Boolean(event.target.value.trim())); setSelectedId(""); }}
          onFocus={() => { if (query.trim()) setOpen(true); }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" && matches.length) { event.preventDefault(); setOpen(true); setActive((current) => Math.min(current + 1, matches.length - 1)); }
            if (event.key === "ArrowUp" && matches.length) { event.preventDefault(); setActive((current) => Math.max(current - 1, 0)); }
            if (event.key === "Enter" && compact) { event.preventDefault(); router.push(`/${locale}/hotels?q=${encodeURIComponent(query)}`); }
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
        ><strong>{choice.name}</strong></button>) : <p>{t.noResults}</p>}
      </div> : null}
      {!stays && initialStays === null ? <p className="stay-search__note">{t.unavailable}</p> : null}
      {!compact && selected ? <section className="stay-search__inquiry" aria-labelledby="stay-quote-title">
        <span className="landing-kicker">PERSONAL QUOTE</span>
        <h2 id="stay-quote-title">{t.requestTitle}</h2>
        <p><strong>{selected.name}</strong></p>
        <p>{t.requestIntro}</p>
        <form onSubmit={submitInquiry}>
          <label>{t.route}<select name="route" defaultValue={t.routes[routeIndex >= 0 ? routeIndex : 0]} required>{t.routes.map((label) => <option key={label}>{label}</option>)}</select></label>
          <label>{t.handoff}<select name="handoff" required>{t.handoffs.map((label) => <option key={label}>{label}</option>)}</select></label>
          <label>{t.date}<input name="date" type="date" required /></label>
          <label>{t.bags}<input name="bags" type="number" min="1" max="8" defaultValue="1" required /></label>
          <label>{t.contact}<input name="contact" type="text" maxLength={160} required /></label>
          <label className="stay-search__wide">{t.notes}<textarea name="notes" rows={3} maxLength={1000} /></label>
          <button type="submit" className="customer-action" disabled={busy}>{busy ? t.sending : t.send} ↗</button>
        </form>
        {failed ? <p role="alert">{t.failed}</p> : null}
      </section> : null}
      {!compact && stays?.length ? <small className="stay-search__source">{t.source}</small> : null}
    </div>
  );
}
