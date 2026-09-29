import type { MetadataRoute } from "next";
import { LOCALES } from "@luggage/i18n";
import { getServerConfig } from "@/lib/env";

const PUBLIC_PATHS = ["", "/luggage", "/hotels", "/help"];

export default function sitemap(): MetadataRoute.Sitemap {
  const { appUrl } = getServerConfig();
  return PUBLIC_PATHS.map((path) => ({
    url: `${appUrl}/zh-CN${path}`,
    alternates: { languages: Object.fromEntries(LOCALES.map((l) => [l, `${appUrl}/${l}${path}`])) },
  }));
}
