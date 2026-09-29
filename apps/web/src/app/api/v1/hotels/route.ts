import { isLocale, DEFAULT_LOCALE } from "@luggage/i18n";
import { fail, newRequestId, ok } from "@/server/api";
import { loadPublicCatalog, searchHotels } from "@/server/catalog";

export const dynamic = "force-dynamic";

/** 공개 호텔 검색. 활성 호텔의 제한된 DTO만 반환한다. */
export async function GET(request: Request) {
  const requestId = newRequestId();
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").slice(0, 80);
  const localeParam = url.searchParams.get("locale");
  const locale = isLocale(localeParam) ? localeParam : DEFAULT_LOCALE;
  const catalog = await loadPublicCatalog();
  if (!catalog) return fail("PROVIDER_UNAVAILABLE", requestId);
  return ok({ hotels: searchHotels(catalog, q, locale) }, requestId);
}
