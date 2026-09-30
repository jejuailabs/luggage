import { expect, test } from "@playwright/test";

test("account exposes booking, signup, login and bag tracking paths", async ({ page }) => {
  await page.goto("/ko/account");
  await expect(page.getByRole("heading", { name: "내 짐 현재 위치" })).toBeVisible();
  await expect(page.getByRole("link", { name: /GPS 추적 해보기/ })).toHaveAttribute("href", "/ko/account/track");
  await expect(page.getByRole("link", { name: /회원가입/ })).toHaveAttribute("href", "/ko/account/signup");
  await page.goto("/ko/account/signup");
  await expect(page.getByTestId("customer-auth-form")).toBeVisible();
  await page.goto("/ko/account/login");
  await expect(page.getByTestId("customer-auth-form")).toBeVisible();
});

test("admin member and partner screens require staff access", async ({ page, request, baseURL }) => {
  await page.goto("/ko/admin/members", { waitUntil: "domcontentloaded" });
  await expect(page.getByText("업무 계정으로 로그인하세요.")).toBeVisible();
  const headers = { Origin: new URL(baseURL!).origin };
  expect((await request.get("/api/v1/admin/members", { headers })).status()).toBe(401);
  expect((await request.post("/api/v1/admin/partners", { headers, data: { name: "Example" } })).status()).toBe(401);
});
