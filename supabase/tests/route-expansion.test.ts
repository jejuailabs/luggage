import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { as, createUser } from "./support/booking";
import { connect } from "./support/db";

let client: pg.Client;
let customer: string;
let driver: string;
let dispatcher: string;
let cityHotel: string;
let seogwipoHotel: string;
let cityStaff: string;
let seogwipoStaff: string;
let seq = 0;
const key = () => `route-exp-${++seq}-${Date.now()}`;

type Slot = { id: string; pickup_ends_at: Date; delivery_ends_at: Date };

async function slotFor(routeType: string, origin: string, destination: string): Promise<Slot> {
  return (
    await client.query(
      `select s.id, s.pickup_ends_at, s.delivery_ends_at from public.service_slots s
       join public.route_offerings r on r.id = s.route_offering_id
       join public.service_zones o on o.id = r.origin_zone_id
       join public.service_zones d on d.id = r.destination_zone_id
       where r.route_type = $1 and o.code = $2 and d.code = $3 and s.booking_cutoff_at > now()
       order by s.pickup_starts_at limit 1`,
      [routeType, origin, destination],
    )
  ).rows[0];
}

function quote(slot: string, origin: string | null, destination: string | null, flight: { departs?: Date; arrives?: Date } = {}) {
  return as<Record<string, unknown> & { id: string }>(
    "authenticated",
    customer,
    "select * from public.create_quote($1, $2, $3, '{\"standard\":2}', $4, $5, $6)",
    [slot, origin, destination, flight.arrives || flight.departs ? "KE1234" : null, flight.departs ?? null, flight.arrives ?? null],
  );
}

async function confirm(quoteId: string) {
  const order = await as<{ id: string; flight_arrives_at: Date | null }>(
    "authenticated",
    customer,
    "select * from public.create_order_with_attribution($1, $2, $3, 'zh-CN', $4, null)",
    [quoteId, key(), JSON.stringify({ name: "王", email: "w@example.com" }), ["bag-size-rules", "prohibited-items", "cancellation-refund", "damage-compensation"]],
  );
  const attempt = await as<{ merchant_order_id: string; amount_minor: number }>(
    "authenticated",
    customer,
    "select * from public.start_payment($1, 'mock', 'alipay', $2)",
    [order.id, key()],
  );
  await as("service_role", null, "select public.record_payment_result('mock', $1, 'h', $2, 'txn-' || $2, 'succeeded', $3, 'KRW')", [
    key(),
    attempt.merchant_order_id,
    attempt.amount_minor,
  ]);
  const job = (await client.query("select id from public.delivery_jobs where order_id = $1", [order.id])).rows[0].id as string;
  const tags = (await client.query("select tag_id from public.bags where order_id = $1 order by seq", [order.id])).rows.map((r) => r.tag_id as string);
  return { order, job, tags };
}

function event(actor: string, tag: string, job: string, type: string, note: string | null = null) {
  return as<{ to_status: string }>("authenticated", actor, "select * from public.record_bag_event($1, $2, $3::public.bag_event_type, $4, now(), null, '{}', $5)", [
    tag,
    job,
    type,
    key(),
    note,
  ]);
}

