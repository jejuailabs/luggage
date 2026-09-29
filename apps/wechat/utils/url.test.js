import { describe, expect, it } from "vitest";
import url from "./url.js";

const { buildWebViewUrl, parsePayQuery } = url;
const ORIGIN = "https://app.test";

describe("buildWebViewUrl", () => {
  it("opens the default locale home without a path", () => {
    expect(buildWebViewUrl(ORIGIN, undefined, "zh-CN")).toBe("https://app.test/zh-CN");
  });

  it("keeps same-origin locale paths", () => {
    expect(buildWebViewUrl(ORIGIN, encodeURIComponent("/zh-CN/orders/abc?x=1"), "zh-CN")).toBe("https://app.test/zh-CN/orders/abc?x=1");
  });

  it("refuses external or protocol-relative targets", () => {
    for (const bad of ["https://evil.test", "//evil.test/zh-CN", "/fr/x", "javascript:alert(1)"]) {
      expect(buildWebViewUrl(ORIGIN, encodeURIComponent(bad), "zh-CN")).toBe("https://app.test/zh-CN");
    }
  });
});

describe("parsePayQuery", () => {
  const ticket = "a".repeat(64);
  const orderId = "00000000-0000-4000-8000-000000000001";

  it("accepts a well-formed ticket and order", () => {
    expect(parsePayQuery({ ticket, orderId, locale: "ko" })).toEqual({ ticket, orderId, locale: "ko" });
  });

  it("rejects malformed input", () => {
    expect(parsePayQuery({ ticket: "x", orderId })).toBeNull();
    expect(parsePayQuery({ ticket, orderId: "not-an-id" })).toBeNull();
  });

  it("falls back to simplified Chinese", () => {
    expect(parsePayQuery({ ticket, orderId, locale: "fr" }).locale).toBe("zh-CN");
  });
});
