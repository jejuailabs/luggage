"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { fieldErrorText, fieldRequest } from "@/lib/field-client";

const input = "min-h-11 rounded-[var(--radius-button)] border border-line bg-bg px-3";

export function CampaignForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={async (event) => {
        event.preventDefault();
        const formElement = event.currentTarget;
        const form = new FormData(formElement);
        const text = (name: string) => String(form.get(name) ?? "").trim();
        setBusy(true);
        const result = await fieldRequest("/api/v1/campaigns", "POST", {
          code: text("code"),
          channel: text("channel"),
          name: text("name"),
          postUrl: text("postUrl") || undefined,
          publishedOn: text("publishedOn") || undefined,
          keywords: text("keywords")
            .split(/[,，]/)
            .map((k) => k.trim())
            .filter(Boolean),
          landingPath: text("landingPath"),
        });
        setBusy(false);
        if (result.ok) {
          formElement.reset();
          setMessage("저장했습니다.");
          router.refresh();
        } else {
          setMessage(result.code === "CONFLICT" ? "같은 캠페인 코드가 이미 있습니다." : fieldErrorText(result.code));
        }
      }}
    >
      <h2 className="font-semibold">캠페인 기록</h2>
      <input name="code" required placeholder="캠페인 코드 (예: xhs_checkout_01)" pattern="[A-Za-z0-9_\-]{1,40}" className={input} />
      <select name="channel" className={input} defaultValue="xiaohongshu">
        <option value="xiaohongshu">샤오홍슈</option>
        <option value="search">검색</option>
        <option value="share">공유</option>
        <option value="direct">직접</option>
      </select>
      <input name="name" required maxLength={120} placeholder="소재명" className={input} />
      <input name="postUrl" type="url" placeholder="게시 URL (https://)" className={input} />
      <input name="publishedOn" type="date" className={input} />
      <input name="keywords" placeholder="키워드 (쉼표로 구분)" className={input} />
      <input name="landingPath" required defaultValue="/zh-CN/guide/checkout-day" className={input} />
      <button type="submit" disabled={busy} className="min-h-12 rounded-[var(--radius-button)] bg-primary px-4 font-semibold text-on-primary disabled:opacity-50">
        저장
      </button>
      {message ? <p role="status" className="text-sm">{message}</p> : null}
    </form>
  );
}
