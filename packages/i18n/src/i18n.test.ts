import { describe, expect, it } from "vitest";
import { createTranslator, formatKst, formatMoney, getMessages, LOCALES, negotiateLocale } from "./index";

describe("negotiateLocale", () => {
  it("defaults to simplified Chinese", () => {
    expect(negotiateLocale(null)).toBe("zh-CN");
    expect(negotiateLocale("fr-FR,de;q=0.8")).toBe("zh-CN");
  });

  it("maps any Chinese variant to zh-CN until traditional is approved", () => {
    expect(negotiateLocale("zh-TW,zh;q=0.9")).toBe("zh-CN");
  });

  it("respects quality ordering", () => {
    expect(negotiateLocale("en;q=0.5,ko;q=0.9")).toBe("ko");
    expect(negotiateLocale("ko;q=0,en")).toBe("en");
  });
});

describe("messages", () => {
  it("every locale defines every key with non-empty text", () => {
    const base = Object.keys(getMessages("zh-CN")).sort();
    for (const locale of LOCALES) {
      const messages = getMessages(locale);
      expect(Object.keys(messages).sort()).toEqual(base);
      for (const value of Object.values(messages)) expect(value.trim()).not.toBe("");
    }
  });

  it("formats variables", () => {
    expect(createTranslator("ko")("theme.current", { mode: "다크" })).toBe("현재: 다크");
  });
});

describe("formatKst", () => {
  it("shows Korea time regardless of device time zone", () => {
    const utc = new Date("2026-09-29T01:00:00Z");
    expect(formatKst(utc, "en", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" })).toBe("10:00");
  });
});

describe("formatMoney", () => {
  it("formats KRW minor units without decimals", () => {
    expect(formatMoney(30000, "KRW", "ko")).toBe("₩30,000");
  });

  it("rejects non-integer amounts", () => {
    expect(() => formatMoney(10.5, "KRW", "ko")).toThrow(TypeError);
  });
});
