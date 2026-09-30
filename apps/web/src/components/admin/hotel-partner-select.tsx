"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { adminFetch } from "./admin-fetch";

export function HotelPartnerSelect({ hotelId, partnerId, partners }: { hotelId: string; partnerId: string | null; partners: { id: string; name: string }[] }) {
  const router = useRouter();
  const [error, setError] = useState("");
  return <div><select aria-label="숙소 제휴사" value={partnerId ?? ""} onChange={async (event) => { const result = await adminFetch(`/api/v1/admin/hotels/${hotelId}`, "PATCH", { partnerId: event.target.value || null }); setError(result.ok ? "" : result.code); if (result.ok) router.refresh(); }}><option value="">고객사 미지정</option>{partners.map((partner) => <option key={partner.id} value={partner.id}>{partner.name}</option>)}</select>{error ? <small role="alert">{error}</small> : null}</div>;
}
