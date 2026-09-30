import { ContentManager, type ManagedContent } from "@/components/admin/content-manager";
import { StaffGate } from "@/components/staff-gate";
import { resolveLocale } from "@/lib/request-context";
import { getViewer } from "@/server/auth";

async function ContentAdmin() {
  const viewer = await getViewer();
  const isAdmin = viewer.roles.some((role) => role.role === "admin");
  const { data, error } = isAdmin && viewer.client
    ? await viewer.client.from("content_items").select("id, slug, kind, criticality, source_locale, source_version, content_translations(locale, title, body, status, needs_review, based_on_version)").order("sort_order").order("slug")
    : { data: [], error: null };
  return <section className="admin-dashboard" lang="ko">
    <div className="admin-dashboard__intro"><div><span>CONTENT / OPERATIONS</span><h1>콘텐츠·예약 안내</h1><p>언어별 원문·번역을 검토하고 게시합니다. 예약 필수 안내는 고객 언어별 게시본만 사용합니다.</p></div></div>
    {!isAdmin ? <p className="rounded-[var(--radius-card)] border border-line bg-card p-5">관리자 권한이 필요합니다.</p> : error ? <p role="alert">콘텐츠를 불러오지 못했습니다.</p> : <ContentManager items={data as ManagedContent[]} />}
  </section>;
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const locale = await resolveLocale(params);
  return <StaffGate locale={locale} area="admin"><ContentAdmin /></StaffGate>;
}
