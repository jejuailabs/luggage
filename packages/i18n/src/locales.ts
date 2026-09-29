export const LOCALES = ["zh-CN", "ko", "en"] as const;
export type Locale = (typeof LOCALES)[number];

/** 고객 기본 언어는 중국어 간체다. */
export const DEFAULT_LOCALE: Locale = "zh-CN";

/** 구조만 열어 둔 언어. 번역 승인 전에는 라우팅하지 않는다. */
export const PLANNED_LOCALES = ["zh-TW", "ja"] as const;

export const LOCALE_COOKIE = "locale";

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/**
 * Accept-Language 헤더에서 지원 언어를 고른다.
 * zh-TW·zh-HK 등 번체 요청은 번체 승인 전까지 간체로 보낸다.
 */
export function negotiateLocale(acceptLanguage: string | null | undefined): Locale {
  if (!acceptLanguage) return DEFAULT_LOCALE;

  const ranked = acceptLanguage
    .split(",")
    .map((part, index) => {
      const [tag = "", ...params] = part.trim().split(";");
      const q = params.find((p) => p.trim().startsWith("q="));
      const quality = q ? Number.parseFloat(q.trim().slice(2)) : 1;
      return { tag: tag.toLowerCase(), quality: Number.isNaN(quality) ? 0 : quality, index };
    })
    .filter((entry) => entry.tag && entry.quality > 0)
    .sort((a, b) => b.quality - a.quality || a.index - b.index);

  for (const { tag } of ranked) {
    if (tag.startsWith("zh")) return "zh-CN";
    if (tag.startsWith("ko")) return "ko";
    if (tag.startsWith("en")) return "en";
  }
  return DEFAULT_LOCALE;
}

/** 각 언어의 HTML lang 값. */
export const HTML_LANG: Record<Locale, string> = {
  "zh-CN": "zh-Hans",
  ko: "ko",
  en: "en",
};

/** 언어 선택·대체 언어 안내에 쓰는 각 언어의 자국어 이름. */
export const LOCALE_NAMES: Record<Locale, string> = { "zh-CN": "简体中文", ko: "한국어", en: "English" };
