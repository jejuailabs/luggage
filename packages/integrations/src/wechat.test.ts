import { describe, expect, it } from "vitest";
import { MockMiniProgramPaymentAdapter, MockWeChatIdentityAdapter, WeChatCodeError } from "./wechat";

describe("MockWeChatIdentityAdapter", () => {
  const adapter = new MockWeChatIdentityAdapter();

  it("returns a stable openid per code and no unionid", async () => {
    const a = await adapter.exchangeCode("code-12345678");
    const b = await adapter.exchangeCode("code-12345678");
    expect(a).toEqual(b);
    expect(a.openid).toMatch(/^mock_[0-9a-f]{24}$/);
    expect(a.unionid).toBeNull();
  });

  it("rejects malformed codes", async () => {
    await expect(adapter.exchangeCode("x")).rejects.toBeInstanceOf(WeChatCodeError);
  });
});

describe("MockMiniProgramPaymentAdapter", () => {
  it("returns well-formed but clearly mock payment params", async () => {
    const adapter = new MockMiniProgramPaymentAdapter(() => new Date("2026-09-29T00:00:00Z"));
    const result = await adapter.prepare({ merchantOrderId: "JCABCDEFGH-1", amountMinor: 15000, currency: "KRW", payerOpenid: "mock_x" });
    expect(result.mock).toBe(true);
    expect(result.params).toMatchObject({ timeStamp: "1790640000", package: "prepay_id=mock_JCABCDEFGH-1", paySign: "MOCK_SIGNATURE" });
  });
});
