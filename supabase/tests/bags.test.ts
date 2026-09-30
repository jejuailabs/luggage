import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asRole, connect, testDatabaseUrl } from "./support/db";

let client: pg.Client;
let guest: string;
let otherGuest: string;
let cityHotel: string;
let slotId: string;
let departs: Date;

async function createUser(): Promise<string> {
  const { rows } = await client.query<{ id: string }>("insert into auth.users (is_anonymous) values (true) returning id");
  return rows[0]!.id;
}

async function as<T>(role: "authenticated" | "service_role", userId: string | null, sql: string, params: unknown[] = []): Promise<T> {
  const c = new pg.Client({ connectionString: testDatabaseUrl() });
  await c.connect();
  try {
    await c.query("begin");
    await c.query(`set local role ${role}`);
    if (userId) await c.query("select set_config('request.jwt.claim.sub', $1, true)", [userId]);
    const { rows } = await c.query(sql, params);
    await c.query("commit");
    return rows[0] as T;
  } catch (error) {
    await c.query("rollback").catch(() => {});
    throw error;
  } finally {
    await c.end();
  }
}

async function confirmedOrder(bags: Record<string, number>) {
  const quote = await as<{ id: string }>("authenticated", guest, "select * from public.create_quote($1, $2, null, $3, 'KE1', $4)", [
    slotId,
    cityHotel,
    JSON.stringify(bags),
    departs,
  ]);
  const order = await as<{ id: string }>("authenticated", guest, "select * from public.create_order_with_attribution($1, $2, $3, 'zh-CN', $4, null)", [
    quote.id,
    `bags-${quote.id}`,
    JSON.stringify({ name: "王", email: "w@example.com" }),
    ["bag-size-rules", "prohibited-items", "cancellation-refund", "damage-compensation"],
  ]);
  const attempt = await as<{ merchant_order_id: string; amount_minor: number }>(
    "authenticated",
    guest,
    "select * from public.start_payment($1, 'mock', 'alipay', $2)",
    [order.id, `bags-pay-${order.id}`],
  );
  await as("service_role", null, "select public.record_payment_result('mock', $1, 'h', $2, 'txn-' || $2, 'succeeded', $3, 'KRW')", [
    `bags-evt-${order.id}`,
    attempt.merchant_order_id,
    attempt.amount_minor,
  ]);
  return order;
}

beforeAll(async () => {
  client = await connect();
  guest = await createUser();
  otherGuest = await createUser();
  cityHotel = (await client.query("select id from public.hotels where slug = 'sample-hotel-jeju-city'")).rows[0].id;
  const base = (
    await client.query(`
      select s.* from public.service_slots s
      join public.route_offerings r on r.id = s.route_offering_id
      join public.service_zones z on z.id = r.origin_zone_id
      where z.code = 'jeju-city' and r.route_type = 'hotel_to_airport' and s.booking_cutoff_at > now() order by s.pickup_starts_at limit 1`)
  ).rows[0];
  const slot = (
    await client.query(
      `insert into public.service_slots (route_offering_id, service_date, pickup_starts_at, pickup_ends_at, delivery_starts_at, delivery_ends_at, booking_cutoff_at)
       values ($1, $2, $3::timestamptz + interval '3 minutes', $4, $5, $6, $7) returning id, delivery_ends_at`,
      [base.route_offering_id, base.service_date, base.pickup_starts_at, base.pickup_ends_at, base.delivery_starts_at, base.delivery_ends_at, base.booking_cutoff_at],
    )
  ).rows[0];
  slotId = slot.id;
  departs = new Date(new Date(slot.delivery_ends_at).getTime() + 3 * 3600_000);
  await client.query("insert into public.capacity_buckets (slot_id, max_units) values ($1, 100)", [slotId]);
  for (const slug of ["bag-size-rules", "prohibited-items", "cancellation-refund", "damage-compensation"]) {
    const item = (
      await client.query(
        "insert into public.content_items (slug, kind, criticality) values ($1, 'legal', 'critical') on conflict (slug) do update set slug = excluded.slug returning id",
        [slug],
      )
    ).rows[0].id;
    await client.query(
      `insert into public.content_translations (content_id, locale, title, body, status, published_at)
       values ($1, 'zh-CN', $2, '正文', 'published', now()) on conflict (content_id, locale) do nothing`,
      [item, slug],
    );
  }
});

