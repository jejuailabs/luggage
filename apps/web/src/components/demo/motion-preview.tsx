"use client";
/* eslint-disable @next/next/no-img-element -- QR data URLs are generated in the browser. */

import Link from "next/link";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import type { Locale } from "@luggage/i18n";
import { RealMap } from "@/components/account/real-map";

// 이용 미리보기: 휴대폰 화면 속 모션으로 예약부터 짐 찾기까지 보여 준다. 예시 화면이며 서버를 호출하지 않는다.
type Scenario = "hotel_to_airport" | "airport_to_hotel" | "hotel_to_hotel";
const STEP_COUNT = 9;
const REF = "JC7Q2M4K8A";
const TAGS = ["TK4P8M2Q7RZ", "TN3W6D9X2LC"];

const COPY = {
  ko: {
    badge: "미리보기 · 예시 화면", brand: "제주 커넥트",
    tabs: { hotel_to_airport: ["🧳", "체크아웃 날", "숙소 → 공항"], airport_to_hotel: ["🛬", "제주 도착 직후", "공항 → 숙소"], hotel_to_hotel: ["🏨", "숙소 이동", "숙소 → 숙소"] },
    step: "단계", prev: "이전", next: "다음", play: "자동재생", pause: "멈춤", replay: "다시 보기",
    typed: "제주시", hotels: ["예시 호텔 제주시점", "예시 호텔 서귀포점"], search: "숙소 이름 검색", more: "관광공사 등록 숙소도 검색돼요",
    airport: "제주공항", date: "내일", kst: "한국 시간", slots: ["09:00–11:00", "12:00–14:00"], pickup: "수거", delivery: "인계",
    standard: "보통 짐", large: "대형 짐", flight: "항공편", departs: "출발 19:00", arrives: "도착 09:30", dest: "도착 숙소",
    total: "결제 금액", price: "₩35,000", vat: "부가세 포함", policies: ["짐 규격·수량", "맡길 수 없는 물품", "취소·환불", "파손·분실 보상"],
    pay: "위챗페이로 결제", verifying: "결제 확인 중…", paid: "결제 완료",
    voucher: "예약증", ref: "예약 번호", front: "호텔 프런트", driver: "기사", scan: "QR 스캔 · 사진 기록", stored: "보관 완료", received: "기사 인수 완료",
    moving: "이동 중", notif: "짐이 이동 중이에요", code: "수령 코드", checked: "확인", done: "모든 짐을 받았어요 🎉", showQr: "예약증 QR 제시",
    steps: {
      hotel_to_airport: [
        ["숙소 이름을 입력해요", "짐을 맡길 숙소 이름을 몇 글자만 쓰면 목록이 떠요. 한국 전화번호는 필요 없어요."],
        ["날짜와 시간대를 골라요", "수거 시간과 공항 인계 시간은 모두 한국 시간이에요. 남은 자리가 있는 시간만 보여요."],
        ["짐 개수와 항공편을 넣어요", "항공편 출발 시각을 넣으면 비행기 타기 전에 짐을 받을 수 있는지 서버가 확인해요."],
        ["요금과 필수 안내를 확인해요", "요금은 서버가 계산해요. 짐 규격·금지 물품·취소·보상 안내 4가지에 동의해요."],
        ["위챗페이·알리페이로 결제해요", "결제 화면이 끝나도 결제사 확인이 끝나야 예약이 확정돼요."],
        ["예약증과 짐 태그 QR을 받아요", "짐마다 태그 QR이 생겨요. QR에는 개인정보가 들어 있지 않아요."],
        ["호텔 프런트에 짐을 맡겨요", "체크아웃할 때 예약증을 보여 주면 직원이 태그를 붙이고 사진을 남겨요."],
        ["내 짐이 어디쯤인지 봐요", "지도에서 배송 차량 위치와 단계별 알림을 받아요. 짐 자체 GPS는 아니에요."],
        ["공항에서 짐을 찾아요", "수령 코드를 기사에게 보여 주면 태그를 하나씩 확인한 뒤 짐을 돌려받아요."],
      ],
      airport_to_hotel: [
        ["짐을 받을 숙소를 입력해요", "오늘 묵을 숙소 이름을 몇 글자만 쓰면 목록이 떠요."],
        ["날짜와 시간대를 골라요", "공항 수거 시간과 숙소 도착 시간은 모두 한국 시간이에요."],
        ["짐 개수와 항공편을 넣어요", "항공편 도착 시각으로 공항에서 짐을 받을 수 있는지 확인해요."],
        ["요금과 필수 안내를 확인해요", "요금은 서버가 계산해요. 필수 안내 4가지에 동의해요."],
        ["위챗페이·알리페이로 결제해요", "결제사 확인이 끝나야 예약이 확정돼요."],
        ["예약증과 짐 태그 QR을 받아요", "짐마다 태그 QR이 생겨요."],
        ["공항에서 기사에게 짐을 건네요", "도착 후 약속 장소에서 기사가 QR을 스캔하고 사진을 남겨요. 바로 여행을 시작하세요."],
        ["내 짐이 어디쯤인지 봐요", "숙소로 가는 배송 차량 위치와 알림을 받아요."],
        ["숙소 프런트에서 짐을 찾아요", "체크인할 때 예약증 QR을 보여 주면 짐을 하나씩 확인해 돌려받아요."],
      ],
      hotel_to_hotel: [
        ["출발 숙소를 입력해요", "지금 묵고 있는 숙소 이름을 몇 글자만 쓰면 목록이 떠요."],
        ["날짜와 시간대를 골라요", "수거 시간과 도착 숙소 인계 시간은 모두 한국 시간이에요."],
        ["짐 개수와 도착 숙소를 골라요", "다음 숙소를 고르면 같은 날 짐을 옮겨 드려요."],
        ["요금과 필수 안내를 확인해요", "요금은 서버가 계산해요. 필수 안내 4가지에 동의해요."],
        ["위챗페이·알리페이로 결제해요", "결제사 확인이 끝나야 예약이 확정돼요."],
        ["예약증과 짐 태그 QR을 받아요", "짐마다 태그 QR이 생겨요."],
        ["출발 숙소 프런트에 맡겨요", "체크아웃할 때 예약증을 보여 주면 직원이 태그를 붙이고 사진을 남겨요."],
        ["내 짐이 어디쯤인지 봐요", "다음 숙소로 가는 배송 차량 위치와 알림을 받아요."],
        ["도착 숙소에서 짐을 찾아요", "체크인할 때 예약증 QR을 보여 주면 짐을 돌려받아요."],
      ],
    },
    ctaTitle: "직접 해보고 싶다면?", ctaText: "값을 바꿔 가며 예약·결제·배송·짐 찾기를 직접 눌러 볼 수 있어요. 호텔·기사·운영 화면도 볼 수 있어요.", cta: "실제 시뮬레이션 해보기", book: "바로 예약하기",
  },
  "zh-CN": {
    badge: "预览 · 示例画面", brand: "济州Connect",
    tabs: { hotel_to_airport: ["🧳", "退房当天", "住宿 → 机场"], airport_to_hotel: ["🛬", "刚到济州", "机场 → 住宿"], hotel_to_hotel: ["🏨", "更换住宿", "住宿 → 住宿"] },
    step: "步骤", prev: "上一步", next: "下一步", play: "自动播放", pause: "暂停", replay: "再看一次",
    typed: "济州市", hotels: ["示例酒店 济州市店", "示例酒店 西归浦店"], search: "搜索住宿名称", more: "也可搜索韩国观光公社登记的住宿",
    airport: "济州机场", date: "明天", kst: "韩国时间", slots: ["09:00–11:00", "12:00–14:00"], pickup: "取件", delivery: "交付",
    standard: "普通行李", large: "大件行李", flight: "航班", departs: "起飞 19:00", arrives: "抵达 09:30", dest: "目的住宿",
    total: "应付金额", price: "₩35,000", vat: "含增值税", policies: ["行李规格", "禁止物品", "取消退款", "损坏丢失赔偿"],
    pay: "微信支付", verifying: "正在确认付款…", paid: "付款成功",
    voucher: "预约凭证", ref: "预约号", front: "酒店前台", driver: "司机", scan: "扫码 · 拍照记录", stored: "已保管", received: "司机已接收",
    moving: "运送中", notif: "行李正在运送中", code: "取件码", checked: "已核对", done: "所有行李已取回 🎉", showQr: "出示预约凭证二维码",
    steps: {
      hotel_to_airport: [
        ["输入住宿名称", "只需输入几个字即可看到住宿列表，无需韩国手机号。"],
        ["选择日期和时段", "取件和机场交付时间均为韩国时间，只显示还有名额的时段。"],
        ["填写行李数量和航班", "填写航班起飞时间后，服务器会确认能否在登机前交付行李。"],
        ["确认价格与必读须知", "价格由服务器计算，并同意行李规格、禁止物品、取消、赔偿 4 项须知。"],
        ["使用微信支付或支付宝付款", "支付页面完成后，还需支付机构确认，预约才会生效。"],
        ["获取预约凭证和行李标签二维码", "每件行李都有标签二维码，二维码不含个人信息。"],
        ["在酒店前台寄存行李", "退房时出示预约凭证，工作人员贴标签并拍照记录。"],
        ["查看行李位置", "在地图上查看配送车辆位置并接收各阶段通知，并非行李本身 GPS。"],
        ["在机场取回行李", "向司机出示取件码，逐件核对标签后取回行李。"],
      ],
      airport_to_hotel: [
        ["输入收件住宿", "输入今晚住宿名称的几个字即可看到列表。"],
        ["选择日期和时段", "机场取件和住宿送达时间均为韩国时间。"],
        ["填写行李数量和航班", "根据航班抵达时间确认能否在机场接收行李。"],
        ["确认价格与必读须知", "价格由服务器计算，并同意 4 项必读须知。"],
        ["使用微信支付或支付宝付款", "支付机构确认后预约才会生效。"],
        ["获取预约凭证和行李标签二维码", "每件行李都有标签二维码。"],
        ["在机场把行李交给司机", "到达后在约定地点，司机扫码拍照，您即可轻松出发。"],
        ["查看行李位置", "接收前往住宿的配送车辆位置与通知。"],
        ["在住宿前台取回行李", "入住时出示预约凭证二维码，逐件核对后取回。"],
      ],
      hotel_to_hotel: [
        ["输入出发住宿", "输入当前住宿名称的几个字即可看到列表。"],
        ["选择日期和时段", "取件与目的住宿交付时间均为韩国时间。"],
        ["选择行李数量和目的住宿", "选择下一家住宿，当天为您运送行李。"],
        ["确认价格与必读须知", "价格由服务器计算，并同意 4 项必读须知。"],
        ["使用微信支付或支付宝付款", "支付机构确认后预约才会生效。"],
        ["获取预约凭证和行李标签二维码", "每件行李都有标签二维码。"],
        ["在出发住宿前台寄存", "退房时出示预约凭证，工作人员贴标签并拍照。"],
        ["查看行李位置", "接收前往下一家住宿的车辆位置与通知。"],
        ["在目的住宿取回行李", "入住时出示预约凭证二维码即可取回。"],
      ],
    },
    ctaTitle: "想亲自试试？", ctaText: "可以修改信息，亲自点击体验预约、付款、配送到取回行李，还能查看酒店、司机、运营画面。", cta: "开始模拟体验", book: "立即预约",
  },
  en: {
    badge: "Preview · sample screens", brand: "Jeju Connect",
    tabs: { hotel_to_airport: ["🧳", "Checkout day", "Stay → Airport"], airport_to_hotel: ["🛬", "Just landed", "Airport → Stay"], hotel_to_hotel: ["🏨", "Changing stays", "Stay → Stay"] },
    step: "Step", prev: "Back", next: "Next", play: "Autoplay", pause: "Pause", replay: "Replay",
    typed: "Jeju City", hotels: ["Sample Hotel Jeju City", "Sample Hotel Seogwipo"], search: "Search your stay", more: "Stays listed by the Korea Tourism Organization appear too",
    airport: "Jeju Airport", date: "Tomorrow", kst: "Korea time", slots: ["09:00–11:00", "12:00–14:00"], pickup: "Pickup", delivery: "Handoff",
    standard: "Standard", large: "Large", flight: "Flight", departs: "Departs 19:00", arrives: "Arrives 09:30", dest: "Next stay",
    total: "Total", price: "₩35,000", vat: "VAT included", policies: ["Bag size", "Prohibited items", "Cancellation", "Compensation"],
    pay: "Pay with WeChat Pay", verifying: "Confirming payment…", paid: "Paid",
    voucher: "Voucher", ref: "Booking no.", front: "Hotel front desk", driver: "Driver", scan: "QR scan · photo", stored: "Stored", received: "Driver received",
    moving: "In transit", notif: "Your bags are on the move", code: "Handoff code", checked: "Checked", done: "All bags collected 🎉", showQr: "Show voucher QR",
    steps: {
      hotel_to_airport: [
        ["Type your stay", "A few letters of your hotel name bring up the list. No Korean phone number needed."],
        ["Pick a date and time", "Pickup and airport handoff times are in Korea time. Only windows with space are shown."],
        ["Add bags and your flight", "With your departure time, the server checks you'll get your bags before boarding."],
        ["Check price and notices", "The server calculates the price. Accept the 4 notices: size, prohibited items, cancellation, compensation."],
        ["Pay with WeChat Pay or Alipay", "The booking is confirmed only after the payment provider verifies it."],
        ["Get your voucher and bag tag QRs", "Each bag gets a tag QR. The QR holds no personal data."],
        ["Drop bags at the front desk", "Show your voucher at checkout; staff tag and photograph each bag."],
        ["See where your bags are", "Follow the delivery vehicle on the map with alerts at every stage — not a GPS on the bag."],
        ["Collect at the airport", "Show your handoff code to the driver; every tag is checked before you get your bags."],
      ],
      airport_to_hotel: [
        ["Type the stay to deliver to", "A few letters of tonight's hotel bring up the list."],
        ["Pick a date and time", "Airport pickup and stay delivery times are in Korea time."],
        ["Add bags and your flight", "Your arrival time confirms the airport pickup works."],
        ["Check price and notices", "The server calculates the price. Accept the 4 notices."],
        ["Pay with WeChat Pay or Alipay", "Confirmed only after the provider verifies payment."],
        ["Get your voucher and bag tag QRs", "Each bag gets a tag QR."],
        ["Hand bags to the driver", "At the meeting point the driver scans and photographs each bag. Start exploring."],
        ["See where your bags are", "Follow the vehicle heading to your stay."],
        ["Collect at the front desk", "Show your voucher QR at check-in to collect every bag."],
      ],
      hotel_to_hotel: [
        ["Type your current stay", "A few letters of your hotel name bring up the list."],
        ["Pick a date and time", "Pickup and next-stay handoff times are in Korea time."],
        ["Add bags and your next stay", "Choose your next hotel and we move your bags the same day."],
        ["Check price and notices", "The server calculates the price. Accept the 4 notices."],
        ["Pay with WeChat Pay or Alipay", "Confirmed only after the provider verifies payment."],
        ["Get your voucher and bag tag QRs", "Each bag gets a tag QR."],
        ["Drop bags at the front desk", "Show your voucher at checkout; staff tag and photograph each bag."],
        ["See where your bags are", "Follow the vehicle heading to your next stay."],
        ["Collect at your next stay", "Show your voucher QR at check-in to collect your bags."],
      ],
    },
    ctaTitle: "Want to try it yourself?", ctaText: "Change the details and tap through booking, payment, delivery and collection yourself — including hotel, driver and ops screens.", cta: "Try the simulation", book: "Book now",
  },
} as const;

