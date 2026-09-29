import { expect, test } from "@playwright/test";

// PUBLIC_DATA_SOURCE=fixture 합성 카탈로그 기준 (apps/web/src/server/catalog-fixtures.ts).
test("home shows route availability from the catalog", async ({ page }) => {
  await page.goto("/zh-CN");
  const routes = page.getByTestId("route-list");
  await expect(routes.locator('[data-route="hotel_to_airport"]')).toHaveAttribute("data-open", "true");
  await expect(routes.locator('[data-route="airport_to_hotel"]')).toHaveAttribute("data-open", "true");
  await expect(routes.locator('[data-route="hotel_to_hotel"]')).toHaveAttribute("data-open", "true");
});

test("customer finds a hotel by Chinese alias and sees Korea-time front desk hours", async ({ page }) => {
  await page.goto("/zh-CN");
  await page.getByTestId("home-hotel-search").fill("示例");
  await page.getByTestId("home-hotel-search").press("Enter");
  await expect(page).toHaveURL(/\/zh-CN\/hotels\?q=/);
  await expect(page.getByTestId("hotel-result")).toHaveCount(2);

  await page.getByTestId("hotel-result").filter({ hasText: "济州市店" }).click();
  await expect(page).toHaveURL(/\/zh-CN\/hotels\/sample-hotel-jeju-city$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("示例酒店 济州市店");
  await expect(page.getByText("예시 호텔 제주시점")).toBeVisible();
  await expect(page.getByTestId("hotel-front-desk")).toHaveText("07:00–22:00（韩国时间）");
});

test("hotel name falls back to the Korean original without a translation", async ({ page }) => {
  await page.goto("/en/hotels/sample-hotel-seogwipo");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("예시 호텔 서귀포점");
});

test("unknown hotels return 404", async ({ page }) => {
  const response = await page.goto("/zh-CN/hotels/not-a-hotel");
  expect(response?.status()).toBe(404);
});

test("no-result search explains how to search", async ({ page }) => {
  await page.goto("/ko/hotels?q=zzzz");
  await expect(page.getByTestId("hotel-result-count")).toHaveText("숙소가 없습니다");
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
