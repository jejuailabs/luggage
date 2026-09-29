import pg from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { asRole, connect, testDatabaseUrl } from "./support/db";

let client: pg.Client;
let guest: string;
let otherGuest: string;
let dispatcher: string;
let cityHotel: string;
let slotId: string;
let bucketId: string;
let departs: Date;

const CONTACT = { name: "王小明", email: "wang@example.com", phone: "+86 138 0013 8000" };
const POLICIES = ["bag-size-rules", "prohibited-items"];

async function createUser(isAnonymous = true): Promise<string> {
  const { rows } = await client.query<{ id: string }>("insert into auth.users (is_anonymous) values ($1) returning id", [isAnonymous]);
  return rows[0]!.id;
}

/** 역할을 설정한 채 커밋까지 하는 호출 (동시성 테스트용, 별도 연결). */
async function committed<T>(userId: string, sql: string, params: unknown[]): Promise<T> {
  const c = new pg.Client({ connectionString: testDatabaseUrl() });
  await c.connect();
  try {
    await c.query("begin");
    await c.query("set local role authenticated");
    await c.query("select set_config('request.jwt.claim.sub', $1, true)", [userId]);
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

async function newQuote(userId: string, bags: Record<string, number> = { standard: 2, large: 1 }) {
  return committed<{ id: string; capacity_units: number; tax_minor: number; total_minor: number }>(
    userId,
    "select * from public.create_quote($1, $2, null, $3, 'KE1234', $4)",
    [slotId, cityHotel, JSON.stringify(bags), departs],
  );
}

function orderCall(userId: string, quoteId: string, key: string, overrides: Partial<{ contact: unknown; locale: string; policies: string[] }> = {}) {
  return committed<Record<string, unknown>>(userId, "select * from public.create_order($1, $2, $3, $4, $5)", [
    quoteId,
    key,
    JSON.stringify(overrides.contact ?? CONTACT),
    overrides.locale ?? "zh-CN",
    overrides.policies ?? POLICIES,
  ]);
}

async function bucket() {
  return (await client.query("select held_units, committed_units, max_units from public.capacity_buckets where id = $1", [bucketId])).rows[0];
}

beforeAll(async () => {
  client = await connect();
  guest = await createUser();
  otherGuest = await createUser();
  dispatcher = await createUser(false);
  await client.query("insert into public.role_assignments (user_id, role) values ($1, 'dispatcher')", [dispatcher]);
  cityHotel = (await client.query("select id from public.hotels where slug = 'sample-hotel-jeju-city'")).rows[0].id;

  // 이 테스트 전용 슬롯 (다른 테스트와 용량을 공유하지 않는다)
  const base = (
    await client.query(`
      select s.* from public.service_slots s
      join public.route_offerings r on r.id = s.route_offering_id
      join public.service_zones z on z.id = r.origin_zone_id
      where z.code = 'jeju-city' and s.booking_cutoff_at > now() order by s.pickup_starts_at limit 1`)
  ).rows[0];
  const slot = (
    await client.query(
      `insert into public.service_slots (route_offering_id, service_date, pickup_starts_at, pickup_ends_at, delivery_starts_at, delivery_ends_at, booking_cutoff_at)
       values ($1, $2, $3::timestamptz + interval '1 minute', $4, $5, $6, $7) returning id, delivery_ends_at`,
      [base.route_offering_id, base.service_date, base.pickup_starts_at, base.pickup_ends_at, base.delivery_starts_at, base.delivery_ends_at, base.booking_cutoff_at],
    )
  ).rows[0];
  slotId = slot.id;
  departs = new Date(new Date(slot.delivery_ends_at).getTime() + 3 * 3600_000);
  bucketId = (await client.query("insert into public.capacity_buckets (slot_id, max_units) values ($1, 20) returning id", [slotId])).rows[0].id;

  // 필수 정책 게시본 (zh-CN만)
  for (const slug of POLICIES) {
    const item = (
      await client.query(
        "insert into public.content_items (slug, kind, criticality) values ($1, 'legal', 'critical') on conflict (slug) do update set slug = excluded.slug returning id",
        [slug],
      )
    ).rows[0].id;
    await client.query(
      `insert into public.content_translations (content_id, locale, title, body, status, published_at)
       values ($1, 'zh-CN', $2, '【测试】政策正文', 'published', now()) on conflict (content_id, locale) do nothing`,
      [item, `${slug} 标题`],
    );
  }
});

beforeEach(async () => {
  await client.query("update public.capacity_buckets set held_units = 0, committed_units = 0, max_units = 20 where id = $1", [bucketId]);
});

afterAll(async () => {
  await client.end();
});

describe("create_order", () => {
  it("holds capacity and snapshots prices, tax, contact and policies", async () => {
    const quote = await newQuote(guest);
    const order = await orderCall(guest, quote.id, "key-happy-path-1");
    expect(order).toMatchObject({
      owner_id: guest,
      quote_id: quote.id,
      reservation_status: "held",
      total_minor: 50000,
      tax_minor: 4545,
      locale: "zh-CN",
      contact: { name: "王小明", email: "wang@example.com", phone: "+8613800138000" },
    });
    expect(String(order.public_code)).toMatch(/^JC[A-HJ-NP-Z2-9]{8}$/);
    const holdMinutes = (new Date(String(order.hold_expires_at)).getTime() - Date.now()) / 60_000;
    expect(holdMinutes).toBeGreaterThan(9);
    expect(holdMinutes).toBeLessThanOrEqual(10);

    expect(await bucket()).toMatchObject({ held_units: 4, committed_units: 0 });
    const bags = (await client.query("select size, quantity, amount_minor, tax_minor from public.order_bags where order_id = $1 order by size", [order.id])).rows;
    expect(bags.reduce((sum, b) => sum + b.tax_minor, 0)).toBe(4545);
    expect(bags).toEqual([
      { size: "standard", quantity: 2, amount_minor: 30000, tax_minor: 2727 },
      { size: "large", quantity: 1, amount_minor: 20000, tax_minor: 1818 },
    ]);
    const policies = (await client.query("select policy_slug, locale from public.policy_acceptances where order_id = $1 order by policy_slug", [order.id])).rows;
    expect(policies).toEqual([
      { policy_slug: "bag-size-rules", locale: "zh-CN" },
      { policy_slug: "prohibited-items", locale: "zh-CN" },
    ]);
    const outbox = (await client.query("select topic from public.outbox_events where aggregate_id = $1", [order.id])).rows;
    expect(outbox).toEqual([{ topic: "order.held" }]);
  });

  it("returns the same order for a repeated key and body (double click)", async () => {
    const quote = await newQuote(guest);
    const [a, b] = await Promise.all([orderCall(guest, quote.id, "key-double-click"), orderCall(guest, quote.id, "key-double-click")]);
    expect(a.id).toBe(b.id);
    expect(await bucket()).toMatchObject({ held_units: 4 });
  });

  it("rejects the same key with a different body", async () => {
    const quote = await newQuote(guest);
    await orderCall(guest, quote.id, "key-conflict-1");
    await expect(orderCall(guest, quote.id, "key-conflict-1", { contact: { ...CONTACT, name: "李" } })).rejects.toThrow("LUGGAGE:IDEMPOTENCY_CONFLICT");
  });

  it("rejects reusing a quote with a new key", async () => {
    const quote = await newQuote(guest);
    await orderCall(guest, quote.id, "key-reuse-1");
    await expect(orderCall(guest, quote.id, "key-reuse-2")).rejects.toThrow("LUGGAGE:QUOTE_ALREADY_ORDERED");
  });

  it("rejects someone else's quote", async () => {
    const quote = await newQuote(guest);
    await expect(orderCall(otherGuest, quote.id, "key-other-owner")).rejects.toThrow("LUGGAGE:QUOTE_NOT_FOUND");
  });

  it("rejects an expired quote", async () => {
    const quote = await newQuote(guest);
    await client.query("update public.quotes set expires_at = now() - interval '1 second' where id = $1", [quote.id]);
    await expect(orderCall(guest, quote.id, "key-expired-quote")).rejects.toThrow("LUGGAGE:QUOTE_EXPIRED");
  });

  it.each([
    ["no contact channel", { name: "王" }],
    ["missing name", { email: "a@b.cn" }],
    ["phone without country code", { name: "王", phone: "13800138000" }],
    ["malformed email", { name: "王", email: "not-an-email" }],
  ])("rejects contact with %s", async (_label, contact) => {
    const quote = await newQuote(guest);
    await expect(orderCall(guest, quote.id, `key-contact-${_label.length}`, { contact })).rejects.toThrow("LUGGAGE:CONTACT_INVALID");
  });

  it("accepts a WeChat ID as the only contact channel", async () => {
    const quote = await newQuote(guest);
    const order = await orderCall(guest, quote.id, "key-wechat-only", { contact: { name: "王", wechat: "wxid_abc123" } });
    expect(order.contact).toEqual({ name: "王", wechat: "wxid_abc123" });
  });

  it("requires every policy to be accepted and published in the customer's language", async () => {
    const quote = await newQuote(guest);
    await expect(orderCall(guest, quote.id, "key-policy-missing", { policies: ["bag-size-rules"] })).rejects.toThrow(
      "LUGGAGE:POLICY_ACCEPTANCE_REQUIRED",
    );
    // 영어 게시본이 없으므로 영어 주문은 막힌다.
    await expect(orderCall(guest, quote.id, "key-policy-english", { locale: "en" })).rejects.toThrow("LUGGAGE:POLICY_ACCEPTANCE_REQUIRED");
  });

  it("leaves no trace when it fails (idempotency key is reusable)", async () => {
    const quote = await newQuote(guest);
    await expect(orderCall(guest, quote.id, "key-retry-after-fail", { policies: [] })).rejects.toThrow();
    const order = await orderCall(guest, quote.id, "key-retry-after-fail");
    expect(order.reservation_status).toBe("held");
  });
});

describe("last slot under concurrency", () => {
  it("gives the last units to exactly one of two simultaneous orders", async () => {
    const q1 = await newQuote(guest, { standard: 3 });
    const q2 = await newQuote(otherGuest, { standard: 3 });
    await client.query("update public.capacity_buckets set committed_units = 16 where id = $1", [bucketId]);

    const results = await Promise.allSettled([orderCall(guest, q1.id, "key-race-guest"), orderCall(otherGuest, q2.id, "key-race-other")]);
    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(String(rejected[0]!.reason)).toContain("LUGGAGE:CAPACITY_UNAVAILABLE");
    expect(await bucket()).toMatchObject({ held_units: 3, committed_units: 16 });
  });
});

describe("expire_holds", () => {
  it("releases capacity for unpaid holds exactly once", async () => {
    const quote = await newQuote(guest);
    const order = await orderCall(guest, quote.id, "key-expire-1");
    await client.query("update public.orders set hold_expires_at = now() - interval '1 second' where id = $1", [order.id]);

    const first = await asRole(client, "service_role", async (c) => (await c.query("select public.expire_holds() as n")).rows[0].n);
    expect(first).toBeGreaterThanOrEqual(1);
    await client.query("select public.expire_holds()");
    const state = (await client.query("select reservation_status, hold_expires_at from public.orders where id = $1", [order.id])).rows[0];
    expect(state).toEqual({ reservation_status: "expired", hold_expires_at: null });
    expect(await bucket()).toMatchObject({ held_units: 0 });
    const holds = (await client.query("select status from public.capacity_holds where order_id = $1", [order.id])).rows;
    expect(holds).toEqual([{ status: "released" }]);
  });

  it("cannot be called by customers", async () => {
    await expect(asRole(client, "authenticated", (c) => c.query("select public.expire_holds()"), { userId: guest })).rejects.toThrow(/permission denied/);
  });
});

describe("order visibility and transitions", () => {
  it("shows orders only to the owner and operations staff", async () => {
    const quote = await newQuote(guest);
    const order = await orderCall(guest, quote.id, "key-visibility-1");
    const view = (userId: string) =>
      asRole(client, "authenticated", async (c) => (await c.query("select id from public.orders where id = $1", [order.id])).rows.length, { userId });
    expect(await view(guest)).toBe(1);
    expect(await view(otherGuest)).toBe(0);
    expect(await view(dispatcher)).toBe(1);
    await expect(asRole(client, "anon", (c) => c.query("select * from public.orders"))).rejects.toThrow(/permission denied/);
  });

  it("does not let customers change their order directly", async () => {
    const quote = await newQuote(guest);
    const order = await orderCall(guest, quote.id, "key-direct-update");
    await expect(
      asRole(client, "authenticated", (c) => c.query("update public.orders set reservation_status = 'confirmed' where id = $1", [order.id]), { userId: guest }),
    ).rejects.toThrow(/permission denied/);
  });

  it("forbids invalid reservation transitions", async () => {
    const quote = await newQuote(guest);
    const order = await orderCall(guest, quote.id, "key-transition");
    await client.query("update public.orders set reservation_status = 'cancelled' where id = $1", [order.id]);
    await expect(client.query("update public.orders set reservation_status = 'held' where id = $1", [order.id])).rejects.toThrow(
      /invalid reservation transition/,
    );
  });
});
