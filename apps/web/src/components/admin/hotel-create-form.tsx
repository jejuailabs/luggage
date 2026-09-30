"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { adminFetch } from "./admin-fetch";
import { ADMIN_LABELS } from "./labels";

const L = ADMIN_LABELS.create;
const inputClass = "min-h-11 rounded-[var(--radius-button)] border border-line bg-bg px-3";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}

export function HotelCreateForm({ zones, partners = [] }: { zones: { id: string; name: string }[]; partners?: { id: string; name: string }[] }) {
  const router = useRouter();
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <form
      data-testid="hotel-create-form"
      className="flex flex-col gap-3"
      onSubmit={async (event) => {
        event.preventDefault();
        const formElement = event.currentTarget;
        const form = new FormData(formElement);
        const text = (name: string) => String(form.get(name) ?? "").trim();
        const translations = [
          text("nameZh") && {
            locale: "zh-CN",
            name: text("nameZh"),
            aliases: text("aliasesZh")
              .split(/[,，]/)
              .map((a) => a.trim())
              .filter(Boolean),
          },
          text("nameEn") && { locale: "en", name: text("nameEn"), aliases: [] },
        ].filter(Boolean);
        const opensAt = text("opensAt");
        const closesAt = text("closesAt");

        setPending(true);
        setMessage(null);
        const result = await adminFetch("/api/v1/admin/hotels", "POST", {
          zoneId: text("zoneId"),
          slug: text("slug"),
          nameKo: text("nameKo"),
          addressKo: text("addressKo"),
          partnerId: text("partnerId") || null,
          ...(opensAt && closesAt ? { frontDeskOpensAt: opensAt, frontDeskClosesAt: closesAt } : {}),
          translations,
        });
        setPending(false);
        if (result.ok) {
          formElement.reset();
          setMessage({ tone: "ok", text: L.created });
          router.refresh();
        } else {
          setMessage({ tone: "error", text: result.code === "CONFLICT" ? ADMIN_LABELS.conflict : ADMIN_LABELS.saveFailed });
        }
      }}
    >
      <h2 className="text-lg font-semibold">{L.title}</h2>
      <Field label={L.zone}>
        <select name="zoneId" required className={inputClass}>
          {zones.map((zone) => (
            <option key={zone.id} value={zone.id}>
              {zone.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="제휴 고객사">
        <select name="partnerId" className={inputClass}><option value="">미지정</option>{partners.map((partner) => <option key={partner.id} value={partner.id}>{partner.name}</option>)}</select>
      </Field>
      <Field label={L.slug}>
        <input name="slug" required pattern="[a-z0-9][a-z0-9\-]*" maxLength={80} className={inputClass} />
      </Field>
      <Field label={L.nameKo}>
        <input name="nameKo" required maxLength={120} className={inputClass} />
      </Field>
      <Field label={L.addressKo}>
        <input name="addressKo" required maxLength={300} className={inputClass} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={L.opensAt}>
          <input name="opensAt" type="time" className={inputClass} />
        </Field>
        <Field label={L.closesAt}>
          <input name="closesAt" type="time" className={inputClass} />
        </Field>
      </div>
      <Field label={L.nameZh}>
        <input name="nameZh" lang="zh-Hans" maxLength={120} className={inputClass} />
      </Field>
      <Field label={L.aliasesZh}>
        <input name="aliasesZh" lang="zh-Hans" className={inputClass} />
      </Field>
      <Field label={L.nameEn}>
        <input name="nameEn" lang="en" maxLength={120} className={inputClass} />
      </Field>
      {message ? (
        <p role={message.tone === "error" ? "alert" : "status"} className={message.tone === "error" ? "text-sm text-warm" : "text-sm"}>
          {message.text}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="min-h-12 rounded-[var(--radius-button)] bg-primary px-4 font-semibold text-on-primary disabled:opacity-60"
      >
        {L.submit}
      </button>
    </form>
  );
}
