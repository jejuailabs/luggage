import { expect, test } from "@playwright/test";

// 개발 Supabase에 합성 문의를 저장한다. 일반 E2E에서는 외부 Auth/DB에 의존하지 않는다.
test.skip(process.env.LIVE_INQUIRY_TEST !== "1", "requires a reachable development Supabase project");

test("tourism stay quote request reaches the customer's inquiry page", async ({ page }) => {
  await page.goto("/ko/luggage/book?stay=2707417&route=airport_to_hotel");
  const form = page.locator(".stay-search__inquiry form");
  await expect(form).toBeVisible();
  await form.locator('select[name="handoff"]').selectOption({ index: 2 });
  const pickup = new Date(Date.now() + (7 * 24 + 9) * 60 * 60_000).toISOString().slice(0, 16);
  const delivery = new Date(Date.now() + (7 * 24 + 12) * 60 * 60_000).toISOString().slice(0, 16);
  await form.locator('input[name="pickupAt"]').fill(pickup);
  await form.locator('input[name="deliveryAt"]').fill(delivery);
  await form.getByRole("button", { name: "M · 일반 캐리어 +" }).click();
  await form.locator('input[name="contact"]').fill("test@example.invalid");
  await form.locator('textarea[name="notes"]').fill("자동 검증용 합성 문의입니다.");
  await page.locator(".stay-search__summary").getByRole("button", { name: /견적 요청 보내기/ }).click();
  await expect(page).toHaveURL(/\/ko\/help\/requests\/[0-9a-f-]{36}$/);
  await expect(page.getByText("요청을 보내지 못했습니다")).toHaveCount(0);
});

test("stay-to-stay quote request saves a separate destination and both times", async ({ page }) => {
  await page.goto("/ko/luggage/book?stay=4058390&route=hotel_to_hotel");
  const form = page.locator(".stay-search__inquiry form");
  await expect(form).toBeVisible();
  await form.locator('input[name="destinationStay"]').fill("테스트 도착 숙소");
  const pickup = new Date(Date.now() + (8 * 24 + 9) * 60 * 60_000).toISOString().slice(0, 16);
  const delivery = new Date(Date.now() + (8 * 24 + 13) * 60 * 60_000).toISOString().slice(0, 16);
  await form.locator('input[name="pickupAt"]').fill(pickup);
  await form.locator('input[name="deliveryAt"]').fill(delivery);
  await form.getByRole("button", { name: "M · 일반 캐리어 +" }).click();
  await form.locator('input[name="contact"]').fill("test@example.invalid");
  await form.locator('textarea[name="notes"]').fill("숙소 간 이동 자동 검증용 합성 문의입니다.");
  await page.locator(".stay-search__summary").getByRole("button", { name: /견적 요청 보내기/ }).click();
  await expect(page).toHaveURL(/\/ko\/help\/requests\/[0-9a-f-]{36}$/);
  await expect(page.getByText("테스트 도착 숙소").first()).toBeVisible();
});
