import { describe, expect, it } from "vitest";
import { MockPaymentAdapter, WebhookVerificationError } from "./payment";

const NOW = new Date("2026-09-29T03:00:00Z");
const adapter = new MockPaymentAdapter("local-mock-secret-0123456789", "https://app.test/zh-CN/mock-pay", () => NOW);

const event = {
  eventId: "evt-1",
  merchantOrderId: "JCABCDEFGH-1",
  status: "succeeded" as const,
  amountMinor: 15000,
  currency: "KRW",
  issuedAt: NOW.toISOString(),
};

function headers(signature: string) {
  return new Headers({ [MockPaymentAdapter.signatureHeader]: signature });
}

describe("MockPaymentAdapter", () => {
  it("redirects to the mock checkout with a return URL", async () => {
    const session = await adapter.createSession({
      attemptId: "att-1",
      merchantOrderId: "JCABCDEFGH-1",
      amountMinor: 15000,
      currency: "KRW",
      method: "alipay",
      returnUrl: "https://app.test/zh-CN/orders/o1",
    });
    expect(session.action).toEqual({
      type: "redirect",
      url: "https://app.test/zh-CN/mock-pay/att-1?return=https%3A%2F%2Fapp.test%2Fzh-CN%2Forders%2Fo1",
    });
  });

  it("accepts a correctly signed, fresh event", () => {
    const { body, signature } = adapter.signEvent(event);
    const notification = adapter.parseWebhook(headers(signature), body);
    expect(notification).toMatchObject({ eventId: "evt-1", merchantOrderId: "JCABCDEFGH-1", reported: { status: "succeeded", amountMinor: 15000 } });
  });

  it("rejects a tampered body", () => {
    const { signature } = adapter.signEvent(event);
    const forged = JSON.stringify({ ...event, amountMinor: 1 });
    expect(() => adapter.parseWebhook(headers(signature), forged)).toThrow(WebhookVerificationError);
  });

  it("rejects a missing signature", () => {
    expect(() => adapter.parseWebhook(new Headers(), JSON.stringify(event))).toThrow(WebhookVerificationError);
  });

  it("rejects stale events (replay)", () => {
    const { body, signature } = adapter.signEvent({ ...event, issuedAt: new Date(NOW.getTime() - 10 * 60_000).toISOString() });
    expect(() => adapter.parseWebhook(headers(signature), body)).toThrow(/stale/);
  });

  it("reports pending when no notification is known", async () => {
    expect((await adapter.retrieve("JCABCDEFGH-1")).status).toBe("pending");
  });

  it("requires a non-trivial secret", () => {
    expect(() => new MockPaymentAdapter("short", "https://x")).toThrow();
  });
});
