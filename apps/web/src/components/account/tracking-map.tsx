"use client";

import { useEffect, useState } from "react";
import type { Locale } from "@luggage/i18n";

type Location = { latitude: number; longitude: number; observedAt: string; stale: boolean };

const translations = {
  ko: { title: "내 짐 현재 위치", demo: "GPS 이동 시연", live: "배송 차량 최근 위치", disclaimer: "실제 위치는 기사 또는 차량 단말이 전송한 최근 기록입니다. 짐 자체에 GPS가 달린 것은 아닙니다.", demoDisclaimer: "시연용 경로입니다. 실제 주문·차량의 위치를 나타내지 않습니다.", play: "재생", pause: "일시 정지", restart: "처음부터", pickup: "수거", airport: "공항 수령", current: "최근 확인 지점", updated: "최근 확인", stale: "위치 업데이트 지연", kst: "한국 시간", step1: "숙소에서 인계", step2: "제주 시내 이동", step3: "공항 인계 준비" },
  "zh-CN": { title: "我的行李位置", demo: "GPS 路线演示", live: "配送车辆最近位置", disclaimer: "实际位置为司机或车辆设备最后上传的位置，行李本身没有 GPS。", demoDisclaimer: "这是路线演示，不代表真实订单或车辆位置。", play: "播放", pause: "暂停", restart: "重新开始", pickup: "取件", airport: "机场交付", current: "最近记录位置", updated: "最近更新", stale: "位置更新延迟", kst: "韩国时间", step1: "住宿交接", step2: "穿过济州市区", step3: "准备机场交付" },
  en: { title: "Where are my bags?", demo: "GPS route demo", live: "Latest delivery vehicle position", disclaimer: "The actual position is the last report from the driver or vehicle. Bags do not have their own GPS.", demoDisclaimer: "This is a route demonstration, not the position of a real order or vehicle.", play: "Play", pause: "Pause", restart: "Restart", pickup: "Pickup", airport: "Airport handover", current: "Last reported point", updated: "Last update", stale: "Position update delayed", kst: "Korea time", step1: "Handover at stay", step2: "Travelling across Jeju", step3: "Preparing airport handover" },
} as const;

const route = [{ x: 390, y: 292 }, { x: 365, y: 247 }, { x: 310, y: 213 }, { x: 264, y: 177 }, { x: 220, y: 153 }, { x: 167, y: 132 }];

function position(progress: number) {
  const segment = Math.min(route.length - 2, Math.floor(progress * (route.length - 1)));
  const part = Math.min(1, progress * (route.length - 1) - segment);
  return { x: route[segment]!.x + (route[segment + 1]!.x - route[segment]!.x) * part, y: route[segment]!.y + (route[segment + 1]!.y - route[segment]!.y) * part };
}

function projectedLocation(location: Location) {
  // 제주 지도 영역을 대략 투영한다. 정밀 도로 안내용 좌표가 아니다.
  const x = 90 + ((location.longitude - 126.14) / 0.88) * 580;
  const y = 335 - ((location.latitude - 33.1) / 0.53) * 250;
  return { x: Math.max(90, Math.min(670, x)), y: Math.max(85, Math.min(335, y)) };
}

