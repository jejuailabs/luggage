import { describe, expect, it } from "vitest";
import { mapDeepLinks, parseTelematicsWebhook, signTrackingPayload, TrackingWebhookError } from "./tracking";

const SECRET = "tracking-secret-0123456789";
const NOW = new Date("2026-09-29T01:00:00Z");
const ts = Math.floor(NOW.getTime() / 1000);
const body = JSON.stringify({ deviceId: "DEV-001", latitude: 33.4996, longitude: 126.5312, accuracyM: 12.4, observedAt: "2026-09-29T00:59:30Z" });

function headers(signature: string, timestamp = ts) {
  return new Headers({ "x-tracking-timestamp": String(timestamp), "x-tracking-signature": signature });
}

describe("parseTelematicsWebhook", () => {
  it("accepts a signed, fresh point", () => {
    const point = parseTelematicsWebhook(SECRET, headers(signTrackingPayload(SECRET, ts, body)), body, NOW);
    expect(point).toEqual({ deviceId: "DEV-001", latitude: 33.4996, longitude: 126.5312, accuracyM: 12, observedAt: "2026-09-29T00:59:30.000Z" });
  });

  it("rejects a tampered body or wrong secret", () => {
    const tampered = body.replace("33.4996", "37.5");
    expect(() => parseTelematicsWebhook(SECRET, headers(signTrackingPayload(SECRET, ts, body)), tampered, NOW)).toThrow(TrackingWebhookError);
    expect(() => parseTelematicsWebhook(SECRET, headers(signTrackingPayload("other-secret-000000", ts, body)), body, NOW)).toThrow(/signature/);
  });

  it("rejects replays outside five minutes", () => {
    const old = ts - 600;
    expect(() => parseTelematicsWebhook(SECRET, headers(signTrackingPayload(SECRET, old, body), old), body, NOW)).toThrow(/stale/);
  });

  it("rejects out-of-range coordinates", () => {
    const bad = JSON.stringify({ deviceId: "DEV-001", latitude: 120, longitude: 126.5, observedAt: "2026-09-29T00:59:30Z" });
    expect(() => parseTelematicsWebhook(SECRET, headers(signTrackingPayload(SECRET, ts, bad)), bad, NOW)).toThrow(/invalid point/);
  });
});

describe("mapDeepLinks", () => {
  it("builds Amap, Baidu and Apple links with WGS84 and no Google", () => {
    const links = mapDeepLinks(33.5, 126.531, "配送车辆");
    expect(links.amap).toContain("coordinate=wgs84");
    expect(links.baidu).toContain("coord_type=wgs84");
    expect(Object.values(links).join(" ")).not.toMatch(/google/);
  });
});
