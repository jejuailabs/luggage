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
    <div className="customer-shell mx-auto flex min-h-dvh w-full flex-col">
      <header className="customer-header sticky top-0 z-20 flex items-center justify-between gap-2 px-4 py-3 backdrop-blur print:hidden md:px-8 xl:px-16">
        <Link href={`/${locale}`} className="customer-header__brand text-[19px] font-extrabold text-brand">
          {t("brand.name")}
        </Link>
        <nav aria-label={t("nav.primary")} className="hidden items-center gap-7 lg:flex">
          <Link className="flex min-h-11 items-center text-sm font-semibold text-muted hover:text-primary" href={`/${locale}`}>{t("nav.home")}</Link>
          <Link className="flex min-h-11 items-center text-sm font-semibold text-muted hover:text-primary" href={`/${locale}/luggage`}>{t("nav.preview")}</Link>
          <Link className="flex min-h-11 items-center text-sm font-semibold text-muted hover:text-primary" href={`/${locale}/luggage/book`}>{t("nav.book")}</Link>
          <Link className="flex min-h-11 items-center text-sm font-semibold text-muted hover:text-primary" href={`/${locale}/account`}>{t("nav.orders")}</Link>
          <Link className="flex min-h-11 items-center text-sm font-semibold text-muted hover:text-primary" href={`/${locale}/help`}>{t("nav.help")}</Link>
        </nav>
        <div className="flex items-center gap-2">
          <ThemeQuickToggle initial={themePreference} labels={themeLabels} syncToAccount={signedIn} />
          <LocaleSwitcher locale={locale} label={t("locale.label")} syncToAccount={signedIn} />
        </div>
      </header>
      <main className="customer-main flex-1 px-4 pb-[calc(96px+env(safe-area-inset-bottom))] pt-5 md:px-8 md:pt-8">{children}</main>
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
