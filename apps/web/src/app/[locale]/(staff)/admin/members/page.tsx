import { StaffGate } from "@/components/staff-gate";
import { MemberRoleEditor } from "@/components/admin/member-role-editor";
import { resolveLocale } from "@/lib/request-context";
import { getViewer } from "@/server/auth";

type Member = { user_id: string; email: string | null; display_name: string | null; created_at: string; order_count: number; roles: { role: string; scope_id: string | null }[] };
export default async function AdminMembers({ params }: { params: Promise<{ locale: string }> }) {
  const locale = await resolveLocale(params);
  const viewer = await getViewer();
  const permitted = viewer.roles.some((role) => role.role === "admin");
  const [{ data: members, error }, { data: hotels }] = permitted && viewer.client ? await Promise.all([viewer.client.rpc("admin_list_members"), viewer.client.from("hotels").select("id, name_ko").order("name_ko")]) : [{ data: [], error: null }, { data: [] }];
  return <StaffGate locale={locale} area="admin"><section className="admin-data-page"><header><span>PEOPLE & ACCESS</span><h1>회원·권한 관리</h1><p>고객 계정과 직원 역할을 확인하고 업무 접근 권한을 부여합니다.</p></header>{error ? <p role="alert">회원 목록을 불러오지 못했습니다. 최신 DB 마이그레이션 적용 상태를 확인하세요.</p> : <div className="admin-data-page__table"><table><thead><tr><th>회원</th><th>가입일</th><th>예약</th><th>권한</th></tr></thead><tbody>{(members as Member[] ?? []).map((member) => <tr key={member.user_id}><td><strong>{member.display_name || member.email || "이름 없음"}</strong><small>{member.email ?? member.user_id}</small></td><td>{new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", dateStyle: "medium" }).format(new Date(member.created_at))}</td><td>{member.order_count}</td><td><MemberRoleEditor userId={member.user_id} currentRoles={member.roles ?? []} hotels={hotels ?? []} /></td></tr>)}</tbody></table>{!members?.length ? <p>표시할 회원이 없습니다.</p> : null}</div>}</section></StaffGate>;
}
