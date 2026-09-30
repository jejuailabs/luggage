import Link from "next/link";
import { hotelScopes } from "@luggage/domain";
import { PartnerConsole, type PartnerJob } from "@/components/field/partner-console";
import { StaffGate } from "@/components/staff-gate";
import { resolveLocale } from "@/lib/request-context";
import { getViewer } from "@/server/auth";
import { kstDate, kstTime, kstToday } from "@/server/field";

interface PartnerJobRow {
  job_id: string;
  direction: "pickup" | "dropoff";
  order_code: string;
  customer_name: string | null;
  window_starts_at: string;
  window_ends_at: string;
}

async function PartnerDesk({ locale, hotelParam }: { locale: string; hotelParam: string | undefined }) {
  const viewer = await getViewer();
  const client = viewer.client!;
  const scopes = hotelScopes(viewer.roles);
  // admin은 전체 호텔을 볼 수 있지만 현장 화면은 지점 하나씩 다룬다.
  const { data: hotels } = await client.from("hotels").select("id, name_ko").order("name_ko");
  const allowed = (hotels ?? []).filter((h) => scopes === "all" || scopes.includes(h.id));
  const hotel = allowed.find((h) => h.id === hotelParam) ?? allowed[0];

  if (!hotel) return <p lang="ko">연결된 호텔 지점이 없습니다. 운영자에게 문의하세요.</p>;

  const { data: rows } = await client.rpc("partner_jobs", { p_hotel_id: hotel.id, p_from: kstToday(0), p_to: kstToday(1) });
  const jobRows = (rows ?? []) as PartnerJobRow[];
  const jobIds = jobRows.map((r) => r.job_id);
  const { data: jobOrders } = jobIds.length
    ? await client.from("delivery_jobs").select("id, order_id").in("id", jobIds)
    : { data: [] as { id: string; order_id: string }[] };
  const orderIds = (jobOrders ?? []).map((j) => j.order_id);
  const { data: bags } = orderIds.length
    ? await client.from("bags").select("order_id, tag_id, seq, size, bag_status, version").in("order_id", orderIds).order("seq")
    : { data: [] as { order_id: string; tag_id: string; seq: number; size: string; bag_status: string; version: number }[] };

  const jobs: PartnerJob[] = jobRows.map((row) => {
    const orderId = jobOrders?.find((j) => j.id === row.job_id)?.order_id;
    return {
      jobId: row.job_id,
      direction: row.direction,
      orderCode: row.order_code,
      customerName: row.customer_name,
      window: `${kstDate(row.window_starts_at)} ${kstTime(row.window_starts_at)}–${kstTime(row.window_ends_at)}`,
      bags: (bags ?? [])
        .filter((b) => b.order_id === orderId && b.bag_status !== "cancelled_before_pickup")
        .map((b) => ({ tagId: b.tag_id, seq: b.seq, size: b.size, status: b.bag_status, version: b.version })),
    };
  });

  return (
    <div className="flex flex-col gap-4" lang="ko">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold">{hotel.name_ko} · 짐 보관</h1>
        <Link href={`/${locale}/partner/qr?hotel=${hotel.id}`} className="inline-flex min-h-11 items-center text-sm text-primary underline">
          QR·실적
        </Link>
        <Link href={`/${locale}/partner/tags?hotel=${hotel.id}`} className="inline-flex min-h-11 items-center text-sm text-primary underline">짐 태그 인쇄</Link>
      </div>
      {allowed.length > 1 ? (
        <nav className="flex flex-wrap gap-2 text-sm" aria-label="지점 선택">
          {allowed.map((h) => (
            <Link
              key={h.id}
              href={`/${locale}/partner?hotel=${h.id}`}
              aria-current={h.id === hotel.id ? "page" : undefined}
              className="inline-flex min-h-11 items-center rounded-[var(--radius-button)] border border-line px-3 aria-[current=page]:border-primary"
            >
              {h.name_ko}
            </Link>
          ))}
        </nav>
      ) : null}
      <PartnerConsole jobs={jobs} />
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
      <PartnerDesk locale={locale} hotelParam={hotel} />
    </StaffGate>
  );
}
