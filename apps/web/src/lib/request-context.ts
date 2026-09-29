import "server-only";
import { cookies, headers } from "next/headers";
import { notFound } from "next/navigation";
import { detectRuntimeEnvironment } from "@luggage/domain";
import { createTranslator, isLocale, type Locale } from "@luggage/i18n";
import { getViewer } from "@/server/auth";
import { parseThemePreference, THEME_COOKIE } from "./theme";

export async function resolveLocale(params: Promise<{ locale: string }>): Promise<Locale> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return locale;
}

export async function getRequestContext(locale: Locale) {
  const [cookieStore, headerStore] = await Promise.all([cookies(), headers()]);
  return {
    locale,
    t: createTranslator(locale),
    themePreference: await resolveThemePreference(cookieStore.get(THEME_COOKIE)?.value),
    runtime: detectRuntimeEnvironment({ userAgent: headerStore.get("user-agent") }),
  };
}

/**
 * 테마 우선순위: 이 기기에서 고른 값(쿠키) → 로그인 계정 기본값 → 기기 설정 따르기.
 */
async function resolveThemePreference(cookieValue: string | undefined) {
  if (cookieValue) return parseThemePreference(cookieValue);
  const viewer = await getViewer();
  if (!viewer.user || !viewer.client) return "system";
  const { data } = await viewer.client.from("profiles").select("theme").eq("user_id", viewer.user.id).maybeSingle();
  return parseThemePreference(data?.theme ?? undefined);
}
