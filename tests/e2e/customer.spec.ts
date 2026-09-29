import { expect, test, type Page } from "@playwright/test";

const GOOGLE_HOSTS = /(^|\.)(google|googleapis|gstatic|googletagmanager|google-analytics|recaptcha)\.(com|net)$/;

function trackGoogleRequests(page: Page): string[] {
  const hits: string[] = [];
  page.on("request", (request) => {
    const host = new URL(request.url()).hostname;
    if (GOOGLE_HOSTS.test(host)) hits.push(request.url());
  });
  return hits;
}

test.describe("zh-CN customer home", () => {
  test.use({ locale: "zh-CN" });

  test("redirects to simplified Chinese and shows the booking entry", async ({ page }) => {
    const googleHits = trackGoogleRequests(page);
    await page.goto("/");
    await expect(page).toHaveURL(/\/zh-CN$/);
    await expect(page.locator("html")).toHaveAttribute("lang", "zh-Hans");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("行李交给我们，轻松畅游济州");
    await expect(page.getByText("韩国时间").first()).toBeVisible();
    await expect(page.getByTestId("test-mode-banner")).toBeVisible();
    await expect(page.getByRole("navigation", { name: "主导航" })).toBeVisible();
    await page.waitForLoadState("networkidle");
    expect(googleHits, "customer pages must not call Google services").toEqual([]);
  });
});

test("negotiates Korean from Accept-Language and switches locale", async ({ browser }) => {
  const context = await browser.newContext({ locale: "ko-KR", viewport: { width: 360, height: 740 } });
  const page = await context.newPage();
  await page.goto("/help");
  await expect(page).toHaveURL(/\/ko\/help$/);
  await page.getByTestId("locale-switcher").selectOption("en");
  await expect(page).toHaveURL(/\/en\/help$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Support & FAQ");
  // 선택한 언어는 쿠키로 유지된다.
  await page.goto("/");
  await expect(page).toHaveURL(/\/en$/);
  await context.close();
});

test("theme toggle persists and system mode follows the device", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/zh-CN");
  const html = page.locator("html");
  await expect(html).toHaveAttribute("data-theme", "light");

  await page.getByTestId("theme-quick-toggle").click();
  await expect(html).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(html).toHaveAttribute("data-theme", "dark");
  await expect(html).toHaveAttribute("data-theme-preference", "dark");

  await page.getByTestId("theme-option-system").click();
  await expect(html).toHaveAttribute("data-theme", "light");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(html).toHaveAttribute("data-theme", "dark");
  await expect(page.getByTestId("theme-option-system")).toHaveAttribute("aria-checked", "true");
});

test.describe("runtime environment detection", () => {
  const cases = [
    {
      name: "wechat",
      ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.50 NetType/WIFI Language/zh_CN",
    },
    {
      name: "wechat_miniprogram",
      ua: "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/111.0 Mobile Safari/537.36 MicroMessenger/8.0.49 miniProgram/wx0000000000000000",
    },
    {
      name: "alipay",
      ua: "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/100.0 Mobile Safari/537.36 AlipayClient/10.5.86",
    },
  ];

  for (const { name, ua } of cases) {
    test(name, async ({ browser }) => {
      const context = await browser.newContext({ userAgent: ua, viewport: { width: 360, height: 740 } });
      const page = await context.newPage();
      await page.goto("/zh-CN");
      await expect(page.locator("html")).toHaveAttribute("data-runtime", name);
      await context.close();
    });
  }
});

test("staff screens do not show the customer tab bar", async ({ page }) => {
  await page.goto("/ko/driver");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("기사 작업");
  await expect(page.getByRole("navigation", { name: "주 메뉴" })).toHaveCount(0);
});

test("health endpoint reports mock integrations without secrets", async ({ request }) => {
  const response = await request.get("/api/v1/health");
  expect(response.ok()).toBe(true);
  const body = await response.json();
  expect(body.data).toEqual({
    status: "ok",
    appEnv: "local",
    integrations: { payment: "mock", notification: "mock", maps: "mock", wechat: "mock" },
  });
  expect(JSON.stringify(body)).not.toMatch(/sb_publishable|supabase\.co|secret/i);
});
