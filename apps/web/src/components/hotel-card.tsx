import Link from "next/link";
import type { Translate } from "@luggage/i18n";
import type { PublicHotel } from "@/server/catalog";

export function HotelCard({ hotel, locale, t }: { hotel: PublicHotel; locale: string; t: Translate; index?: number }) {
  return (
    <Link
      href={`/${locale}/hotels/${hotel.slug}`}
      data-testid="hotel-result"
      className="hotel-search-card customer-card"
    >
      <span className="hotel-search-card__mark" aria-hidden="true">↗</span>
      <span className="hotel-search-card__body"><small>{t("hotels.zone")} · {hotel.zone}</small><strong>{hotel.name}</strong>{hotel.name !== hotel.nameKo ? <span lang="ko">{hotel.nameKo}</span> : null}<span className="hotel-search-card__footer">{t("hotels.bookFromHere")} <b aria-hidden="true">↗</b></span></span>
    </Link>
  );
}
