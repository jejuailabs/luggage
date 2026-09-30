"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { adminFetch } from "./admin-fetch";

type Partner = { id: string; name: string; status: string; contract_reference: string | null; created_at: string };
export function PartnerManager({ partners }: { partners: Partner[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [contractReference, setContractReference] = useState("");
  const [message, setMessage] = useState("");
  async function create(event: React.FormEvent) {
    event.preventDefault();
    const result = await adminFetch("/api/v1/admin/partners", "POST", { name, contractReference });
    setMessage(result.ok ? "제휴사를 등록했습니다." : `등록 실패: ${result.code}`);
    if (result.ok) { setName(""); setContractReference(""); router.refresh(); }
  }
  async function change(id: string, status: string) {
    const result = await adminFetch(`/api/v1/admin/partners/${id}`, "PATCH", { status });
    setMessage(result.ok ? "상태를 변경했습니다." : `변경 실패: ${result.code}`);
    if (result.ok) router.refresh();
  }
  return <><form className="admin-partner-form" onSubmit={create}><label>고객사·제휴사명<input value={name} onChange={(event) => setName(event.target.value)} maxLength={120} required /></label><label>계약 참조 (선택)<input value={contractReference} onChange={(event) => setContractReference(event.target.value)} maxLength={200} /></label><button type="submit">제휴사 등록 ↗</button></form>{message ? <p role="status">{message}</p> : null}<div className="admin-data-page__table"><table><thead><tr><th>제휴사</th><th>계약 참조</th><th>등록일</th><th>상태</th></tr></thead><tbody>{partners.map((partner) => <tr key={partner.id}><td><strong>{partner.name}</strong><small>{partner.id}</small></td><td>{partner.contract_reference || "—"}</td><td>{new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", dateStyle: "medium" }).format(new Date(partner.created_at))}</td><td><select aria-label={`${partner.name} 상태`} value={partner.status} onChange={(event) => change(partner.id, event.target.value)}>{["draft", "active", "suspended", "archived"].map((status) => <option key={status} value={status}>{status}</option>)}</select></td></tr>)}</tbody></table>{!partners.length ? <p>등록된 제휴사가 없습니다.</p> : null}</div></>;
}
