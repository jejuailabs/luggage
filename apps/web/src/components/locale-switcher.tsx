"use client";

import { usePathname, useRouter } from "next/navigation";
import { LOCALE_COOKIE, LOCALES, type Locale } from "@luggage/i18n";

const LOCALE_NAMES: Record<Locale, string> = { "zh-CN": "简体中文", ko: "한국어", en: "English" };

export function LocaleSwitcher({ locale, label }: { locale: Locale; label: string }) {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <label className="inline-flex items-center">
      <span className="sr-only">{label}</span>
      <select
        value={locale}
        data-testid="locale-switcher"
        onChange={(event) => {
          const next = event.target.value as Locale;
          document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
          const rest = pathname.split("/").slice(2).join("/");
          router.push(`/${next}${rest ? `/${rest}` : ""}`);
        }}
        className="min-h-11 rounded-[var(--radius-button)] border border-line bg-card px-2 text-sm"
      >
        {LOCALES.map((option) => (
          <option key={option} value={option}>
            {LOCALE_NAMES[option]}
          </option>
        ))}
      </select>
    </label>
  );
}
