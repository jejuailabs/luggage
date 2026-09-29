import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { as, confirmedOrder, createUser, setupBookingFixture } from "./support/booking";
import { asRole, connect } from "./support/db";

let client: pg.Client;
let fixture: Awaited<ReturnType<typeof setupBookingFixture>>;
let customer: string;
let otherCustomer: string;
let driver: string;
let otherDriver: string;
let dispatcher: string;
let vehicleId: string;
let seq = 0;
const key = () => `track-${++seq}-${Date.now()}`;

async function activeJob() {
  const order = await confirmedOrder(fixture, customer, { standard: 1 });
  const job = (await client.query("select id from public.delivery_jobs where order_id = $1", [order.id])).rows[0].id as string;
  await as("authenticated", dispatcher, "select public.assign_driver($1, $2)", [job, driver]);
  const tag = (await client.query("select tag_id from public.bags where order_id = $1", [order.id])).rows[0].tag_id;
  await as("authenticated", driver, "select public.record_bag_event($1, $2, 'collected', $3, now(), null, '{}', '사유')", [tag, job, key()]);
  return { order, job, tag };
}

function driverPing(job: string, actor = driver, observedAt: Date = new Date(), accuracy = 20) {
  return as<{ r: string }>("authenticated", actor, "select public.record_driver_location($1, 33.499621, 126.531188, $2, $3) as r", [job, accuracy, observedAt]);
}

beforeAll(async () => {
  client = await connect();
  fixture = await setupBookingFixture(client, 9);
  customer = await createUser(client, { anonymous: true });
  otherCustomer = await createUser(client, { anonymous: true });
  driver = await createUser(client, { role: "driver" });
  otherDriver = await createUser(client, { role: "driver" });
  dispatcher = await createUser(client, { role: "dispatcher" });
  vehicleId = (await client.query("insert into public.vehicles (label, telematics_device_id) values ('1호차', 'DEV-001') returning id")).rows[0].id;
});

afterAll(async () => {
  await client.end();
});

describe("driver device location", () => {
  it("is accepted only from the assigned driver while the job is active, with throttling", async () => {
    const { job } = await activeJob();
    await expect(driverPing(job, otherDriver)).rejects.toThrow("LUGGAGE:FORBIDDEN");
    expect((await driverPing(job)).r).toBe("recorded");
    expect((await driverPing(job)).r).toBe("throttled");
  });

  it("rejects stale, future and inaccurate points", async () => {
    const { job } = await activeJob();
    await expect(driverPing(job, driver, new Date(Date.now() - 10 * 60_000))).rejects.toThrow("LUGGAGE:LOCATION_STALE");
    await expect(driverPing(job, driver, new Date(Date.now() + 10 * 60_000))).rejects.toThrow("LUGGAGE:LOCATION_STALE");
    await expect(driverPing(job, driver, new Date(), 3000)).rejects.toThrow("LUGGAGE:LOCATION_INACCURATE");
  });
});

describe("telematics", () => {
  it("records the vehicle position for its active jobs only (server only)", async () => {
    const { job } = await activeJob();
    await as("authenticated", dispatcher, "select public.set_job_vehicle($1, $2)", [job, vehicleId]);
    await expect(
      as("authenticated", driver, "select public.ingest_telematics_location('DEV-001', 33.5, 126.5, 10, now())"),
    ).rejects.toThrow(/permission denied/);
    const n = await as<{ n: number }>("service_role", null, "select public.ingest_telematics_location('DEV-001', 33.51, 126.52, 10, now()) as n");
    expect(n.n).toBeGreaterThanOrEqual(1);
    const unknown = await as<{ n: number }>("service_role", null, "select public.ingest_telematics_location('UNKNOWN', 33.51, 126.52, 10, now()) as n");
    expect(unknown.n).toBe(0);
  });
});

describe("customer view", () => {
  it("shows a rounded, labelled last position only to the owner while bags are in the vehicle", async () => {
    const { order, job, tag } = await activeJob();
    await driverPing(job);
    const view = await as<{ latitude: string; longitude: string; stale: boolean; source: string }>(
      "authenticated",
      customer,
      "select * from public.latest_vehicle_location($1)",
      [order.id],
    );
    expect(view).toMatchObject({ latitude: "33.500", longitude: "126.531", stale: false, source: "driver_device" });
    await expect(as("authenticated", otherCustomer, "select * from public.latest_vehicle_location($1)", [order.id])).rejects.toThrow(
      "LUGGAGE:ORDER_NOT_FOUND",
    );
    // 원시 위치 테이블은 고객에게 보이지 않는다
    const raw = await asRole(client, "authenticated", async (c) => (await c.query("select count(*)::int as n from public.vehicle_locations")).rows[0].n, {
      userId: customer,
    });
    expect(raw).toBe(0);

    // 인계 준비 이후에는 위치를 보여 주지 않는다
    await as("authenticated", driver, "select public.record_bag_event($1, $2, 'loaded', $3)", [tag, job, key()]);
    await as("authenticated", driver, "select public.record_bag_event($1, $2, 'ready_for_handoff', $3)", [tag, job, key()]);
    const after = await as<unknown>("authenticated", customer, "select * from public.latest_vehicle_location($1)", [order.id]);
    expect(after).toBeUndefined();
  });

  it("marks positions older than five minutes as stale", async () => {
    const { order, job } = await activeJob();
    await client.query(
      "insert into public.vehicle_locations (job_id, source, latitude, longitude, accuracy_m, observed_at) values ($1, 'telematics', 33.5, 126.5, 10, now() - interval '20 minutes')",
      [job],
    );
    const view = await as<{ stale: boolean }>("authenticated", customer, "select * from public.latest_vehicle_location($1)", [order.id]);
    expect(view.stale).toBe(true);
  });
});

describe("retention", () => {
  it("purges old positions", async () => {
    const { job } = await activeJob();
    await client.query(
      "insert into public.vehicle_locations (job_id, source, latitude, longitude, observed_at, received_at) values ($1, 'mock', 33.5, 126.5, now() - interval '9 days', now() - interval '9 days')",
      [job],
    );
    const n = await as<{ n: number }>("service_role", null, "select public.purge_vehicle_locations(7) as n");
    expect(n.n).toBeGreaterThanOrEqual(1);
  });
});
