import { expect, test } from "@playwright/test";

function kstDate(offsetDays: number): string {
  const now = new Date(Date.now() + 9 * 3600_000 + offsetDays * 86_400_000);
  return now.toISOString().slice(0, 10);
}

test.describe("service slots API", () => {
  test("lists slots for an open route from a hotel", async ({ request }) => {
    const response = await request.get(`/api/v1/service-slots?hotel=sample-hotel-jeju-city&routeType=hotel_to_airport&date=${kstDate(2)}`);
    expect(response.ok()).toBe(true);
    const { data } = await response.json();
    expect(data.routeOfferingId).toBeTruthy();
    expect(data.slots).toHaveLength(2);
    expect(data.slots[0].slotId).toMatch(/^[0-9a-f-]{36}$/);
    // 한국 시간 09:00 수거 시작 = UTC 00:00
    expect(data.slots[0].pickup.startsAt).toMatch(/T00:00:00/);
  });

  test("hotel-to-hotel needs a destination hotel", async ({ request }) => {
    const none = await request.get(`/api/v1/service-slots?hotel=sample-hotel-jeju-city&routeType=hotel_to_hotel&date=${kstDate(2)}`);
    expect((await none.json()).data).toEqual({ routeOfferingId: null, slots: [] });
    const withDestination = await request.get(
      `/api/v1/service-slots?hotel=sample-hotel-jeju-city&routeType=hotel_to_hotel&destinationHotel=sample-hotel-seogwipo&date=${kstDate(2)}`,
    );
    expect((await withDestination.json()).data.slots).toHaveLength(1);
  });

  test("airport-to-hotel slots start at the airport in Korea time", async ({ request }) => {
    const response = await request.get(`/api/v1/service-slots?hotel=sample-hotel-seogwipo&routeType=airport_to_hotel&date=${kstDate(2)}`);
    const { data } = await response.json();
    expect(data.slots).toHaveLength(1);
    // 한국 시간 10:00 공항 수거 = UTC 01:00
    expect(data.slots[0].pickup.startsAt).toMatch(/T01:00:00/);
  });

  test("validates the query and hotel", async ({ request }) => {
    expect((await request.get("/api/v1/service-slots?hotel=x&routeType=boat&date=2026")).status()).toBe(400);
    expect((await request.get(`/api/v1/service-slots?hotel=nope&routeType=hotel_to_airport&date=${kstDate(2)}`)).status()).toBe(404);
  });
});

test.describe("quotes API", () => {
  const body = {
    slotId: "00000000-0000-4000-8000-000000000001",
    originHotel: "sample-hotel-jeju-city",
    bags: { standard: 1, large: 0 },
    flightNumber: "KE1234",
    flightDepartsAt: "2026-12-01T12:00:00+09:00",
  };

  test("requires a session", async ({ request, baseURL }) => {
    const response = await request.post("/api/v1/quotes", { headers: { Origin: new URL(baseURL!).origin }, data: body });
    expect(response.status()).toBe(401);
  });

  test("never accepts a client-supplied amount", async ({ request, baseURL }) => {
    const response = await request.post("/api/v1/quotes", {
      headers: { Origin: new URL(baseURL!).origin },
      data: { ...body, totalMinor: 1 },
    });
    expect(response.status()).toBe(400);
  });

  test("rejects cross-origin cookie requests", async ({ request }) => {
    const response = await request.post("/api/v1/quotes", { headers: { Origin: "https://evil.example" }, data: body });
    expect(response.status()).toBe(403);
  });
});
