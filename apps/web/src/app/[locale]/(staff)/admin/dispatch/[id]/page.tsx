import Link from "next/link";
import { ReturnStart } from "@/components/admin/return-start";
import { BagCorrection } from "@/components/admin/bag-correction";
import { StaffGate } from "@/components/staff-gate";
import { resolveLocale } from "@/lib/request-context";
import { getViewer } from "@/server/auth";
import { loadFieldJob } from "@/server/field";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function DispatchJobPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const locale = await resolveLocale(params);
  const { id } = await params;
  const viewer = await getViewer();
  const dispatcher = viewer.roles.some((role) => role.role === "dispatcher");
  const job = dispatcher && viewer.client && UUID.test(id) ? await loadFieldJob(viewer.client, id) : null;
  const [{ data: rows }, { data: events }] = job && viewer.client ? await Promise.all([
    viewer.client.from("bags").select("id, tag_id, seq, bag_status, version").eq("order_id", job.orderId),
    viewer.client.from("bag_events").select("id, bag_id, event_type, from_status, to_status, server_received_at, note").eq("job_id", job.id).order("server_received_at", { ascending: false }).limit(100),
  ]) : [{ data: [] }, { data: [] }];
  const correctionBags = (rows ?? []).map((row) => ({ id: row.id, tagId: row.tag_id, seq: row.seq, status: row.bag_status, version: row.version }));
  return <StaffGate locale={locale} area="admin"><main lang="ko" className="mx-auto flex max-w-3xl flex-col gap-5"><Link href={`/${locale}/admin/dispatch`} className="text-sm font-semibold text-primary">← 배차 현황</Link><header><span className="text-xs font-bold tracking-widest text-primary">FIELD CONTROL</span><h1 className="mt-2 text-2xl font-bold">짐별 작업 기록</h1></header>{!dispatcher ? <p className="rounded-xl border border-line bg-card p-5">배차 담당자 권한이 필요합니다.</p> : !job ? <p className="rounded-xl border border-line bg-card p-5">작업을 찾을 수 없습니다.</p> : <><div className="rounded-[var(--radius-card)] border border-line bg-card p-5"><strong>{job.orderCode ?? "작업"}</strong><p className="text-sm text-muted">{job.originHotel ?? "제주공항"} → {job.destinationHotel ?? "제주공항"}</p><ul className="mt-3 space-y-2 text-sm">{job.bags.map((bag) => <li key={bag.tagId} className="flex justify-between border-t border-line pt-2"><span>{bag.seq}번 · {bag.tagId}</span><span>{bag.status}</span></li>)}</ul></div><ReturnStart job={job} /><BagCorrection bags={correctionBags} events={events ?? []} /></>}</main></StaffGate>;
}
