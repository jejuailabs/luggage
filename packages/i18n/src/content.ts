import type { Locale } from "./locales";

export type ContentCriticality = "general" | "critical";

export interface PublishedTranslation {
  locale: string;
  title: string;
  body: string;
}

export type ResolvedContent =
  | { status: "ok"; translation: PublishedTranslation; fallback: false }
  | { status: "ok"; translation: PublishedTranslation; fallback: true; requestedLocale: Locale }
  /** 가격·취소·보험·금지 품목·필수 동의 문구에 해당 언어 승인본이 없다. 결제 진입을 막거나 지원 흐름으로 보낸다. */
  | { status: "blocked"; reason: "critical_translation_missing"; requestedLocale: Locale }
  | { status: "missing" };

/** 요청 언어에 게시본이 없을 때 시도할 승인 언어 순서. */
const FALLBACK_ORDER: Record<Locale, readonly Locale[]> = {
  "zh-CN": ["en", "ko"],
  en: ["zh-CN", "ko"],
  ko: ["en", "zh-CN"],
};

/**
 * 03 문서 4절 규칙. 입력은 이미 게시(published)된 번역만이어야 한다.
 * - 일반 안내: 요청 언어 → 대체 언어, 대체 여부를 표시한다.
 * - critical: 요청 언어 게시본이 없으면 대체하지 않고 차단한다.
 */
export function resolveContent(
  translations: readonly PublishedTranslation[],
  requested: Locale,
  criticality: ContentCriticality,
): ResolvedContent {
  const byLocale = new Map(translations.map((t) => [t.locale, t]));
  const exact = byLocale.get(requested);
  if (exact) return { status: "ok", translation: exact, fallback: false };
  if (criticality === "critical") {
    return { status: "blocked", reason: "critical_translation_missing", requestedLocale: requested };
  }
  for (const locale of FALLBACK_ORDER[requested]) {
    const candidate = byLocale.get(locale);
    if (candidate) return { status: "ok", translation: candidate, fallback: true, requestedLocale: requested };
  }
  return { status: "missing" };
}
