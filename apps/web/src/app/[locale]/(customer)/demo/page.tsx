import type { Metadata } from "next";
import { JourneySimulator, type Role } from "@/components/demo/journey-simulator";
import type { RouteType } from "@/components/demo/demo-copy";
import { NO_INDEX } from "@/lib/seo";
import { resolveLocale } from "@/lib/request-context";
import { loadPublicCatalog, searchHotels } from "@/server/catalog";

export const metadata: Metadata = { robots: NO_INDEX };

const ROUTES: RouteType[] = ["hotel_to_airport", "airport_to_hotel", "hotel_to_hotel"];

/** 외부 연동·승인 문구 없이 전체 여정을 브라우저 안에서만 재현하는 시뮬레이션. 서버에 주문을 만들지 않는다. */
export default async function DemoPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ route?: string; hotel?: string; role?: string }> }) {
  const locale = await resolveLocale(params);
  const query = await searchParams;
  const catalog = await loadPublicCatalog().catch(() => null);
  const hotels = catalog ? searchHotels(catalog, "", locale, 50).map((hotel) => ({ slug: hotel.slug, name: hotel.name })) : [];
  const route = ROUTES.includes(query.route as RouteType) ? (query.route as RouteType) : "hotel_to_airport";
  const role = (["customer", "hotel", "driver", "ops"] as const).find((value) => value === query.role) ?? "customer";
  return <JourneySimulator locale={locale} hotels={hotels} initialRoute={route} initialHotel={query.hotel} initialRole={role as Role} />;
}
