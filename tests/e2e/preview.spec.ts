import { expect, test } from "@playwright/test";

// 이용 미리보기: 예시 값이 채워진 여정을 '다음'만으로 끝까지 따라간다 (서버 호출 없음).
test("preview walks from prefilled booking to collecting bags", async ({ page }) => {
  await page.goto("/ko/luggage");
  const preview = page.getByTestId("preview-journey");
  await expect(preview.getByRole("tab", { name: /체크아웃 날/ })).toHaveAttribute("aria-selected", "true");
  await preview.getByRole("tab", { name: /제주 도착 직후/ }).click();
  await expect(preview.locator(".pv-route")).toContainText("제주공항");

  const next = () => preview.locator(".pv-nav button").last();
  await next().click();
  await expect(preview.locator(".pv-policies li")).toHaveCount(4);
  await next().click();
  await next().click();
  await expect(preview.locator(".pv-voucher")).toContainText("JC7Q2M4K8A", { timeout: 5000 });

  await next().click();
  await preview.getByRole("button", { name: /빠르게 보기/ }).click();
  await next().click();
  await preview.getByRole("button", { name: /예약증 QR/ }).click();
  await expect(preview.locator(".pv-finish")).toContainText("모든 짐을 받았어요", { timeout: 6000 });
  await expect(preview.getByRole("link", { name: /이 상황으로 예약하기/ })).toHaveAttribute("href", "/ko/luggage/book?route=airport_to_hotel");
});

test("header menu names the service page as a preview", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/zh-CN");
  await expect(page.locator(".customer-header nav").getByRole("link", { name: "服务预览" })).toHaveAttribute("href", "/zh-CN/luggage");
});
