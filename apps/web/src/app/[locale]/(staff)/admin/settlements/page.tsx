import { CreateSettlementForm, SettlementBatchActions } from "@/components/admin/settlement-actions";
import Link from "next/link";
import { StaffGate } from "@/components/staff-gate";
import { resolveLocale } from "@/lib/request-context";
import { getViewer } from "@/server/auth";
import { kstToday } from "@/server/field";

const STATUS_KO: Record<string, string> = {
  pending: "배송 전",
  eligible: "정산 대상",
  batched: "정산 중",
  paid: "지급 완료",
  reversed: "취소(미지급)",
  draft: "초안",
  confirmed: "확정",
};

const won = (amount: number) => `${amount.toLocaleString("ko-KR")}원`;

/** 호텔 제휴 정산 (재무). 적격 원장 → 초안 → 검토·확정 → 지급 기록. */
async function Settlements() {
  const viewer = await getViewer();
  const client = viewer.client!;
  const isFinance = viewer.roles.some((r) => r.role === "finance" || r.role === "admin");
  if (!isFinance) return <p lang="ko">재무 권한이 필요합니다.</p>;

  const [partners, commissions, batches] = await Promise.all([
    client.from("hotel_partners").select("id, name, status").order("name"),
    client.from("hotel_commissions").select("partner_id, kind, status, amount_minor"),
    client.from("settlement_batches").select("id, partner_id, period_start, period_end, status, total_minor, payout_reference, created_at").order("created_at", { ascending: false }).limit(30),
  ]);

  const monthStart = `${kstToday(0).slice(0, 8)}01`;
  const card = "rounded-[var(--radius-card)] border border-line bg-card p-4";
  return (
    <div className="flex flex-col gap-5" lang="ko">
      <h1 className="text-xl font-bold">호텔 제휴 정산</h1>
      {(partners.data ?? []).map((partner) => {
        const rows = (commissions.data ?? []).filter((c) => c.partner_id === partner.id);
        const sum = (status: string) => rows.filter((c) => c.status === status).reduce((s, c) => s + c.amount_minor, 0);
        const count = (status: string) => rows.filter((c) => c.status === status).length;
        return (
          <section key={partner.id} className={`${card} flex flex-col gap-3`} data-testid="settlement-partner">
            <h2 className="font-semibold">{partner.name}</h2>
            <dl className="grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
              {["pending", "eligible", "batched", "paid"].map((status) => (
                <div key={status}>
                  <dt className="text-muted">{STATUS_KO[status]}</dt>
                  <dd className="font-medium">
                    {count(status)}건 · {won(sum(status))}
                  </dd>
                </div>
              ))}
            </dl>
            <CreateSettlementForm partnerId={partner.id} defaultStart={monthStart} defaultEnd={kstToday(0)} />
            <ul className="flex flex-col gap-2 text-sm">
              {(batches.data ?? [])
                .filter((b) => b.partner_id === partner.id)
                .map((batch) => (
                  <li key={batch.id} className="flex flex-col gap-2 rounded-[var(--radius-button)] border border-line p-3 md:flex-row md:items-center md:justify-between">
                    <span>
                      {batch.period_start} ~ {batch.period_end} · {STATUS_KO[batch.status] ?? batch.status} · {won(batch.total_minor)}
                      {batch.payout_reference ? ` · 증빙 ${batch.payout_reference}` : ""}
                    </span>
                    <SettlementBatchActions batchId={batch.id} status={batch.status} />
                    <Link href={`/api/v1/settlements/${batch.id}/statement`} target="_blank" className="inline-flex min-h-10 items-center text-sm font-semibold text-primary underline">PDF 내역서 ↓</Link>
                  </li>
                ))}
            </ul>
          </section>
        );
      })}
      <p className="text-xs text-muted">
        수수료는 예약 확정 시 계약 규칙 스냅샷으로 계산되고 배송 완료 후 정산 대상이 됩니다. 지급 후 취소는 과거 기록을 수정하지 않고 다음 정산의 환수 항목으로
        반영됩니다.
      </p>
    </div>
  );
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const locale = await resolveLocale(params);
  return (
    <StaffGate locale={locale} area="admin">
      <Settlements />
    </StaffGate>
  );
}
