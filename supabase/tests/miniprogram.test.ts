import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { as, createUser, setupBookingFixture } from "./support/booking";
import { connect } from "./support/db";

let client: pg.Client;
let fixture: Awaited<ReturnType<typeof setupBookingFixture>>;
let customer: string;
let other: string;
let seq = 0;
const key = () => `mp-${++seq}-${Date.now()}`;

async function miniprogramAttempt(owner = customer) {
  const quote = await as<{ id: string }>("authenticated", owner, "select * from public.create_quote($1, $2, null, '{\"standard\":1}', 'KE1', $3)", [
    fixture.slotId,
    fixture.cityHotel,
    fixture.departs,
  ]);
  const order = await as<{ id: string }>("authenticated", owner, "select * from public.create_order($1, $2, $3, 'zh-CN', $4)", [
    quote.id,
    key(),
    JSON.stringify({ name: "王", wechat: "wxid_test" }),
    ["bag-size-rules", "prohibited-items"],
  ]);
  return as<{ id: string; merchant_order_id: string }>("authenticated", owner, "select * from public.start_payment($1, 'mock', 'wechat_pay_miniprogram', $2)", [
    order.id,
    key(),
  ]);
}

beforeAll(async () => {
  client = await connect();
  fixture = await setupBookingFixture(client, 8);
  customer = await createUser(client, { anonymous: true });
  other = await createUser(client, { anonymous: true });
});

afterAll(async () => {
  await client.end();
});

describe("mini program pay tickets", () => {
  it("are issued only to the order owner and stored as a hash", async () => {
    const attempt = await miniprogramAttempt();
    await expect(as("authenticated", other, "select public.create_miniprogram_pay_ticket($1) as t", [attempt.id])).rejects.toThrow(
      "LUGGAGE:ORDER_NOT_PAYABLE",
    );
    const { t } = await as<{ t: string }>("authenticated", customer, "select public.create_miniprogram_pay_ticket($1) as t", [attempt.id]);
    expect(t).toMatch(/^[0-9a-f]{64}$/);
    const stored = (await client.query("select ticket_hash from public.miniprogram_pay_tickets where attempt_id = $1", [attempt.id])).rows[0].ticket_hash;
    expect(stored).not.toBe(t);
  });

  it("can be redeemed once, only by the server", async () => {
    const attempt = await miniprogramAttempt();
    const { t } = await as<{ t: string }>("authenticated", customer, "select public.create_miniprogram_pay_ticket($1) as t", [attempt.id]);
    await expect(as("authenticated", customer, "select * from public.redeem_miniprogram_pay_ticket($1)", [t])).rejects.toThrow(/permission denied/);
    const results = await Promise.allSettled([
      as<{ id: string }>("service_role", null, "select * from public.redeem_miniprogram_pay_ticket($1)", [t]),
      as<{ id: string }>("service_role", null, "select * from public.redeem_miniprogram_pay_ticket($1)", [t]),
    ]);
    const fulfilled = results.filter((r): r is PromiseFulfilledResult<{ id: string }> => r.status === "fulfilled");
    expect(fulfilled).toHaveLength(1);
    expect(fulfilled[0]!.value.id).toBe(attempt.id);
    expect(String((results.find((r) => r.status === "rejected") as PromiseRejectedResult).reason)).toContain("LUGGAGE:PAY_TICKET_INVALID");
  });

  it("expire after five minutes", async () => {
    const attempt = await miniprogramAttempt();
    const { t } = await as<{ t: string }>("authenticated", customer, "select public.create_miniprogram_pay_ticket($1) as t", [attempt.id]);
    await client.query("update public.miniprogram_pay_tickets set expires_at = now() - interval '1 second' where attempt_id = $1", [attempt.id]);
    await expect(as("service_role", null, "select * from public.redeem_miniprogram_pay_ticket($1)", [t])).rejects.toThrow("LUGGAGE:PAY_TICKET_INVALID");
  });

  it("are refused for other payment methods", async () => {
    const quote = await as<{ id: string }>("authenticated", customer, "select * from public.create_quote($1, $2, null, '{\"standard\":1}', 'KE1', $3)", [
      fixture.slotId,
      fixture.cityHotel,
      fixture.departs,
    ]);
    const order = await as<{ id: string }>("authenticated", customer, "select * from public.create_order($1, $2, $3, 'zh-CN', $4)", [
      quote.id,
      key(),
      JSON.stringify({ name: "王", wechat: "wxid_test" }),
      ["bag-size-rules", "prohibited-items"],
    ]);
    const attempt = await as<{ id: string }>("authenticated", customer, "select * from public.start_payment($1, 'mock', 'alipay', $2)", [order.id, key()]);
    await expect(as("authenticated", customer, "select public.create_miniprogram_pay_ticket($1)", [attempt.id])).rejects.toThrow("LUGGAGE:ORDER_NOT_PAYABLE");
  });
});
