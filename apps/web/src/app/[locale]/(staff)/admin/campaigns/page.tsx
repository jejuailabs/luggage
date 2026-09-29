import { CampaignForm } from "@/components/admin/campaign-form";
import { StaffGate } from "@/components/staff-gate";
import { getServerConfig } from "@/lib/env";
import { resolveLocale } from "@/lib/request-context";
import { getViewer } from "@/server/auth";

/**
 * 캠페인 기록과 결과 (08 문서 4절). 조회수가 아니라 예약·결제 확정까지 연결해 본다.
 * 귀속이 없는 주문은 ‘알 수 없음’으로 남는다.
 */
async function Campaigns() {
  const viewer = await getViewer();
  const client = viewer.client!;
  const canEdit = viewer.roles.some((r) => r.role === "content_editor" || r.role === "admin");
  const [{ data: campaigns }, { data: attributions }] = await Promise.all([
    client.from("marketing_campaigns").select("id, code, channel, name, post_url, published_on, landing_path").order("created_at", { ascending: false }),
    client.from("order_attributions").select("campaign_code, order:orders(reservation_status)"),
  ]);
  const appUrl = getServerConfig().appUrl;
  const stats = (code: string) => {
    const rows = ((attributions ?? []) as unknown as { campaign_code: string | null; order: { reservation_status: string } | null }[]).filter(
      (a) => a.campaign_code === code,
    );
    return { orders: rows.length, confirmed: rows.filter((r) => r.order?.reservation_status === "confirmed").length };
  };

  return (
    <div className="flex flex-col gap-5" lang="ko">
      <h1 className="text-xl font-bold">유입 캠페인</h1>
      <ul className="flex flex-col gap-3">
        {(campaigns ?? []).map((c) => {
          const s = stats(c.code);
          return (
            <li key={c.id} className="rounded-[var(--radius-card)] border border-line bg-card p-4 text-sm" data-testid="campaign">
              <p className="font-semibold">
                {c.name} <span className="font-mono text-xs text-muted">({c.code})</span>
              </p>
              <p className="text-muted">
                {c.channel} · {c.published_on ?? "게시일 미입력"} · 예약 {s.orders}건 / 결제 확정 {s.confirmed}건
              </p>
              <p className="break-all font-mono text-xs">
                {appUrl}
                {c.landing_path}?cid={c.code}&ch={c.channel}
              </p>
              {c.post_url ? (
                <a href={c.post_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline">
                  게시물
                </a>
              ) : null}
            </li>
          );
        })}
      </ul>
      {canEdit ? (
        <div className="rounded-[var(--radius-card)] border border-line bg-card p-4">
          <CampaignForm />
        </div>
      ) : null}
    </div>
  );
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const locale = await resolveLocale(params);
  return (
    <StaffGate locale={locale} area="admin">
      <Campaigns />
    </StaffGate>
  );
}
