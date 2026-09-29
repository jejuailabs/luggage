import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { as, confirmedOrder, createUser, setupBookingFixture } from "./support/booking";
import { connect } from "./support/db";

let client: pg.Client;
let fixture: Awaited<ReturnType<typeof setupBookingFixture>>;
let customer: string;
let driver1: string;
let driver2: string;
let dispatcher: string;
let cityStaff: string;
let otherStaff: string;
let seq = 0;

const eventId = () => `client-evt-${++seq}-${Date.now()}`;

async function jobFor(orderId: string) {
  return (await client.query("select id, status from public.delivery_jobs where order_id = $1", [orderId])).rows[0] as { id: string; status: string };
}

async function tags(orderId: string): Promise<string[]> {
  return (await client.query("select tag_id from public.bags where order_id = $1 order by seq", [orderId])).rows.map((r) => r.tag_id);
}

function event(actor: string, tag: string, jobId: string, type: string, extra: { id?: string; note?: string; version?: number } = {}) {
  return as<{ id: string; to_status: string }>(
    "authenticated",
    actor,
    "select * from public.record_bag_event($1, $2, $3::public.bag_event_type, $4, now(), $5, '{}', $6)",
    [tag, jobId, type, extra.id ?? eventId(), extra.version ?? null, extra.note ?? null],
  );
}

async function assign(jobId: string, driver: string) {
  return as("authenticated", dispatcher, "select public.assign_driver($1, $2)", [jobId, driver]);
}

/** 3개 짐 주문을 인계 준비 상태까지 진행한다. */
async function readyOrder() {
  const order = await confirmedOrder(fixture, customer, { standard: 2, large: 1 });
  const job = await jobFor(order.id);
  await assign(job.id, driver1);
  for (const tag of await tags(order.id)) {
    await event(cityStaff, tag, job.id, "origin_received");
    await event(driver1, tag, job.id, "collected", { note: "외관 이상 없음 (사진 생략 사유: 테스트)" });
    await event(driver1, tag, job.id, "loaded");
    await event(driver1, tag, job.id, "ready_for_handoff");
  }
  return { order, job };
}

function issueCode(orderId: string) {
  return as<{ code: string; bag_count: number }>("authenticated", customer, "select * from public.issue_handoff_challenge($1)", [orderId]);
}

function verify(jobId: string, code: string, tagIds: string[], actor = driver1, id = eventId()) {
  return as<{ n: number }>("authenticated", actor, "select public.verify_handoff($1, $2, $3, $4) as n", [jobId, code, tagIds, id]);
}

beforeAll(async () => {
  client = await connect();
  fixture = await setupBookingFixture(client, 4);
  customer = await createUser(client, { anonymous: true });
  driver1 = await createUser(client, { role: "driver" });
  driver2 = await createUser(client, { role: "driver" });
  dispatcher = await createUser(client, { role: "dispatcher" });
  cityStaff = await createUser(client, { role: "hotel_staff", hotelId: fixture.cityHotel });
  const seogwipo = (await client.query("select id from public.hotels where slug = 'sample-hotel-seogwipo'")).rows[0].id;
  otherStaff = await createUser(client, { role: "hotel_staff", hotelId: seogwipo });
});

afterAll(async () => {
  await client.end();
});

describe("jobs and hotel storage", () => {
  it("creates a planned job when the booking is confirmed", async () => {
    const order = await confirmedOrder(fixture, customer, { standard: 1 });
    expect((await jobFor(order.id)).status).toBe("planned");
  });

  it("lets only the origin hotel receive bags, with minimal order info", async () => {
    const order = await confirmedOrder(fixture, customer, { standard: 1 });
    const job = await jobFor(order.id);
    const [tag] = await tags(order.id);
    await expect(event(otherStaff, tag!, job.id, "origin_received")).rejects.toThrow("LUGGAGE:FORBIDDEN");
    expect((await event(cityStaff, tag!, job.id, "origin_received")).to_status).toBe("at_origin");

    const listed = await as<Record<string, unknown>>(
      "authenticated",
      cityStaff,
      "select * from public.partner_jobs($1, current_date - 1, current_date + 30) where job_id = $2",
      [fixture.cityHotel, job.id],
    );
    expect(listed).toMatchObject({ customer_name: "王", bag_count: 1 });
    expect(Object.keys(listed)).not.toContain("contact");
    const otherView = await as<Record<string, unknown> | undefined>(
      "authenticated",
      otherStaff,
      "select * from public.partner_jobs($1, current_date - 1, current_date + 30)",
      [fixture.cityHotel],
    );
    expect(otherView).toBeUndefined();
  });
});

