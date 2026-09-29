import { describe, expect, it } from "vitest";
import { openRouteTypes, searchHotels, toPublicHotel } from "./catalog";
import { CATALOG_FIXTURE } from "./catalog-fixtures";

describe("searchHotels", () => {
  it("matches Chinese aliases and returns Chinese names with the Korean original", () => {
    const results = searchHotels(CATALOG_FIXTURE, "济州示例", "zh-CN");
    expect(results).toEqual([
      expect.objectContaining({ slug: "sample-hotel-jeju-city", name: "示例酒店 济州市店", nameKo: "예시 호텔 제주시점", zone: "济州市" }),
    ]);
  });

  it("matches the Korean name regardless of spacing", () => {
    expect(searchHotels(CATALOG_FIXTURE, "예시호텔 서귀포", "ko").map((h) => h.slug)).toEqual(["sample-hotel-seogwipo"]);
  });

  it("falls back to the Korean name when the locale has no translation", () => {
    const hotel = CATALOG_FIXTURE.hotels.find((h) => h.slug === "sample-hotel-seogwipo")!;
    expect(toPublicHotel(hotel, CATALOG_FIXTURE, "en").name).toBe("예시 호텔 서귀포점");
  });
});

describe("openRouteTypes", () => {
  it("includes only enabled route types", () => {
    expect([...openRouteTypes(CATALOG_FIXTURE)]).toEqual(["hotel_to_airport", "airport_to_hotel", "hotel_to_hotel"]);
    const closed = { ...CATALOG_FIXTURE, routes: CATALOG_FIXTURE.routes.map((r) => (r.routeType === "hotel_to_hotel" ? r : { ...r, enabled: false })) };
    expect([...openRouteTypes(closed)]).toEqual(["hotel_to_hotel"]);
  });

  it("shows nothing as open when the catalog is unavailable", () => {
    expect(openRouteTypes(null).size).toBe(0);
  });
});
