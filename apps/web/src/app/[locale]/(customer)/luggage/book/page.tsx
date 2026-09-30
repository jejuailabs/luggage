import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ROUTE_TYPES, type RouteType } from "@luggage/domain";
import { BookingFlow } from "@/components/booking/booking-flow";
import { getRequestContext, resolveLocale } from "@/lib/request-context";
import { NO_INDEX } from "@/lib/seo";
import { loadPublicCatalog, toPublicHotel } from "@/server/catalog";
import { getContent } from "@/server/content";
import { routeChoicesForHotel } from "@/server/slots";

/** 주문 시 동의를 받는 필수 안내. DB booking_settings.required_policy_slugs와 같아야 한다. */
const REQUIRED_POLICIES = ["bag-size-rules", "prohibited-items"] as const;

export const metadata: Metadata = { robots: NO_INDEX };

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ hotel?: string | string[]; route?: string | string[] }>;
};

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export default async function BookPage({ params, searchParams }: Props) {
  const locale = await resolveLocale(params);
  const { t } = await getRequestContext(locale);
  const query = await searchParams;
  const hotelSlug = first(query.hotel);
  const requestedRoute = first(query.route);

  const catalog = await loadPublicCatalog();
  const hotelRecord = catalog?.hotels.find((h) => h.slug === hotelSlug);
  const hotel = catalog && hotelRecord ? toPublicHotel(hotelRecord, catalog, locale) : null;

  const panel = "customer-card p-5";
  if (!catalog || !hotelRecord || !hotel) {
    return (
      <div className="booking-page">
        <header className="booking-visual-header"><Image src="/images/editorial-airport.jpg" alt="" width={1800} height={1200} sizes="(min-width: 768px) 760px, 100vw" /><div><span className="landing-kicker">JEJU · YOUR JOURNEY</span><h1>{t("booking.title")}</h1></div></header>
        <section className={`${panel} booking-empty-state flex flex-col gap-3`}>
          <p className="text-muted">{t("booking.hotelMissing")}</p>
          <Link href={`/${locale}/hotels`} className="customer-action flex min-h-12 items-center justify-center px-5 font-semibold">{t("booking.chooseHotel")} <span aria-hidden="true" className="ml-2">→</span></Link>
        </section>
      </div>
    );
  }

  // 이 호텔에서 판매 중인 노선만 보여 준다 (운영 설정 route_offerings 기준).
  const choices = routeChoicesForHotel(catalog, hotelRecord);
  const choice =
    choices.find((c) => c.routeType === requestedRoute && (ROUTE_TYPES as readonly string[]).includes(requestedRoute ?? "")) ??
    choices[0];

  // 필수 안내가 이 언어로 승인·게시되지 않았으면 예약을 받지 않는다.
  const notices = await Promise.all(REQUIRED_POLICIES.map((slug) => getContent(slug, locale)));
  const policies = notices.flatMap((notice, index) =>
    notice.status === "ok" && !notice.fallback ? [{ slug: REQUIRED_POLICIES[index]!, title: notice.translation.title }] : [],
  );

  return (
    <div className="booking-page mx-auto flex max-w-[760px] flex-col gap-5 pb-5">
      <header className="booking-visual-header"><Image src="/images/editorial-airport.jpg" alt="" width={1800} height={1200} sizes="(min-width: 768px) 760px, 100vw" /><div><span className="landing-kicker">JEJU · RESERVATION</span><h1>{t("booking.title")}</h1><p>{hotel.name}</p></div></header>

      {choices.length === 0 ? (
        <p className={`${panel} text-sm`} data-testid="booking-no-routes">
          {t("booking.noRoutes")}
        </p>
      ) : (
        <nav aria-label={t("booking.chooseRoute")} className="booking-route-choices grid grid-cols-3 gap-2">
          {choices.map((c) => (
            <Link
              key={c.routeType}
              href={`/${locale}/luggage/book?hotel=${encodeURIComponent(hotel.slug)}&route=${c.routeType}`}
              aria-current={c.routeType === choice?.routeType ? "page" : undefined}
              data-testid={`route-choice-${c.routeType}`}
              className="customer-card flex min-h-16 items-center justify-center px-2 text-center text-xs font-semibold leading-snug aria-[current=page]:border-primary aria-[current=page]:bg-sea aria-[current=page]:text-primary sm:text-sm"
            >
              {t(`route.${c.routeType as RouteType}`)}
            </Link>
          ))}
        </nav>
      )}

      {!choice ? null : policies.length < REQUIRED_POLICIES.length ? (
        <p role="note" data-testid="booking-blocked" className={`${panel} text-sm text-warm`}>
          {t("luggage.bookingBlocked")}
        </p>
      ) : (
        <BookingFlow
          key={choice.routeType}
          locale={locale}
          hotel={{ slug: hotel.slug, name: hotel.name }}
          routeType={choice.routeType}
          destinations={choice.destinations.map((d) => {
            const view = toPublicHotel(d, catalog, locale);
            return { slug: view.slug, name: view.name };
          })}
          policies={policies}
        />
      )}
    </div>
  );
}