describe("dispatch", () => {
  it("only dispatchers assign, only to drivers", async () => {
    const order = await confirmedOrder(fixture, customer, { standard: 1 });
    const job = await jobFor(order.id);
    await expect(as("authenticated", customer, "select public.assign_driver($1, $2)", [job.id, driver1])).rejects.toThrow("LUGGAGE:FORBIDDEN");
    await expect(assign(job.id, cityStaff)).rejects.toThrow("LUGGAGE:DRIVER_INVALID");
    await assign(job.id, driver1);
    expect((await jobFor(order.id)).status).toBe("assigned");
  });

  it("ends the previous driver's rights on reassignment (LOG-04)", async () => {
    const order = await confirmedOrder(fixture, customer, { standard: 1 });
    const job = await jobFor(order.id);
    const [tag] = await tags(order.id);
    await assign(job.id, driver1);
    await assign(job.id, driver2);
    await expect(event(driver1, tag!, job.id, "collected", { note: "x" })).rejects.toThrow("LUGGAGE:FORBIDDEN");
    const oldJobs = await as<{ job_id: string } | undefined>("authenticated", driver1, "select * from public.driver_jobs() where job_id = $1", [job.id]);
    expect(oldJobs).toBeUndefined();
    expect((await event(driver2, tag!, job.id, "collected", { note: "x" })).to_status).toBe("collected");
  });
});

describe("bag events", () => {
  it("requires a photo or an exception reason to collect", async () => {
    const order = await confirmedOrder(fixture, customer, { standard: 1 });
    const job = await jobFor(order.id);
    await assign(job.id, driver1);
    const [tag] = await tags(order.id);
    await expect(event(driver1, tag!, job.id, "collected")).rejects.toThrow("LUGGAGE:EVIDENCE_REQUIRED");
  });

  it("refuses a tag from another order (LOG-01)", async () => {
    const a = await confirmedOrder(fixture, customer, { standard: 1 });
    const b = await confirmedOrder(fixture, customer, { standard: 1 });
    const jobA = await jobFor(a.id);
    await assign(jobA.id, driver1);
    const [tagB] = await tags(b.id);
    await expect(event(driver1, tagB!, jobA.id, "collected", { note: "x" })).rejects.toThrow("LUGGAGE:BAG_NOT_IN_JOB");
    const status = (await client.query("select bag_status from public.bags where tag_id = $1", [tagB])).rows[0].bag_status;
    expect(status).toBe("registered");
  });

  it("does not duplicate a re-sent scan (LOG-03)", async () => {
    const order = await confirmedOrder(fixture, customer, { standard: 1 });
    const job = await jobFor(order.id);
    await assign(job.id, driver1);
    const [tag] = await tags(order.id);
    const id = eventId();
    const first = await event(driver1, tag!, job.id, "collected", { id, note: "x" });
    const again = await event(driver1, tag!, job.id, "collected", { id, note: "x" });
    expect(again.id).toBe(first.id);
    const n = (await client.query("select count(*)::int as n from public.bag_events where client_event_id = $1", [id])).rows[0].n;
    expect(n).toBe(1);
    const outbox = (await client.query("select count(*)::int as n from public.outbox_events where topic = 'bag.collected' and payload ->> 'event_id' = $1", [first.id])).rows[0].n;
    expect(outbox).toBe(1);
  });

  it("rejects out-of-order transitions and stale versions", async () => {
    const order = await confirmedOrder(fixture, customer, { standard: 1 });
    const job = await jobFor(order.id);
    await assign(job.id, driver1);
    const [tag] = await tags(order.id);
    await expect(event(driver1, tag!, job.id, "loaded")).rejects.toThrow("LUGGAGE:INVALID_TRANSITION");
    await expect(event(driver1, tag!, job.id, "collected", { note: "x", version: 99 })).rejects.toThrow("LUGGAGE:VERSION_CONFLICT");
    await expect(event(driver1, tag!, job.id, "delivered")).rejects.toThrow("LUGGAGE:INVALID_TRANSITION");
  });

  it("holds exceptions and restores the previous status only by dispatch", async () => {
    const order = await confirmedOrder(fixture, customer, { standard: 1 });
    const job = await jobFor(order.id);
    await assign(job.id, driver1);
    const [tag] = await tags(order.id);
    await event(driver1, tag!, job.id, "collected", { note: "x" });
    await event(driver1, tag!, job.id, "exception_reported", { note: "바퀴 파손 발견" });
    expect((await jobFor(order.id)).status).toBe("exception");
    await expect(event(driver1, tag!, job.id, "exception_resolved")).rejects.toThrow("LUGGAGE:INVALID_TRANSITION");
    expect((await event(dispatcher, tag!, job.id, "exception_resolved")).to_status).toBe("collected");
  });

  it("keeps collected bags and the job after a refund (LOG-06)", async () => {
    const order = await confirmedOrder(fixture, customer, { standard: 1 });
    const job = await jobFor(order.id);
    await assign(job.id, driver1);
    const [tag] = await tags(order.id);
    await event(driver1, tag!, job.id, "collected", { note: "x" });
    await client.query("update public.orders set reservation_status = 'cancelled' where id = $1", [order.id]);
    expect((await jobFor(order.id)).status).not.toBe("cancelled");
    expect((await client.query("select bag_status from public.bags where tag_id = $1", [tag])).rows[0].bag_status).toBe("collected");
    expect((await event(dispatcher, tag!, job.id, "return_started")).to_status).toBe("return_in_progress");
  });

  it("is append-only", async () => {
    await expect(client.query("update public.bag_events set note = 'x'")).rejects.toThrow(/append-only/);
  });
});