afterAll(async () => {
  await client.end();
});

describe("bags on confirmation", () => {
  it("keeps the original event and records a dispatcher correction with version protection", async () => {
    const order = await confirmedOrder({ standard: 1 });
    const bag = (await client.query<{ id: string }>("select id from public.bags where order_id = $1", [order.id])).rows[0]!;
    const job = (await client.query<{ id: string }>("select id from public.delivery_jobs where order_id = $1", [order.id])).rows[0]!;
    const dispatcher = (await client.query<{ id: string }>("insert into auth.users (is_anonymous) values (false) returning id")).rows[0]!.id;
    await client.query("insert into public.role_assignments(user_id, role) values ($1, 'dispatcher')", [dispatcher]);
    const original = (await client.query<{ id: string }>(`insert into public.bag_events(bag_id, job_id, order_id, actor_id, actor_role, event_type, from_status, to_status, client_event_id)
      values ($1, $2, $3, $4, 'dispatcher', 'origin_received', 'registered', 'at_origin', $5) returning id`, [bag.id, job.id, order.id, dispatcher, crypto.randomUUID()])).rows[0]!;
    await client.query("update public.bags set bag_status = 'at_origin', version = version + 1 where id = $1", [bag.id]);
    await expect(as("authenticated", guest, "select public.correct_bag_status($1, 'registered', 'Incorrect origin scan', 2, $2)", [original.id, crypto.randomUUID()])).rejects.toThrow("LUGGAGE:FORBIDDEN");
    const corrected = await as<{ event_type: string; from_status: string; to_status: string; details: { original_event_id: string } }>("authenticated", dispatcher, "select * from public.correct_bag_status($1, 'registered', 'Incorrect origin scan', 2, $2)", [original.id, crypto.randomUUID()]);
    expect(corrected.event_type).toBe("correction");
    expect(corrected.from_status).toBe("at_origin");
    expect(corrected.to_status).toBe("registered");
    expect(corrected.details.original_event_id).toBe(original.id);
    expect((await client.query("select event_type from public.bag_events where id = $1", [original.id])).rows[0].event_type).toBe("origin_received");
    await expect(as("authenticated", dispatcher, "select public.correct_bag_status($1, 'at_origin', 'Wrong old version', 2, $2)", [original.id, crypto.randomUUID()])).rejects.toThrow("LUGGAGE:VERSION_CONFLICT");
  });
  it("queues an airport handoff change for affected confirmed bookings", async () => {
    const order = await confirmedOrder({ standard: 1 });
    const zone = (await client.query<{ destination_zone_id: string }>("select r.destination_zone_id from public.orders o join public.route_offerings r on r.id = o.route_offering_id where o.id = $1", [order.id])).rows[0]!.destination_zone_id;
    const code = `test-counter-${Date.now()}`;
    const location = (await client.query<{ id: string }>("insert into public.handoff_locations(code, type, zone_id, name_ko, floor, valid_from, status) values ($1, 'airport_counter', $2, '테스트 카운터', '1F', now(), 'active') returning id", [code, zone])).rows[0]!;
    const count = async () => (await client.query<{ n: number }>("select count(*)::int as n from public.outbox_events where topic = 'handoff_location.changed' and aggregate_id = $1 and payload->>'location_id' = $2", [order.id, location.id])).rows[0]!.n;
    expect(await count()).toBe(1);
    await client.query("update public.handoff_locations set floor = '2F' where id = $1", [location.id]);
    expect(await count()).toBe(2);
  });
  it("reissues a pre-collection tag with an audit trail and rejects old or late labels", async () => {
    const order = await confirmedOrder({ standard: 1 });
    const bag = (await client.query<{ id: string; tag_id: string }>("select id, tag_id from public.bags where order_id = $1", [order.id])).rows[0]!;
    const staff = (await client.query<{ id: string }>("insert into auth.users (is_anonymous) values (false) returning id")).rows[0]!.id;
    await client.query("insert into public.role_assignments (user_id, role, scope_type, scope_id) values ($1, 'hotel_staff', 'hotel', $2)", [staff, cityHotel]);
    await expect(as("authenticated", guest, "select public.reissue_bag_tag($1, 'label damaged')", [bag.id])).rejects.toThrow("LUGGAGE:FORBIDDEN");
    const replacement = await as<{ tag_id: string; version: number }>("authenticated", staff, "select * from public.reissue_bag_tag($1, 'label damaged')", [bag.id]);
    expect(replacement.tag_id).not.toBe(bag.tag_id);
    expect(replacement.version).toBe(2);
    const audit = (await client.query("select old_tag, new_tag, reason from public.bag_tag_reissues where bag_id = $1", [bag.id])).rows;
    expect(audit).toEqual([{ old_tag: bag.tag_id, new_tag: replacement.tag_id, reason: "label damaged" }]);
    expect((await client.query("select count(*)::int as n from public.bags where tag_id = $1", [bag.tag_id])).rows[0].n).toBe(0);
    await client.query("update public.bags set bag_status = 'collected' where id = $1", [bag.id]);
    await expect(as("authenticated", staff, "select public.reissue_bag_tag($1, 'too late')", [bag.id])).rejects.toThrow("LUGGAGE:INVALID_TRANSITION");
  });
  it("creates one bag per unit with a random, unique tag", async () => {
    const order = await confirmedOrder({ standard: 2, large: 1 });
    const bags = (await client.query("select seq, size, tag_id, bag_status from public.bags where order_id = $1 order by seq", [order.id])).rows;
    expect(bags.map((b) => [b.seq, b.size, b.bag_status])).toEqual([
      [1, "standard", "registered"],
      [2, "standard", "registered"],
      [3, "large", "registered"],
    ]);
    for (const bag of bags) expect(bag.tag_id).toMatch(/^T[A-HJ-NP-Z2-9]{10}$/);
    expect(new Set(bags.map((b) => b.tag_id)).size).toBe(3);
  });

  it("does not create bags for unpaid holds", async () => {
    const quote = await as<{ id: string }>("authenticated", guest, "select * from public.create_quote($1, $2, null, '{\"standard\":1}', 'KE1', $3)", [
      slotId,
      cityHotel,
      departs,
    ]);
    const order = await as<{ id: string }>("authenticated", guest, "select * from public.create_order_with_attribution($1, $2, $3, 'zh-CN', $4, null)", [
      quote.id,
      `bags-unpaid-${quote.id}`,
      JSON.stringify({ name: "王", email: "w@example.com" }),
      ["bag-size-rules", "prohibited-items", "cancellation-refund", "damage-compensation"],
    ]);
    const n = (await client.query("select count(*)::int as n from public.bags where order_id = $1", [order.id])).rows[0].n;
    expect(n).toBe(0);
  });

  it("marks bags cancelled before pickup when the booking is cancelled", async () => {
    const order = await confirmedOrder({ standard: 1 });
    const request = await as<{ id: string }>("authenticated", guest, "select * from public.request_cancellation($1, 'x')", [order.id]);
    await as("service_role", null, "select public.approve_refund($1)", [request.id]);
    const statuses = (await client.query("select bag_status from public.bags where order_id = $1", [order.id])).rows.map((r) => r.bag_status);
    expect(statuses).toEqual(["cancelled_before_pickup"]);
  });

  it("shows bags only to the order owner", async () => {
    const order = await confirmedOrder({ standard: 1 });
    const own = await asRole(client, "authenticated", async (c) => (await c.query("select tag_id from public.bags where order_id = $1", [order.id])).rows, {
      userId: guest,
    });
    expect(own).toHaveLength(1);
    const other = await asRole(client, "authenticated", async (c) => (await c.query("select tag_id from public.bags where order_id = $1", [order.id])).rows, {
      userId: otherGuest,
    });
    expect(other).toHaveLength(0);
    await expect(asRole(client, "anon", (c) => c.query("select * from public.bags"))).rejects.toThrow(/permission denied/);
  });
});
