import { describe, expect, it } from "vitest";
import { resolveContent } from "./content";

const ko = { locale: "ko", title: "안내", body: "본문" };
const en = { locale: "en", title: "Guide", body: "Body" };
const zh = { locale: "zh-CN", title: "说明", body: "正文" };

describe("resolveContent", () => {
  it("returns the requested locale when published", () => {
    expect(resolveContent([ko, zh], "zh-CN", "general")).toEqual({ status: "ok", translation: zh, fallback: false });
  });

  it("falls back for general content and marks it", () => {
    expect(resolveContent([ko, en], "zh-CN", "general")).toEqual({
      status: "ok",
      translation: en,
      fallback: true,
      requestedLocale: "zh-CN",
    });
  });

  it("never falls back for critical content", () => {
    expect(resolveContent([ko, en], "zh-CN", "critical")).toEqual({
      status: "blocked",
      reason: "critical_translation_missing",
      requestedLocale: "zh-CN",
    });
  });

  it("ignores unsupported locales such as zh-TW until they are routed", () => {
    expect(resolveContent([{ locale: "zh-TW", title: "說明", body: "" }], "zh-CN", "general")).toEqual({ status: "missing" });
  });
});
