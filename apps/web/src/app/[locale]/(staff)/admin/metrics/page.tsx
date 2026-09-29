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
  const { data, error } = await viewer.client!.rpc("ops_metrics", { p_from: from, p_to: to, p_dimension: dimension });
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
