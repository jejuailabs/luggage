import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { as, createUser, setupBookingFixture } from "./support/booking";
import { asRole, connect } from "./support/db";

let client: pg.Client;
let fixture: Awaited<ReturnType<typeof setupBookingFixture>>;
let customer: string;
let dispatcher: string;
let driver: string;
let seq = 0;
const key = () => `analytics-${++seq}-${Date.now()}`;
const today = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);

async function deliveredOrder() {
  const quote = await as<{ id: string }>("authenticated", customer, "select * from public.create_quote($1, $2, null, '{\"standard\":1}', 'KE1', $3)", [
    fixture.slotId,
    fixture.cityHotel,
    fixture.departs,
  ]);
  const order = await as<{ id: string }>("authenticated", customer, "select * from public.create_order_with_attribution($1, $2, $3, 'zh-CN', $4, $5)", [
    quote.id,
    key(),
    JSON.stringify({ name: "王小明", email: "wang@example.com", phone: "+8613800138000" }),
    ["bag-size-rules", "prohibited-items", "cancellation-refund", "damage-compensation"],
    JSON.stringify({ partnerCode: "SAMPLE01", campaign: "xhs_test" }),
  ]);
  const attempt = await as<{ merchant_order_id: string; amount_minor: number }>("authenticated", customer, "select * from public.start_payment($1, 'mock', 'alipay', $2)", [
    order.id,
    key(),
  ]);
  await as("service_role", null, "select public.record_payment_result('mock', $1, 'h', $2, 'txn-' || $2, 'succeeded', $3, 'KRW')", [
    key(),
    attempt.merchant_order_id,
    attempt.amount_minor,
  ]);
  const job = (await client.query("select id from public.delivery_jobs where order_id = $1", [order.id])).rows[0].id;
  await as("authenticated", dispatcher, "select public.assign_driver($1, $2)", [job, driver]);
  const [tag] = (await client.query("select tag_id from public.bags where order_id = $1", [order.id])).rows.map((r) => r.tag_id);
  for (const [type, note] of [["collected", "사유"], ["loaded", null], ["ready_for_handoff", null]] as const) {
    await as("authenticated", driver, "select public.record_bag_event($1, $2, $3::public.bag_event_type, $4, now(), null, '{}', $5)", [tag, job, type, key(), note]);
  }
  const { code } = await as<{ code: string }>("authenticated", customer, "select * from public.issue_handoff_challenge($1)", [order.id]);
  await as("authenticated", driver, "select public.verify_handoff($1, $2, $3, $4)", [job, code, [tag], key()]);
  return order;
}

beforeAll(async () => {
  client = await connect();
  fixture = await setupBookingFixture(client, 7);
  customer = await createUser(client, { anonymous: true });
  dispatcher = await createUser(client, { role: "dispatcher" });
  driver = await createUser(client, { role: "driver" });
});

afterAll(async () => {
  await client.end();
});

describe("server-side analytics events", () => {
  it("records the funnel from quote to delivery without personal data", async () => {
    const before = (await client.query("select max(id) as id from public.analytics_events")).rows[0].id ?? 0;
    await deliveredOrder();
    const events = (await client.query("select event_type, channel, campaign_code, on_time, props from public.analytics_events where id > $1 order by id", [before])).rows;
    expect(events.map((e) => e.event_type)).toEqual([
      "quote_created",
      "order_held",
      "payment_confirmed",
      "bag_collected",
      "handoff_ready",
      "bag_delivered",
    ]);
    expect(events[1]).toMatchObject({ channel: "hotel_qr", campaign_code: "xhs_test" });
    expect(events.filter((e) => e.event_type !== "quote_created" && e.event_type !== "order_held" && e.event_type !== "payment_confirmed").every((e) => e.on_time === true)).toBe(
      true,
    );
    const serialized = JSON.stringify(events);
    for (const secret of ["王小明", "wang@example.com", "+8613800138000"]) expect(serialized).not.toContain(secret);
  });

  it("refuses personal data keys in event properties", async () => {
    await expect(
      client.query("insert into public.analytics_events (event_type, props) values ('landing_viewed', '{\"email\": \"a@b.cn\"}')"),
    ).rejects.toThrow(/analytics_events_no_pii/);
  });

  it("is not readable by customers or staff tables directly", async () => {
    await expect(asRole(client, "authenticated", (c) => c.query("select * from public.analytics_events"), { userId: customer })).rejects.toThrow(
      /permission denied/,
    );
  });

  it("accepts only page-view events from the public", async () => {
    await asRole(client, "anon", (c) =>
      c.query("select public.track_public_event('landing_viewed', 'zh-CN', null, 'sample-hotel-jeju-city', 'hotel_qr', 'xhs_test', '/zh-CN/h/SAMPLE01')"),
    );
    await expect(
      asRole(client, "anon", (c) => c.query("select public.track_public_event('payment_confirmed', 'zh-CN', null, null, null, null, '/')")),
    ).rejects.toThrow("LUGGAGE:FORBIDDEN");
  });
});

