export const THEME_COOKIE = "theme";
export const THEME_PREFERENCES = ["light", "dark", "system"] as const;
export type ThemePreference = (typeof THEME_PREFERENCES)[number];

export function parseThemePreference(value: string | undefined): ThemePreference {
  return (THEME_PREFERENCES as readonly string[]).includes(value ?? "") ? (value as ThemePreference) : "system";
}

/**
 * system 모드의 첫 렌더 깜박임을 줄이는 최소 초기 스크립트.
 * light/dark는 서버가 data-theme을 이미 넣어 보낸다.
 */
export const THEME_BOOT_SCRIPT = `(function(){try{var d=document.documentElement;if(d.dataset.themePreference==="system"){d.dataset.theme=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";}}catch(e){}})();`;
