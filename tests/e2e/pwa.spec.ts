import { expect, test, type Page } from "@playwright/test";

async function controlledBy(page: Page) {
  await page.goto("/zh-CN");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  // 첫 방문 뒤 새로고침하면 서비스 워커가 페이지를 제어한다.
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
}

test.describe("installable PWA", () => {
  test("serves a manifest with standalone display and icons", async ({ request }) => {
    const manifest = await (await request.get("/manifest.webmanifest")).json();
    expect(manifest).toMatchObject({ display: "standalone", start_url: "/", theme_color: "#0F766E" });
    const sizes = manifest.icons.map((icon: { sizes: string }) => icon.sizes);
    expect(sizes).toEqual(expect.arrayContaining(["192x192", "512x512"]));
    expect(manifest.icons.some((icon: { purpose?: string }) => icon.purpose === "maskable")).toBe(true);
    for (const icon of manifest.icons) expect((await request.get(icon.src)).ok()).toBe(true);
  });

  test("serves the service worker and offline page", async ({ request }) => {
    const sw = await request.get("/sw.js");
    expect(sw.ok()).toBe(true);
    expect(await sw.text()).toContain("showNotification");
    expect(await (await request.get("/offline.html")).text()).toContain("当前离线");
  });
});

test.describe("offline behaviour", () => {
  test("shows the offline page instead of a browser error and never confirms offline", async ({ page, context }) => {
    await controlledBy(page);
    await context.setOffline(true);
    await page.goto("/zh-CN/luggage").catch(() => undefined);
    await expect(page.getByText("当前离线")).toBeVisible();
    await expect(page.getByText("离线时无法付款或完成交付")).toBeVisible();
    await context.setOffline(false);
  });

  test("shows saved vouchers with their last server check time", async ({ page, context }) => {
    await controlledBy(page);
    await page.evaluate(async () => {
      await new Promise<void>((resolve, reject) => {
        const open = indexedDB.open("luggage-local", 1);
        open.onupgradeneeded = () => {
          for (const name of ["queue", "vouchers", "jobs"]) open.result.createObjectStore(name);
        };
        open.onsuccess = () => {
          const tx = open.result.transaction(["vouchers", "queue"], "readwrite");
          tx.objectStore("vouchers").put(
            { orderId: "o1", publicCode: "JCABCDEFGH", lines: ["酒店 → 机场", "TABCDEFGHJK"], checkedAtKst: "2026年9月29日 10:00" },
            "o1",
          );
          tx.objectStore("queue").put({ clientEventId: "q1", body: { tagId: "TABCDEFGHJK" }, queuedAt: "2026-09-29T00:00:00Z" }, "q1");
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        };
      });
    });
    await context.setOffline(true);
    await page.goto("/zh-CN/orders/o1").catch(() => undefined);
    await expect(page.getByText("JCABCDEFGH")).toBeVisible();
    await expect(page.getByText(/2026年9月29日 10:00/)).toBeVisible();
    await expect(page.locator("#pending-count")).toHaveText("1");
    await context.setOffline(false);
  });

  test("never caches API responses", async ({ page }) => {
    await controlledBy(page);
    await page.evaluate(() => fetch("/api/v1/hotels?q=Sample&locale=en"));
    const cached = await page.evaluate(async () => {
      const urls: string[] = [];
      for (const key of await caches.keys()) {
        for (const request of await (await caches.open(key)).keys()) urls.push(new URL(request.url).pathname);
      }
      return urls;
    });
    expect(cached.some((path) => path.startsWith("/api/"))).toBe(false);
  });
});

test.describe("staff notifications", () => {
  test("push subscription and outbox job are protected", async ({ request, baseURL }) => {
    const origin = new URL(baseURL!).origin;
    const subscribe = await request.post("/api/v1/push/subscriptions", {
      headers: { Origin: origin },
      data: { endpoint: "https://push.example/x", keys: { p256dh: "k".repeat(20), auth: "a".repeat(10) } },
    });
    expect(subscribe.status()).toBe(401);
    expect((await request.get("/api/v1/jobs/dispatch-outbox")).status()).toBe(403);
  });

  test("notification inbox requires staff sign-in", async ({ page }) => {
    await page.goto("/ko/notifications");
    await expect(page.getByTestId("staff-login")).toBeVisible();
  });
});
