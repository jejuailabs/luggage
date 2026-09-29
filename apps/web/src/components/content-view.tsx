import { HTML_LANG, isLocale, LOCALE_NAMES, type Translate } from "@luggage/i18n";
import type { ContentResult } from "@/server/content";

/**
 * 게시 콘텐츠 표시. 대체 언어로 보여 줄 때는 안내를 붙이고 본문에 실제 언어를 표시한다.
 * critical 문구에 해당 언어 승인본이 없으면 본문 대신 차단 안내를 보여 준다.
 */
export function ContentView({
  result,
  t,
  headingLevel = 2,
  testId,
}: {
  result: ContentResult;
  t: Translate;
  headingLevel?: 1 | 2 | 3;
  testId?: string;
}) {
  const Heading = `h${headingLevel}` as const;

  if (result.status === "unavailable" || result.status === "missing") {
    return (
      <p className="text-muted" data-testid={testId} data-content-status={result.status}>
        {result.status === "unavailable" ? t("content.unavailable") : t("content.empty")}
      </p>
    );
  }

  if (result.status === "blocked") {
    return (
      <div
        role="note"
        data-testid={testId}
        data-content-status="blocked"
        className="rounded-[var(--radius-card)] border border-line border-l-4 border-l-warm bg-card p-4 text-sm"
      >
        {t("content.criticalBlocked")}
      </div>
    );
  }

  const { translation } = result;
  const lang = isLocale(translation.locale) ? HTML_LANG[translation.locale] : translation.locale;
  return (
    <article data-testid={testId} data-content-status={result.fallback ? "fallback" : "ok"} className="flex flex-col gap-2">
      {result.fallback ? (
        <p className="rounded-[var(--radius-button)] bg-sea px-3 py-2 text-sm" data-testid="content-fallback-notice">
          {t("content.fallbackNotice", {
            language: isLocale(translation.locale) ? LOCALE_NAMES[translation.locale] : translation.locale,
          })}
        </p>
      ) : null}
      <div lang={lang} className="flex flex-col gap-2">
        <Heading className={headingLevel === 1 ? "text-2xl font-bold" : "text-lg font-semibold"}>{translation.title}</Heading>
        <p className="whitespace-pre-line text-[15px]">{translation.body}</p>
      </div>
    </article>
  );
}
