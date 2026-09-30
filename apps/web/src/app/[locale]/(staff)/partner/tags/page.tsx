import Link from "next/link";
import QRCode from "qrcode";
import { hotelScopes } from "@luggage/domain";
import { PrintButton } from "@/components/booking/print-button";
import { ReissueTag } from "@/components/field/reissue-tag";
import { StaffGate } from "@/components/staff-gate";
import { resolveLocale } from "@/lib/request-context";
import { getViewer } from "@/server/auth";
import { kstToday } from "@/server/field";

async function TagSheets({ locale, hotelParam }: { locale: string; hotelParam?: string }) {
  const viewer = await getViewer();
  const client = viewer.client!;
  const scopes = hotelScopes(viewer.roles);
  const { data: hotels } = await client.from("hotels").select("id, name_ko").order("name_ko");
  const allowed = (hotels ?? []).filter((hotel) => scopes === "all" || scopes.includes(hotel.id));
  const hotel = allowed.find((row) => row.id === hotelParam) ?? allowed[0];
  if (!hotel) return <p>연결된 호텔 지점이 없습니다.</p>;
  const { data: jobs } = await client.rpc("partner_jobs", { p_hotel_id: hotel.id, p_from: kstToday(0), p_to: kstToday(1) });
  const pickup = (jobs ?? []).filter((row: { direction: string }) => row.direction === "pickup") as { job_id: string; order_code: string }[];
  const { data: jobOrders } = pickup.length ? await client.from("delivery_jobs").select("id, order_id").in("id", pickup.map((row) => row.job_id)) : { data: [] as { id: string; order_id: string }[] };
  const orderIds = (jobOrders ?? []).map((row) => row.order_id);
  const { data: bags } = orderIds.length ? await client.from("bags").select("id, order_id, tag_id, seq, size, bag_status").in("order_id", orderIds).order("seq") : { data: [] as { id: string; order_id: string; tag_id: string; seq: number; size: string; bag_status: string }[] };
  const labels = await Promise.all((bags ?? []).filter((bag) => bag.bag_status !== "cancelled_before_pickup").map(async (bag) => {
    const job = pickup.find((row) => jobOrders?.find((entry) => entry.id === row.job_id)?.order_id === bag.order_id);
    return { ...bag, orderCode: job?.order_code ?? "", svg: await QRCode.toString(bag.tag_id, { type: "svg", margin: 1, errorCorrectionLevel: "M" }) };
  }));
  return <section lang="ko" className="tag-print-page grid gap-5"><div className="no-print flex flex-wrap items-center justify-between gap-3"><div><span className="text-xs font-bold tracking-widest text-primary">BAG ID / LABELS</span><h1 className="text-2xl font-bold">짐 태그 라벨 · {hotel.name_ko}</h1><p className="text-sm text-muted">짐 하나당 라벨 하나를 붙이고 인계할 때 QR을 확인하세요. QR에는 무작위 태그 ID만 들어갑니다.</p></div><div className="flex gap-2"><Link href={`/${locale}/partner?hotel=${hotel.id}`} className="rounded-lg border border-line px-4 py-3 text-sm">호텔 업무로</Link><PrintButton label="라벨 인쇄" /></div></div>{labels.length === 0 ? <p className="rounded-[var(--radius-card)] border border-line bg-card p-5">오늘·내일 수거 대상 짐이 없습니다.</p> : <div className="tag-print-grid grid gap-3 sm:grid-cols-2">{labels.map((bag) => <article key={bag.id} className="tag-label rounded-[var(--radius-card)] border border-line bg-white p-5 text-slate-950"><div className="flex items-start justify-between gap-3"><div><span className="text-xs font-bold tracking-widest">JEJU CONNECT · BAG TAG</span><h2 className="mt-2 font-mono text-2xl font-bold tracking-widest">{bag.tag_id}</h2><p className="text-sm">예약 {bag.orderCode} · {bag.seq}번 짐 · {bag.size === "large" ? "대형" : "보통"}</p></div><div className="h-28 w-28 shrink-0" dangerouslySetInnerHTML={{ __html: bag.svg }} /></div><p className="mt-3 border-t border-slate-300 pt-2 text-xs">인계 시 QR 스캔 · 고객 연락처는 QR에 포함되지 않습니다.</p>{["registered", "at_origin"].includes(bag.bag_status) ? <ReissueTag bagId={bag.id} /> : null}</article>)}</div>}</section>;
}

export default async function Page({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ hotel?: string }> }) {
  const locale = await resolveLocale(params);
  const { hotel } = await searchParams;
  return <StaffGate locale={locale} area="partner"><TagSheets locale={locale} hotelParam={hotel} /></StaffGate>;
}
