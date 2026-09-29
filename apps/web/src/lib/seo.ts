import "server-only";
import type { Metadata } from "next";
import { LOCALES, type Locale } from "@luggage/i18n";
import { getServerConfig } from "./env";

/** 공개 페이지의 canonical·hreflang. path는 언어 접두어 뒤의 경로 ("" = 홈). */
export function localizedAlternates(locale: Locale, path: string): Metadata["alternates"] {
  const base = getServerConfig().appUrl;
  const suffix = path ? `/${path.replace(/^\//, "")}` : "";
  return {
    canonical: `${base}/${locale}${suffix}`,
    languages: {
      ...Object.fromEntries(LOCALES.map((l) => [l, `${base}/${l}${suffix}`])),
      "x-default": `${base}/zh-CN${suffix}`,
    },
  };
}

/** 주문·업무·계정 화면은 색인하지 않는다. 보호는 인증이 담당한다. */
export const NO_INDEX: Metadata["robots"] = { index: false, follow: false };
