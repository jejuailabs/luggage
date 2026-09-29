import { expect, test } from "@playwright/test";

const JOB = "00000000-0000-4000-8000-000000000001";

test.describe("field APIs reject anonymous or cross-origin calls", () => {
  const cases: { name: string; method: "post" | "put"; path: string; data: Record<string, unknown> }[] = [
    {
      name: "bag event",
      method: "post",
      path: "/api/v1/bags/events",
      data: { tagId: "TABCDEFGHJK", jobId: JOB, eventType: "collected", clientEventId: "client-evt-123" },
    },
    { name: "driver assignment", method: "put", path: `/api/v1/delivery-jobs/${JOB}/assignment`, data: { driverId: JOB } },
    {
      name: "upload intent",
      method: "post",
      path: "/api/v1/uploads/intents",
      data: { jobId: JOB, purpose: "collection_photo", contentType: "image/jpeg", sizeBytes: 1000 },
    },
    { name: "handoff verify", method: "post", path: "/api/v1/handoffs/verify", data: { jobId: JOB, code: "123456", tagIds: ["TABCDEFGHJK"], clientEventId: "client-evt-123" } },
    { name: "incident", method: "post", path: "/api/v1/incidents", data: { jobId: JOB, type: "damage", description: "x" } },
    { name: "handoff code", method: "post", path: `/api/v1/orders/${JOB}/handoff-challenges`, data: {} },
    {
      name: "support ticket",
      method: "post",
      path: "/api/v1/support/tickets",
      data: { locale: "zh-CN", subject: "s", body: "b", clientMessageId: "client-msg-1234" },
    },
  ];

  for (const c of cases) {
    test(`${c.name}: 401 without session, 403 cross-origin`, async ({ request, baseURL }) => {
      const origin = new URL(baseURL!).origin;
      const same = await request[c.method](c.path, { headers: { Origin: origin }, data: c.data });
      expect(same.status()).toBe(401);
      const cross = await request[c.method](c.path, { headers: { Origin: "https://evil.example" }, data: c.data });
      expect(cross.status()).toBe(403);
    });
  }

  test("checks the session before the body (no information leak to anonymous callers)", async ({ request, baseURL }) => {
    const response = await request.post("/api/v1/handoffs/verify", {
      headers: { Origin: new URL(baseURL!).origin },
      data: { jobId: JOB, code: "12ab", tagIds: ["TABCDEFGHJK"], clientEventId: "client-evt-123" },
    });
    expect(response.status()).toBe(401);
  });

  test("evidence links require a session", async ({ request }) => {
    expect((await request.get(`/api/v1/evidence/${JOB}/url`)).status()).toBe(401);
  });
});

test.describe("field screens", () => {
  for (const path of ["/ko/driver", `/ko/driver/jobs/${JOB}`, "/ko/partner", "/ko/admin/dispatch", `/ko/admin/support/${JOB}`]) {
    test(`${path} requires staff sign-in`, async ({ page }) => {
      await page.goto(path);
      await expect(page.getByTestId("staff-login")).toBeVisible();
    });
  }
});

test.describe("customer support", () => {
  test("help page offers an inquiry form", async ({ page }) => {
    await page.goto("/zh-CN/help");
    await expect(page.getByTestId("support-form")).toBeVisible();
  });

  test("an inquiry thread is private to its owner", async ({ page }) => {
    await page.goto(`/zh-CN/help/requests/${JOB}`);
    await expect(page.getByTestId("request-not-found")).toBeVisible();
  });
});
