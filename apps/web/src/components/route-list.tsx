import { ROUTE_TYPES, type RouteType } from "@luggage/domain";
import type { Translate } from "@luggage/i18n";

/** A단계 임시값. A05에서 운영 설정(노선 판매 여부)으로 교체한다. */
export const OPEN_ROUTES: ReadonlySet<RouteType> = new Set(["hotel_to_airport"]);

export function RouteList({ t }: { t: Translate }) {
  return (
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
  );
}
