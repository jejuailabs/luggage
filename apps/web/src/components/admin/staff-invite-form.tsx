"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { STAFF_ROLES, type StaffRole } from "@luggage/domain";
import { adminFetch } from "./admin-fetch";

export function StaffInviteForm({ hotels }: { hotels: { id: string; name_ko: string }[] }) {
  const router = useRouter();
  const [role, setRole] = useState<StaffRole>("support");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  return <form className="mb-5 grid gap-3 rounded-[var(--radius-card)] border border-line bg-card p-5 md:grid-cols-4" onSubmit={async (event) => { event.preventDefault(); const form = event.currentTarget; const f = new FormData(form); setPending(true); setMessage(""); const result = await adminFetch("/api/v1/admin/invites", "POST", { email: String(f.get("email") ?? "").trim(), role, scopeId: role === "hotel_staff" ? String(f.get("hotel") ?? "") : null }); setPending(false); setMessage(result.ok ? "초대 메일을 요청하고 역할을 부여했습니다." : result.code === "CONFLICT" ? "이미 등록된 계정입니다. 아래 목록에서 역할을 부여하세요." : "초대하지 못했습니다. 메일 발송 설정과 계정을 확인해 주세요."); if (result.ok) { form.reset(); router.refresh(); } }}><div className="md:col-span-4"><h2 className="text-lg font-bold">업무 계정 초대</h2><p className="text-sm text-muted">직원 이메일로 초대 링크를 보내고 역할을 부여합니다. 아직 등록된 계정은 아래 목록에서 권한을 관리하세요.</p></div><label className="text-sm md:col-span-2">이메일<input name="email" type="email" required maxLength={254} className="mt-1 min-h-11 w-full rounded-lg border border-line bg-bg px-3" /></label><label className="text-sm">역할<select value={role} onChange={(e) => setRole(e.target.value as StaffRole)} className="mt-1 min-h-11 w-full rounded-lg border border-line bg-bg px-3">{STAFF_ROLES.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>{role === "hotel_staff" ? <label className="text-sm">호텔<select name="hotel" required className="mt-1 min-h-11 w-full rounded-lg border border-line bg-bg px-3">{hotels.map((hotel) => <option key={hotel.id} value={hotel.id}>{hotel.name_ko}</option>)}</select></label> : <div />}<button disabled={pending || role === "hotel_staff" && hotels.length === 0} className="min-h-11 rounded-lg bg-primary px-4 font-semibold text-on-primary md:col-span-4">초대 보내기</button>{message ? <p role="status" className="text-sm md:col-span-4">{message}</p> : null}</form>;
}
