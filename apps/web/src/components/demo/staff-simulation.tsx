"use client";
/* eslint-disable @next/next/no-img-element -- QR data URL is generated in the browser. */

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import type { Locale } from "@luggage/i18n";

// 업무 계정 없이 기사·호텔·운영 화면의 흐름을 보여 주는 시뮬레이션. 서버를 호출하지 않는다.
type Area = "driver" | "partner" | "admin";
type Route = "hotel_to_airport" | "airport_to_hotel" | "hotel_to_hotel";
interface Job { ref: string; route: Route; hotel: string; dest: string; bags: number; pickup: string; delivery: string; status: number; driver: string; tags: string[] }

const COPY = {
  ko: {
    badge: "시뮬레이션 데이터 · 실제 주문 아님", intro: "업무 계정이 없어도 아래에서 화면 흐름을 직접 눌러 볼 수 있어요.",
    routes: { hotel_to_airport: "숙소 → 공항", airport_to_hotel: "공항 → 숙소", hotel_to_hotel: "숙소 → 숙소" },
    statuses: ["예약 확정", "호텔 보관", "기사 수거", "이동 중", "인계 준비", "완료"],
    next: ["호텔 보관 처리", "QR 스캔·수거", "출발", "인계 준비", "인계 완료"],
    airport: "제주공항", bags: (n: number) => `짐 ${n}개`, pickup: "수거", delivery: "인계", detail: "작업 상세 시뮬레이션",
    driverTitle: "오늘 내 작업", partnerTitle: "오늘 호텔 업무", dropoffs: "맡기는 짐", arrivals: "도착하는 짐", store: "태그 확인 후 보관", stored: "보관 중", receive: "도착 짐 인수", received: "인수 완료",
    qrTitle: "호텔 QR 포스터", qrText: "고객이 스캔하면 이 지점이 선택된 예약 화면으로 이동해요. 유입·수수료가 지점에 귀속됩니다.",
    kpi: ["오늘 예약", "배송 중", "완료", "열린 문의"], orders: "예약·배차", driver: "기사", refunds: "환불 승인 대기", approve: "승인", reject: "거절", approved: "승인됨", rejected: "거절됨",
    support: "고객 문의", reply: "답변 보내기", replied: "답변 완료", incidents: "사고·지연", noIncidents: "열린 사고 없음", settlement: "호텔 정산 (이번 달)", commission: "수수료", paid: "지급 처리", paidDone: "지급 완료",
    tickets: ["공항 수령 장소가 어디인가요?", "짐 1개 추가할 수 있나요?"], refundReason: "일정 변경으로 취소", reportDelay: "지연 보고", delayed: "지연 보고됨 · 고객 알림 발송(시뮬레이션)",
  },
  "zh-CN": {
    badge: "模拟数据 · 非真实订单", intro: "没有工作账号也可以在下方点击体验业务流程。",
    routes: { hotel_to_airport: "住宿 → 机场", airport_to_hotel: "机场 → 住宿", hotel_to_hotel: "住宿 → 住宿" },
    statuses: ["预约确认", "酒店保管", "司机取件", "运送中", "准备交付", "已完成"],
    next: ["酒店保管", "扫码取件", "出发", "准备交付", "完成交付"],
    airport: "济州机场", bags: (n: number) => `行李 ${n} 件`, pickup: "取件", delivery: "交付", detail: "查看任务模拟",
    driverTitle: "今日任务", partnerTitle: "今日酒店业务", dropoffs: "寄存行李", arrivals: "到达行李", store: "核对标签后保管", stored: "保管中", receive: "接收到达行李", received: "已接收",
    qrTitle: "酒店二维码海报", qrText: "顾客扫码后进入已选定本店的预约页面，来源与佣金归属本店。",
    kpi: ["今日预约", "运送中", "已完成", "未结咨询"], orders: "预约与派单", driver: "司机", refunds: "待审批退款", approve: "批准", reject: "拒绝", approved: "已批准", rejected: "已拒绝",
    support: "顾客咨询", reply: "发送回复", replied: "已回复", incidents: "事故与延误", noIncidents: "暂无事故", settlement: "酒店结算（本月）", commission: "佣金", paid: "标记已付", paidDone: "已支付",
    tickets: ["机场取件地点在哪里？", "可以再加一件行李吗？"], refundReason: "行程变更取消", reportDelay: "上报延误", delayed: "已上报延误 · 已通知顾客（模拟）",
  },
  en: {
    badge: "Simulated data · not real orders", intro: "No staff account? Tap through the workflow below.",
    routes: { hotel_to_airport: "Stay → Airport", airport_to_hotel: "Airport → Stay", hotel_to_hotel: "Stay → Stay" },
    statuses: ["Confirmed", "Stored", "Picked up", "In transit", "Ready", "Done"],
    next: ["Store at hotel", "Scan & pick up", "Depart", "Ready for handoff", "Complete handoff"],
    airport: "Jeju Airport", bags: (n: number) => `${n} bag${n === 1 ? "" : "s"}`, pickup: "Pickup", delivery: "Handoff", detail: "Job detail simulation",
    driverTitle: "Today's jobs", partnerTitle: "Today at the hotel", dropoffs: "Drop-offs", arrivals: "Arrivals", store: "Check tags & store", stored: "Stored", receive: "Receive arriving bags", received: "Received",
    qrTitle: "Hotel QR poster", qrText: "Guests who scan it land on booking with this branch selected; attribution and commission go to this branch.",
    kpi: ["Bookings today", "In transit", "Done", "Open tickets"], orders: "Bookings & dispatch", driver: "Driver", refunds: "Refunds awaiting approval", approve: "Approve", reject: "Reject", approved: "Approved", rejected: "Rejected",
    support: "Guest tickets", reply: "Send reply", replied: "Replied", incidents: "Incidents", noIncidents: "No open incidents", settlement: "Hotel settlement (this month)", commission: "Commission", paid: "Mark paid", paidDone: "Paid",
    tickets: ["Where is the airport pickup point?", "Can I add one more bag?"], refundReason: "Plans changed", reportDelay: "Report delay", delayed: "Delay reported · guest notified (simulated)",
  },
} as const;

