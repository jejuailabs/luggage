"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { STAFF_ROLES, type StaffRole } from "@luggage/domain";
import { adminFetch } from "./admin-fetch";

export function MemberRoleEditor({ userId, currentRoles, hotels }: { userId: string; currentRoles: { role: string; scope_id: string | null }[]; hotels: { id: string; name_ko: string }[] }) {
  const router = useRouter();
  const [role, setRole] = useState<StaffRole>("support");
  const [hotel, setHotel] = useState(hotels[0]?.id ?? "");
  const [message, setMessage] = useState("");
  async function save(enabled: boolean, selectedRole: StaffRole, scopeId: string | null) {
    const result = await adminFetch("/api/v1/admin/members", "POST", { userId, role: selectedRole, scopeId, enabled });
    setMessage(result.ok ? "권한이 반영되었습니다." : `변경 실패: ${result.code}`);
    if (result.ok) router.refresh();
  }
  return <div className="admin-role-editor"><div className="admin-role-editor__current">{currentRoles.length ? currentRoles.map((grant) => <button key={`${grant.role}-${grant.scope_id}`} type="button" onClick={() => save(false, grant.role as StaffRole, grant.scope_id)} title="권한 회수">{grant.role}{grant.scope_id ? " · 호텔" : ""} ×</button>) : <span>고객</span>}</div><div className="admin-role-editor__form"><select value={role} onChange={(event) => setRole(event.target.value as StaffRole)} aria-label="추가할 역할">{STAFF_ROLES.map((value) => <option key={value} value={value}>{value}</option>)}</select>{role === "hotel_staff" ? <select value={hotel} onChange={(event) => setHotel(event.target.value)} aria-label="호텔 범위">{hotels.map((item) => <option key={item.id} value={item.id}>{item.name_ko}</option>)}</select> : null}<button type="button" disabled={role === "hotel_staff" && !hotel} onClick={() => save(true, role, role === "hotel_staff" ? hotel : null)}>권한 추가</button></div>{message ? <small role="status">{message}</small> : null}</div>;
}
