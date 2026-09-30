"use client";

import { useEffect, useState } from "react";
import type { Locale } from "@luggage/i18n";
import { RealMap } from "./real-map";

type Location = { latitude: number; longitude: number; observedAt: string; stale: boolean };

const translations = {
  ko: { title: "내 짐 현재 위치", demo: "GPS 이동 시연", live: "배송 차량 최근 위치", disclaimer: "실제 위치는 기사 또는 차량 단말이 전송한 최근 기록입니다. 짐 자체에 GPS가 달린 것은 아닙니다.", demoDisclaimer: "실제 제주 지도 위의 시연용 경로입니다. 실제 주문·차량 위치나 확정된 운행 경로가 아닙니다.", play: "재생", pause: "일시 정지", restart: "처음부터", pickup: "수거", airport: "공항 수령", current: "최근 확인 지점", updated: "최근 확인", stale: "위치 업데이트 지연", kst: "한국 시간", step1: "숙소에서 인계", step2: "제주 시내 이동", step3: "공항 인계 준비", unavailable: "지도를 불러오지 못했습니다. 연결을 확인해 주세요." },
  "zh-CN": { title: "我的行李位置", demo: "GPS 路线演示", live: "配送车辆最近位置", disclaimer: "实际位置为司机或车辆设备最后上传的位置，行李本身没有 GPS。", demoDisclaimer: "这是真实济州地图上的路线演示，不代表真实订单、车辆位置或确定的行驶路线。", play: "播放", pause: "暂停", restart: "重新开始", pickup: "取件", airport: "机场交付", current: "最近记录位置", updated: "最近更新", stale: "位置更新延迟", kst: "韩国时间", step1: "住宿交接", step2: "穿过济州市区", step3: "准备机场交付", unavailable: "地图暂时无法加载，请检查网络连接。" },
  en: { title: "Where are my bags?", demo: "GPS route demo", live: "Latest delivery vehicle position", disclaimer: "The actual position is the last report from the driver or vehicle. Bags do not have their own GPS.", demoDisclaimer: "A sample route on a real Jeju map. This is not a real order, vehicle position, or confirmed driving route.", play: "Play", pause: "Pause", restart: "Restart", pickup: "Pickup", airport: "Airport handover", current: "Last reported point", updated: "Last update", stale: "Position update delayed", kst: "Korea time", step1: "Handover at stay", step2: "Travelling across Jeju", step3: "Preparing airport handover", unavailable: "Map tiles could not load. Check your connection." },
} as const;

export function TrackingMap({ locale, location, demo = false }: { locale: Locale; location?: Location | null; demo?: boolean }) {
  const t = translations[locale];
  const [playing, setPlaying] = useState(true);
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    if (!demo || !playing) return;
    const timer = window.setInterval(() => setProgress((value) => value >= 1 ? 0 : Math.min(1, value + 0.004)), 80);
    return () => window.clearInterval(timer);
  }, [demo, playing]);
  const step = progress < 0.32 ? t.step1 : progress < 0.75 ? t.step2 : t.step3;
  const date = location ? new Intl.DateTimeFormat(locale === "zh-CN" ? "zh-CN" : locale, { timeZone: "Asia/Seoul", dateStyle: "medium", timeStyle: "short" }).format(new Date(location.observedAt)) : "";

  return <section className="tracking-map" data-testid="tracking-map" data-mode={demo ? "demo" : "live"}>
    <div className="tracking-map__heading"><div><span className="landing-kicker">LIVE JOURNEY</span><h2>{t.title}</h2></div><span className={`tracking-map__badge ${demo ? "tracking-map__badge--demo" : ""}`}>{demo ? t.demo : t.live}</span></div>
    <div className="tracking-map__canvas"><RealMap demo={demo} location={location} progress={progress} labels={t} /></div>
    <div className="tracking-map__footer">
      <div><strong>{demo ? step : location ? t.current : t.stale}</strong><p>{demo ? t.demoDisclaimer : `${location?.stale ? t.stale : t.updated} · ${date} (${t.kst})`}</p></div>
      {demo ? <div className="tracking-map__controls"><button type="button" onClick={() => setPlaying((value) => !value)}>{playing ? t.pause : t.play}</button><button type="button" onClick={() => { setProgress(0); setPlaying(true); }}>{t.restart}</button></div> : null}
    </div>
    {demo ? <input type="range" min="0" max="1" step="0.001" value={progress} onChange={(event) => { setProgress(Number(event.target.value)); setPlaying(false); }} aria-label={t.demo} /> : null}
    <p className="tracking-map__disclaimer">{demo ? t.demoDisclaimer : t.disclaimer}</p>
  </section>;
}