export function TrackingMap({ locale, location, demo = false }: { locale: Locale; location?: Location | null; demo?: boolean }) {
  const t = translations[locale];
  const [playing, setPlaying] = useState(true);
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    if (!demo || !playing) return;
    const timer = window.setInterval(() => setProgress((value) => value >= 1 ? 0 : Math.min(1, value + 0.004)), 80);
    return () => window.clearInterval(timer);
  }, [demo, playing]);
  const marker = demo ? position(progress) : location ? projectedLocation(location) : null;
  const step = progress < 0.32 ? t.step1 : progress < 0.75 ? t.step2 : t.step3;
  const date = location ? new Intl.DateTimeFormat(locale === "zh-CN" ? "zh-CN" : locale, { timeZone: "Asia/Seoul", dateStyle: "medium", timeStyle: "short" }).format(new Date(location.observedAt)) : "";
  const bbox = location ? [location.longitude - 0.015, location.latitude - 0.008, location.longitude + 0.015, location.latitude + 0.008].join(",") : "";
  const liveMapUrl = location ? `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${encodeURIComponent(`${location.latitude},${location.longitude}`)}` : "";

  return <section className="tracking-map" data-testid="tracking-map" data-mode={demo ? "demo" : "live"}>
    <div className="tracking-map__heading"><div><span className="landing-kicker">LIVE JOURNEY</span><h2>{t.title}</h2></div><span className={`tracking-map__badge ${demo ? "tracking-map__badge--demo" : ""}`}>{demo ? t.demo : t.live}</span></div>
    <div className="tracking-map__canvas">
      {!demo && location ? <iframe title={t.live} src={liveMapUrl} className="tracking-map__live-frame" loading="lazy" referrerPolicy="no-referrer" /> : <svg viewBox="0 0 760 420" role="img" aria-label={demo ? t.demo : t.live}>
        <defs><linearGradient id="track-sea" x1="0" x2="1" y1="0" y2="1"><stop stopColor="#dcebe7" /><stop offset="1" stopColor="#b7d4d0" /></linearGradient><linearGradient id="track-land" x1="0" x2="1" y1="0" y2="1"><stop stopColor="#e5e5ca" /><stop offset="1" stopColor="#b8cda9" /></linearGradient><pattern id="track-grid" width="36" height="36" patternUnits="userSpaceOnUse"><path d="M36 0H0V36" fill="none" stroke="#fff" strokeOpacity=".18" /></pattern></defs>
        <rect width="760" height="420" fill="url(#track-sea)" /><rect width="760" height="420" fill="url(#track-grid)" />
        <path d="M83 230 C94 190 120 153 156 132 C210 98 290 86 345 91 C410 75 489 100 548 129 C615 141 677 175 686 217 C686 253 645 291 592 308 C536 335 469 326 415 340 C348 356 268 343 211 322 C152 311 103 278 83 230Z" fill="url(#track-land)" stroke="#fff" strokeWidth="8" />
        <path d="M132 231 C216 160 314 128 416 139 C512 145 593 196 642 231 M201 287 C281 231 382 198 512 211 M335 103 C338 173 388 240 469 321" fill="none" stroke="#f8f6e9" strokeWidth="8" strokeLinecap="round" strokeOpacity=".95" />
        <path d="M132 231 C216 160 314 128 416 139 C512 145 593 196 642 231 M201 287 C281 231 382 198 512 211" fill="none" stroke="#a3b29e" strokeWidth="1" strokeDasharray="8 8" />
        {demo ? <><path d="M390 292 C365 247 310 213 264 177 C220 153 167 132" fill="none" stroke="#fff" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" /><path d="M390 292 C365 247 310 213 264 177 C220 153 167 132" fill="none" stroke="#1b6859" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray={`${progress * 400} 400`} /><circle cx="390" cy="292" r="10" fill="#fff" stroke="#1b6859" strokeWidth="4" /><circle cx="167" cy="132" r="10" fill="#fff" stroke="#1b6859" strokeWidth="4" /><text x="407" y="315" className="tracking-map__label">{t.pickup}</text><text x="102" y="109" className="tracking-map__label">{t.airport}</text></> : null}
        <text x="481" y="177" className="tracking-map__city">JEJU</text><text x="276" y="280" className="tracking-map__city">SEOGWIPO</text>
        {marker ? <g transform={`translate(${marker.x} ${marker.y})`} data-testid="tracking-marker"><circle r="25" fill="#145340" fillOpacity=".16" /><circle r="13" fill="#fff" /><circle r="8" fill="#145340" /><circle r="3" fill="#fff" /></g> : null}
      </svg>}
      <span className="tracking-map__watermark">{demo ? t.demo : t.live}</span>
    </div>
    <div className="tracking-map__footer">
      <div><strong>{demo ? step : location ? t.current : t.stale}</strong><p>{demo ? t.demoDisclaimer : `${location?.stale ? t.stale : t.updated} · ${date} (${t.kst})`}</p></div>
      {demo ? <div className="tracking-map__controls"><button type="button" onClick={() => setPlaying((value) => !value)}>{playing ? t.pause : t.play}</button><button type="button" onClick={() => { setProgress(0); setPlaying(true); }}>{t.restart}</button></div> : null}
    </div>
    {demo ? <input type="range" min="0" max="1" step="0.001" value={progress} onChange={(event) => { setProgress(Number(event.target.value)); setPlaying(false); }} aria-label={t.demo} /> : null}
    <p className="tracking-map__disclaimer">{demo ? t.demoDisclaimer : <>{t.disclaimer} · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap contributors</a></>}</p>
  </section>;
}
