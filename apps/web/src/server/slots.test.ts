import { describe, expect, it } from "vitest";
import { CATALOG_FIXTURE } from "./catalog-fixtures";
import { findOffering, routeChoicesForHotel } from "./slots";

const city = CATALOG_FIXTURE.hotels.find((h) => h.slug === "sample-hotel-jeju-city")!;
const seogwipo = CATALOG_FIXTURE.hotels.find((h) => h.slug === "sample-hotel-seogwipo")!;

describe("findOffering", () => {
  it("matches hotel-to-airport by origin zone and airport-to-hotel by destination zone", () => {
    expect(findOffering(CATALOG_FIXTURE, "hotel_to_airport", city)?.originZoneId).toBe(city.zoneId);
    expect(findOffering(CATALOG_FIXTURE, "airport_to_hotel", seogwipo)?.destinationZoneId).toBe(seogwipo.zoneId);
  });

  it("needs a different destination hotel for hotel-to-hotel", () => {
    expect(findOffering(CATALOG_FIXTURE, "hotel_to_hotel", city)).toBeUndefined();
    expect(findOffering(CATALOG_FIXTURE, "hotel_to_hotel", city, city)).toBeUndefined();
    expect(findOffering(CATALOG_FIXTURE, "hotel_to_hotel", city, seogwipo)?.destinationZoneId).toBe(seogwipo.zoneId);
  });

  it("ignores disabled offerings", () => {
    const closed = { ...CATALOG_FIXTURE, routes: CATALOG_FIXTURE.routes.map((r) => ({ ...r, enabled: false })) };
    expect(findOffering(closed, "hotel_to_airport", city)).toBeUndefined();
  });
});

describe("routeChoicesForHotel", () => {
  it("lists every open route with reachable destination hotels", () => {
    const choices = routeChoicesForHotel(CATALOG_FIXTURE, city);
    expect(choices.map((c) => c.routeType)).toEqual(["hotel_to_airport", "airport_to_hotel", "hotel_to_hotel"]);
    expect(choices.find((c) => c.routeType === "hotel_to_hotel")?.destinations.map((d) => d.slug)).toEqual(["sample-hotel-seogwipo"]);
  });
});
