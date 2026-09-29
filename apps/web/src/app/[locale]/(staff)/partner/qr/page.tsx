import QRCode from "qrcode";
import { hotelScopes } from "@luggage/domain";
import { PrintButton } from "@/components/booking/print-button";
import { StaffGate } from "@/components/staff-gate";
import { getServerConfig } from "@/lib/env";
import { resolveLocale } from "@/lib/request-context";
import { getViewer } from "@/server/auth";
import { kstToday } from "@/server/field";

const COMMISSION_KO: Record<string, string> = {
  pending: "배송 전",
  eligible: "정산 대상",
  batched: "정산 중",
  paid: "지급 완료",
  reversed: "취소",
};

/**
 * 호텔 QR·인쇄 자료와 지점 실적 (08 문서 2절).
 * QR에는 공개 랜딩 URL과 제휴 코드만 담는다 (로그인·주문·정산 정보 없음).
 */
async function PartnerQr({ hotelParam }: { hotelParam: string | undefined }) {
  const viewer = await getViewer();
  const client = viewer.client!;
  const scopes = hotelScopes(viewer.roles);
  const { data: hotels } = await client.from("hotels").select("id, name_ko").order("name_ko");
  const allowed = (hotels ?? []).filter((h) => scopes === "all" || scopes.includes(h.id));
  const hotel = allowed.find((h) => h.id === hotelParam) ?? allowed[0];
  if (!hotel) return <p lang="ko">연결된 호텔 지점이 없습니다.</p>;

  const [{ data: codes }, { data: attributions }, { data: commissions }] = await Promise.all([
    client.from("partner_codes").select("code, status, valid_until").eq("hotel_id", hotel.id).eq("status", "active"),
    client.from("order_attributions").select("channel, created_at").eq("hotel_id", hotel.id),
    client.from("hotel_commissions").select("kind, status, amount_minor").eq("hotel_id", hotel.id),
  ]);
  const appUrl = getServerConfig().appUrl;
  const posters = await Promise.all(
    (codes ?? []).map(async (c) => {
      const url = `${appUrl}/zh-CN/h/${c.code}`;
      return { ...c, url, svg: await QRCode.toString(url, { type: "svg", margin: 2, errorCorrectionLevel: "M" }) };
    }),
  );
  const sum = (status: string) => (commissions ?? []).filter((c) => c.status === status).reduce((s, c) => s + c.amount_minor, 0);

  return (
    <div className="flex flex-col gap-5" lang="ko">
      <div className="flex items-center justify-between print:hidden">
        <h1 className="text-xl font-bold">{hotel.name_ko} · QR·실적</h1>
        <PrintButton label="인쇄" />
      </div>

      {posters.length === 0 ? <p className="print:hidden">활성 제휴 코드가 없습니다. 운영자에게 발급을 요청하세요.</p> : null}
      {posters.map((poster) => (
        <section key={poster.code} className="flex flex-col gap-4 rounded-[var(--radius-card)] border border-line bg-white p-5 text-black" data-testid="qr-poster">
          <div lang="zh-Hans" className="flex flex-col items-center gap-2 text-center">
            <p className="text-2xl font-bold">行李送机场 · 空手游济州</p>
            <p className="text-sm">扫码预约 · 无需韩国手机号 · 支持支付宝/微信支付</p>
            <div className="w-56" dangerouslySetInnerHTML={{ __html: poster.svg }} />
            <p className="font-mono text-sm">{poster.code}</p>
            <p className="text-xs text-slate-600">可预约时间、截止时间和机场取件地点以预约页面最新显示为准。</p>
          </div>
          <div className="border-t border-dashed border-slate-400 pt-3 text-sm">
            <p className="font-semibold">[프런트 직원용]</p>
            <p>고객이 QR로 예약하면 예약증(QR·예약번호)을 보여 줍니다. 업무 화면에서 짐 태그를 확인하고 보관 확정해 주세요.</p>
            <p className="text-xs text-slate-600">
              인쇄 자료 생성일 {kstToday(0)} · 요금·마감·공항 수령 장소는 예약 화면의 최신 운영 설정을 따릅니다.
            </p>
          </div>
        </section>
      ))}

      <section className="rounded-[var(--radius-card)] border border-line bg-card p-4 print:hidden">
        <h2 className="mb-2 font-semibold">지점 실적</h2>
        <dl className="grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
          <div>
            <dt className="text-muted">QR 유입 예약</dt>
            <dd className="font-medium">{(attributions ?? []).filter((a) => a.channel === "hotel_qr").length}건</dd>
          </div>
          {["eligible", "batched", "paid"].map((status) => (
            <div key={status}>
              <dt className="text-muted">수수료 {COMMISSION_KO[status]}</dt>
              <dd className="font-medium">{sum(status).toLocaleString("ko-KR")}원</dd>
            </div>
          ))}
        </dl>
        <p className="mt-2 text-xs text-muted">QR 유입 건수와 호텔이 실제 인계한 건수는 별개입니다. 예약 표본이 적을 때는 비율보다 건수를 보세요.</p>
      </section>
    </div>
  );
}

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ hotel?: string }>;
}) {
  const locale = await resolveLocale(params);
  const { hotel } = await searchParams;
  return (
    <StaffGate locale={locale} area="partner">
      <PartnerQr hotelParam={hotel} />
    </StaffGate>
  );
}
