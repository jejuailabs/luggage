"use client";
/* eslint-disable @next/next/no-img-element -- QR data URLs are generated in the browser. */

import Link from "next/link";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import type { Locale } from "@luggage/i18n";
import { RealMap } from "@/components/account/real-map";

// 이용 미리보기: 예시 값이 채워진 고객 여정을 '다음' 버튼만으로 따라간다. 서버를 호출하지 않는다.
type Scenario = "hotel_to_airport" | "airport_to_hotel" | "hotel_to_hotel";
const PRICE = { standard: 15000, large: 20000 };
const REF = "JC7Q2M4K8A";
const TAGS = ["TK4P8M2Q7RZ", "TN3W6D9X2LC", "TP7H2K5M9QA", "TR2M5X8C4VB"];
const CODE = "482913";

const HOTEL = { ko: ["예시 호텔 제주시점", "예시 호텔 서귀포점"], "zh-CN": ["示例酒店 济州市店", "示例酒店 西归浦店"], en: ["Sample Hotel Jeju City", "Sample Hotel Seogwipo"] } as const;

const COPY = {
  ko: {
    badge: "미리보기 · 예시 값이며 실제 예약·결제가 아닙니다",
    scenarios: { hotel_to_airport: ["🧳", "체크아웃 날", "숙소 → 공항"], airport_to_hotel: ["🛬", "제주 도착 직후", "공항 → 숙소"], hotel_to_hotel: ["🏨", "숙소 이동", "숙소 → 숙소"] },
    steps: ["입력", "확인", "결제", "예약 완료", "짐 추적", "짐 찾기"],
    airport: "제주공항", tomorrow: "내일", kst: "한국 시간",
    form: "예약 정보", sample: "예시 값", from: "출발", to: "도착", date: "날짜", pickup: "수거", delivery: "전달", flight: "항공편",
    departs: "출발 19:00", arrives: "도착 09:30", bags: "짐", standard: "보통 짐", large: "대형 짐", name: "이름", email: "이메일",
    next: "다음", back: "이전", review: "요금과 안내 확인", total: "결제 금액", vat: "부가세 포함",
    policies: ["짐 규격·수량 안내", "맡길 수 없는 물품", "취소·환불 규정", "파손·분실 보상 기준"], agreed: "필수 안내 4가지에 동의했어요", readAll: "전체 안내 보기 ↓",
    payTitle: "결제 수단", wechat: "위챗페이", alipay: "알리페이", pay: "결제하기", verifying: "결제 서버에서 결과를 확인하고 있어요…",
    doneTitle: "결제 완료 · 예약이 접수됐어요", doneText: "예약증과 짐 태그 QR이 발급됐어요. 알림은 위챗·이메일로 받아요.",
    ref: "예약 번호", prepare: ["짐을 닫고 잠가 주세요", "금지 물품은 빼 주세요", "예약증 QR을 준비해 주세요"], prepareTitle: "맡기기 전 준비",
    track: "내 짐 추적하기", trackTitle: "내 짐 추적",
    stages: { hotel_to_airport: ["호텔 프런트에서 짐 보관", "기사 QR 스캔·사진 기록 후 수거", "공항으로 이동 중", "공항 인계 준비 완료"], airport_to_hotel: ["공항에서 기사가 짐 인수", "짐마다 QR 스캔·사진 기록", "숙소로 이동 중", "숙소 프런트 도착·보관"], hotel_to_hotel: ["출발 숙소 프런트에서 짐 보관", "기사 QR 스캔·사진 기록 후 수거", "도착 숙소로 이동 중", "도착 숙소 프런트 보관 완료"] },
    mapNote: "배송 차량의 최근 위치예요. 짐 자체에 GPS가 달린 것은 아니에요.", skip: "빠르게 보기", notif: "알림",
    goPickup: "짐 찾으러 가기", pickupTitle: "짐 찾기",
    airportSpot: "공항 수령 장소 (예시): 1층 도착장 3번 출구 앞 짐 카운터", hotelSpot: "도착 숙소 프런트 · 체크인 때 바로 받을 수 있어요",
    code: "수령 코드", showCode: "기사에게 코드 보여주기", showQr: "프런트에 예약증 QR 보여주기", checking: "짐 태그를 하나씩 확인하고 있어요", checked: "확인 완료",
    finished: "모든 짐을 받았어요 🎉", finishedText: "짐별 인계 사진과 시각이 예약 기록에 남아요. 문제가 있으면 7일 안에 고객지원으로 알려 주세요.",
    bookReal: "이 상황으로 예약하기", again: "처음부터 다시", staff: "호텔·기사·운영 화면까지 보기",
  },
  "zh-CN": {
    badge: "预览 · 示例数据，非真实预约或付款",
    scenarios: { hotel_to_airport: ["🧳", "退房当天", "住宿 → 机场"], airport_to_hotel: ["🛬", "刚到济州", "机场 → 住宿"], hotel_to_hotel: ["🏨", "更换住宿", "住宿 → 住宿"] },
    steps: ["填写", "确认", "付款", "预约完成", "行李追踪", "取回行李"],
    airport: "济州机场", tomorrow: "明天", kst: "韩国时间",
    form: "预约信息", sample: "示例", from: "出发", to: "到达", date: "日期", pickup: "取件", delivery: "送达", flight: "航班",
    departs: "起飞 19:00", arrives: "抵达 09:30", bags: "行李", standard: "普通行李", large: "大件行李", name: "姓名", email: "邮箱",
    next: "下一步", back: "上一步", review: "确认价格与须知", total: "应付金额", vat: "含增值税",
    policies: ["行李规格与数量", "禁止寄存物品", "取消与退款规定", "损坏与丢失赔偿标准"], agreed: "已同意 4 项必读须知", readAll: "查看完整须知 ↓",
    payTitle: "付款方式", wechat: "微信支付", alipay: "支付宝", pay: "付款", verifying: "正在向支付服务器确认结果…",
    doneTitle: "付款成功 · 预约已受理", doneText: "已生成预约凭证和行李标签二维码。通知将通过微信或邮件发送。",
    ref: "预约号", prepare: ["拉好拉链并上锁", "取出禁止物品", "准备好预约凭证二维码"], prepareTitle: "寄存前准备",
    track: "追踪我的行李", trackTitle: "行李追踪",
    stages: { hotel_to_airport: ["酒店前台保管行李", "司机扫码拍照后取件", "正在前往机场", "机场交付准备完成"], airport_to_hotel: ["司机在机场接收行李", "逐件扫码拍照记录", "正在前往住宿", "已送达住宿前台保管"], hotel_to_hotel: ["出发住宿前台保管", "司机扫码拍照后取件", "正在前往目的住宿", "目的住宿前台保管完成"] },
    mapNote: "这是配送车辆的最近位置，并非行李本身的 GPS。", skip: "快速查看", notif: "通知",
    goPickup: "去取行李", pickupTitle: "取回行李",
    airportSpot: "机场取件地点（示例）：1 楼到达大厅 3 号出口前行李柜台", hotelSpot: "目的住宿前台 · 入住时即可领取",
    code: "取件码", showCode: "向司机出示取件码", showQr: "向前台出示预约凭证二维码", checking: "正在逐件核对行李标签", checked: "核对完成",
    finished: "所有行李已取回 🎉", finishedText: "每件行李的交接照片和时间都会记录在预约中。如有问题请在 7 天内联系客服。",
    bookReal: "按此场景预约", again: "重新开始", staff: "查看酒店、司机、运营画面",
  },
  en: {
    badge: "Preview · sample values, not a real booking or payment",
    scenarios: { hotel_to_airport: ["🧳", "Checkout day", "Stay → Airport"], airport_to_hotel: ["🛬", "Just landed", "Airport → Stay"], hotel_to_hotel: ["🏨", "Changing stays", "Stay → Stay"] },
    steps: ["Details", "Review", "Pay", "Booked", "Track", "Collect"],
    airport: "Jeju Airport", tomorrow: "Tomorrow", kst: "Korea time",
    form: "Booking details", sample: "Sample", from: "From", to: "To", date: "Date", pickup: "Pickup", delivery: "Delivery", flight: "Flight",
    departs: "Departs 19:00", arrives: "Arrives 09:30", bags: "Bags", standard: "Standard", large: "Large", name: "Name", email: "Email",
    next: "Next", back: "Back", review: "Check price & notices", total: "Total", vat: "VAT included",
    policies: ["Bag size and quantity", "Items we cannot carry", "Cancellation and refunds", "Damage and loss compensation"], agreed: "Accepted all 4 required notices", readAll: "Read full notices ↓",
    payTitle: "Payment method", wechat: "WeChat Pay", alipay: "Alipay", pay: "Pay", verifying: "Checking the result with the payment server…",
    doneTitle: "Paid · booking received", doneText: "Your voucher and bag tag QR codes are ready. Updates arrive by WeChat or email.",
    ref: "Booking no.", prepare: ["Close and lock your bags", "Remove prohibited items", "Have your voucher QR ready"], prepareTitle: "Before handover",
    track: "Track my bags", trackTitle: "Bag tracking",
    stages: { hotel_to_airport: ["Stored at the hotel front desk", "Driver scans QR, photographs and picks up", "On the way to the airport", "Ready for airport handoff"], airport_to_hotel: ["Driver receives bags at the airport", "Each bag scanned and photographed", "On the way to your stay", "Stored at your stay's front desk"], hotel_to_hotel: ["Stored at the first stay", "Driver scans QR, photographs and picks up", "On the way to the next stay", "Stored at the next stay's front desk"] },
    mapNote: "The latest position of the delivery vehicle — not a GPS on the bag itself.", skip: "Skip ahead", notif: "Alert",
    goPickup: "Go collect my bags", pickupTitle: "Collect your bags",
    airportSpot: "Airport pickup point (sample): bag counter by Exit 3, arrivals hall, 1F", hotelSpot: "Front desk of your next stay · collect at check-in",
    code: "Handoff code", showCode: "Show the code to the driver", showQr: "Show the voucher QR at the front desk", checking: "Checking each bag tag", checked: "Checked",
    finished: "All bags collected 🎉", finishedText: "Handover photos and times for every bag stay in your booking record. Contact support within 7 days if anything is wrong.",
    bookReal: "Book this for real", again: "Start over", staff: "See hotel, driver & ops screens",
  },
} as const;

