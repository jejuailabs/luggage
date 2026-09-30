import { ROUTE_TYPES, type RouteType } from "@luggage/domain";
import type { Locale, Translate } from "@luggage/i18n";

/** 판매 여부는 운영 설정(route_offerings)에서 온다. */
export function RouteList({ t, open, locale }: { t: Translate; open: ReadonlySet<RouteType>; locale: Locale }) {
  return (
    <ul className="grid grid-cols-3 gap-2 md:gap-3" data-testid="route-list">
      {ROUTE_TYPES.map((route) => {
        const isOpen = open.has(route);
        return (
          <li
            key={route}
            data-route={route}
            data-open={isOpen}
            className="customer-card flex min-h-16 flex-col items-start gap-1 px-2.5 py-2 md:min-h-[92px] md:flex-row md:items-center md:gap-3 md:px-4 md:py-3"
          >
            <span aria-hidden="true" className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-sea text-base font-bold text-primary md:size-11 md:rounded-xl md:text-xl">
              {route === "hotel_to_airport" ? "↗" : route === "airport_to_hotel" ? "↙" : "⇄"}
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-xs font-semibold leading-snug md:text-base">{t(`route.${route}`)}</span>
              <span className={isOpen ? "text-[10px] font-semibold text-primary md:text-xs" : "text-[10px] text-muted md:text-xs"}>
                {isOpen ? t("route.status.open") : locale === "ko" ? "견적 문의 가능" : locale === "zh-CN" ? "可咨询报价" : "Quote inquiry available"}
              </span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