describe("airport handoff", () => {
  it("delivers only the verified bags and does not complete a partial handoff (LOG-02)", async () => {
    const { order, job } = await readyOrder();
    const all = await tags(order.id);
    const { code, bag_count } = await issueCode(order.id);
    expect(bag_count).toBe(3);
    expect(code).toMatch(/^\d{6}$/);

    expect((await verify(job.id, "000000" === code ? "111111" : "000000", all)).n).toBe(-1);
    expect((await verify(job.id, code, all.slice(0, 2))).n).toBe(2);
    expect((await jobFor(order.id)).status).toBe("ready");

    // 남은 1개는 새 코드로
    const second = await issueCode(order.id);
    expect(second.bag_count).toBe(1);
    // 이미 쓴 이전 코드는 새 코드와 맞지 않는다 (틀린 시도로 계산)
    expect((await verify(job.id, code, all.slice(2))).n).toBe(-1);
    expect((await verify(job.id, second.code, all.slice(2))).n).toBe(1);
    expect((await jobFor(order.id)).status).toBe("completed");
  });

  it("completes a handoff exactly once under concurrent verification (LOG-08)", async () => {
    const { order, job } = await readyOrder();
    const all = await tags(order.id);
    const { code } = await issueCode(order.id);
    const results = await Promise.allSettled([verify(job.id, code, all, driver1, eventId()), verify(job.id, code, all, driver1, eventId())]);
    const ok = results.filter((r) => r.status === "fulfilled" && (r.value as { n: number }).n === 3);
    expect(ok).toHaveLength(1);
    const delivered = (await client.query("select count(*)::int as n from public.bag_events where order_id = $1 and event_type = 'delivered'", [order.id])).rows[0].n;
    expect(delivered).toBe(3);
  });

  it("locks the code after repeated wrong attempts", async () => {
    const { order, job } = await readyOrder();
    const all = await tags(order.id);
    const { code } = await issueCode(order.id);
    const wrong = code === "123456" ? "654321" : "123456";
    for (let i = 0; i < 5; i++) expect((await verify(job.id, wrong, all)).n).toBe(-1);
    await expect(verify(job.id, code, all)).rejects.toThrow("LUGGAGE:HANDOFF_CODE_LOCKED");
  });

  it("refuses bags that are not ready or belong to another order", async () => {
    const { order, job } = await readyOrder();
    const other = await confirmedOrder(fixture, customer, { standard: 1 });
    const { code } = await issueCode(order.id);
    await expect(verify(job.id, code, [...(await tags(other.id))])).rejects.toThrow("LUGGAGE:BAG_NOT_IN_JOB");
  });

  it("only the owner can request a code, only the assigned driver can verify", async () => {
    const { order, job } = await readyOrder();
    await expect(as("authenticated", driver1, "select * from public.issue_handoff_challenge($1)", [order.id])).rejects.toThrow("LUGGAGE:ORDER_NOT_FOUND");
    const { code } = await issueCode(order.id);
    await expect(verify(job.id, code, await tags(order.id), driver2)).rejects.toThrow("LUGGAGE:FORBIDDEN");
  });
});

describe("driver directory", () => {
  it("lists drivers for dispatch only", async () => {
    const rows = await as<{ user_id: string } | undefined>("authenticated", dispatcher, "select * from public.list_drivers() where user_id = $1", [driver1]);
    expect(rows?.user_id).toBe(driver1);
    const hidden = await as<{ user_id: string } | undefined>("authenticated", customer, "select * from public.list_drivers()");
    expect(hidden).toBeUndefined();
  });
});
