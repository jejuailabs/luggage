import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asRole, connect } from "./support/db";

let client: pg.Client;
let guest: string;
let otherGuest: string;
let cityHotel: string;
let seogwipoHotel: string;
let slotId: string;
let slotDeliveryEnd: Date;

const HOUR = 3600_000;

async function createUser(isAnonymous = true): Promise<string> {
  const { rows } = await client.query<{ id: string }>("insert into auth.users (is_anonymous) values ($1) returning id", [isAnonymous]);
  return rows[0]!.id;
}

type QuoteArgs = {
  slot?: string;
  origin?: string | null;
  destination?: string | null;
  bags?: unknown;
  flight?: string | null;
  departs?: Date | null;
};

function callQuote(args: QuoteArgs, userId = guest) {
  return asRole(
    client,
    "authenticated",
    async (c) =>
      (
        await c.query("select * from public.create_quote($1, $2, $3, $4, $5, $6)", [
          args.slot ?? slotId,
          args.origin === undefined ? cityHotel : args.origin,
          args.destination ?? null,
          JSON.stringify(args.bags ?? { standard: 2, large: 1 }),
          args.flight === undefined ? "KE1234" : args.flight,
          args.departs === undefined ? new Date(slotDeliveryEnd.getTime() + 3 * HOUR) : args.departs,
        ])
      ).rows[0],
    { userId },
  );
}

beforeAll(async () => {
  client = await connect();
  guest = await createUser();
  otherGuest = await createUser();
  cityHotel = (await client.query("select id from public.hotels where slug = 'sample-hotel-jeju-city'")).rows[0].id;
  seogwipoHotel = (await client.query("select id from public.hotels where slug = 'sample-hotel-seogwipo'")).rows[0].id;
  // 제주시 → 공항 노선의 가장 이른 예약 가능 슬롯
  const slot = (
    await client.query(`
      select s.id, s.delivery_ends_at from public.service_slots s
      join public.route_offerings r on r.id = s.route_offering_id
      join public.service_zones z on z.id = r.origin_zone_id
      where z.code = 'jeju-city' and r.route_type = 'hotel_to_airport' and s.booking_cutoff_at > now()
      order by s.pickup_starts_at limit 1`)
  ).rows[0];
  slotId = slot.id;
  slotDeliveryEnd = slot.delivery_ends_at;
});

afterAll(async () => {
  await client.query("delete from auth.users where id = any($1)", [[guest, otherGuest]]);
  await client.end();
});

describe("available_slots", () => {
  it("lists open slots with remaining units for visitors", async () => {
    const rows = await asRole(client, "anon", async (c) =>
      (
        await c.query(
          `select a.* from public.service_slots s, lateral public.available_slots(s.route_offering_id, s.service_date) a
           where s.id = $1 and a.slot_id = $1`,
          [slotId],
        )
      ).rows,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].remaining_units).toBe(20);
  });

  it("does not expose the capacity ledger directly", async () => {
    await expect(asRole(client, "anon", (c) => c.query("select * from public.capacity_buckets"))).rejects.toThrow(/permission denied/);
  });
});