describe("ops_metrics", () => {
  it("refreshes historical daily summaries without exposing raw events", async () => {
    await client.query("insert into public.analytics_events(event_type, service_day, locale) values ('landing_viewed', '2025-01-01', 'zh-CN')");
    await expect(as("authenticated", dispatcher, "select public.refresh_analytics_daily_summary('2025-01-01', '2025-01-01')")).rejects.toThrow(/permission denied/);
    await as("service_role", null, "select public.refresh_analytics_daily_summary('2025-01-01', '2025-01-01')");
    const summary = await as<{ landing_views: string }>("authenticated", dispatcher, "select * from public.ops_metrics('2025-01-01', '2025-01-01', 'locale') where dimension_value='zh-CN'");
    expect(Number(summary.landing_views)).toBe(1);
    await expect(asRole(client, "authenticated", (c) => c.query("select * from public.analytics_daily_summary"), { userId: customer })).rejects.toThrow(/permission denied/);
  });
  it("shows field evidence and notification failure counts only to staff", async () => {
    await deliveredOrder();
    const serviceDate = (await client.query<{ service_date: string }>("select service_date from public.service_slots where id=$1", [fixture.slotId])).rows[0]!.service_date;
    const quality = await as<{ collected_total: string }>("authenticated", dispatcher, "select * from public.ops_field_quality($1, $1) where dimension='hotel' limit 1", [serviceDate]);
    expect(Number(quality.collected_total)).toBeGreaterThanOrEqual(1);
    const failures = await as<{ dead_events: string }>("authenticated", dispatcher, "select * from public.ops_notification_failures($1, $1)", [today()]);
    expect(Number(failures.dead_events)).toBeGreaterThanOrEqual(0);
    await expect(as("authenticated", customer, "select * from public.ops_field_quality($1, $1)", [serviceDate])).rejects.toThrow("LUGGAGE:FORBIDDEN");
  });
  it("aggregates counts per dimension for operations staff", async () => {
    await deliveredOrder();
    const overall = await as<Record<string, string>>("authenticated", dispatcher, "select * from public.ops_metrics($1, $1, 'overall')", [today()]);
    expect(Number(overall.payments_confirmed)).toBeGreaterThanOrEqual(1);
    expect(Number(overall.bags_delivered)).toBeGreaterThanOrEqual(1);
    expect(Number(overall.bags_delivered_on_time)).toBeLessThanOrEqual(Number(overall.bags_delivered));
    const byChannel = await as<Record<string, string>>(
      "authenticated",
      dispatcher,
      "select * from public.ops_metrics($1, $1, 'channel') where dimension_value = 'hotel_qr'",
      [today()],
    );
    expect(Number(byChannel.orders_held)).toBeGreaterThanOrEqual(1);
  });

  it("is refused to customers and invalid dimensions", async () => {
    await expect(as("authenticated", customer, "select * from public.ops_metrics($1, $1)", [today()])).rejects.toThrow("LUGGAGE:FORBIDDEN");
    await expect(as("authenticated", dispatcher, "select * from public.ops_metrics($1, $1, 'email')", [today()])).rejects.toThrow(
      "LUGGAGE:VALIDATION_FAILED",
    );
  });
});
