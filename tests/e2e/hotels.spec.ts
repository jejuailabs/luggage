import { expect, test } from "@playwright/test";

// PUBLIC_DATA_SOURCE=fixture 합성 카탈로그 기준 (apps/web/src/server/catalog-fixtures.ts).
test("home shows route availability from the catalog", async ({ page }) => {
  await page.goto("/zh-CN");
  const routes = page.locator(".pf-route");
  await expect(routes).toHaveCount(3);
  for (const [index, route] of (await routes.all()).entries()) {
    await expect(route).toHaveAttribute("href", `/zh-CN/luggage/book?route=${["hotel_to_airport", "airport_to_hotel", "hotel_to_hotel"][index]}`);
  }
});

test("home stay search opens a filtered dropdown", async ({ page }) => {
  await page.route("**/api/v1/tour-stays", (route) => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({ data: { stays: [{ id: "1896032", name: "가름게스트하우스", address: "제주특별자치도 서귀포시 법환하로9번길 10", image: null, latitude: 33.2, longitude: 126.5 }], count: 1 } }),
  }));
  await page.goto("/ko");
  await expect(page.getByTestId("hotel-result")).toHaveCount(0);
  await page.getByTestId("home-hotel-search").fill("가름");
  await expect(page.getByTestId("hotel-result")).toHaveCount(2);
  await expect(page.getByTestId("hotel-result").first()).toHaveText("가름게스트하우스");
  await expect(page.getByTestId("hotel-result").first()).not.toContainText("법환하로9번길 10");
  await expect(page.getByTestId("hotel-result").last()).toContainText("이 이름으로 견적 요청");
});

test("customer finds a hotel by Chinese name and continues to pickup or delivery booking", async ({ page }) => {
  await page.goto("/zh-CN");
  await page.getByTestId("home-hotel-search").fill("示例");
  await page.getByTestId("home-hotel-search").press("Enter");
  await expect(page).toHaveURL(/\/zh-CN\/luggage\/book\?q=/);
  await expect(page.getByTestId("hotel-result")).toHaveCount(3);

  await page.getByTestId("hotel-result").filter({ hasText: "济州市店" }).click();
  await expect(page).toHaveURL(/\/zh-CN\/luggage\/book\?hotel=sample-hotel-jeju-city&route=hotel_to_airport$/);
  await expect(page.locator(".stay-search__route-switch")).toBeVisible();
  await expect(page.getByTestId("booking-blocked")).toBeVisible();
});

test("hotel name falls back to the Korean original without a translation", async ({ page }) => {
  await page.goto("/en/hotels/sample-hotel-seogwipo");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("예시 호텔 서귀포점");
});

test("unknown hotels return 404", async ({ page }) => {
  const response = await page.goto("/zh-CN/hotels/not-a-hotel");
  expect(response?.status()).toBe(404);
});

test("an unlisted stay can still be used for a quote request", async ({ page }) => {
  await page.goto("/ko/luggage/book?q=zzzz");
  await page.getByTestId("hotel-result").last().click();
  await expect(page.getByRole("heading", { name: /이 숙소에서 짐 배송 견적 요청/ })).toBeVisible();
  await expect(page.locator(".stay-search__inquiry")).toContainText("zzzz");
  await expect(page.locator(".stay-search__inquiry input[name=contact]")).toBeVisible();
  await page.locator('.stay-search__route-switch input[value="hotel_to_hotel"]').check();
  await expect(page.getByLabel("도착 숙소")).toBeVisible();
  await page.getByRole("button", { name: "대형 짐 +" }).click();
  await expect(page.getByTestId("inquiry-bag-large")).toHaveText("1");
  await expect(page.locator(".stay-search__summary")).toContainText("2");
});

test("stay-to-stay inquiry asks for both stays and pickup/delivery times", async ({ page }) => {
  await page.goto("/ko/luggage/book?stay=4058390&route=hotel_to_hotel");
  const inquiry = page.locator(".stay-search__inquiry");
  await expect(inquiry).toContainText("출발 숙소:");
  await expect(inquiry.getByLabel("도착 숙소")).toBeVisible();
  await inquiry.getByLabel("도착 숙소").fill("가름");
  await expect(inquiry.locator(".stay-search__destination-options [role=option]").first()).toBeVisible();
  await expect(inquiry.locator('input[name="pickupAt"]')).toHaveAttribute("type", "datetime-local");
  await expect(inquiry.locator('input[name="deliveryAt"]')).toHaveAttribute("type", "datetime-local");
  const originName = (await inquiry.locator("p strong").textContent())!.replace("출발 숙소: ", "");
  const pickup = new Date(Date.now() + (3 * 24 + 9) * 60 * 60_000).toISOString().slice(0, 16);
  const delivery = new Date(Date.now() + (3 * 24 + 12) * 60 * 60_000).toISOString().slice(0, 16);
  await inquiry.locator('input[name="destinationStay"]').fill(originName);
  await inquiry.locator('input[name="pickupAt"]').fill(pickup);
  await inquiry.locator('input[name="deliveryAt"]').fill(delivery);
  await inquiry.locator('input[name="contact"]').fill("test@example.invalid");
  await inquiry.getByRole("button", { name: /견적 요청 보내기/ }).click();
  await expect(inquiry.getByRole("alert")).toHaveText("출발 숙소와 다른 도착 숙소를 입력해 주세요.");
  await inquiry.locator('input[name="destinationStay"]').fill("다른 숙소");
  await inquiry.locator('input[name="deliveryAt"]').fill(pickup);
  await inquiry.getByRole("button", { name: /견적 요청 보내기/ }).click();
  await expect(inquiry.getByRole("alert")).toContainText("전달은 수거 이후");
  await page.locator('.stay-search__route-switch input[value="airport_to_hotel"]').check();
  await expect(inquiry.getByLabel("도착 숙소")).toHaveCount(0);
  await expect(inquiry).toContainText("도착 숙소:");
});

test.describe("hotel API", () => {
  test("returns a limited public DTO", async ({ request }) => {
    const response = await request.get("/api/v1/hotels?q=Sample&locale=en");
    expect(response.ok()).toBe(true);
    const { data } = await response.json();
    expect(data.hotels).toHaveLength(1);
    expect(Object.keys(data.hotels[0]).sort()).toEqual(
      ["addressKo", "frontDesk", "handoffNote", "name", "nameKo", "slug", "zone"].sort(),
    );
  });
});

test.describe("admin catalog", () => {
  test("admin pages require staff sign-in", async ({ page }) => {
    for (const path of ["/ko/admin/hotels", "/ko/admin/routes"]) {
      await page.goto(path);
      await expect(page.getByTestId("staff-login")).toBeVisible();
      await expect(page.getByTestId("hotel-create-form")).toHaveCount(0);
    }
  });

  test("admin APIs reject anonymous and cross-origin requests", async ({ request, baseURL }) => {
    const origin = new URL(baseURL!).origin;
    const create = await request.post("/api/v1/admin/hotels", { headers: { Origin: origin }, data: {} });
    expect(create.status()).toBe(401);
    const cross = await request.patch("/api/v1/admin/route-offerings/00000000-0000-4000-8000-000000000021", {
      headers: { Origin: "https://evil.example" },
      data: { enabled: false },
    });
    expect(cross.status()).toBe(403);
    const forged = await request.patch("/api/v1/admin/hotels/00000000-0000-4000-8000-000000000011", {
      headers: { Authorization: "Bearer forged" },
      data: { status: "archived" },
    });
    expect(forged.status()).toBe(401);
  });
});
