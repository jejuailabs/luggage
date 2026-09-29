import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asRole, connect } from "./support/db";

let client: pg.Client;
let admin: string;
let dispatcher: string;
let hotelStaff: string;
let customer: string;
let cityZone: string;
let airportZone: string;
let cityHotel: string;
let otherHotel: string;

async function createUser(): Promise<string> {
  const { rows } = await client.query<{ id: string }>("insert into auth.users default values returning id");
  return rows[0]!.id;
}

async function id(sql: string, params: unknown[] = []): Promise<string> {
  return (await client.query<{ id: string }>(sql, params)).rows[0]!.id;
}

beforeAll(async () => {
  client = await connect();
  cityZone = await id("select id from public.service_zones where code = 'jeju-city'");
  airportZone = await id("select id from public.service_zones where code = 'jeju-airport'");
  cityHotel = await id("select id from public.hotels where slug = 'sample-hotel-jeju-city'");
  otherHotel = await id(
    "insert into public.hotels (zone_id, slug, name_ko, address_ko, status) values ($1, 'draft-hotel', '초안 호텔', '주소 3', 'draft') returning id",
    [cityZone],
  );
  admin = await createUser();
  dispatcher = await createUser();
  hotelStaff = await createUser();
  customer = await createUser();
  await client.query(
    `insert into public.role_assignments (user_id, role, scope_type, scope_id) values
      ($1, 'admin', 'global', null), ($2, 'dispatcher', 'global', null), ($3, 'hotel_staff', 'hotel', $4)`,
    [admin, dispatcher, hotelStaff, otherHotel],
  );
});

afterAll(async () => {
  await client.query("delete from auth.users where id = any($1)", [[admin, dispatcher, hotelStaff, customer]]);
  await client.end();
});

describe("public catalog", () => {
  it("shows only active hotels to visitors, with their translations", async () => {
    const rows = await asRole(client, "anon", async (c) =>
      (
        await c.query(
          "select h.slug, t.name from public.hotels h left join public.hotel_translations t on t.hotel_id = h.id and t.locale = 'zh-CN' order by h.slug",
        )
      ).rows,
    );
    expect(rows).toEqual([
      { slug: "sample-hotel-jeju-city", name: "示例酒店 济州市店" },
      { slug: "sample-hotel-seogwipo", name: "示例酒店 西归浦店" },
    ]);
  });

  it("hides partner contract data from visitors and customers", async () => {
    await expect(asRole(client, "anon", (c) => c.query("select * from public.hotel_partners"))).rejects.toThrow(/permission denied/);
    const rows = await asRole(client, "authenticated", async (c) => (await c.query("select * from public.hotel_partners")).rows, {
      userId: customer,
    });
    expect(rows).toEqual([]);
  });

  it("shows only enabled route offerings to visitors", async () => {
    const rows = await asRole(client, "anon", async (c) =>
      (await c.query("select distinct route_type from public.route_offerings order by route_type")).rows,
    );
    expect(rows).toEqual([{ route_type: "hotel_to_airport" }]);
  });

  it("does not let customers change the catalog", async () => {
    await expect(
      asRole(client, "authenticated", (c) => c.query("update public.hotels set name_ko = 'x' where id = $1 returning id", [cityHotel]), {
        userId: customer,
      }).then((r) => r.rowCount),
    ).resolves.toBe(0);
    await expect(
      asRole(client, "anon", (c) => c.query("delete from public.hotels where id = $1", [cityHotel])),
    ).rejects.toThrow(/permission denied/);
  });
});

describe("staff visibility", () => {
  it("lets dispatchers see draft hotels", async () => {
    const rows = await asRole(client, "authenticated", async (c) => (await c.query("select slug from public.hotels where status = 'draft'")).rows, {
      userId: dispatcher,
    });
    expect(rows).toEqual([{ slug: "draft-hotel" }]);
  });

  it("lets hotel staff see their own draft hotel but not write", async () => {
    const rows = await asRole(client, "authenticated", async (c) => (await c.query("select slug from public.hotels where status = 'draft'")).rows, {
      userId: hotelStaff,
    });
    expect(rows).toEqual([{ slug: "draft-hotel" }]);
    const updated = await asRole(
      client,
      "authenticated",
      async (c) => (await c.query("update public.hotels set name_ko = 'x' where id = $1", [otherHotel])).rowCount,
      { userId: hotelStaff },
    );
    expect(updated).toBe(0);
  });
});

