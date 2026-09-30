import { StaffGate } from "@/components/staff-gate";
import { resolveLocale } from "@/lib/request-context";
import { getViewer } from "@/server/auth";
import { kstToday } from "@/server/field";

const DIMENSIONS: Record<string, string> = {
  overall: "전체",
  locale: "언어",
  route_type: "노선",
  hotel: "호텔",
  channel: "유입 채널",
  campaign: "캠페인",
};

interface MetricRow {
  dimension_value: string;
  landing_views: number;
  quotes: number;
  orders_held: number;
  payments_confirmed: number;
  cancellations: number;
  bags_collected: number;
  bags_collected_on_time: number;
  handoff_ready: number;
  handoff_ready_on_time: number;
  bags_delivered: number;
  bags_delivered_on_time: number;
  support_created: number;
}

/** 표본이 작으면 비율 대신 건수만 보여 준다 (08 문서 6절). 항상 분모를 함께 표시한다. */
const MIN_SAMPLE = 20;

function Ratio({ numerator, denominator }: { numerator: number; denominator: number }) {
  if (denominator === 0) return <span className="text-muted">—</span>;
  const ratio = denominator >= MIN_SAMPLE ? ` (${Math.round((numerator / denominator) * 100)}%)` : "";
  return (
    <span>
      {numerator}/{denominator}
      {ratio}
    </span>
  );
}

