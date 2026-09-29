import { ROUTE_TYPES, type RouteType } from "@luggage/domain";
import type { Translate } from "@luggage/i18n";

/** 판매 여부는 운영 설정(route_offerings)에서 온다. */
export function RouteList({ t, open }: { t: Translate; open: ReadonlySet<RouteType> }) {
  return (
    <ul className="flex flex-col gap-3" data-testid="route-list">
      {ROUTE_TYPES.map((route) => {
        const isOpen = open.has(route);
        return (
          <li
            key={route}
            data-route={route}
            data-open={isOpen}
            className="flex min-h-14 items-center justify-between rounded-[var(--radius-card)] border border-line bg-card px-4"
          >
            <span className="font-medium">{t(`route.${route}`)}</span>
            <span className={isOpen ? "text-sm font-semibold text-primary" : "text-sm text-muted"}>
              {isOpen ? t("route.status.open") : t("route.status.comingSoon")}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