describe("admin management", () => {
  it("lets admins create and activate hotels, recording an audit trail", async () => {
    const audit = await asRole(
      client,
      "authenticated",
      async (c) => {
        const { rows } = await c.query<{ id: string }>(
          "insert into public.hotels (zone_id, slug, name_ko, address_ko) values ($1, 'new-hotel', '새 호텔', '주소 9') returning id",
          [cityZone],
        );
        await c.query("update public.hotels set status = 'active' where id = $1", [rows[0]!.id]);
        await c.query("reset role");
        return (
          await c.query("select action, actor_user_id, detail from public.audit_events where target_id = $1 order by occurred_at, action", [
            rows[0]!.id,
          ])
        ).rows;
      },
      { userId: admin },
    );
    expect(audit.map((a) => a.action)).toEqual(["hotels.insert", "hotels.update"]);
    expect(audit[1]!.actor_user_id).toBe(admin);
    expect(audit[1]!.detail).toEqual({ status: { from: "draft", to: "active" } });
  });

  it("does not let dispatchers edit the catalog", async () => {
    const updated = await asRole(
      client,
      "authenticated",
      async (c) => (await c.query("update public.hotels set name_ko = 'x' where id = $1", [cityHotel])).rowCount,
      { userId: dispatcher },
    );
    expect(updated).toBe(0);
  });

  it("distinguishes branches with the same name by address", async () => {
    await expect(
      client.query(
        "insert into public.hotels (zone_id, slug, name_ko, address_ko) values ($1, 'dup', '예시 호텔 제주시점', '제주특별자치도 제주시 예시로 1')",
        [cityZone],
      ),
    ).rejects.toThrow(/hotels_name_address_key/);
  });
});

describe("route offerings", () => {
  it("requires zone kinds that match the route direction", async () => {
    await expect(
      client.query(
        "insert into public.route_offerings (route_type, origin_zone_id, destination_zone_id) values ('hotel_to_airport', $1, $1)",
        [cityZone],
      ),
    ).rejects.toThrow(/does not match zone kinds/);
    await expect(
      client.query(
        "insert into public.route_offerings (route_type, origin_zone_id, destination_zone_id) values ('airport_to_hotel', $1, $2)",
        [cityZone, airportZone],
      ),
    ).rejects.toThrow(/does not match zone kinds/);
  });
});

describe("handoff locations", () => {
  it("does not allow overlapping versions of the same airport location", async () => {
    await client.query(
      `insert into public.handoff_locations (code, type, zone_id, name_ko, valid_from, valid_until, status)
       values ('arrival-counter', 'airport_counter', $1, '도착층 카운터', '2026-10-01', '2026-12-01', 'active')`,
      [airportZone],
    );
    await expect(
      client.query(
        `insert into public.handoff_locations (code, type, zone_id, name_ko, valid_from, status)
         values ('arrival-counter', 'airport_counter', $1, '도착층 카운터 v2', '2026-11-01', 'active')`,
        [airportZone],
      ),
    ).rejects.toThrow(/handoff_locations_no_overlap/);
    // 이전 버전이 끝난 뒤부터는 새 버전을 둘 수 있다.
    await client.query(
      `insert into public.handoff_locations (code, type, zone_id, name_ko, valid_from, status)
       values ('arrival-counter', 'airport_counter', $1, '도착층 카운터 v2', '2026-12-01', 'active')`,
      [airportZone],
    );
  });

  it("requires a hotel for front desk locations only", async () => {
    await expect(
      client.query("insert into public.handoff_locations (code, type, zone_id, name_ko) values ('desk', 'hotel_front_desk', $1, '프런트')", [
        cityZone,
      ]),
    ).rejects.toThrow(/handoff_locations_hotel_shape/);
  });

  it("hides future versions from visitors", async () => {
    const rows = await asRole(client, "anon", async (c) =>
      (await c.query("select name_ko from public.handoff_locations where code = 'arrival-counter'")).rows,
    );
    // 테스트 기준 시각(2026-09-29 이후 실행)에서 2026-10-01 이전이면 아직 유효하지 않다.
    const now = new Date();
    const expected = now < new Date("2026-10-01")
      ? []
      : now < new Date("2026-12-01")
        ? [{ name_ko: "도착층 카운터" }]
        : [{ name_ko: "도착층 카운터 v2" }];
    expect(rows).toEqual(expected);
  });
});

describe("hotel-scoped roles", () => {
  it("must point to an existing hotel", async () => {
    await expect(
      client.query("insert into public.role_assignments (user_id, role, scope_type, scope_id) values ($1, 'hotel_staff', 'hotel', gen_random_uuid())", [
        customer,
      ]),
    ).rejects.toThrow(/hotel scope .* does not exist/);
    await client.query("insert into public.role_assignments (user_id, role, scope_type, scope_id) values ($1, 'hotel_staff', 'hotel', $2)", [
      customer,
      cityHotel,
    ]);
  });
});