/** 한 글자씩 입력되는 효과. 움직임 줄이기 설정이면 바로 완성된 글자를 보여 준다. */
function useTyping(text: string, delay = 400, speed = 180) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const id = setTimeout(() => setCount(text.length), 0);
      return () => clearTimeout(id);
    }
    let timer: ReturnType<typeof setInterval> | undefined;
    const start = setTimeout(() => {
      timer = setInterval(() => setCount((value) => (value >= text.length ? value : value + 1)), speed);
    }, delay);
    return () => { clearTimeout(start); if (timer) clearInterval(timer); };
  }, [text, delay, speed]);
  return text.slice(0, count);
}

export function MotionPreview({ locale }: { locale: Locale }) {
  const t = COPY[locale];
  const [scenario, setScenario] = useState<Scenario>("hotel_to_airport");
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [round, setRound] = useState(0);
  const [qr, setQr] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    Promise.all(TAGS.map(async (tag) => [tag, await QRCode.toDataURL(tag, { margin: 1, width: 120 })] as const))
      .then((pairs) => { if (!cancelled) setQr(Object.fromEntries(pairs)); })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!playing) return;
    const timer = setTimeout(() => {
      if (step >= STEP_COUNT - 1) setPlaying(false);
      else setStep(step + 1);
    }, step === 7 ? 7000 : 5200);
    return () => clearTimeout(timer);
  }, [playing, step]);

  const go = (next: number) => { setStep(Math.max(0, Math.min(STEP_COUNT - 1, next))); setRound((value) => value + 1); };
  const choose = (next: Scenario) => { setScenario(next); setStep(0); setRound((value) => value + 1); };
  const [title, desc] = t.steps[scenario][step]!;
  const hotelName = scenario === "airport_to_hotel" ? t.hotels[1] : t.hotels[0];
  const origin = scenario === "airport_to_hotel" ? t.airport : t.hotels[0];
  const destination = scenario === "hotel_to_airport" ? t.airport : t.hotels[1];
  const sceneKey = `${scenario}-${step}-${round}`;

  return (
    <section className="mp" aria-label={t.badge} data-testid="motion-preview">
      <div className="pv-scenarios" role="tablist">
        {(Object.keys(t.tabs) as Scenario[]).map((key) => {
          const [emoji, name, route] = t.tabs[key];
          return (
            <button key={key} type="button" role="tab" aria-selected={scenario === key} onClick={() => choose(key)}>
              <span aria-hidden="true">{emoji}</span><strong>{name}</strong><small>{route}</small>
            </button>
          );
        })}
      </div>

      <div className="mp-stage">
        <div className="mp-phone" aria-hidden="true">
          <div className="mp-notch" />
          <div className="mp-screen" key={sceneKey}>
            <div className="mp-appbar"><b>{t.brand}</b><span>{t.badge}</span></div>
            <Scene index={step} scenario={scenario} t={t} hotelName={hotelName} origin={origin} destination={destination} qr={qr} />
          </div>
        </div>

        <div className="mp-caption">
          <span className="mp-count">{t.step} {step + 1} / {STEP_COUNT}</span>
          <h3 key={`title-${sceneKey}`}>{title}</h3>
          <p>{desc}</p>
          <div className="mp-dots" role="tablist" aria-label={t.step}>
            {Array.from({ length: STEP_COUNT }, (_, index) => (
              <button key={index} type="button" role="tab" aria-selected={index === step} aria-label={`${t.step} ${index + 1}`} onClick={() => go(index)} />
            ))}
          </div>
          <div className="mp-controls">
            <button type="button" className="pf-btn pf-btn--ghost" onClick={() => go(step - 1)} disabled={step === 0}>← {t.prev}</button>
            <button type="button" className="mp-play" onClick={() => setPlaying(!playing)} aria-pressed={playing}>{playing ? `⏸ ${t.pause}` : `▶ ${t.play}`}</button>
            {step < STEP_COUNT - 1
              ? <button type="button" className="pf-btn pf-btn--coral" onClick={() => go(step + 1)}>{t.next} →</button>
              : <button type="button" className="pf-btn pf-btn--coral" onClick={() => { setPlaying(false); go(0); }}>↺ {t.replay}</button>}
          </div>
        </div>
      </div>

      <div className="mp-cta" data-testid="simulation-cta">
        <div><strong>🧪 {t.ctaTitle}</strong><p>{t.ctaText}</p></div>
        <div className="mp-cta__actions">
          <Link href={`/${locale}/demo?route=${scenario}`} className="pf-btn pf-btn--coral">{t.cta} →</Link>
          <Link href={`/${locale}/luggage/book?route=${scenario}`} className="pf-btn pf-btn--ghost">{t.book}</Link>
        </div>
      </div>
    </section>
  );
}