const HOTELS = { ko: ["예시 호텔 제주시점", "예시 호텔 서귀포점"], "zh-CN": ["示例酒店 济州市店", "示例酒店 西归浦店"], en: ["Sample Hotel Jeju City", "Sample Hotel Seogwipo"] } as const;
const DRIVERS = ["A", "B", "C"];

function sampleJobs(locale: Locale): Job[] {
  const [h1, h2] = HOTELS[locale];
  return [
    { ref: "JC7Q2M4K8A", route: "hotel_to_airport", hotel: h1, dest: "", bags: 2, pickup: "09:00–11:00", delivery: "14:00–16:00", status: 0, driver: "A", tags: ["TK4P8M2Q7RZ", "TN3W6D9X2LC"] },
    { ref: "JC3N8P5R2B", route: "airport_to_hotel", hotel: h2, dest: "", bags: 1, pickup: "10:00–12:00", delivery: "16:00–18:00", status: 3, driver: "B", tags: ["TP7H2K5M9QA"] },
    { ref: "JC9W4T6Y1C", route: "hotel_to_hotel", hotel: h1, dest: h2, bags: 3, pickup: "10:00–12:00", delivery: "16:00–18:00", status: 1, driver: "A", tags: ["TR2M5X8C4VB", "TL9Q3F6J2WN", "TD5T8H1K7PE"] },
    { ref: "JC5K2H7D3E", route: "hotel_to_airport", hotel: h2, dest: "", bags: 1, pickup: "12:00–14:00", delivery: "17:00–19:00", status: 5, driver: "C", tags: ["TG6N1B4R8YS"] },
  ];
}