describe("create_quote", () => {
  it("prices bags from the rules with integer KRW and VAT included", async () => {
    const quote = await callQuote({});
    expect(quote).toMatchObject({
      owner_id: guest,
      route_type: "hotel_to_airport",
      bag_counts: { standard: 2, large: 1 },
      capacity_units: 4,
      subtotal_minor: 50000,
      discount_minor: 0,
      total_minor: 50000,
      tax_minor: 4545,
      currency: "KRW",
      flight_number: "KE1234",
    });
    expect(quote.line_items).toEqual([
      expect.objectContaining({ size: "standard", quantity: 2, unit_amount_minor: 15000, amount_minor: 30000 }),
      expect.objectContaining({ size: "large", quantity: 1, unit_amount_minor: 20000, amount_minor: 20000 }),
    ]);
    const ttl = new Date(quote.expires_at).getTime() - Date.now();
    expect(ttl).toBeGreaterThan(14 * 60_000);
    expect(ttl).toBeLessThanOrEqual(15 * 60_000);
  });

  it("is visible only to its owner", async () => {
    const quote = await callQuote({});
    const rows = await asRole(client, "authenticated", async (c) => (await c.query("select id from public.quotes where id = $1", [quote.id])).rows, {
      userId: otherGuest,
    });
    expect(rows).toEqual([]);
  });

  it("cannot be inserted directly with a forged amount", async () => {
    await expect(
      asRole(
        client,
        "authenticated",
        (c) =>
          c.query(
            `insert into public.quotes (owner_id, slot_id, route_offering_id, route_type, bag_counts, capacity_units, line_items,
               subtotal_minor, total_minor, tax_minor, currency, input_hash, expires_at)
             select $1, s.id, s.route_offering_id, 'hotel_to_airport', '{}', 1, '[]', 1, 1, 0, 'KRW', 'x', now() + interval '1 hour'
             from public.service_slots s where s.id = $2`,
            [guest, slotId],
          ),
        { userId: guest },
      ),
    ).rejects.toThrow(/permission denied/);
  });

  it("requires a session", async () => {
    await expect(
      asRole(client, "anon", (c) => c.query("select public.create_quote($1, $2, null, '{\"standard\":1}', 'KE1', now() + interval '2 days')", [slotId, cityHotel])),
    ).rejects.toThrow(/permission denied/);
  });

  it.each([
    ["no bags", { bags: { standard: 0 } }, "BAGS_INVALID"],
    ["negative bags", { bags: { standard: -1 } }, "BAGS_INVALID"],
    ["fractional bags", { bags: { standard: 1.5 } }, "BAGS_INVALID"],
    ["unknown size", { bags: { huge: 1 } }, "BAGS_INVALID"],
    ["too many bags", { bags: { standard: 9 } }, "BAGS_INVALID"],
    ["hotel outside origin zone", { origin: "SEOGWIPO" }, "ORIGIN_HOTEL_INVALID"],
    ["missing origin hotel", { origin: null }, "ORIGIN_HOTEL_INVALID"],
    ["unexpected destination hotel", { destination: "CITY" }, "DESTINATION_HOTEL_INVALID"],
    ["missing flight time", { departs: null }, "FLIGHT_REQUIRED"],
    ["flight too soon after delivery", { departs: "SOON" }, "FLIGHT_TOO_EARLY"],
    ["malformed flight number", { flight: "hello world" }, "FLIGHT_NUMBER_INVALID"],
  ])("rejects %s", async (_name, raw, code) => {
    const args = { ...(raw as QuoteArgs & { origin?: string; destination?: string; departs?: unknown }) };
    if (args.origin === "SEOGWIPO") args.origin = seogwipoHotel;
    if (args.destination === "CITY") args.destination = cityHotel;
    if ((args.departs as unknown) === "SOON") args.departs = new Date(slotDeliveryEnd.getTime() + HOUR);
    await expect(callQuote(args)).rejects.toThrow(`LUGGAGE:${code}`);
  });

  it("rejects slots past the booking cutoff", async () => {
    const past = (
      await client.query(
        `insert into public.service_slots (route_offering_id, service_date, pickup_starts_at, pickup_ends_at, delivery_starts_at, delivery_ends_at, booking_cutoff_at)
         select route_offering_id, current_date, now() + interval '1 hour', now() + interval '2 hours', now() + interval '3 hours', now() + interval '4 hours', now() - interval '1 minute'
         from public.service_slots where id = $1 returning id`,
        [slotId],
      )
    ).rows[0].id;
    await client.query("insert into public.capacity_buckets (slot_id, max_units) values ($1, 10)", [past]);
    await expect(callQuote({ slot: past, departs: new Date(Date.now() + 10 * HOUR) })).rejects.toThrow("LUGGAGE:BOOKING_CUTOFF_PASSED");
  });

  it("rejects when the route is not on sale", async () => {
    await client.query("update public.route_offerings set enabled = false where id = (select route_offering_id from public.service_slots where id = $1)", [
      slotId,
    ]);
    try {
      await expect(callQuote({})).rejects.toThrow("LUGGAGE:ROUTE_NOT_AVAILABLE");
    } finally {
      await client.query("update public.route_offerings set enabled = true where id = (select route_offering_id from public.service_slots where id = $1)", [
        slotId,
      ]);
    }
  });

  it("rejects when remaining capacity is too small", async () => {
    await client.query("update public.capacity_buckets set committed_units = 18 where slot_id = $1", [slotId]);
    try {
      await expect(callQuote({ bags: { large: 2 } })).rejects.toThrow("LUGGAGE:CAPACITY_UNAVAILABLE");
      const ok = await callQuote({ bags: { standard: 2 } });
      expect(ok.capacity_units).toBe(2);
    } finally {
      await client.query("update public.capacity_buckets set committed_units = 0 where slot_id = $1", [slotId]);
    }
  });

  it("rejects when no price rule covers the date", async () => {
    await client.query("update public.price_rules set status = 'archived' where bag_size = 'large'");
    try {
      await expect(callQuote({ bags: { large: 1 } })).rejects.toThrow("LUGGAGE:PRICE_UNAVAILABLE");
    } finally {
      await client.query("update public.price_rules set status = 'active' where bag_size = 'large'");
    }
  });
});

describe("capacity invariant", () => {
  it("never allows held + committed to exceed max", async () => {
    await expect(client.query("update public.capacity_buckets set held_units = 15, committed_units = 6 where slot_id = $1", [slotId])).rejects.toThrow(
      /capacity_buckets_within_max/,
    );
  });

  it("does not allow overlapping price rules for the same route and size", async () => {
    await expect(
      client.query(
        "insert into public.price_rules (route_offering_id, bag_size, unit_amount_minor, valid_from) select route_offering_id, 'standard', 1, current_date from public.service_slots where id = $1",
        [slotId],
      ),
    ).rejects.toThrow(/price_rules_no_overlap/);
  });
});
