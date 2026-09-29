import "server-only";
import { cookies, headers } from "next/headers";
import { notFound } from "next/navigation";
import { detectRuntimeEnvironment } from "@luggage/domain";
import { createTranslator, isLocale, type Locale } from "@luggage/i18n";
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
    themePreference: parseThemePreference(cookieStore.get(THEME_COOKIE)?.value),
    runtime: detectRuntimeEnvironment({ userAgent: headerStore.get("user-agent") }),
  };
}
