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
  ["demo", "/ko/demo"],
  ["demo-driver", "/ko/demo?role=driver"],
  ["home-zh", "/zh-CN"],
  ["home-en", "/en"],
  ["booking-zh", "/zh-CN/luggage/book?hotel=sample-hotel-jeju-city"],
  ["demo-zh", "/zh-CN/demo"],
  ["hotel-zh", "/zh-CN/hotels/sample-hotel-jeju-city"],
  ["service-en", "/en/luggage"],
  ["service-zh", "/zh-CN/luggage"],
  ["help-zh", "/zh-CN/help"],
  ["account-en", "/en/account"],
  ["guide-checkout", "/ko/guide/checkout-day"],
  ["admin-en", "/en/admin"],
  ["partner-zh", "/zh-CN/partner"],
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
        ...(() => {
          const rgb = (value) => { const parts = (value.match(/[\d.]+/g) ?? []).map(Number); return value.startsWith("color(") ? [parts[0] * 255, parts[1] * 255, parts[2] * 255, parts[3] ?? 1] : parts; };
          const lum = ([r, g, b]) => { const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
          const background = (el) => { for (let node = el; node; node = node.parentElement) { const style = getComputedStyle(node); if (style.backgroundImage !== "none") return null; const color = rgb(style.backgroundColor); if (color.length >= 3 && (color[3] ?? 1) > 0.9) return color; } return [255, 255, 255]; };
          const lowContrast = [];
          const clipped = [];
          const smallTargets = [];
          for (const el of document.querySelectorAll("body *")) {
            const rect = el.getBoundingClientRect();
            if (!rect.width || !rect.height) continue;
            const style = getComputedStyle(el);
            if (style.visibility === "hidden" || Number(style.opacity) === 0) continue;
            const ownText = [...el.childNodes].some((node) => node.nodeType === 3 && node.textContent.trim());
            if (ownText && !el.matches(".sr-only") && lowContrast.length < 8) {
              const bg = background(el);
              if (bg) {
                const fg = rgb(style.color);
                const [a, b] = [lum(fg), lum(bg)].sort((x, y) => y - x);
                const ratio = (a + 0.05) / (b + 0.05);
                const large = parseFloat(style.fontSize) >= 24 || (parseFloat(style.fontSize) >= 18.66 && Number(style.fontWeight) >= 700);
                if (ratio < (large ? 3 : 4.5)) lowContrast.push(`${el.tagName.toLowerCase()}.${String(el.className).split(" ")[0]} "${el.textContent.trim().slice(0, 24)}" ${ratio.toFixed(2)}`);
              }
            }
            if (ownText && !el.matches(".sr-only") && el.scrollWidth > el.clientWidth + 2 && style.overflowX !== "visible" && style.textOverflow !== "ellipsis" && clipped.length < 6) clipped.push(`${el.tagName.toLowerCase()}.${String(el.className).split(" ")[0]} "${el.textContent.trim().slice(0, 24)}"`);
            if (el.matches("a,button,input,select,textarea") && el.closest(".customer-main") && (rect.height < 32 || rect.width < 32) && smallTargets.length < 6) smallTargets.push(`${el.tagName.toLowerCase()} "${(el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 20)}" ${Math.round(rect.width)}x${Math.round(rect.height)}`);
          }
          const placeholders = (document.body.innerText.match(/\[(예시|示例|Sample)\]/g) ?? []).length;
          return { lowContrast, clipped, smallTargets, placeholders };
        })(),
      }));
      await page.screenshot({ path: resolve(out, `${theme === "light" ? "" : "dark-"}${viewport}-${name}.png`), fullPage: true, timeout: 15000 });
      results.push({ viewport, theme, name, route, status: response?.status(), ...metrics, overflow: metrics.scrollWidth > metrics.clientWidth });
    } catch (error) {
      results.push({ viewport, theme, name, route, error: String(error).slice(0, 250) });
    } finally {
      await page.close().catch(() => {});
      // Windows에서 결과 파일이 잠깐 잠길 수 있어 중간 저장 실패는 무시하고 마지막에 다시 쓴다.
      await writeFile(resultFile, JSON.stringify(results, null, 2) + "\n").catch(() => {});
    }
  }
  await context.close();
 }
}
await browser.close();
for (let attempt = 0; attempt < 5; attempt += 1) {
  try { await writeFile(resultFile, JSON.stringify(results, null, 2) + "\n"); break; } catch { await new Promise((done) => setTimeout(done, 500)); }
}
console.log(JSON.stringify({ screens: results.length, errors: results.filter((r) => r.status !== 200 || r.overflow || r.brokenImages?.length || r.lowContrast?.length || r.clipped?.length || r.smallTargets?.length).map(({ viewport, theme, name, status, error, overflow, brokenImages, lowContrast, clipped, smallTargets }) => ({ viewport, theme, name, status, error, overflow, brokenImages, lowContrast, clipped, smallTargets })) }, null, 2));
