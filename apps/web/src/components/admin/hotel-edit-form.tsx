"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { adminFetch } from "./admin-fetch";

type Translation = { locale: string; name: string; aliases: string[]; handoff_note: string | null };
type Hotel = { id: string; name_ko: string; address_ko: string; zone_id: string; front_desk_opens_at: string | null; front_desk_closes_at: string | null; hotel_translations: Translation[] };
const input = "min-h-11 w-full rounded-[var(--radius-button)] border border-line bg-bg px-3 text-sm";

export function HotelEditForm({ hotel, zones }: { hotel: Hotel; zones: { id: string; name_ko: string }[] }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const save = async (url: string, method: "PATCH" | "PUT", body: unknown) => {
    setPending(true); setMessage("");
    const result = await adminFetch(url, method, body);
    setPending(false);
    setMessage(result.ok ? "저장했습니다." : result.code === "CONFLICT" ? "같은 이름·주소의 숙소가 있거나 입력값이 충돌합니다." : "저장하지 못했습니다.");
    if (result.ok) router.refresh();
  };
  return <details className="mt-3 w-full border-t border-line pt-3"><summary className="cursor-pointer text-sm font-semibold text-primary">숙소 정보·검색명 편집</summary><div className="mt-4 grid gap-5 lg:grid-cols-3">
    <form className="grid gap-3 rounded-xl bg-bg p-4" onSubmit={(event) => { event.preventDefault(); const f = new FormData(event.currentTarget); void save(`/api/v1/admin/hotels/${hotel.id}`, "PATCH", { nameKo: String(f.get("nameKo") ?? "").trim(), addressKo: String(f.get("addressKo") ?? "").trim(), zoneId: String(f.get("zoneId") ?? ""), frontDeskOpensAt: String(f.get("opens") ?? "") || null, frontDeskClosesAt: String(f.get("closes") ?? "") || null }); }}><h3 className="font-semibold">기본 정보</h3><label className="text-sm">한국어 이름<input name="nameKo" required defaultValue={hotel.name_ko} className={input} /></label><label className="text-sm">주소<input name="addressKo" required defaultValue={hotel.address_ko} className={input} /></label><label className="text-sm">권역<select name="zoneId" required defaultValue={hotel.zone_id} className={input}>{zones.map((z) => <option key={z.id} value={z.id}>{z.name_ko}</option>)}</select></label><div className="grid grid-cols-2 gap-2"><label className="text-sm">프런트 시작<input name="opens" type="time" defaultValue={hotel.front_desk_opens_at?.slice(0, 5) ?? ""} className={input} /></label><label className="text-sm">프런트 종료<input name="closes" type="time" defaultValue={hotel.front_desk_closes_at?.slice(0, 5) ?? ""} className={input} /></label></div><button disabled={pending} className="min-h-11 rounded-[var(--radius-button)] bg-primary px-4 font-semibold text-on-primary">기본 정보 저장</button></form>
    {(["zh-CN", "en"] as const).map((locale) => { const translation = hotel.hotel_translations?.find((row) => row.locale === locale); return <form key={locale} className="grid gap-3 rounded-xl bg-bg p-4" onSubmit={(event) => { event.preventDefault(); const f = new FormData(event.currentTarget); void save(`/api/v1/admin/hotels/${hotel.id}/translations`, "PUT", { locale, name: String(f.get("name") ?? "").trim(), aliases: String(f.get("aliases") ?? "").split(/[,，]/).map((v) => v.trim()).filter(Boolean), handoffNote: String(f.get("handoffNote") ?? "").trim() || null }); }}><h3 className="font-semibold">{locale === "zh-CN" ? "简体中文" : "English"}</h3><label className="text-sm">검색 표시명<input name="name" required defaultValue={translation?.name ?? ""} lang={locale} className={input} /></label><label className="text-sm">검색 별칭 · 쉼표 구분<input name="aliases" defaultValue={translation?.aliases?.join(", ") ?? ""} lang={locale} className={input} /></label><label className="text-sm">인계 안내<textarea name="handoffNote" rows={3} maxLength={1000} defaultValue={translation?.handoff_note ?? ""} lang={locale} className={`${input} py-3`} /></label><button disabled={pending} className="min-h-11 rounded-[var(--radius-button)] bg-primary px-4 font-semibold text-on-primary">번역 저장</button></form>; })}
  </div>{message ? <p role="status" className="mt-3 text-sm">{message}</p> : null}</details>;
}
