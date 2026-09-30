import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { connect } from "./support/db";
import { as, createUser, setupBookingFixture } from "./support/booking";

let client: pg.Client;
let fixture: Awaited<ReturnType<typeof setupBookingFixture>>;
const POLICIES = ["bag-size-rules", "prohibited-items", "cancellation-refund", "damage-compensation"];

type Quote = { id: string; subtotal_minor: number; discount_minor: number; total_minor: number; tax_minor: number; coupon_id: string | null };

function quote(user: string, bags: Record<string, number>) {
  return as<Quote>("authenticated", user, "select * from public.create_quote($1, $2, null, $3, 'KE1', $4)", [
    fixture.slotId,
    fixture.cityHotel,
    JSON.stringify(bags),
    fixture.departs,
  ]);
}
const apply = (user: string, quoteId: string, code: string | null) =>
  as<Quote>("authenticated", user, "select * from public.apply_quote_coupon($1, $2)", [quoteId, code]);

beforeAll(async () => {
  client = await connect();
  fixture = await setupBookingFixture(client, 23);
  await client.query(`insert into public.coupons (code, kind, value, route_types, note) values ('AIRPORTONLY', 'fixed', 3000, array['airport_to_hotel']::public.route_type[], 'test') on conflict (code) do nothing`);
  await client.query(`insert into public.coupons (code, kind, value, min_subtotal_minor, note) values ('BIGBAGS', 'fixed', 5000, 60000, 'test') on conflict (code) do nothing`);
  await client.query(`insert into public.coupons (code, kind, value, note) values ('FREEALL', 'percent', 100, 'test') on conflict (code) do nothing`);
  await client.query(`insert into public.coupons (code, kind, value, status, note) values ('PAUSED01', 'fixed', 1000, 'paused', 'test') on conflict (code) do nothing`);
});

afterAll(async () => {
  await client.end();
});

describe("coupons", () => {
  it("applies a percent coupon with VAT recalculated on the discounted total", async () => {
    const user = await createUser(client, { anonymous: true });
    const q = await quote(user, { standard: 2 });
    const applied = await apply(user, q.id, " welcome10 ");
    expect(applied).toMatchObject({ subtotal_minor: 30000, discount_minor: 3000, total_minor: 27000, tax_minor: 2455 });
    expect(applied.coupon_id).not.toBeNull();
  });

  it("caps the discount and keeps the minimum charge", async () => {
    const user = await createUser(client, { anonymous: true });
    const big = await quote(user, { large: 4 });
    expect((await apply(user, big.id, "WELCOME10")).discount_minor).toBe(5000);
    const free = await apply(user, big.id, "FREEALL");
    expect(free).toMatchObject({ discount_minor: 79000, total_minor: 1000 });
  });

  it("removes the coupon when the code is empty", async () => {
    const user = await createUser(client, { anonymous: true });
    const q = await quote(user, { standard: 1 });
    await apply(user, q.id, "WELCOME10");
    expect(await apply(user, q.id, "")).toMatchObject({ discount_minor: 0, total_minor: 15000, tax_minor: 1364, coupon_id: null });
  });

  it("rejects unknown, paused, route-restricted and below-minimum coupons", async () => {
    const user = await createUser(client, { anonymous: true });
    const q = await quote(user, { standard: 1 });
    await expect(apply(user, q.id, "NOPE1234")).rejects.toThrow("LUGGAGE:COUPON_INVALID");
    await expect(apply(user, q.id, "PAUSED01")).rejects.toThrow("LUGGAGE:COUPON_INVALID");
    await expect(apply(user, q.id, "AIRPORTONLY")).rejects.toThrow("LUGGAGE:COUPON_NOT_APPLICABLE");
    await expect(apply(user, q.id, "BIGBAGS")).rejects.toThrow("LUGGAGE:COUPON_NOT_APPLICABLE");
  });

  it("only lets the quote owner apply a coupon", async () => {
    const owner = await createUser(client, { anonymous: true });
    const other = await createUser(client, { anonymous: true });
    const q = await quote(owner, { standard: 1 });
    await expect(apply(other, q.id, "WELCOME10")).rejects.toThrow("LUGGAGE:QUOTE_NOT_FOUND");
  });

  it("carries the discount into the order and enforces the per-user limit", async () => {
    const user = await createUser(client, { anonymous: true });
    const q = await quote(user, { standard: 2 });
    await apply(user, q.id, "WELCOME10");
    const order = await as<{ id: string; total_minor: number; discount_minor: number }>(
      "authenticated",
      user,
      "select * from public.create_order_with_attribution($1, $2, $3, 'zh-CN', $4, null)",
      [q.id, `coupon-${q.id}`, JSON.stringify({ name: "王", email: "w@example.com" }), POLICIES],
    );
    expect(order).toMatchObject({ discount_minor: 3000, total_minor: 27000 });
    await expect(apply(user, q.id, null)).rejects.toThrow("LUGGAGE:QUOTE_ALREADY_ORDERED");
    const next = await quote(user, { standard: 1 });
    await expect(apply(user, next.id, "WELCOME10")).rejects.toThrow("LUGGAGE:COUPON_LIMIT_REACHED");
  });

  it("hides coupons from customers", async () => {
    const user = await createUser(client, { anonymous: true });
    const rows = await as<unknown>("authenticated", user, "select count(*)::int as n from public.coupons");
    expect(rows).toEqual({ n: 0 });
  });
});
