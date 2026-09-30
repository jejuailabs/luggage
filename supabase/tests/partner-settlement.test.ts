import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { as, createUser, setupBookingFixture } from "./support/booking";
import { asRole, connect } from "./support/db";

let client: pg.Client;
let fixture: Awaited<ReturnType<typeof setupBookingFixture>>;
let customer: string;
let finance: string;
let dispatcher: string;
let driver: string;
let cityStaff: string;
let seogwipoStaff: string;
let partnerId: string;
let seq = 0;
const key = () => `partner-${++seq}-${Date.now()}`;

async function attributedOrder(attribution: Record<string, unknown>, idem = key()) {
  const quote = await as<{ id: string }>("authenticated", customer, "select * from public.create_quote($1, $2, null, '{\"standard\":2}', 'KE1', $3)", [
    fixture.slotId,
    fixture.cityHotel,
    fixture.departs,
  ]);
  const call = (attr: Record<string, unknown>) =>
    as<{ id: string; total_minor: number }>(
      "authenticated",
      customer,
      "select * from public.create_order_with_attribution($1, $2, $3, 'zh-CN', $4, $5)",
      [quote.id, idem, JSON.stringify({ name: "王", email: "w@example.com" }), ["bag-size-rules", "prohibited-items", "cancellation-refund", "damage-compensation"], JSON.stringify(attr)],
    );
  return { order: await call(attribution), retry: call };
}

async function pay(orderId: string) {
  const attempt = await as<{ merchant_order_id: string; amount_minor: number }>(
    "authenticated",
    customer,
    "select * from public.start_payment($1, 'mock', 'alipay', $2)",
    [orderId, key()],
  );
  await as("service_role", null, "select public.record_payment_result('mock', $1, 'h', $2, 'txn-' || $2, 'succeeded', $3, 'KRW')", [
    key(),
    attempt.merchant_order_id,
    attempt.amount_minor,
  ]);
}

async function complete(orderId: string) {
  const job = (await client.query("select id from public.delivery_jobs where order_id = $1", [orderId])).rows[0].id;
  await as("authenticated", dispatcher, "select public.assign_driver($1, $2)", [job, driver]);
  const tags = (await client.query("select tag_id from public.bags where order_id = $1", [orderId])).rows.map((r) => r.tag_id);
  for (const tag of tags) {
    for (const [type, note] of [["collected", "사유"], ["loaded", null], ["ready_for_handoff", null]] as const) {
      await as("authenticated", driver, "select public.record_bag_event($1, $2, $3::public.bag_event_type, $4, now(), null, '{}', $5)", [tag, job, type, key(), note]);
    }
  }
  const { code } = await as<{ code: string }>("authenticated", customer, "select * from public.issue_handoff_challenge($1)", [orderId]);
  await as("authenticated", driver, "select public.verify_handoff($1, $2, $3, $4)", [job, code, tags, key()]);
}

async function commission(orderId: string, kind = "commission") {
  return (await client.query("select amount_minor, status, rule_snapshot from public.hotel_commissions where order_id = $1 and kind = $2", [orderId, kind])).rows[0];
}

beforeAll(async () => {
  client = await connect();
  fixture = await setupBookingFixture(client, 6);
  customer = await createUser(client, { anonymous: true });
  finance = await createUser(client, { role: "finance" });
  dispatcher = await createUser(client, { role: "dispatcher" });
  driver = await createUser(client, { role: "driver" });
  cityStaff = await createUser(client, { role: "hotel_staff", hotelId: fixture.cityHotel });
  const seogwipo = (await client.query("select id from public.hotels where slug = 'sample-hotel-seogwipo'")).rows[0].id;
  seogwipoStaff = await createUser(client, { role: "hotel_staff", hotelId: seogwipo });
  partnerId = (await client.query("select id from public.hotel_partners where name = '예시 제휴사'")).rows[0].id;
});

afterAll(async () => {
  await client.end();
});

