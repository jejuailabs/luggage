import { ROUTE_TYPES, type RouteType } from "@luggage/domain";
import { ThemePreferencePicker } from "@/components/theme-controls";
import { getRequestContext, resolveLocale } from "@/lib/request-context";
import { getViewer } from "@/server/auth";

/** A단계 임시값. A05에서 운영 설정(노선 판매 여부)으로 교체한다. */
const OPEN_ROUTES: ReadonlySet<RouteType> = new Set(["hotel_to_airport"]);

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = await resolveLocale(params);
  const { t, themePreference } = await getRequestContext(locale);
  const signedIn = Boolean((await getViewer()).user);

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-[var(--radius-card)] bg-sea px-4 py-6">
        <h1 className="text-[26px] font-bold leading-tight">{t("home.headline")}</h1>
        <p className="mt-2 text-muted">{t("home.subheadline")}</p>
      </section>

      <section aria-labelledby="search-title" className="rounded-[var(--radius-card)] border border-line bg-card p-4">
        <h2 id="search-title" className="text-lg font-semibold">
          {t("home.search.title")}
        </h2>
        <form className="mt-3 flex flex-col gap-3" aria-describedby="search-unavailable">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">{t("home.search.hotel")}</span>
            <input
              name="hotel"
              type="search"
              placeholder={t("home.search.hotelPlaceholder")}
              disabled
              className="min-h-11 rounded-[var(--radius-button)] border border-line bg-bg px-3 disabled:opacity-60"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">
              {t("home.search.date")} <span className="text-muted">({t("time.kstLabel")})</span>
            </span>
            <input
              name="date"
              type="date"
              disabled
              className="min-h-11 rounded-[var(--radius-button)] border border-line bg-bg px-3 disabled:opacity-60"
            />
          </label>
          <button
            type="submit"
            disabled
            className="min-h-12 rounded-[var(--radius-button)] bg-primary px-4 font-semibold text-on-primary disabled:opacity-60"
          >
            {t("home.search.submit")}
          </button>
          <p id="search-unavailable" className="text-center text-sm text-muted">
            {t("home.search.unavailable")}
          </p>
        </form>
      </section>

      <section aria-labelledby="routes-title">
        <h2 id="routes-title" className="mb-2 text-lg font-semibold">
          {t("home.routes.title")}
        </h2>
        <ul className="flex flex-col gap-3">
          {ROUTE_TYPES.map((route) => {
            const open = OPEN_ROUTES.has(route);
            return (
              <li
                key={route}
                className="flex min-h-14 items-center justify-between rounded-[var(--radius-card)] border border-line bg-card px-4"
              >
                <span className="font-medium">{t(`route.${route}`)}</span>
                <span className={open ? "text-sm font-semibold text-primary" : "text-sm text-muted"}>
                  {open ? t("route.status.open") : t("route.status.comingSoon")}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <section
        aria-labelledby="notice-title"
        className="rounded-[var(--radius-card)] border border-line border-l-4 border-l-warm bg-card p-4"
      >
        <h2 id="notice-title" className="font-semibold">
          {t("home.notice.title")}
        </h2>
        <p className="mt-1 text-sm text-muted">{t("home.notice.body")}</p>
      </section>

      <section aria-labelledby="trust-title" className="rounded-[var(--radius-card)] border border-line bg-card p-4">
        <h2 id="trust-title" className="font-semibold">
          {t("home.trust.title")}
        </h2>
        <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-sm">
          <li>{t("home.trust.perBag")}</li>
          <li>{t("home.trust.noKoreanPhone")}</li>
          <li>{t("home.trust.support")}</li>
        </ul>
      </section>

      <section className="rounded-[var(--radius-card)] border border-line bg-card p-4">
        <ThemePreferencePicker
          initial={themePreference}
          syncToAccount={signedIn}
          labels={{
            label: t("theme.label"),
            light: t("theme.light"),
            dark: t("theme.dark"),
            system: t("theme.system"),
          }}
        />
      </section>
    </div>
  );
}
