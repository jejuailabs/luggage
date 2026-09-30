"use client";

import { RealMap } from "@/components/account/real-map";

export function DriverLocationMap({ points, observedAt }: { points: { latitude: number; longitude: number }[]; observedAt: string }) {
  const current = points.at(-1);
  if (!current) return null;
  return <section className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-card"><div className="p-4"><h2 className="font-bold">차량 위치·이동 기록</h2><p className="text-sm text-muted">최근 기록을 지도에 연결했습니다. 도로 안내 경로나 수하물 자체 GPS가 아닙니다.</p><p className="text-xs text-muted">마지막 수신 {new Date(observedAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })} KST</p></div><RealMap demo={false} location={current} trail={points} progress={0} labels={{ pickup: "", airport: "", demo: "", live: "차량 위치 기록", unavailable: "지도 타일을 불러오지 못했습니다." }} /></section>;
}
