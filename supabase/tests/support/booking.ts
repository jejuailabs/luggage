import pg from "pg";
import { testDatabaseUrl } from "./db";

/** 역할·사용자를 설정하고 커밋까지 하는 호출 (별도 연결 — 동시성 테스트에 쓴다). */
export async function as<T>(
  role: "authenticated" | "service_role",
  userId: string | null,
  sql: string,
  params: unknown[] = [],
): Promise<T> {
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

export async function createUser(client: pg.Client, options: { anonymous?: boolean; role?: string; hotelId?: string } = {}) {
  const { rows } = await client.query<{ id: string }>("insert into auth.users (is_anonymous) values ($1) returning id", [
    options.anonymous ?? false,
  ]);
  const id = rows[0]!.id;
  if (options.role) {
    await client.query(
      "insert into public.role_assignments (user_id, role, scope_type, scope_id) values ($1, $2, $3, $4)",
      [id, options.role, options.hotelId ? "hotel" : "global", options.hotelId ?? null],
    );
  }
  return id;
}

/** 테스트 전용 슬롯(용량 100)과 zh-CN 필수 정책 게시본을 만든다. */
export async function setupBookingFixture(client: pg.Client, offsetMinutes: number) {
  const cityHotel: string = (await client.query("select id from public.hotels where slug = 'sample-hotel-jeju-city'")).rows[0].id;
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
       values ($1, $2, $3::timestamptz + make_interval(mins => $8), $4, $5, $6, $7) returning id, delivery_ends_at`,
      [
        base.route_offering_id,
        base.service_date,
        base.pickup_starts_at,
        base.pickup_ends_at,
        base.delivery_starts_at,
        base.delivery_ends_at,
        base.booking_cutoff_at,
        offsetMinutes,
      ],
    )
  ).rows[0];
  await client.query("insert into public.capacity_buckets (slot_id, max_units) values ($1, 100)", [slot.id]);
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
  return {
    cityHotel,
    slotId: slot.id as string,
    departs: new Date(new Date(slot.delivery_ends_at).getTime() + 3 * 3600_000),
  };
}

/** 견적 → 주문 → mock 결제 성공까지 진행한 확정 주문. */
export async function confirmedOrder(
  fixture: { cityHotel: string; slotId: string; departs: Date },
  customer: string,
  bags: Record<string, number>,
) {
  const quote = await as<{ id: string }>("authenticated", customer, "select * from public.create_quote($1, $2, null, $3, 'KE1', $4)", [
    fixture.slotId,
    fixture.cityHotel,
    JSON.stringify(bags),
    fixture.departs,
  ]);
  const order = await as<{ id: string }>("authenticated", customer, "select * from public.create_order($1, $2, $3, 'zh-CN', $4)", [
    quote.id,
    `ord-${quote.id}`,
    JSON.stringify({ name: "王", email: "w@example.com", phone: "+8613800138000" }),
    ["bag-size-rules", "prohibited-items"],
  ]);
  const attempt = await as<{ merchant_order_id: string; amount_minor: number }>(
    "authenticated",
    customer,
    "select * from public.start_payment($1, 'mock', 'alipay', $2)",
    [order.id, `pay-${order.id}`],
  );
  await as("service_role", null, "select public.record_payment_result('mock', $1, 'h', $2, 'txn-' || $2, 'succeeded', $3, 'KRW')", [
    `evt-${order.id}`,
    attempt.merchant_order_id,
    attempt.amount_minor,
  ]);
  return order;
}
