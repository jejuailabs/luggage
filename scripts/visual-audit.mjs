import { chromium } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const base = process.env.AUDIT_BASE_URL ?? "http://127.0.0.1:3000";
const out = resolve("docs/visual-audit");
const pages = [
  ["home", "/ko"],
  ["hotels", "/ko/hotels"],
  ["hotel", "/ko/hotels/sample-hotel-jeju-city"],
  ["service", "/ko/luggage"],
  ["booking-empty", "/ko/luggage/book"],
  ["booking", "/ko/luggage/book?hotel=sample-hotel-jeju-city"],
  ["mock-pay-empty", "/ko/mock-pay/00000000-0000-0000-0000-000000000000"],
  ["help", "/ko/help"],
  ["account", "/ko/account"],
  ["account-login", "/ko/account/login"],
  ["account-signup", "/ko/account/signup"],
  ["account-track", "/ko/account/track"],
  ["guide", "/ko/guide/how-it-works"],
  ["legal", "/ko/legal/bag-size-rules"],
  ["order-empty", "/ko/orders/00000000-0000-0000-0000-000000000000"],
  ["support-empty", "/ko/help/requests/00000000-0000-0000-0000-000000000000"],
  ["driver", "/ko/driver"],
  ["driver-job", "/ko/driver/jobs/00000000-0000-0000-0000-000000000000"],
  ["partner", "/ko/partner"],
  ["partner-qr", "/ko/partner/qr"],
  ["admin", "/ko/admin"],
  ["admin-members", "/ko/admin/members"],
  ["admin-partners", "/ko/admin/partners"],
  ["admin-orders", "/ko/admin/orders"],
  ["admin-support-list", "/ko/admin/support"],
  ["admin-hotels", "/ko/admin/hotels"],
  ["admin-routes", "/ko/admin/routes"],
  ["admin-dispatch", "/ko/admin/dispatch"],
  ["admin-settlements", "/ko/admin/settlements"],
  ["admin-campaigns", "/ko/admin/campaigns"],
  ["admin-metrics", "/ko/admin/metrics"],
  ["admin-support", "/ko/admin/support/00000000-0000-0000-0000-000000000000"],
  ["notifications", "/ko/notifications"],
];

await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const resultFile = resolve(out, "results.json");
const prior = process.env.AUDIT_APPEND === "1" ? JSON.parse(await readFile(resultFile, "utf8").catch(() => "[]")) : [];
const results = Array.isArray(prior) ? prior : [];
const selected = pages.filter(([name]) => !process.env.AUDIT_PAGES || process.env.AUDIT_PAGES.split(",").includes(name));
for (const [viewport, size] of Object.entries({ mobile: { width: 390, height: 844 }, desktop: { width: 1280, height: 900 } }).filter(([name]) => !process.env.AUDIT_VIEWPORTS || process.env.AUDIT_VIEWPORTS.split(",").includes(name))) {
 for (const theme of ["light", "dark"].filter((name) => !process.env.AUDIT_THEMES || process.env.AUDIT_THEMES.split(",").includes(name))) {
  const context = await browser.newContext({ viewport: size, deviceScaleFactor: 1 });
  await context.addCookies([{ name: "theme", value: theme, url: base }]);
  for (const [name, route] of selected) {
    const page = await context.newPage();
    try {
      const response = await page.goto(`${base}${route}`, { waitUntil: "domcontentloaded", timeout: 15000 });
      await page.waitForTimeout(300);
      const metrics = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        headings: [...document.querySelectorAll("h1")].map((h) => h.textContent?.trim()).filter(Boolean),
        actions: [...document.querySelectorAll("button,a")].map((el) => el.textContent?.trim()).filter(Boolean).slice(0, 35),
        brokenImages: [...document.images].filter((img) => !img.complete || img.naturalWidth === 0).map((img) => img.currentSrc),
      }));
      await page.screenshot({ path: resolve(out, `${theme === "light" ? "" : "dark-"}${viewport}-${name}.png`), fullPage: true, timeout: 15000 });
      results.push({ viewport, theme, name, route, status: response?.status(), ...metrics, overflow: metrics.scrollWidth > metrics.clientWidth });
    } catch (error) {
      results.push({ viewport, theme, name, route, error: String(error).slice(0, 250) });
    } finally {
      await page.close().catch(() => {});
      await writeFile(resultFile, JSON.stringify(results, null, 2) + "\n");
    }
  }
  await context.close();
 }
}
await browser.close();
console.log(JSON.stringify({ screens: results.length, errors: results.filter((r) => r.status !== 200 || r.overflow || r.brokenImages?.length) }, null, 2));
