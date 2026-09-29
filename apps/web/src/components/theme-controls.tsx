"use client";

import { useEffect, useSyncExternalStore } from "react";
import { syncPreferenceToAccount } from "@/lib/preferences-client";
import { THEME_COOKIE, THEME_PREFERENCES, parseThemePreference, type ThemePreference } from "@/lib/theme";

type Rendered = "light" | "dark";

function systemTheme(): Rendered {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyPreference(preference: ThemePreference) {
  const root = document.documentElement;
  root.dataset.themePreference = preference;
  root.dataset.theme = preference === "system" ? systemTheme() : preference;
  document.cookie = `${THEME_COOKIE}=${preference}; path=/; max-age=31536000; samesite=lax`;
}

// 테마 상태의 기준은 <html>의 data-theme / data-theme-preference 속성이다.
// 헤더 토글과 설정 선택기가 같은 값을 보도록 React 상태로 복제하지 않는다.
function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme", "data-theme-preference"],
  });
  return () => observer.disconnect();
}

function readSnapshot(): string {
  const { theme, themePreference } = document.documentElement.dataset;
  return `${themePreference ?? "system"}:${theme === "dark" ? "dark" : "light"}`;
}

function useThemePreference(initial: ThemePreference, syncToAccount: boolean) {
  const snapshot = useSyncExternalStore(subscribe, readSnapshot, () => null);
  const [preferenceValue, renderedValue] = snapshot ? snapshot.split(":") : [initial, null];
  const preference = parseThemePreference(preferenceValue);
  const rendered = (renderedValue as Rendered | null) ?? (initial === "system" ? null : initial);

  useEffect(() => {
    if (preference !== "system") return;
    // 운영체제 테마 변경은 system 모드에서만 반영한다.
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      document.documentElement.dataset.theme = systemTheme();
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [preference]);

  const choose = (next: ThemePreference) => {
    applyPreference(next);
    if (syncToAccount) syncPreferenceToAccount({ theme: next });
  };

  return { preference, rendered, choose };
}

interface Labels {
  label: string;
  light: string;
  dark: string;
  system: string;
}

/** 헤더용 라이트/다크 빠른 전환. 접근 가능한 이름에 현재 상태를 포함한다. */
export function ThemeQuickToggle({
  initial,
  labels,
  syncToAccount = false,
}: {
  initial: ThemePreference;
  labels: Labels;
  syncToAccount?: boolean;
}) {
  const { rendered, choose } = useThemePreference(initial, syncToAccount);
  const isDark = rendered === "dark";
  const current = rendered ? labels[rendered] : labels.system;
  return (
    <button
      type="button"
      onClick={() => choose(isDark ? "light" : "dark")}
      aria-label={`${labels.label}: ${current}`}
      data-testid="theme-quick-toggle"
      className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-[var(--radius-button)] border border-line px-3 text-sm"
    >
      {rendered ? <span aria-hidden="true">{isDark ? "☾" : "☀"}</span> : null}
      <span>{current}</span>
    </button>
  );
}

/** 설정용 3단 선택 (라이트 / 다크 / 기기 설정 따르기). */
export function ThemePreferencePicker({
  initial,
  labels,
  syncToAccount = false,
}: {
  initial: ThemePreference;
  labels: Labels;
  syncToAccount?: boolean;
}) {
  const { preference, choose } = useThemePreference(initial, syncToAccount);
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm font-semibold text-muted">{labels.label}</legend>
      <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label={labels.label}>
        {THEME_PREFERENCES.map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={preference === option}
            data-testid={`theme-option-${option}`}
            onClick={() => choose(option)}
            className="min-h-11 rounded-[var(--radius-button)] border border-line px-2 text-sm aria-checked:border-primary aria-checked:bg-sea aria-checked:font-semibold"
          >
            {labels[option]}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