describe("partner codes", () => {
  it("resolve publicly to the hotel only while active", async () => {
    const rows = await asRole(client, "anon", async (c) => (await c.query("select hotel_slug, applicable_routes::text[] as applicable_routes from public.resolve_partner_code('sample01')")).rows);
    expect(rows).toEqual([{ hotel_slug: "sample-hotel-jeju-city", applicable_routes: ["hotel_to_airport", "airport_to_hotel", "hotel_to_hotel"] }]);
    await client.query("update public.partner_codes set status = 'suspended' where code = 'SAMPLE01'");
    try {
      const none = await asRole(client, "anon", async (c) => (await c.query("select * from public.resolve_partner_code('SAMPLE01')")).rows);
      expect(none).toEqual([]);
    } finally {
      await client.query("update public.partner_codes set status = 'active' where code = 'SAMPLE01'");
    }
  });
});

describe("attribution", () => {
  it("records the home experiment once and rejects forged variants", async () => {
    const sessionId = "123e4567-e89b-42d3-a456-426614174000";
    const { order, retry } = await attributedOrder({ heroVariant: "B", experimentSessionId: sessionId });
    const read = async () => (await client.query("select experiment_key, experiment_variant, experiment_session_id from public.order_attributions where order_id = $1", [order.id])).rows[0];
    expect(await read()).toEqual({ experiment_key: "home_hero_v1", experiment_variant: "B", experiment_session_id: sessionId });
    await retry({ heroVariant: "A", experimentSessionId: "123e4567-e89b-42d3-a456-426614174001" });
    expect((await read()).experiment_variant).toBe("B");
    const forged = await attributedOrder({ heroVariant: "admin", experimentSessionId: sessionId });
    expect((await client.query("select experiment_key from public.order_attributions where order_id = $1", [forged.order.id])).rows[0].experiment_key).toBeNull();
  });

  it("is fixed when the order is created and cannot be changed later", async () => {
    const idem = key();
    const { order, retry } = await attributedOrder({ partnerCode: "SAMPLE01", landing: "/zh-CN/h/SAMPLE01" }, idem);
    const row = (await client.query("select channel, partner_id, landing_path from public.order_attributions where order_id = $1", [order.id])).rows[0];
    expect(row).toEqual({ channel: "hotel_qr", partner_id: partnerId, landing_path: "/zh-CN/h/SAMPLE01" });
    // 같은 요청 재전송에 다른 귀속을 넣어도 처음 값이 유지된다
    const again = await retry({ channel: "search", campaign: "other" });
    expect(again.id).toBe(order.id);
    expect((await client.query("select channel from public.order_attributions where order_id = $1", [order.id])).rows[0].channel).toBe("hotel_qr");
    await expect(client.query("update public.order_attributions set partner_id = null where order_id = $1", [order.id])).rejects.toThrow(/append-only/);
    await expect(
      asRole(client, "authenticated", (c) => c.query("insert into public.order_attributions (order_id) values ($1)", [order.id]), { userId: customer }),
    ).rejects.toThrow(/permission denied/);
  });

  it("ignores unknown codes and keeps the campaign channel", async () => {
    const { order } = await attributedOrder({ partnerCode: "NOPE9999", channel: "xiaohongshu", campaign: "xhs_checkout_01" });
    const row = (await client.query("select channel, partner_id, campaign_code from public.order_attributions where order_id = $1", [order.id])).rows[0];
    expect(row).toEqual({ channel: "xiaohongshu", partner_id: null, campaign_code: "xhs_checkout_01" });
  });

  it("records unknown when no attribution was given", async () => {
    const { order } = await attributedOrder({});
    expect((await client.query("select channel from public.order_attributions where order_id = $1", [order.id])).rows[0].channel).toBe("unknown");
  });
});

