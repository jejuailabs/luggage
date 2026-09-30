"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { adminFetch } from "./admin-fetch";

type Language = "ko" | "zh-CN" | "en";
type Translation = { locale: Language; title: string; body: string; status: "draft" | "review" | "published" | "archived"; needs_review: boolean; based_on_version: number };
export type ManagedContent = { id: string; slug: string; kind: string; criticality: string; source_locale: Language; source_version: number; content_translations: Translation[] };

const languages: { code: Language; label: string }[] = [{ code: "ko", label: "한국어" }, { code: "zh-CN", label: "简体中文" }, { code: "en", label: "English" }];
const inputClass = "min-h-11 w-full rounded-[var(--radius-button)] border border-line bg-bg px-3 text-sm";
const buttonClass = "min-h-11 rounded-[var(--radius-button)] border border-line bg-card px-4 text-sm font-semibold disabled:opacity-50";

function errorText(code: string) {
  if (code === "CONFLICT") return "문서 상태가 바뀌었거나 같은 언어가 이미 있습니다. 새로고침 후 확인해 주세요.";
  if (code === "FORBIDDEN") return "이 작업을 할 권한이 없습니다.";
  return "저장하지 못했습니다. 입력값과 연결 상태를 확인해 주세요.";
}

function TranslationEditor({ item, language }: { item: ManagedContent; language: Language }) {
  const router = useRouter();
  const translation = item.content_translations.find((row) => row.locale === language);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const endpoint = `/api/v1/admin/content/${item.id}/translations`;

  async function send(action: "save" | "review" | "publish" | "archive", form?: HTMLFormElement) {
    setPending(true);
    setMessage("");
    const fields = form ? new FormData(form) : null;
    const payload = action === "save"
      ? { action, title: String(fields?.get("title") ?? "").trim(), body: String(fields?.get("body") ?? "").trim() }
      : { action };
    const result = translation
      ? await adminFetch(`${endpoint}/${language}`, "PATCH", payload)
      : await adminFetch(endpoint, "POST", { locale: language, title: String(fields?.get("title") ?? "").trim(), body: String(fields?.get("body") ?? "").trim() });
    setPending(false);
    if (result.ok) {
      setMessage(action === "publish" ? "게시했습니다." : action === "archive" ? "보관했습니다." : "저장했습니다.");
      router.refresh();
    } else setMessage(errorText(result.code));
  }

  return <section className="rounded-[var(--radius-card)] border border-line bg-card p-4" lang={language}>
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <h3 className="font-semibold">{languages.find((entry) => entry.code === language)?.label}</h3>
      <span className="rounded-full border border-line px-3 py-1 text-xs font-semibold">{translation ? translation.status : "미작성"}{translation?.needs_review ? " · 재검토 필요" : ""}</span>
    </div>
    <form className="grid gap-3" onSubmit={(event) => { event.preventDefault(); void send("save", event.currentTarget); }}>
      <label className="grid gap-1 text-sm font-medium">제목<input name="title" required maxLength={200} defaultValue={translation?.title ?? ""} className={inputClass} /></label>
      <label className="grid gap-1 text-sm font-medium">본문<textarea name="body" required maxLength={20_000} rows={7} defaultValue={translation?.body ?? ""} className={`${inputClass} resize-y py-3 leading-relaxed`} /></label>
      <div className="flex flex-wrap gap-2">
        <button className="min-h-11 rounded-[var(--radius-button)] bg-primary px-4 text-sm font-semibold text-on-primary disabled:opacity-50" disabled={pending}>초안 저장</button>
        {translation && translation.status !== "archived" ? <>
          <button type="button" className={buttonClass} disabled={pending || translation.status === "published"} onClick={() => void send("review")}>검토 완료</button>
          <button type="button" className={buttonClass} disabled={pending || translation.status !== "review" || translation.needs_review || translation.based_on_version !== item.source_version} onClick={() => void send("publish")}>고객에게 게시</button>
          <button type="button" className={buttonClass} disabled={pending} onClick={() => void send("archive")}>보관</button>
        </> : null}
      </div>
    </form>
    {message ? <p className="mt-2 text-sm" role={message.includes("했습니다") ? "status" : "alert"}>{message}</p> : null}
    {language !== item.source_locale && translation?.needs_review ? <p className="mt-2 text-xs text-warm">원문이 바뀌었습니다. 번역을 확인하고 다시 검토해 주세요.</p> : null}
  </section>;
}

