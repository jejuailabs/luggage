import { createHmac } from "node:crypto";
import { expect, test } from "@playwright/test";

// 로컬 기본 mock 서명 키 (apps/web/src/lib/env.ts). 실제 비밀값이 아니다.
const LOCAL_MOCK_SECRET = "local-mock-payment-secret";
const ORDER_ID = "00000000-0000-4000-8000-000000000001";

function signed(event: Record<string, unknown>, secret = LOCAL_MOCK_SECRET) {
  const body = JSON.stringify(event);
  return { body, signature: createHmac("sha256", secret).update(body).digest("hex") };
}

const event = () => ({
  eventId: `evt-${Date.now()}`,
  merchantOrderId: "JCABCDEFGH-1",
  status: "succeeded",
  amountMinor: 15000,
  currency: "KRW",
  issuedAt: new Date().toISOString(),
});

test.describe("payment webhooks", () => {
  test("reject a forged signature", async ({ request }) => {
    const { body } = signed(event(), "attacker-secret-0000");
    const response = await request.post("/api/v1/payments/webhooks/mock", {
      headers: { "x-mock-signature": createHmac("sha256", "attacker-secret-0000").update(body).digest("hex") },
      data: body,
    });
    expect(response.status()).toBe(403);
  });

  test("reject unknown providers", async ({ request }) => {
    const response = await request.post("/api/v1/payments/webhooks/unknownpay", { data: "{}" });
    expect(response.status()).toBe(404);
  });

  test("never confirms without the server database role (asks the PG to retry)", async ({ request }) => {
    const { body, signature } = signed(event());
    const response = await request.post("/api/v1/payments/webhooks/mock", {
      headers: { "x-mock-signature": signature, "content-type": "application/json" },
      data: body,
    });
    // E2E 환경에는 SUPABASE_SERVER_SECRET이 없다 → 확정하지 않고 503
    expect(response.status()).toBe(503);
  });
});

test.describe("payment attempts API", () => {
  test("requires an idempotency key", async ({ request, baseURL }) => {
    const response = await request.post(`/api/v1/orders/${ORDER_ID}/payment-attempts`, {
      headers: { Origin: new URL(baseURL!).origin },
      data: { method: "alipay", locale: "zh-CN" },
    });
    expect(response.status()).toBe(400);
  });

  test("refuses WeChat JSAPI outside WeChat", async ({ request, baseURL }) => {
    const response = await request.post(`/api/v1/orders/${ORDER_ID}/payment-attempts`, {
      headers: { Origin: new URL(baseURL!).origin, "Idempotency-Key": "pay-key-12345678" },
      data: { method: "wechat_pay_jsapi", locale: "zh-CN" },
    });
    expect(response.status()).toBe(422);
    expect((await response.json()).error.messageKey).toBe("payment.methodUnavailable");
  });

  test("requires a session for an allowed method", async ({ request, baseURL }) => {
    const response = await request.post(`/api/v1/orders/${ORDER_ID}/payment-attempts`, {
      headers: { Origin: new URL(baseURL!).origin, "Idempotency-Key": "pay-key-12345678" },
      data: { method: "alipay", locale: "zh-CN" },
    });
    expect(response.status()).toBe(401);
  });
});

test.describe("customer actions and jobs", () => {
  test("mock checkout result requires the owning session", async ({ request, baseURL }) => {
    const response = await request.post(`/api/v1/payments/mock/${ORDER_ID}`, {
      headers: { Origin: new URL(baseURL!).origin },
      data: { outcome: "succeeded" },
    });
    expect(response.status()).toBe(401);
  });

  test("mock checkout page is not reachable without the attempt owner", async ({ page }) => {
    const response = await page.goto(`/zh-CN/mock-pay/${ORDER_ID}`);
    expect(response?.status()).toBe(404);
  });

  test("cancellation requires a session", async ({ request, baseURL }) => {
    const response = await request.post(`/api/v1/orders/${ORDER_ID}/cancellation-requests`, {
      headers: { Origin: new URL(baseURL!).origin },
      data: {},
    });
    expect(response.status()).toBe(401);
  });

  test("refund approval requires finance staff", async ({ request, baseURL }) => {
    const response = await request.post(`/api/v1/refunds/${ORDER_ID}/approve`, { headers: { Origin: new URL(baseURL!).origin } });
    expect(response.status()).toBe(401);
  });

  test("scheduled jobs reject calls without the cron secret", async ({ request }) => {
    expect((await request.get("/api/v1/jobs/expire-holds")).status()).toBe(403);
    expect((await request.get("/api/v1/jobs/reconcile-payments", { headers: { Authorization: "Bearer wrong-secret-value" } })).status()).toBe(403);
  });
});

test.describe("WeChat mini program", () => {
  const MINIPROGRAM_UA =
    "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/111.0 Mobile Safari/537.36 MicroMessenger/8.0.49 miniProgram/wx0000000000000000";

  test("mini program payment is delegated only inside the mini program", async ({ request, baseURL }) => {
    const origin = new URL(baseURL!).origin;
    const outside = await request.post(`/api/v1/orders/${ORDER_ID}/payment-attempts`, {
      headers: { Origin: origin, "Idempotency-Key": "mp-key-12345678" },
      data: { method: "wechat_pay_miniprogram", locale: "zh-CN" },
    });
    expect(outside.status()).toBe(422);
    const inside = await request.post(`/api/v1/orders/${ORDER_ID}/payment-attempts`, {
      headers: { Origin: origin, "Idempotency-Key": "mp-key-12345678", "User-Agent": MINIPROGRAM_UA },
      data: { method: "wechat_pay_miniprogram", locale: "zh-CN" },
    });
    // 방식은 허용되지만 주문 소유 세션이 필요하다
    expect(inside.status()).toBe(401);
  });

  test("pay ticket redemption validates input and never confirms without the server role", async ({ request }) => {
    expect((await request.post("/api/v1/wechat/pay-tickets/redeem", { data: { ticket: "x", code: "y" } })).status()).toBe(400);
    const response = await request.post("/api/v1/wechat/pay-tickets/redeem", {
      data: { ticket: "a".repeat(64), code: "wx-code-12345678" },
    });
    // E2E 환경에는 service role 키가 없다 → 결제 파라미터를 만들지 않는다
    expect(response.status()).toBe(503);
  });

  test("mock completion requires a valid token", async ({ request }) => {
    const response = await request.post("/api/v1/wechat/mock-complete", {
      data: { attemptId: ORDER_ID, token: "b".repeat(64), outcome: "succeeded" },
    });
    expect(response.status()).toBe(403);
  });
});