beforeAll(async () => {
  client = await connect();
  customer = await createUser(client, { anonymous: true });
  driver = await createUser(client, { role: "driver" });
  dispatcher = await createUser(client, { role: "dispatcher" });
  cityHotel = (await client.query("select id from public.hotels where slug = 'sample-hotel-jeju-city'")).rows[0].id;
  seogwipoHotel = (await client.query("select id from public.hotels where slug = 'sample-hotel-seogwipo'")).rows[0].id;
  cityStaff = await createUser(client, { role: "hotel_staff", hotelId: cityHotel });
  seogwipoStaff = await createUser(client, { role: "hotel_staff", hotelId: seogwipoHotel });
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

describe("airport → hotel", () => {
  it("requires an arrival time that leaves room to hand over bags", async () => {
    const slot = await slotFor("airport_to_hotel", "jeju-airport", "jeju-city");
    await expect(quote(slot.id, null, cityHotel)).rejects.toThrow("LUGGAGE:FLIGHT_REQUIRED");
    const tooLate = new Date(new Date(slot.pickup_ends_at).getTime() - 30 * 60_000);
    await expect(quote(slot.id, null, cityHotel, { arrives: tooLate })).rejects.toThrow("LUGGAGE:FLIGHT_TOO_LATE");
    await expect(quote(slot.id, cityHotel, cityHotel, { arrives: new Date(new Date(slot.pickup_ends_at).getTime() - 3 * 3600_000) })).rejects.toThrow(
      "LUGGAGE:ORIGIN_HOTEL_INVALID",
    );
    const arrives = new Date(new Date(slot.pickup_ends_at).getTime() - 2 * 3600_000);
    const q = await quote(slot.id, null, cityHotel, { arrives });
    expect(q).toMatchObject({ route_type: "airport_to_hotel", flight_departs_at: null, total_minor: 30000 });
    expect(new Date(q.flight_arrives_at as string).getTime()).toBe(arrives.getTime());
  });

  it("is delivered by the destination hotel, not by a customer code", async () => {
    const slot = await slotFor("airport_to_hotel", "jeju-airport", "jeju-city");
    const q = await quote(slot.id, null, cityHotel, { arrives: new Date(new Date(slot.pickup_ends_at).getTime() - 2 * 3600_000) });
    const { order, job, tags } = await confirm(q.id);
    expect(order.flight_arrives_at).not.toBeNull();
    await as("authenticated", dispatcher, "select public.assign_driver($1, $2)", [job, driver]);
    for (const tag of tags) {
      // 공항에서 고객에게 직접 받는다 (호텔 보관 단계 없음)
      await event(driver, tag, job, "collected", "공항 도착층에서 고객에게서 인수");
      await event(driver, tag, job, "loaded");
      await event(driver, tag, job, "ready_for_handoff");
    }
    await expect(as("authenticated", customer, "select * from public.issue_handoff_challenge($1)", [order.id])).rejects.toThrow(
      "LUGGAGE:HANDOFF_NOT_APPLICABLE",
    );
    await expect(event(driver, tags[0]!, job, "delivered")).rejects.toThrow("LUGGAGE:INVALID_TRANSITION");
    await expect(event(seogwipoStaff, tags[0]!, job, "delivered")).rejects.toThrow("LUGGAGE:FORBIDDEN");

    const dropoffs = await as<{ direction: string; bag_count: number }>(
      "authenticated",
      cityStaff,
      "select * from public.partner_jobs($1, current_date - 1, current_date + 30) where job_id = $2",
      [cityHotel, job],
    );
    expect(dropoffs).toMatchObject({ direction: "dropoff", bag_count: 2 });

    await event(cityStaff, tags[0]!, job, "delivered");
    expect((await client.query("select status from public.delivery_jobs where id = $1", [job])).rows[0].status).toBe("ready");
    await event(cityStaff, tags[1]!, job, "delivered");
    expect((await client.query("select status from public.delivery_jobs where id = $1", [job])).rows[0].status).toBe("completed");
  });
});

describe("hotel → hotel", () => {
  it("needs two different hotels in the offering's zones and no flight", async () => {
    const slot = await slotFor("hotel_to_hotel", "jeju-city", "seogwipo");
    await expect(quote(slot.id, cityHotel, cityHotel)).rejects.toThrow("LUGGAGE:DESTINATION_HOTEL_INVALID");
    await expect(quote(slot.id, seogwipoHotel, cityHotel)).rejects.toThrow("LUGGAGE:ORIGIN_HOTEL_INVALID");
    const q = await quote(slot.id, cityHotel, seogwipoHotel);
    expect(q).toMatchObject({ route_type: "hotel_to_hotel", flight_number: null, flight_departs_at: null, flight_arrives_at: null });
  });

  it("is received by the origin hotel and handed over at the destination hotel", async () => {
    const slot = await slotFor("hotel_to_hotel", "jeju-city", "seogwipo");
    const q = await quote(slot.id, cityHotel, seogwipoHotel);
    const { job, tags } = await confirm(q.id);
    await as("authenticated", dispatcher, "select public.assign_driver($1, $2)", [job, driver]);
    const tag = tags[0]!;
    expect((await event(cityStaff, tag, job, "origin_received")).to_status).toBe("at_origin");
    // 도착 호텔은 출발 접수를 할 수 없다
    await expect(event(seogwipoStaff, tags[1]!, job, "origin_received")).rejects.toThrow("LUGGAGE:INVALID_TRANSITION");
    await event(driver, tag, job, "collected", "외관 이상 없음");
    await event(driver, tag, job, "loaded");
    await event(driver, tag, job, "ready_for_handoff");
    // 출발 호텔은 도착 인수를 할 수 없다
    await expect(event(cityStaff, tag, job, "delivered")).rejects.toThrow("LUGGAGE:INVALID_TRANSITION");
    expect((await event(seogwipoStaff, tag, job, "delivered")).to_status).toBe("delivered");
  });
});
