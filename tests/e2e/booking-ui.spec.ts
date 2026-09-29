import { expect, test } from "@playwright/test";

// fixture 모드: 영어 필수 안내는 모두 게시, 중국어는 금지 품목 안내가 없다.
test("asks for a hotel before booking", async ({ page }) => {
  await page.goto("/zh-CN/luggage/book");
  await expect(page.getByRole("link", { name: "选择酒店" })).toBeVisible();
});

test("blocks booking when a required notice is not approved in the customer's language", async ({ page }) => {
  await page.goto("/zh-CN/luggage/book?hotel=sample-hotel-jeju-city");
  await expect(page.getByTestId("booking-blocked")).toBeVisible();
  await expect(page.getByTestId("booking-flow")).toHaveCount(0);
});

test("walks through slot, bags and flight before a price can be requested", async ({ page }) => {
  await page.goto("/en/luggage/book?hotel=sample-hotel-jeju-city");
  await expect(page.getByTestId("booking-flow")).toBeVisible();
  await expect(page.getByTestId("booking-slot")).toHaveCount(2);
  await expect(page.getByTestId("booking-slot").first()).toBeChecked();
  // 한국 시간으로 표시한다 (09:00–11:00 수거)
  await expect(page.getByText("Pickup 09:00–11:00 · Airport handoff 14:00–16:00")).toBeVisible();

  const getQuote = page.getByTestId("booking-get-quote");
  await expect(getQuote).toBeDisabled();

  await page.getByRole("button", { name: "More: Large bag (29 in and up)" }).click();
  await expect(page.getByTestId("bag-count-large")).toHaveText("1");
  await page.getByRole("button", { name: "Fewer: Standard bag (carry-on to 28 in)" }).click();
  await expect(page.getByTestId("bag-count-standard")).toHaveText("0");

  await page.getByTestId("booking-flight-time").fill("20:30");
  await expect(getQuote).toBeEnabled();
});

test("booking and order pages are not indexed", async ({ page }) => {
  await page.goto("/en/luggage/book?hotel=sample-hotel-jeju-city");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
});

test("an order cannot be opened without the owning session", async ({ page }) => {
  await page.goto("/zh-CN/orders/00000000-0000-4000-8000-000000000099");
  await expect(page.getByTestId("order-not-found")).toBeVisible();
  await expect(page.getByTestId("order-code")).toHaveCount(0);
});

test.describe("orders API", () => {
  test("requires an Idempotency-Key and a session", async ({ request, baseURL }) => {
    const origin = new URL(baseURL!).origin;
    const body = {
      quoteId: "00000000-0000-4000-8000-000000000001",
      contact: { name: "王", email: "w@example.com" },
      locale: "zh-CN",
      acceptedPolicies: ["bag-size-rules", "prohibited-items"],
    };
    const noKey = await request.post("/api/v1/orders", { headers: { Origin: origin }, data: body });
    expect(noKey.status()).toBe(400);
    const noSession = await request.post("/api/v1/orders", {
      headers: { Origin: origin, "Idempotency-Key": "test-key-123456" },
      data: body,
    });
    expect(noSession.status()).toBe(401);
    const lookup = await request.get("/api/v1/orders/00000000-0000-4000-8000-000000000001");
    expect(lookup.status()).toBe(401);
  });
});