async function Metrics({ from, to, dimension }: { from: string; to: string; dimension: string }) {
  const viewer = await getViewer();
  const [main, quality, notifications] = await Promise.all([
    viewer.client!.rpc("ops_metrics", { p_from: from, p_to: to, p_dimension: dimension }),
    viewer.client!.rpc("ops_field_quality", { p_from: from, p_to: to }),
    viewer.client!.rpc("ops_notification_failures", { p_from: from, p_to: to }),
  ]);
  const { data, error } = main;
  const rows = ((data ?? []) as MetricRow[]).map((row) =>
    Object.fromEntries(Object.entries(row).map(([k, v]) => [k, k === "dimension_value" ? v : Number(v)])),
  ) as unknown as MetricRow[];

  return (
    <div className="flex flex-col gap-4" lang="ko">
      <h1 className="text-xl font-bold">운영 지표</h1>
      <form className="flex flex-wrap items-end gap-2 text-sm">
        <label className="flex flex-col">
          시작
          <input type="date" name="from" defaultValue={from} className="min-h-11 rounded-[var(--radius-button)] border border-line bg-card px-2" />
        </label>
        <label className="flex flex-col">
          종료
          <input type="date" name="to" defaultValue={to} className="min-h-11 rounded-[var(--radius-button)] border border-line bg-card px-2" />
        </label>
        <label className="flex flex-col">
          기준
          <select name="dimension" defaultValue={dimension} className="min-h-11 rounded-[var(--radius-button)] border border-line bg-card px-2">
            {Object.entries(DIMENSIONS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <button className="min-h-11 rounded-[var(--radius-button)] border border-line px-3">조회</button>
      </form>
      <p className="text-xs text-muted">
        기간 {from} ~ {to} (한국 날짜). 비율은 “분자/분모”로 표시하며 분모가 {MIN_SAMPLE}건 미만이면 비율을 생략합니다. 결제·인계 수치는 서버 기록 기준입니다.
      </p>
      {error ? <p role="alert">지표를 불러오지 못했습니다. 운영·재무 권한이 필요합니다.</p> : null}
      <div className="overflow-x-auto rounded-[var(--radius-card)] border border-line bg-card">
        <table className="w-full min-w-[900px] text-left text-sm" data-testid="metrics-table">
          <thead className="border-b border-line text-xs text-muted">
            <tr>
              <th className="p-2">{DIMENSIONS[dimension]}</th>
              <th className="p-2">조회</th>
              <th className="p-2">견적</th>
              <th className="p-2">주문(홀드)</th>
              <th className="p-2">결제 확정 / 주문</th>
              <th className="p-2">취소</th>
              <th className="p-2">수거 정시</th>
              <th className="p-2">인계 준비 정시</th>
              <th className="p-2">실제 인계 정시</th>
              <th className="p-2">문의</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td className="p-2 text-muted" colSpan={10}>
                  기간 내 기록이 없습니다.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.dimension_value} className="border-b border-line last:border-0">
                  <td className="p-2 font-medium">{row.dimension_value}</td>
                  <td className="p-2">{row.landing_views}</td>
                  <td className="p-2">{row.quotes}</td>
                  <td className="p-2">{row.orders_held}</td>
                  <td className="p-2">
                    <Ratio numerator={row.payments_confirmed} denominator={row.orders_held} />
                  </td>
                  <td className="p-2">{row.cancellations}</td>
                  <td className="p-2">
                    <Ratio numerator={row.bags_collected_on_time} denominator={row.bags_collected} />
                  </td>
                  <td className="p-2">
                    <Ratio numerator={row.handoff_ready_on_time} denominator={row.handoff_ready} />
                  </td>
                  <td className="p-2">
                    <Ratio numerator={row.bags_delivered_on_time} denominator={row.bags_delivered} />
                  </td>
                  <td className="p-2">{row.support_created}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <section className="grid gap-4 lg:grid-cols-2">
        <div className="overflow-x-auto rounded-[var(--radius-card)] border border-line bg-card p-4"><h2 className="text-lg font-bold">현장 누락·사진 증빙</h2><p className="mt-1 text-xs text-muted">수거 창이 지난 짐 중 수거 기록이 없는 건수와 수거 시 사진 증빙이 있는 건수를 표시합니다. 기사 기준은 현재 배정 기준입니다.</p>{quality.error ? <p role="alert" className="mt-3 text-sm">최대 93일 범위에서만 현장 품질을 조회할 수 있습니다.</p> : <table className="mt-3 w-full min-w-[480px] text-left text-sm"><thead><tr><th className="p-2">기준</th><th className="p-2">짐</th><th className="p-2">미수거</th><th className="p-2">사진/수거</th></tr></thead><tbody>{((quality.data ?? []) as { dimension: string; subject: string; total_bags: number; missing_after_cutoff: number; collected_with_evidence: number; collected_total: number }[]).map((row) => <tr key={`${row.dimension}-${row.subject}`} className="border-t border-line"><td className="p-2">{row.dimension === "driver" ? "기사" : "숙소"} · {row.subject}</td><td className="p-2">{row.total_bags}</td><td className="p-2">{row.missing_after_cutoff}</td><td className="p-2"><Ratio numerator={Number(row.collected_with_evidence)} denominator={Number(row.collected_total)} /></td></tr>)}</tbody></table>}</div>
        <div className="rounded-[var(--radius-card)] border border-line bg-card p-4"><h2 className="text-lg font-bold">알림 처리 상태</h2><p className="mt-1 text-xs text-muted">선택 기간의 처리 불가 이벤트와 1시간 넘게 대기 중인 이벤트, 현재 푸시 전송 오류가 있는 구독입니다.</p>{notifications.error ? <p role="alert" className="mt-3 text-sm">알림 지표를 조회할 수 없습니다.</p> : <div className="mt-4 grid grid-cols-3 gap-2 text-center">{(() => { const row = (notifications.data ?? [])[0] as { dead_events: number; pending_over_hour: number; push_subscriptions_failing: number } | undefined; return [["처리 불가", row?.dead_events ?? 0], ["지연 대기", row?.pending_over_hour ?? 0], ["푸시 오류", row?.push_subscriptions_failing ?? 0]].map(([label, value]) => <div key={String(label)} className="rounded-xl bg-sea p-3"><strong className="block text-xl">{value}</strong><span className="text-xs text-muted">{label}</span></div>); })()}</div>}</div>
      </section>
      <p className="text-xs text-muted">
        호텔 QR 유입(채널 hotel_qr)과 호텔이 실제 인계한 건수는 다른 지표입니다. 중국망 접속 품질은 실측 전까지 미검증입니다.
      </p>
    </div>
  );
}

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ from?: string; to?: string; dimension?: string }>;
}) {
  const locale = await resolveLocale(params);
  const query = await searchParams;
  const valid = (d: string | undefined) => (d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : undefined);
  const to = valid(query.to) ?? kstToday(0);
  const from = valid(query.from) ?? kstToday(-6);
  const dimension = query.dimension && query.dimension in DIMENSIONS ? query.dimension : "overall";
  return (
    <StaffGate locale={locale} area="admin">
      <Metrics from={from} to={to} dimension={dimension} />
    </StaffGate>
  );
}
