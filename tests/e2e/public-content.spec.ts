import { expect, test } from "@playwright/test";

// PUBLIC_DATA_SOURCE=fixture 합성 콘텐츠 기준 (apps/web/src/server/content-fixtures.ts).
test.describe("luggage service page", () => {
  test("shows the published usage guide as five readable steps", async ({ page }) => {
    await page.goto("/ko/luggage");
    const guide = page.getByTestId("content-how-it-works");
    await expect(guide.locator(".service-page__how-steps li")).toHaveCount(5);
    await expect(guide.locator(".service-page__how-steps li").first()).toContainText("온라인으로 예약·결제");
    // 운영 문구 v1은 예시 표시가 없다.
    await expect(guide).not.toContainText("이용 예시");
  });

  test("blocks booking when a critical notice lacks an approved Chinese version", async ({ page }) => {
    await page.goto("/zh-CN/luggage");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("先跟着体验一遍行李配送");
    await expect(page.getByTestId("content-how-it-works")).toHaveAttribute("data-content-status", "ok");
    await expect(page.getByTestId("content-bag-size-rules")).toHaveAttribute("data-content-status", "ok");
    await expect(page.getByTestId("content-prohibited-items")).toHaveAttribute("data-content-status", "blocked");
    // 다른 언어의 필수 문구를 대신 보여 주지 않는다.
    await expect(page.getByText("Prohibited items")).toHaveCount(0);
    await expect(page.getByTestId("booking-blocked")).toBeVisible();
    await expect(page.getByTestId("booking-cta")).toHaveCount(0);
  });

  test("allows booking entry when every critical notice is approved", async ({ page }) => {
    await page.goto("/en/luggage");
    await expect(page.getByTestId("booking-cta")).toBeVisible();
    await page.getByTestId("booking-cta").click();
    await expect(page).toHaveURL(/\/en\/luggage\/book$/);
  });

  test("publishes canonical and hreflang links", async ({ page, baseURL }) => {
    await page.goto("/zh-CN/luggage");
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", `${baseURL}/zh-CN/luggage`);
    for (const lang of ["zh-CN", "ko", "en", "x-default"]) {
      await expect(page.locator(`link[rel="alternate"][hreflang="${lang}"]`)).toHaveCount(1);
    }
  });
});

test.describe("guides and legal pages", () => {
  test("an arrival guide shows its route and related journeys", async ({ page }) => {
    await page.goto("/ko/guide/arrival-day");
    await expect(page.getByTestId("content-page")).toContainText("제주 도착 직후");
    await expect(page.locator(".guide-page__path")).toContainText("제주공항");
    await expect(page.locator(".guide-page__path")).toContainText("숙소");
    await expect(page.locator(".guide-page__related-card")).toHaveCount(2);
    await expect(page.getByTestId("guide-cta")).toHaveAttribute("href", "/ko/luggage/book?route=airport_to_hotel");
  });

  test("marks a general guide shown in a fallback language", async ({ page }) => {
    await page.goto("/zh-CN/guide/airport-pickup-point");
    await expect(page.getByTestId("content-fallback-notice")).toContainText("English");
    await expect(page.getByTestId("content-page").locator("[lang='en']")).toBeVisible();
  });

  test("never substitutes a critical legal notice", async ({ page }) => {
    await page.goto("/zh-CN/legal/prohibited-items");
    await expect(page.getByTestId("content-page")).toHaveAttribute("data-content-status", "blocked");
  });

  test("returns 404 for unknown slugs or the wrong content kind", async ({ page }) => {
    for (const path of ["/zh-CN/guide/does-not-exist", "/zh-CN/guide/prohibited-items", "/zh-CN/legal/how-it-works"]) {
      const response = await page.goto(path);
      expect(response?.status(), path).toBe(404);
    }
  });

  test("lists FAQ entries on the help page", async ({ page }) => {
    await page.goto("/zh-CN/help");
    await expect(page.getByTestId("faq-item")).toHaveCount(13);
    await expect(page.getByText("没有韩国手机号可以预约吗？")).toBeVisible();
  });
});

test("staff and account pages are not indexed", async ({ page }) => {
  for (const path of ["/ko/driver", "/ko/account"]) {
    await page.goto(path);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  }
});

test("non-production robots.txt disallows crawling", async ({ request }) => {
  const body = await (await request.get("/robots.txt")).text();
  expect(body).toMatch(/Disallow: \//);
});
