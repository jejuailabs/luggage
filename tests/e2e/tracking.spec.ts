import { createHmac } from "node:crypto";
import { expect, test } from "@playwright/test";

const SECRET = "e2e-tracking-secret-0000";
const JOB = "00000000-0000-4000-8000-000000000001";

function signed(body: string, secret = SECRET, timestamp = Math.floor(Date.now() / 1000)) {
  return {
    "x-tracking-timestamp": String(timestamp),
    "x-tracking-signature": createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex"),
    "content-type": "application/json",
  };
}

const point = () => JSON.stringify({ deviceId: "DEV-001", latitude: 33.4996, longitude: 126.5312, accuracyM: 12, observedAt: new Date().toISOString() });

test.describe("telematics webhook", () => {
  test("rejects forged or replayed requests", async ({ request }) => {
    const body = point();
    expect((await request.post("/api/v1/tracking/webhooks/telematics", { headers: signed(body, "wrong-secret-00000000"), data: body })).status()).toBe(403);
    const old = Math.floor(Date.now() / 1000) - 900;
    expect((await request.post("/api/v1/tracking/webhooks/telematics", { headers: signed(body, SECRET, old), data: body })).status()).toBe(403);
  });

  test("accepts a signed point but never records without the server role", async ({ request }) => {
    const body = point();
    const response = await request.post("/api/v1/tracking/webhooks/telematics", { headers: signed(body), data: body });
    expect(response.status()).toBe(503);
  });
});

test.describe("location APIs are protected", () => {
  test("driver location, vehicle assignment and registration need staff sessions", async ({ request, baseURL }) => {
    const origin = new URL(baseURL!).origin;
    const location = await request.post("/api/v1/tracking/driver-location", {
      headers: { Origin: origin },
      data: { jobId: JOB, latitude: 33.5, longitude: 126.5, accuracyM: 10, observedAt: new Date().toISOString() },
    });
    expect(location.status()).toBe(401);
    expect((await request.put(`/api/v1/delivery-jobs/${JOB}/vehicle`, { headers: { Origin: origin }, data: { vehicleId: null } })).status()).toBe(401);
    expect((await request.post("/api/v1/vehicles", { headers: { Origin: origin }, data: { label: "1호차" } })).status()).toBe(401);
    expect(
      (await request.post("/api/v1/tracking/driver-location", { headers: { Origin: "https://evil.example" }, data: {} })).status(),
    ).toBe(403);
  });

  test("retention job requires the cron secret", async ({ request }) => {
    expect((await request.get("/api/v1/jobs/purge-locations")).status()).toBe(403);
  });
});