export function ContentManager({ items }: { items: ManagedContent[] }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const required = ["bag-size-rules", "prohibited-items"];
  const readiness = required.map((slug) => {
    const item = items.find((row) => row.slug === slug);
    return { slug, ready: languages.every(({ code }) => item?.content_translations.some((translation) => translation.locale === code && translation.status === "published" && !translation.needs_review)) };
  });

  return <div className="grid gap-6">
    <section className="rounded-[var(--radius-card)] border border-line bg-card p-5">
      <span className="text-xs font-bold tracking-[0.2em] text-primary">BOOKING READINESS</span>
      <h2 className="mt-2 text-xl font-bold">예약 필수 안내</h2>
      <p className="mt-1 text-sm text-muted">언어별로 검토·게시되기 전에는 해당 언어의 예약을 받지 않습니다. 검토되지 않은 예시 문구를 게시하지 마세요.</p>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">{readiness.map((entry) => <div key={entry.slug} className="flex items-center justify-between rounded-[var(--radius-button)] border border-line bg-bg p-3 text-sm"><strong>{entry.slug === "bag-size-rules" ? "짐 규격·수량" : "금지 품목"}</strong><span className={entry.ready ? "text-primary" : "text-warm"}>{entry.ready ? "3개 언어 게시" : "게시 대기"}</span></div>)}</div>
    </section>
    <section className="rounded-[var(--radius-card)] border border-line bg-card p-5">
      <h2 className="text-lg font-bold">새 문서 만들기</h2>
      <form className="mt-4 grid gap-3 sm:grid-cols-4" onSubmit={async (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        setPending(true); setMessage("");
        const result = await adminFetch("/api/v1/admin/content", "POST", { slug: String(form.get("slug") ?? ""), kind: String(form.get("kind") ?? "guide"), criticality: String(form.get("criticality") ?? "general"), sourceLocale: String(form.get("sourceLocale") ?? "ko") });
        setPending(false);
        setMessage(result.ok ? "문서 초안을 만들었습니다." : errorText(result.code));
        if (result.ok) { event.currentTarget.reset(); router.refresh(); }
      }}>
        <label className="grid gap-1 text-sm">문서 ID<input name="slug" required pattern="[a-z0-9][a-z0-9-]*" maxLength={80} className={inputClass} placeholder="airport-handoff" /></label>
        <label className="grid gap-1 text-sm">종류<select name="kind" className={inputClass}><option value="guide">이용 가이드</option><option value="faq">FAQ</option><option value="notice">안내</option><option value="legal">필수·약관</option></select></label>
        <label className="grid gap-1 text-sm">민감도<select name="criticality" className={inputClass}><option value="general">일반</option><option value="critical">예약 필수</option></select></label>
        <label className="grid gap-1 text-sm">원문 언어<select name="sourceLocale" className={inputClass}><option value="ko">한국어</option><option value="zh-CN">중국어</option><option value="en">영어</option></select></label>
        <button disabled={pending} className="min-h-11 rounded-[var(--radius-button)] bg-primary px-4 text-sm font-semibold text-on-primary disabled:opacity-50 sm:col-span-4">초안 만들기</button>
      </form>
      {message ? <p role={message.includes("만들었습니다") ? "status" : "alert"} className="mt-2 text-sm">{message}</p> : null}
    </section>
    <section className="grid gap-4">
      <h2 className="text-xl font-bold">전체 콘텐츠 <span className="text-muted">{items.length}</span></h2>
      {items.length ? items.map((item) => <details key={item.id} className="group rounded-[var(--radius-card)] border border-line bg-card p-5">
        <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2"><span><strong className="text-lg">{item.slug}</strong><small className="ml-3 text-muted">{item.kind} · {item.criticality} · 원문 v{item.source_version}</small></span><span className="text-sm text-primary group-open:rotate-180">⌄</span></summary>
        <div className="mt-5 grid gap-3 xl:grid-cols-3">{languages.map(({ code }) => <TranslationEditor key={`${item.id}-${code}`} item={item} language={code} />)}</div>
      </details>) : <p className="rounded-[var(--radius-card)] border border-line bg-card p-5 text-muted">작성된 문서가 없습니다.</p>}
    </section>
  </div>;
}