describe("commissions and settlement", () => {
  it("snapshots the rule at confirmation, becomes eligible on delivery, and settles once", async () => {
    const { order } = await attributedOrder({ partnerCode: "SAMPLE01" });
    await pay(order.id);
    const pending = await commission(order.id);
    expect(pending).toMatchObject({ amount_minor: Math.floor(order.total_minor * 0.1), status: "pending" });
    expect(pending.rule_snapshot).toMatchObject({ kind: "percent_of_total", rate_bp: 1000 });

    await complete(order.id);
    expect((await commission(order.id)).status).toBe("eligible");

    const today = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
    await expect(as("authenticated", cityStaff, "select * from public.create_settlement_draft($1, $2, $2)", [partnerId, today])).rejects.toThrow(
      "LUGGAGE:FORBIDDEN",
    );
    const batch = await as<{ id: string; total_minor: number }>("authenticated", finance, "select * from public.create_settlement_draft($1, $2, $2)", [
      partnerId,
      today,
    ]);
    expect(batch.total_minor).toBeGreaterThanOrEqual(pending.amount_minor);
    expect((await commission(order.id)).status).toBe("batched");
    // 같은 항목은 다른 정산에 다시 들어가지 않는다
    const second = await as<{ total_minor: number }>("authenticated", finance, "select * from public.create_settlement_draft($1, $2, $2)", [partnerId, today]);
    expect(second.total_minor).toBe(0);

    await as("authenticated", finance, "select public.confirm_settlement($1)", [batch.id]);
    await expect(as("authenticated", finance, "select public.mark_settlement_paid($1, '')", [batch.id])).rejects.toThrow(
      "LUGGAGE:PAYOUT_REFERENCE_REQUIRED",
    );
    await as("authenticated", finance, "select public.mark_settlement_paid($1, 'TRANSFER-TEST-001')", [batch.id]);
    expect((await commission(order.id)).status).toBe("paid");

    // 지급 후 취소 → 과거 기록은 그대로, 환수 항목 생성
    await client.query("update public.orders set reservation_status = 'cancelled' where id = $1", [order.id]);
    expect((await commission(order.id)).status).toBe("paid");
    expect(await commission(order.id, "clawback")).toMatchObject({ amount_minor: -pending.amount_minor, status: "eligible" });
  });

  it("reverses an unpaid commission when the booking is cancelled", async () => {
    const { order } = await attributedOrder({ partnerCode: "SAMPLE01" });
    await pay(order.id);
    await client.query("update public.orders set reservation_status = 'cancelled' where id = $1", [order.id]);
    expect((await commission(order.id)).status).toBe("reversed");
    expect(await commission(order.id, "clawback")).toBeUndefined();
  });

  it("records zero and flags a missing contract rule instead of inventing an amount", async () => {
    await client.query("update public.commission_rules set status = 'archived' where partner_id = $1", [partnerId]);
    try {
      const { order } = await attributedOrder({ partnerCode: "SAMPLE01" });
      await pay(order.id);
      expect(await commission(order.id)).toMatchObject({ amount_minor: 0, rule_snapshot: { missing_rule: true } });
    } finally {
      await client.query("update public.commission_rules set status = 'active' where partner_id = $1", [partnerId]);
    }
  });
});

describe("visibility", () => {
  it("shows hotel staff only their own hotel's commissions and hides rules", async () => {
    const own = await asRole(client, "authenticated", async (c) => (await c.query("select count(*)::int as n from public.hotel_commissions")).rows[0].n, {
      userId: cityStaff,
    });
    expect(own).toBeGreaterThan(0);
    const other = await asRole(client, "authenticated", async (c) => (await c.query("select count(*)::int as n from public.hotel_commissions")).rows[0].n, {
      userId: seogwipoStaff,
    });
    expect(other).toBe(0);
    const rules = await asRole(client, "authenticated", async (c) => (await c.query("select count(*)::int as n from public.commission_rules")).rows[0].n, {
      userId: cityStaff,
    });
    expect(rules).toBe(0);
    const customerView = await asRole(client, "authenticated", async (c) => (await c.query("select count(*)::int as n from public.hotel_commissions")).rows[0].n, {
      userId: customer,
    });
    expect(customerView).toBe(0);
  });
});
