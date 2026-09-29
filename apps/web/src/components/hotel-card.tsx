import Link from "next/link";
import type { Translate } from "@luggage/i18n";
import type { PublicHotel } from "@/server/catalog";

export function HotelCard({ hotel, locale, t }: { hotel: PublicHotel; locale: string; t: Translate }) {
  return (
    <Link
      href={`/${locale}/hotels/${hotel.slug}`}
      data-testid="hotel-result"
      className="flex min-h-14 flex-col gap-1 rounded-[var(--radius-card)] border border-line bg-card p-4"
    >
      <span className="font-semibold">{hotel.name}</span>
      {hotel.name !== hotel.nameKo ? (
        <span lang="ko" className="text-sm text-muted">
          {hotel.nameKo}
        </span>
      ) : null}
      <span className="text-sm text-muted">
        {t("hotels.zone")}: {hotel.zone}
      </span>
    </Link>
  );
}