export function StaffSimulation({ locale, area }: { locale: Locale; area: Area }) {
  const t = COPY[locale];
  const [jobs, setJobs] = useState<Job[]>(() => sampleJobs(locale));
  const [refund, setRefund] = useState<"pending" | "approved" | "rejected">("pending");
  const [tickets, setTickets] = useState([false, false]);
  const [delayed, setDelayed] = useState<string | null>(null);
  const [settled, setSettled] = useState(false);
  const [qr, setQr] = useState("");
  const money = (value: number) => new Intl.NumberFormat(locale, { style: "currency", currency: "KRW" }).format(value);

  useEffect(() => {
    if (area !== "partner") return;
    QRCode.toDataURL(`${window.location.origin}/${locale}/h/SAMPLE01`, { margin: 1, width: 200 }).then(setQr).catch(() => undefined);
  }, [area, locale]);

  const advance = (ref: string) => setJobs((current) => current.map((job) => job.ref === ref ? { ...job, status: Math.min(5, job.status + (job.route === "airport_to_hotel" && job.status === 0 ? 2 : 1)) } : job));
  const destination = (job: Job) => job.route === "hotel_to_airport" ? t.airport : job.route === "hotel_to_hotel" ? job.dest : job.hotel;
  const origin = (job: Job) => job.route === "airport_to_hotel" ? t.airport : job.hotel;
  const kpis = useMemo(() => [jobs.length, jobs.filter((job) => job.status >= 2 && job.status < 5).length, jobs.filter((job) => job.status >= 5).length, tickets.filter((done) => !done).length], [jobs, tickets]);

  const jobCard = (job: Job, action?: React.ReactNode) => (
    <li key={job.ref} className="staff-sim__job">
      <div className="staff-sim__job-top"><b>{job.ref}</b><span className={`staff-sim__status staff-sim__status--${job.status}`}>{t.statuses[job.status]}</span></div>
      <p>{origin(job)} → {destination(job)}</p>
      <small>{t.routes[job.route]} · {t.bags(job.bags)} · {t.pickup} {job.pickup} · {t.delivery} {job.delivery} (KST)</small>
      {action}
    </li>
  );

  return (
    <section className="staff-sim pf-scope" data-testid="staff-simulation">
      <div className="staff-sim__head"><span className="pf-sim-badge">🧪 {t.badge}</span><p>{t.intro}</p></div>

      {area === "driver" ? (
        <div className="staff-sim__panel">
          <h2>🚐 {t.driverTitle}</h2>
          <ul className="staff-sim__list">
            {jobs.filter((job) => job.driver === "A" || job.driver === "B").map((job) => jobCard(job, (
              <div className="staff-sim__actions">
                {job.status < 5 && job.status >= (job.route === "airport_to_hotel" ? 0 : 1) ? <button type="button" className="pf-btn pf-btn--coral" onClick={() => advance(job.ref)}>{t.next[job.status]}</button> : null}
                <Link href={`/${locale}/demo?role=driver&route=${job.route}`} className="pf-btn pf-btn--ghost">{t.detail} →</Link>
              </div>
            )))}
          </ul>
        </div>
      ) : null}

      {area === "partner" ? (
        <div className="staff-sim__grid">
          <div className="staff-sim__panel">
            <h2>🏨 {t.partnerTitle}</h2>
            <h3>{t.dropoffs}</h3>
            <ul className="staff-sim__list">
              {jobs.filter((job) => job.route !== "airport_to_hotel" && job.status < 2).map((job) => jobCard(job, (
                <div className="staff-sim__actions">
                  <span className="staff-sim__tags">{job.tags.map((tag) => <code key={tag}>🏷️ {tag}</code>)}</span>
                  {job.status === 0 ? <button type="button" className="pf-btn pf-btn--coral" onClick={() => advance(job.ref)}>{t.store}</button> : <span className="pf-chip pf-chip--open">{t.stored}</span>}
                </div>
              )))}
            </ul>
            <h3>{t.arrivals}</h3>
            <ul className="staff-sim__list">
              {jobs.filter((job) => job.route !== "hotel_to_airport" && job.status >= 3).map((job) => jobCard(job, (
                <div className="staff-sim__actions">
                  {job.status < 5 ? <button type="button" className="pf-btn pf-btn--coral" onClick={() => setJobs((current) => current.map((item) => item.ref === job.ref ? { ...item, status: 5 } : item))}>{t.receive}</button> : <span className="pf-chip pf-chip--open">{t.received}</span>}
                </div>
              )))}
            </ul>
          </div>
          <div className="staff-sim__panel staff-sim__qr">
            <h2>🔳 {t.qrTitle}</h2>
            {qr ? <img src={qr} alt="SAMPLE01 QR" width={180} height={180} /> : <span className="sim-qr-ph" />}
            <b>{HOTELS[locale][0]}</b>
            <p>{t.qrText}</p>
          </div>
        </div>
      ) : null}

      {area === "admin" ? (
        <>
          <div className="sim-metrics">{kpis.map((value, index) => <div key={t.kpi[index]}><b>{value}</b><span>{t.kpi[index]}</span></div>)}</div>
          <div className="staff-sim__panel">
            <h2>📋 {t.orders}</h2>
            <ul className="staff-sim__list">
              {jobs.map((job) => jobCard(job, (
                <div className="staff-sim__actions">
                  <label className="staff-sim__select">{t.driver}
                    <select value={job.driver} onChange={(event) => setJobs((current) => current.map((item) => item.ref === job.ref ? { ...item, driver: event.target.value } : item))}>
                      {DRIVERS.map((driver) => <option key={driver} value={driver}>{t.driver} {driver}</option>)}
                    </select>
                  </label>
                  {job.status < 5 ? <button type="button" className="pf-btn pf-btn--ghost" onClick={() => advance(job.ref)}>{t.next[job.status]}</button> : null}
                  {job.status >= 2 && job.status < 5 && delayed !== job.ref ? <button type="button" className="pf-btn pf-btn--ghost" onClick={() => setDelayed(job.ref)}>⚠️ {t.reportDelay}</button> : null}
                </div>
              )))}
            </ul>
          </div>
          <div className="staff-sim__grid">
            <div className="staff-sim__panel">
              <h2>💸 {t.refunds}</h2>
              <div className="staff-sim__job"><b>JC2F6L9M4T</b><p>{t.refundReason} · {money(35000)}</p>
                <div className="staff-sim__actions">{refund === "pending" ? <><button type="button" className="pf-btn pf-btn--coral" onClick={() => setRefund("approved")}>{t.approve}</button><button type="button" className="pf-btn pf-btn--ghost" onClick={() => setRefund("rejected")}>{t.reject}</button></> : <span className="pf-chip pf-chip--open">{refund === "approved" ? t.approved : t.rejected}</span>}</div>
              </div>
              <h2>⚠️ {t.incidents}</h2>
              <p className="sim-muted">{delayed ? `${delayed} · ${t.delayed}` : t.noIncidents}</p>
            </div>
            <div className="staff-sim__panel">
              <h2>💬 {t.support}</h2>
              <ul className="staff-sim__list">{t.tickets.map((ticket, index) => (
                <li key={ticket} className="staff-sim__job"><p>{ticket}</p><div className="staff-sim__actions">{tickets[index] ? <span className="pf-chip pf-chip--open">{t.replied}</span> : <button type="button" className="pf-btn pf-btn--ghost" onClick={() => setTickets((current) => current.map((done, i) => i === index ? true : done))}>{t.reply}</button>}</div></li>
              ))}</ul>
              <h2>🧾 {t.settlement}</h2>
              <div className="staff-sim__job"><b>{HOTELS[locale][0]}</b><p>{t.commission} 10% · {money(12000)}</p><div className="staff-sim__actions">{settled ? <span className="pf-chip pf-chip--open">{t.paidDone}</span> : <button type="button" className="pf-btn pf-btn--ghost" onClick={() => setSettled(true)}>{t.paid}</button>}</div></div>
            </div>
          </div>
        </>
      ) : null}
    </section>
  );
}
