import { describe, expect, it } from "vitest";
import { parseAttribution, serializeAttribution } from "./attribution";

describe("attribution cookie", () => {
  it("round-trips a valid value", () => {
    const value = { partnerCode: "SAMPLE01", channel: "hotel_qr" as const, landing: "/zh-CN/h/SAMPLE01" };
    expect(parseAttribution(serializeAttribution(value))).toEqual(value);
  });

  it("ignores tampered or malformed cookies", () => {
    expect(parseAttribution("not json")).toEqual({});
    expect(parseAttribution(JSON.stringify({ partnerCode: "x'; drop", channel: "hotel_qr" }))).toEqual({});
    expect(parseAttribution(JSON.stringify({ channel: "paid_ads" }))).toEqual({});
  });

  it("does not accept personal data fields", () => {
    expect(parseAttribution(JSON.stringify({ channel: "share", email: "a@b.cn" }))).toEqual({ channel: "share" });
  });
});
