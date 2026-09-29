import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asRole, connect, testDatabaseUrl } from "./support/db";

let client: pg.Client;
let guest: string;
let otherGuest: string;
let finance: string;
let cityHotel: string;
let slotId: string;
let bucketId: string;
let departs: Date;
let eventSeq = 0;

async function createUser(isAnonymous = true): Promise<string> {
  const { rows } = await client.query<{ id: string }>("insert into auth.users (is_anonymous) values ($1) returning id", [isAnonymous]);
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

async function heldOrder(userId = guest, bags = { standard: 1 }) {
  const quote = await as<{ id: string }>("authenticated", userId, "select * from public.create_quote($1, $2, null, $3, 'KE1', $4)", [
    slotId,
    cityHotel,
    JSON.stringify(bags),
    departs,
  ]);
  return as<{ id: string; total_minor: number; public_code: string; capacity_units: number }>(
    "authenticated",
    userId,
    "select * from public.create_order($1, $2, $3, 'zh-CN', $4)",
    [quote.id, `order-${quote.id}`, JSON.stringify({ name: "王", email: "w@example.com" }), ["bag-size-rules", "prohibited-items"]],
  );
}

async function startPayment(orderId: string, key = `pay-${orderId}`, userId = guest) {
  return as<{ id: string; merchant_order_id: string; amount_minor: number; status: string }>(
    "authenticated",
    userId,
    "select * from public.start_payment($1, 'mock', 'alipay', $2)",
    [orderId, key],
  );
}

async function report(merchantOrderId: string, status: string, amount: number, currency = "KRW", eventId = `evt-${++eventSeq}`) {
  const row = await as<{ result: string }>(
    "service_role",
    null,
    "select public.record_payment_result('mock', $1, 'hash', $2, $3, $4, $5, $6) as result",
    [eventId, merchantOrderId, `txn-${merchantOrderId}`, status, amount, currency],
  );
  return row.result;
}

async function orderState(orderId: string) {
  return (await client.query("select reservation_status from public.orders where id = $1", [orderId])).rows[0].reservation_status;
}

async function bucket() {
  return (await client.query("select held_units, committed_units from public.capacity_buckets where id = $1", [bucketId])).rows[0];
}

beforeAll(async () => {
  client = await connect();
  guest = await createUser();
  otherGuest = await createUser();
  finance = await createUser(false);
  await client.query("insert into public.role_assignments (user_id, role) values ($1, 'finance')", [finance]);
  cityHotel = (await client.query("select id from public.hotels where slug = 'sample-hotel-jeju-city'")).rows[0].id;
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
       values ($1, $2, $3::timestamptz + interval '2 minutes', $4, $5, $6, $7) returning id, delivery_ends_at`,
      [base.route_offering_id, base.service_date, base.pickup_starts_at, base.pickup_ends_at, base.delivery_starts_at, base.delivery_ends_at, base.booking_cutoff_at],
    )
  ).rows[0];
  slotId = slot.id;
  departs = new Date(new Date(slot.delivery_ends_at).getTime() + 3 * 3600_000);
  bucketId = (await client.query("insert into public.capacity_buckets (slot_id, max_units) values ($1, 100) returning id", [slotId])).rows[0].id;
  for (const slug of ["bag-size-rules", "prohibited-items"]) {
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

describe("start_payment", () => {
  it("creates one attempt per client key with the server-side amount", async () => {
    const order = await heldOrder();
    const a = await startPayment(order.id, "same-key-123");
    const b = await startPayment(order.id, "same-key-123");
    expect(a.id).toBe(b.id);
    expect(a.amount_minor).toBe(order.total_minor);
    expect(a.merchant_order_id).toBe(`${order.public_code}-1`);
  });

  it("refuses other customers' orders", async () => {
    const order = await heldOrder();
    await expect(startPayment(order.id, "other-key-123", otherGuest)).rejects.toThrow("LUGGAGE:ORDER_NOT_FOUND");
  });

  it("refuses orders whose hold has expired", async () => {
    const order = await heldOrder();
    await client.query("update public.orders set hold_expires_at = now() - interval '1 second' where id = $1", [order.id]);
    await expect(startPayment(order.id)).rejects.toThrow("LUGGAGE:ORDER_NOT_PAYABLE");
  });

  it("cannot be confirmed by the customer directly", async () => {
    const order = await heldOrder();
    const attempt = await startPayment(order.id);
    await expect(
      as("authenticated", guest, "select public.record_payment_result('mock', 'e', 'h', $1, 't', 'succeeded', $2, 'KRW')", [
        attempt.merchant_order_id,
        attempt.amount_minor,
      ]),
    ).rejects.toThrow(/permission denied/);
  });
});

describe("record_payment_result", () => {
  it("confirms the order, commits capacity and writes the ledger once", async () => {
    const before = await bucket();
    const order = await heldOrder();
    const attempt = await startPayment(order.id);
    expect(await report(attempt.merchant_order_id, "succeeded", attempt.amount_minor, "KRW", "evt-confirm")).toBe("confirmed");
    // 같은 웹훅 재전송
    expect(await report(attempt.merchant_order_id, "succeeded", attempt.amount_minor, "KRW", "evt-confirm")).toBe("duplicate_event");
    // 다른 이벤트 ID의 같은 성공 (PG 재조회)
    expect(await report(attempt.merchant_order_id, "succeeded", attempt.amount_minor)).toBe("already_succeeded");

    expect(await orderState(order.id)).toBe("confirmed");
    const after = await bucket();
    expect(after.held_units).toBe(before.held_units);
    expect(after.committed_units).toBe(before.committed_units + order.capacity_units);
    const ledger = (await client.query("select entry_type, amount_minor from public.ledger_entries where order_id = $1", [order.id])).rows;
    expect(ledger).toEqual([{ entry_type: "payment_captured", amount_minor: order.total_minor }]);
    const summary = await as<{ s: string }>("authenticated", guest, "select public.order_payment_summary($1) as s", [order.id]);
    expect(summary.s).toBe("paid");
  });

  it("does not let a late failure overwrite a success", async () => {
    const order = await heldOrder();
    const attempt = await startPayment(order.id);
    await report(attempt.merchant_order_id, "succeeded", attempt.amount_minor);
    expect(await report(attempt.merchant_order_id, "failed", attempt.amount_minor)).toBe("ignored_after_success");
    const status = (await client.query("select status from public.payment_attempts where id = $1", [attempt.id])).rows[0].status;
    expect(status).toBe("succeeded");
  });

  it("keeps the order held on failure so the customer can retry", async () => {
    const order = await heldOrder();
    const attempt = await startPayment(order.id);
    expect(await report(attempt.merchant_order_id, "failed", attempt.amount_minor)).toBe("recorded_failed");
    expect(await orderState(order.id)).toBe("held");
    const retry = await startPayment(order.id, "retry-key-123");
    expect(retry.merchant_order_id).toBe(`${order.public_code}-2`);
  });

  it("stops on amount or currency mismatch and sends the order to review", async () => {
    const order = await heldOrder();
    const attempt = await startPayment(order.id);
    expect(await report(attempt.merchant_order_id, "succeeded", attempt.amount_minor - 1)).toBe("amount_mismatch");
    expect(await orderState(order.id)).toBe("needs_review");
    const ledger = (await client.query("select count(*)::int as n from public.ledger_entries where order_id = $1", [order.id])).rows[0].n;
    expect(ledger).toBe(0);
  });

  it("confirms once when two payment windows both succeed and flags the extra capture", async () => {
    const order = await heldOrder();
    const first = await startPayment(order.id, "window-one-1");
    const second = await startPayment(order.id, "window-two-2");
    expect(await report(first.merchant_order_id, "succeeded", first.amount_minor)).toBe("confirmed");
    expect(await report(second.merchant_order_id, "succeeded", second.amount_minor)).toBe("duplicate_capture");
    expect(await orderState(order.id)).toBe("confirmed");
    const topics = (await client.query("select topic from public.outbox_events where aggregate_id = $1 order by created_at", [order.id])).rows.map((r) => r.topic);
    expect(topics).toContain("payment.duplicate_capture");
  });

  it("re-acquires capacity for a success confirmed after the hold expired", async () => {
    const order = await heldOrder();
    const attempt = await startPayment(order.id);
    await client.query("update public.orders set hold_expires_at = now() - interval '1 second' where id = $1", [order.id]);
    await as("service_role", null, "select public.expire_holds()");
    expect(await orderState(order.id)).toBe("expired");
    expect(await report(attempt.merchant_order_id, "succeeded", attempt.amount_minor)).toBe("confirmed_after_expiry");
    expect(await orderState(order.id)).toBe("confirmed");
  });

  it("sends a late success to review when the slot filled up meanwhile", async () => {
    const order = await heldOrder();
    const attempt = await startPayment(order.id);
    await client.query("update public.orders set hold_expires_at = now() - interval '1 second' where id = $1", [order.id]);
    await as("service_role", null, "select public.expire_holds()");
    const saved = await bucket();
    await client.query("update public.capacity_buckets set committed_units = max_units - held_units where id = $1", [bucketId]);
    try {
      expect(await report(attempt.merchant_order_id, "succeeded", attempt.amount_minor)).toBe("needs_review_capacity");
      expect(await orderState(order.id)).toBe("needs_review");
    } finally {
      await client.query("update public.capacity_buckets set committed_units = $2 where id = $1", [bucketId, saved.committed_units]);
    }
  });
});

describe("cancellation and refunds", () => {
  async function paidOrder() {
    const order = await heldOrder();
    const attempt = await startPayment(order.id);
    await report(attempt.merchant_order_id, "succeeded", attempt.amount_minor);
    return { order, attempt };
  }

  it("cancels an unpaid order immediately and releases the hold", async () => {
    const before = await bucket();
    const order = await heldOrder();
    await as("authenticated", guest, "select public.request_cancellation($1, 'changed plans')", [order.id]);
    expect(await orderState(order.id)).toBe("cancelled");
    expect((await bucket()).held_units).toBe(before.held_units);
  });

  it("separates request, approval and PG refund, then cancels and releases capacity", async () => {
    const { order } = await paidOrder();
    const committedBefore = (await bucket()).committed_units;
    const request = await as<{ id: string; amount_minor: number; status: string }>(
      "authenticated",
      guest,
      "select * from public.request_cancellation($1, 'changed plans')",
      [order.id],
    );
    expect(request).toMatchObject({ amount_minor: order.total_minor, status: "requested" });
    // 고객은 스스로 승인할 수 없다.
    await expect(as("authenticated", guest, "select public.approve_refund($1)", [request.id])).rejects.toThrow("LUGGAGE:FORBIDDEN");

    const refund = await as<{ id: string; status: string }>("authenticated", finance, "select * from public.approve_refund($1)", [request.id]);
    expect(refund.status).toBe("queued");
    expect(await orderState(order.id)).toBe("cancelled");
    expect((await bucket()).committed_units).toBe(committedBefore - order.capacity_units);

    // PG timeout → unknown, 재조회 후 성공 → 원장 한 번만
    await as("service_role", null, "select public.record_refund_result($1, 'unknown', null)", [refund.id]);
    await as("service_role", null, "select public.record_refund_result($1, 'succeeded', 'rf-1')", [refund.id]);
    expect((await as<{ r: string }>("service_role", null, "select public.record_refund_result($1, 'succeeded', 'rf-1') as r", [refund.id])).r).toBe(
      "already_succeeded",
    );
    const ledger = (await client.query("select entry_type, amount_minor from public.ledger_entries where order_id = $1 order by created_at", [order.id])).rows;
    expect(ledger).toEqual([
      { entry_type: "payment_captured", amount_minor: order.total_minor },
      { entry_type: "refund_succeeded", amount_minor: -order.total_minor },
    ]);
    const summary = await as<{ s: string }>("authenticated", guest, "select public.order_payment_summary($1) as s", [order.id]);
    expect(summary.s).toBe("refunded");
  });

  it("approves a request once under concurrent clicks and never refunds more than was captured", async () => {
    const { order, attempt } = await paidOrder();
    const part = Math.floor(attempt.amount_minor * 0.7);
    const first = (await client.query("insert into public.refund_requests (order_id, amount_minor, reason) values ($1, $2, 'partial') returning id", [order.id, part])).rows[0].id;
    const [a, b] = await Promise.all([
      as<{ id: string }>("authenticated", finance, "select * from public.approve_refund($1)", [first]),
      as<{ id: string }>("authenticated", finance, "select * from public.approve_refund($1)", [first]),
    ]);
    expect(a.id).toBe(b.id);
    // 남은 수납액(30%)보다 큰 두 번째 요청은 승인할 수 없다.
    const second = (await client.query("insert into public.refund_requests (order_id, amount_minor, reason) values ($1, $2, 'more') returning id", [order.id, part])).rows[0].id;
    await expect(as("authenticated", finance, "select public.approve_refund($1)", [second])).rejects.toThrow("LUGGAGE:REFUND_EXCEEDS_CAPTURED");
    // 부분환불이므로 예약은 유지된다.
    expect(await orderState(order.id)).toBe("confirmed");
  });

  it("rejects self-service cancellation after the booking cutoff", async () => {
    const { order } = await paidOrder();
    const saved = (await client.query("select booking_cutoff_at from public.service_slots where id = $1", [slotId])).rows[0].booking_cutoff_at;
    await client.query("update public.service_slots set booking_cutoff_at = now() - interval '1 second' where id = $1", [slotId]);
    try {
      await expect(as("authenticated", guest, "select public.request_cancellation($1, 'late')", [order.id])).rejects.toThrow(
        "LUGGAGE:CANCELLATION_WINDOW_CLOSED",
      );
    } finally {
      await client.query("update public.service_slots set booking_cutoff_at = $2 where id = $1", [slotId, saved]);
    }
  });
});

describe("ledger and visibility", () => {
  it("is append-only", async () => {
    await expect(client.query("update public.ledger_entries set amount_minor = 1")).rejects.toThrow(/append-only/);
    await expect(client.query("delete from public.ledger_entries")).rejects.toThrow(/append-only/);
  });

  it("shows payment attempts to the owner but the ledger only to finance", async () => {
    const order = await heldOrder();
    await startPayment(order.id);
    const own = await asRole(client, "authenticated", async (c) => (await c.query("select id from public.payment_attempts where order_id = $1", [order.id])).rows, {
      userId: guest,
    });
    expect(own).toHaveLength(1);
    const other = await asRole(client, "authenticated", async (c) => (await c.query("select id from public.payment_attempts where order_id = $1", [order.id])).rows, {
      userId: otherGuest,
    });
    expect(other).toHaveLength(0);
    const ledger = await asRole(client, "authenticated", async (c) => (await c.query("select id from public.ledger_entries")).rows, { userId: guest });
    expect(ledger).toHaveLength(0);
    const financeLedger = await asRole(client, "authenticated", async (c) => (await c.query("select id from public.ledger_entries")).rows, { userId: finance });
    expect(financeLedger.length).toBeGreaterThan(0);
  });
});