type Copy = (typeof COPY)[Locale];

function Scene({ index, scenario, t, hotelName, origin, destination, qr }: { index: number; scenario: Scenario; t: Copy; hotelName: string; origin: string; destination: string; qr: Record<string, string> }) {
  const typedHotel = useTyping(index === 0 ? t.typed : "");
  const typedFlight = useTyping(index === 2 && scenario !== "hotel_to_hotel" ? "KE1234" : "", 1400, 140);
  const [progress, setProgress] = useState(0);
  const [bags, setBags] = useState([0, 0]);
  useEffect(() => {
    if (index !== 2) return;
    const first = setTimeout(() => setBags([1, 0]), 700);
    const second = setTimeout(() => setBags([1, 1]), 1200);
    return () => { clearTimeout(first); clearTimeout(second); };
  }, [index]);
  useEffect(() => {
    if (index !== 7) return;
    const timer = setInterval(() => setProgress((value) => Math.min(1, value + 0.012)), 70);
    return () => clearInterval(timer);
  }, [index]);
  const airportCollect = scenario === "hotel_to_airport";

  switch (index) {
    case 0:
      return (
        <div className="mp-body">
          <label className="mp-label">🏨 {scenario === "airport_to_hotel" ? t.dest : t.search}</label>
          <div className="mp-input">{typedHotel}<span className="mp-caret" /></div>
          <ul className="mp-list mp-in" style={{ animationDelay: "1.6s" }}>
            <li className="mp-pick">{hotelName}</li>
            <li>{hotelName === t.hotels[0] ? t.hotels[1] : t.hotels[0]}</li>
          </ul>
          <small className="mp-hint mp-in" style={{ animationDelay: "1.8s" }}>{t.more}</small>
        </div>
      );
    case 1:
      return (
        <div className="mp-body">
          <div className="mp-route"><span>{origin}</span><i>→</i><span>{destination}</span></div>
          <div className="mp-field"><small>📅</small><b>{t.date}</b><em>{t.kst}</em></div>
          <div className="mp-chips">
            <span className="mp-chip mp-chip--pick"><small>{t.pickup}</small>{t.slots[0]}</span>
            <span className="mp-chip"><small>{t.pickup}</small>{t.slots[1]}</span>
          </div>
        </div>
      );
    case 2:
      return (
        <div className="mp-body">
          <div className="mp-counter"><span>{t.standard}</span><i>−</i><b>{bags[0]}</b><i className="mp-plus">+</i></div>
          <div className="mp-counter"><span>{t.large}</span><i>−</i><b>{bags[1]}</b><i className="mp-plus">+</i></div>
          {scenario !== "hotel_to_hotel" ? (
            <>
              <label className="mp-label">✈️ {t.flight}</label>
              <div className="mp-input">{typedFlight}<span className="mp-caret" /></div>
              <small className="mp-hint">{scenario === "hotel_to_airport" ? t.departs : t.arrives} ({t.kst})</small>
            </>
          ) : (
            <>
              <label className="mp-label">🏡 {t.dest}</label>
              <div className="mp-input mp-in" style={{ animationDelay: "1.2s" }}>{t.hotels[1]}</div>
            </>
          )}
        </div>
      );
    case 3:
      return (
        <div className="mp-body">
          <div className="mp-ticket mp-in"><small>{t.total}</small><b>{t.price}</b><em>{t.vat}</em></div>
          <ul className="mp-checks">
            {t.policies.map((policy, i) => <li key={policy} style={{ animationDelay: `${0.8 + i * 0.45}s` }}><span />{policy}</li>)}
          </ul>
        </div>
      );
    case 4:
      return (
        <div className="mp-body mp-body--pay">
          <div className="mp-sheet">
            <b>{t.pay}</b>
            <strong>{t.price}</strong>
            <span className="mp-sheet__btn">{t.pay}</span>
            <span className="mp-sheet__wait"><i />{t.verifying}</span>
            <span className="mp-sheet__ok">✓ {t.paid}</span>
          </div>
        </div>
      );
    case 5:
      return (
        <div className="mp-body">
          <div className="mp-voucher mp-in">
            <div><small>{t.ref}</small><b>{REF}</b></div>
            <p>{origin} → {destination}</p>
            <div className="mp-qrs">{TAGS.map((tag, i) => <figure key={tag} className="mp-in" style={{ animationDelay: `${0.8 + i * 0.4}s` }}>{qr[tag] ? <img src={qr[tag]} alt="" width={64} height={64} /> : <span />}<figcaption>{tag}</figcaption></figure>)}</div>
          </div>
        </div>
      );
    case 6:
      return (
        <div className="mp-body">
          <div className="mp-desk">{scenario === "airport_to_hotel" ? `✈️ ${t.airport} · ${t.driver}` : `🛎️ ${t.front}`}</div>
          <div className="mp-bag"><span className="mp-bag__icon">🧳</span><span className="mp-bag__tag">🏷️ {TAGS[0]}</span></div>
          <div className="mp-scanline"><span />{t.scan}</div>
          <p className="mp-toast mp-in" style={{ animationDelay: "2.6s" }}>✓ {scenario === "airport_to_hotel" ? t.received : t.stored}</p>
        </div>
      );
    case 7:
      return (
        <div className="mp-body mp-body--map">
          <div className="mp-map tracking-map__canvas">
            <RealMap demo progress={scenario === "airport_to_hotel" ? 1 - progress : progress} labels={{ pickup: t.pickup, airport: t.airport, demo: t.badge, live: t.moving, unavailable: "Map unavailable" }} />
          </div>
          <p className="mp-toast mp-in" style={{ animationDelay: "1s" }}>🔔 {t.notif}</p>
        </div>
      );
    default:
      return (
        <div className="mp-body">
          {airportCollect ? (
            <div className="mp-code mp-in"><small>{t.code}</small><b>482 913</b></div>
          ) : (
            <div className="mp-code mp-in"><small>{t.showQr}</small><b>▣ QR</b></div>
          )}
          <ul className="mp-tagcheck">
            {TAGS.map((tag, i) => <li key={tag} style={{ animationDelay: `${1.2 + i * 0.7}s` }}>🏷️ {tag}<em>✓ {t.checked}</em></li>)}
          </ul>
          <p className="mp-done mp-in" style={{ animationDelay: "3s" }}>{t.done}</p>
        </div>
      );
  }
}
