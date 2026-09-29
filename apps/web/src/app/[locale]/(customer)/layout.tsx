import Link from "next/link";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeQuickToggle } from "@/components/theme-controls";
import { BottomNav } from "@/components/bottom-nav";
import { getRequestContext, resolveLocale } from "@/lib/request-context";
import { getViewer } from "@/server/auth";

export default async function CustomerLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const locale = await resolveLocale(params);
  const { t, themePreference } = await getRequestContext(locale);
  const signedIn = Boolean((await getViewer()).user);
  const themeLabels = {
    label: t("theme.label"),
    light: t("theme.light"),
    dark: t("theme.dark"),
    system: t("theme.system"),
  };

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col md:max-w-3xl">
      <header className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-line bg-bg/95 px-4 py-2 backdrop-blur">
        <Link href={`/${locale}`} className="text-lg font-bold text-brand">
          {t("brand.name")}
        </Link>
        <div className="flex items-center gap-2">
          <ThemeQuickToggle initial={themePreference} labels={themeLabels} syncToAccount={signedIn} />
          <LocaleSwitcher locale={locale} label={t("locale.label")} syncToAccount={signedIn} />
        </div>
      </header>
      <main className="flex-1 px-4 pb-[calc(88px+env(safe-area-inset-bottom))] pt-4">{children}</main>
      <BottomNav
        locale={locale}
        label={t("nav.primary")}
        items={[
          { href: "", label: t("nav.home") },
          { href: "/luggage/book", label: t("nav.book") },
          { href: "/account", label: t("nav.orders") },
          { href: "/help", label: t("nav.help") },
        ]}
      />
    </div>
  );
}
