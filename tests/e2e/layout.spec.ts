import { expect, test } from "@playwright/test";

// 모바일(360px)과 데스크톱 모두에서 실행한다.
for (const path of ["/zh-CN", "/ko", "/en", "/zh-CN/help", "/zh-CN/luggage", "/ko/admin"]) {
  test(`no horizontal overflow on ${path}`, async ({ page }) => {
    await page.goto(path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
}

test("primary touch targets are at least 44px tall", async ({ page }) => {
  await page.goto("/zh-CN");
  const targets = page.locator("header button, header select, nav a");
  const count = await targets.count();
  expect(count).toBeGreaterThan(0);
  for (let i = 0; i < count; i++) {
    const box = await targets.nth(i).boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  }
});