const PRESET: Record<Scenario, { standard: number; large: number; pickup: string; delivery: string }> = {
  hotel_to_airport: { standard: 1, large: 1, pickup: "09:00–11:00", delivery: "14:00–16:00" },
  airport_to_hotel: { standard: 2, large: 0, pickup: "10:00–12:00", delivery: "16:00–18:00" },
  hotel_to_hotel: { standard: 0, large: 1, pickup: "10:00–12:00", delivery: "16:00–18:00" },
};

export function PreviewJourney({ locale }: { locale: Locale }) {
  const t = COPY[locale];
  const [scenario, setScenario] = useState<Scenario>("hotel_to_airport");
  const [step, setStep] = useState(0);
  const [bags, setBags] = useState({ standard: PRESET.hotel_to_airport.standard, large: PRESET.hotel_to_airport.large });
  const [method, setMethod] = useState<"wechat" | "alipay">("wechat");
  const [verifying, setVerifying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [pickup, setPickup] = useState(0);
  const [qr, setQr] = useState<Record<string, string>>({});
  const [h1, h2] = HOTEL[locale];
  const preset = PRESET[scenario];
  const origin = scenario === "airport_to_hotel" ? t.airport : h1;
  const destination = scenario === "hotel_to_airport" ? t.airport : h2;
  const count = bags.standard + bags.large;
  const tags = TAGS.slice(0, Math.max(1, Math.min(count, TAGS.length)));
  const total = bags.standard * PRICE.standard + bags.large * PRICE.large;
  const money = (value: number) => new Intl.NumberFormat(locale, { style: "currency", currency: "KRW" }).format(value);
  const stages = t.stages[scenario];
  const stage = Math.min(3, Math.floor(progress * 4));

  useEffect(() => {
    let cancelled = false;
    Promise.all(TAGS.map(async (tag) => [tag, await QRCode.toDataURL(tag, { margin: 1, width: 140 })] as const))
      .then((pairs) => { if (!cancelled) setQr(Object.fromEntries(pairs)); })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (step !== 4 || progress >= 1) return;
    const timer = setInterval(() => setProgress((value) => Math.min(1, value + 0.01)), 90);
    return () => clearInterval(timer);
  }, [step, progress]);

  useEffect(() => {
    if (step !== 5 || pickup !== 1) return;
    const timer = setTimeout(() => setPickup(2), 2200);
    return () => clearTimeout(timer);
  }, [step, pickup]);

  function choose(next: Scenario) {
    setScenario(next);
    setBags({ standard: PRESET[next].standard, large: PRESET[next].large });
    setStep(0);
    setProgress(0);
    setPickup(0);
  }
  function pay() {
    setVerifying(true);
    setTimeout(() => { setVerifying(false); setStep(3); }, 1600);
  }
  function restart() { choose(scenario); }

  const summary = (
    <div className="pv-route"><span>{origin}</span><i aria-hidden="true">→</i><span>{destination}</span></div>
  );

  return (
    <section className="pv" aria-label={t.steps.join(" · ")} data-testid="preview-journey">
      <div className="pv-scenarios" role="tablist">
        {(Object.keys(t.scenarios) as Scenario[]).map((key) => {
          const [emoji, title, route] = t.scenarios[key];
          return (
            <button key={key} type="button" role="tab" aria-selected={scenario === key} onClick={() => choose(key)}>
              <span aria-hidden="true">{emoji}</span><strong>{title}</strong><small>{route}</small>
            </button>
          );
        })}
      </div>

      <ol className="pv-steps">
        {t.steps.map((label, index) => <li key={label} className={index === step ? "is-current" : index < step ? "is-done" : ""}><span>{index < step ? "✓" : index + 1}</span><small>{label}</small></li>)}
      </ol>

      <div className="pv-stage">
        <span className="pf-sim-badge">👀 {t.badge}</span>

        {step === 0 ? (
          <>
            <h3>{t.form} <em>{t.sample}</em></h3>
            {summary}
            <dl className="pv-fields">
              <div><dt>{t.date}</dt><dd>{t.tomorrow} ({t.kst})</dd></div>
              <div><dt>{t.pickup}</dt><dd>{preset.pickup}</dd></div>
              <div><dt>{t.delivery}</dt><dd>{preset.delivery}</dd></div>
              {scenario !== "hotel_to_hotel" ? <div><dt>{t.flight}</dt><dd>KE1234 · {scenario === "hotel_to_airport" ? t.departs : t.arrives}</dd></div> : null}
              <div><dt>{t.name}</dt><dd>Li Na</dd></div>
              <div><dt>{t.email}</dt><dd>lina@example.com</dd></div>
            </dl>
            <div className="pv-bags">
              {(["standard", "large"] as const).map((size) => (
                <div key={size}><span>{t[size]}</span>
                  <button type="button" aria-label={`${t[size]} −`} disabled={bags[size] === 0 || count <= 1} onClick={() => setBags({ ...bags, [size]: bags[size] - 1 })}>−</button>
                  <b>{bags[size]}</b>
                  <button type="button" aria-label={`${t[size]} +`} disabled={count >= 4} onClick={() => setBags({ ...bags, [size]: bags[size] + 1 })}>+</button>
                </div>
              ))}
            </div>
          </>
        ) : null}

        {step === 1 ? (
          <>
            <h3>{t.review}</h3>
            {summary}
            <dl className="pv-price">
              {bags.standard ? <div><dt>{t.standard} × {bags.standard}</dt><dd>{money(bags.standard * PRICE.standard)}</dd></div> : null}
              {bags.large ? <div><dt>{t.large} × {bags.large}</dt><dd>{money(bags.large * PRICE.large)}</dd></div> : null}
              <div className="is-total"><dt>{t.total}</dt><dd>{money(total)}</dd></div>
            </dl>
            <small className="pv-muted">{t.vat} {money(Math.round(total * 10 / 110))}</small>
            <ul className="pv-policies">{t.policies.map((policy) => <li key={policy}>☑️ {policy}</li>)}</ul>
            <p className="pv-ok">✓ {t.agreed} · <a href="#required-notices">{t.readAll}</a></p>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <h3>{t.payTitle}</h3>
            <div className="pv-methods">
              <button type="button" aria-pressed={method === "wechat"} className="pv-method pv-method--wechat" onClick={() => setMethod("wechat")}>{t.wechat}</button>
              <button type="button" aria-pressed={method === "alipay"} className="pv-method pv-method--alipay" onClick={() => setMethod("alipay")}>{t.alipay}</button>
            </div>
            <p className="pv-amount">{money(total)}</p>
            {verifying ? <p className="pv-verifying"><span className="sim-spinner" aria-hidden="true" />{t.verifying}</p> : null}
          </>
        ) : null}

        {step === 3 ? (
          <>
            <h3 className="pv-ok">✓ {t.doneTitle}</h3>
            <p className="pv-muted">{t.doneText}</p>
            <div className="pv-voucher">
              <div><small>{t.ref}</small><b>{REF}</b></div>
              {summary}
              <p>{t.tomorrow} · {t.pickup} {preset.pickup} · {t.delivery} {preset.delivery} ({t.kst})</p>
              <div className="pv-tags">{tags.map((tag) => <figure key={tag}>{qr[tag] ? <img src={qr[tag]} alt={tag} width={84} height={84} /> : <span className="sim-qr-ph" />}<figcaption>{tag}</figcaption></figure>)}</div>
            </div>
            <h4>{t.prepareTitle}</h4>
            <ul className="pv-prepare">{t.prepare.map((item, index) => <li key={item}><span aria-hidden="true">{["🔒", "🚫", "📱"][index]}</span>{item}</li>)}</ul>
          </>
        ) : null}

        {step === 4 ? (
          <>
            <h3>📍 {t.trackTitle} · {REF}</h3>
            <ol className="pv-timeline">
              {stages.map((label, index) => <li key={label} className={index < stage || progress >= 1 ? "is-done" : index === stage ? "is-current" : ""}><span aria-hidden="true">{index < stage || progress >= 1 ? "✓" : ""}</span>{label}</li>)}
            </ol>
            <div className="pv-map">
              <div className="tracking-map__canvas"><RealMap demo progress={scenario === "airport_to_hotel" ? 1 - progress : progress} labels={{ pickup: t.pickup, airport: t.airport, demo: t.badge, live: t.trackTitle, unavailable: "Map unavailable" }} /></div>
              <small>{t.mapNote}</small>
            </div>
            <p className="pv-notif">🔔 {t.notif}: {stages[stage]}</p>
            {progress < 1 ? <button type="button" className="pv-link" onClick={() => setProgress(1)}>{t.skip} ⏩</button> : null}
          </>
        ) : null}

        {step === 5 ? (
          <>
            <h3>🎒 {t.pickupTitle}</h3>
            <p className="pv-spot">{scenario === "hotel_to_airport" ? t.airportSpot : t.hotelSpot}</p>
            {scenario === "hotel_to_airport" ? <div className="pv-code"><small>{t.code}</small><b>{CODE.slice(0, 3)} {CODE.slice(3)}</b></div> : null}
            {pickup === 0 ? <button type="button" className="pf-btn pf-btn--coral" onClick={() => setPickup(1)}>{scenario === "hotel_to_airport" ? t.showCode : t.showQr}</button> : null}
            {pickup >= 1 ? (
              <ul className="pv-check">
                {tags.map((tag, index) => <li key={tag} className={pickup === 2 || index === 0 ? "is-done" : ""}>🏷️ {tag} <em>{pickup === 2 || index === 0 ? `✓ ${t.checked}` : "…"}</em></li>)}
              </ul>
            ) : null}
            {pickup === 1 ? <p className="pv-muted">{t.checking}</p> : null}
            {pickup === 2 ? (
              <div className="pv-finish">
                <strong>{t.finished}</strong>
                <p>{t.finishedText}</p>
                <div className="pv-actions">
                  <Link href={`/${locale}/luggage/book?route=${scenario}`} className="pf-btn pf-btn--coral">{t.bookReal} →</Link>
                  <button type="button" className="pf-btn pf-btn--ghost" onClick={restart}>↺ {t.again}</button>
                  <Link href={`/${locale}/demo?route=${scenario}&role=hotel`} className="pv-link">{t.staff} →</Link>
                </div>
              </div>
            ) : null}
          </>
        ) : null}
      </div>

      <div className="pv-nav">
        {step > 0 && step < 5 ? <button type="button" className="pf-btn pf-btn--ghost" onClick={() => setStep(step - 1)} disabled={verifying}>← {t.back}</button> : <span />}
        {step === 0 ? <button type="button" className="pf-btn pf-btn--coral" onClick={() => setStep(1)}>{t.next} →</button> : null}
        {step === 1 ? <button type="button" className="pf-btn pf-btn--coral" onClick={() => setStep(2)}>{t.next} →</button> : null}
        {step === 2 ? <button type="button" className="pf-btn pf-btn--coral" onClick={pay} disabled={verifying}>{money(total)} {t.pay}</button> : null}
        {step === 3 ? <button type="button" className="pf-btn pf-btn--coral" onClick={() => { setProgress(0); setStep(4); }}>📍 {t.track} →</button> : null}
        {step === 4 ? <button type="button" className="pf-btn pf-btn--coral" disabled={progress < 1} onClick={() => { setPickup(0); setStep(5); }}>{t.goPickup} →</button> : null}
      </div>
    </section>
  );
}
