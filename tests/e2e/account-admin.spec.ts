import { expect, test } from "@playwright/test";

test("home experiment keeps its assigned copy in the session", async ({ page, baseURL }) => {
  await page.context().addCookies([{ name: "jc_home_hero_v1", value: "B.123e4567-e89b-42d3-a456-426614174000", url: baseURL! }]);
  await page.goto("/ko");
  await expect(page.getByRole("heading", { name: "짐은 맡기고, 제주는 더 가볍게." })).toBeVisible();
  await expect(page.getByRole("link", { name: /이용 가능 숙소 찾기/ })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "짐은 맡기고, 제주는 더 가볍게." })).toBeVisible();
});

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
  await page.goto("/ko/admin/operations", { waitUntil: "domcontentloaded" });
  await expect(page.getByText("업무 계정으로 로그인하세요.")).toBeVisible();
  expect((await request.post("/api/v1/admin/operations", { headers, data: { kind: "zone", code: "test" } })).status()).toBe(401);
  expect((await request.post("/api/v1/admin/content", { headers, data: {} })).status()).toBe(401);
  expect((await request.post("/api/v1/admin/partner-rules", { headers, data: {} })).status()).toBe(401);
  expect((await request.post("/api/v1/admin/handoff-locations", { headers, data: {} })).status()).toBe(401);
  expect((await request.post("/api/v1/admin/invites", { headers, data: {} })).status()).toBe(401);
  expect((await request.post("/api/v1/admin/bag-corrections", { headers, data: {} })).status()).toBe(401);
  expect((await request.post("/api/v1/admin/payment-reviews/00000000-0000-4000-8000-000000000011/reconcile", { headers, data: {} })).status()).toBe(401);
  await page.goto("/ko/admin/dispatch/00000000-0000-4000-8000-000000000011", { waitUntil: "domcontentloaded" });
  await expect(page.getByText("업무 계정으로 로그인하세요.")).toBeVisible();
  await page.goto("/ko/admin/payment-reviews", { waitUntil: "domcontentloaded" });
  await expect(page.getByText("업무 계정으로 로그인하세요.")).toBeVisible();
  await page.goto("/ko/admin/refunds", { waitUntil: "domcontentloaded" });
  await expect(page.getByText("업무 계정으로 로그인하세요.")).toBeVisible();
  expect((await request.post("/api/v1/refunds/00000000-0000-4000-8000-000000000011/reject", { headers, data: { reason: "test" } })).status()).toBe(401);
  expect((await request.get("/api/v1/jobs/purge-evidence")).status()).toBe(403);
  expect((await request.get("/api/v1/jobs/refresh-metrics")).status()).toBe(403);
  expect((await request.get("/api/v1/settlements/00000000-0000-4000-8000-000000000011/statement", { headers })).status()).toBe(401);
  await page.goto("/ko/partner/tags", { waitUntil: "domcontentloaded" });
  await expect(page.getByText("업무 계정으로 로그인하세요.")).toBeVisible();
  expect((await request.post("/api/v1/bags/00000000-0000-4000-8000-000000000011/reissue", { headers, data: { reason: "test" } })).status()).toBe(401);
});
