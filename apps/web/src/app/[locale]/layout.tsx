import type { Metadata, Viewport } from "next";
import { HTML_LANG, LOCALES } from "@luggage/i18n";
import { RuntimeEnvironmentMarker } from "@/components/runtime-environment-marker";
import { ServiceWorkerRegistration } from "@/components/service-worker";
import { getServerConfig, isTestMode } from "@/lib/env";
import { getRequestContext, resolveLocale } from "@/lib/request-context";
import { THEME_BOOT_SCRIPT } from "@/lib/theme";
import "../globals.css";

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { t } = await getRequestContext(await resolveLocale(params));
  return {
    title: { default: `${t("brand.name")} · ${t("brand.tagline")}`, template: `%s · ${t("brand.name")}` },
    description: t("home.subheadline"),
    icons: { icon: "/icons/icon.svg", apple: "/icons/apple-touch-icon.png" },
    appleWebApp: { capable: true, title: t("brand.name"), statusBarStyle: "default" },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8fafc" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1220" },
  ],
};

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const locale = await resolveLocale(params);
  const { t, themePreference, runtime } = await getRequestContext(locale);
  const testMode = isTestMode(getServerConfig());

  return (
    <html
      lang={HTML_LANG[locale]}
      data-theme={themePreference === "system" ? undefined : themePreference}
      data-theme-preference={themePreference}
      data-runtime={runtime}
      // system 모드는 초기 스크립트가 data-theme을 먼저 정하므로 html 속성 차이만 허용한다.
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body className="min-h-dvh antialiased">
        <RuntimeEnvironmentMarker />
        <ServiceWorkerRegistration />
        {testMode ? (
          <div role="status" data-testid="test-mode-banner" className="bg-warm px-4 py-1 text-center text-xs text-bg">
            {t("env.testMode")}
          </div>
        ) : null}
        {children}
      </body>
    </html>
  );
}
