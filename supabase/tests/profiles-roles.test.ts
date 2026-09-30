import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asRole, connect } from "./support/db";

let client: pg.Client;
let alice: string;
let bob: string;
let guest: string;

async function createUser(isAnonymous = false): Promise<string> {
  const { rows } = await client.query<{ id: string }>(
    "insert into auth.users (is_anonymous) values ($1) returning id",
    [isAnonymous],
  );
  return rows[0]!.id;
}

beforeAll(async () => {
  client = await connect();
  alice = await createUser();
  bob = await createUser();
  guest = await createUser(true);
});

afterAll(async () => {
  await client.query("delete from auth.users where id = any($1)", [[alice, bob, guest]]);
  await client.end();
});

describe("profiles", () => {
  it("is created automatically for every auth user, including guests", async () => {
    const { rows } = await client.query("select user_id, locale, theme from public.profiles where user_id = any($1)", [
      [alice, guest],
    ]);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ locale: "zh-CN", theme: "system" });
  });

  it("lets a user read only their own profile", async () => {
    const rows = await asRole(
      client,
      "authenticated",
      async (c) => (await c.query("select user_id from public.profiles")).rows,
      { userId: alice },
    );
    expect(rows).toEqual([{ user_id: alice }]);
  });

  it("lets a user change display name, locale and theme", async () => {
    const row = await asRole(
      client,
      "authenticated",
      async (c) =>
        (
          await c.query(
            "update public.profiles set display_name = '王小明', locale = 'ko', theme = 'dark' where user_id = $1 returning locale, theme",
            [alice],
          )
        ).rows[0],
      { userId: alice },
    );
    expect(row).toEqual({ locale: "ko", theme: "dark" });
  });

  it("silently affects nothing when updating someone else's profile", async () => {
    const count = await asRole(
      client,
      "authenticated",
      async (c) => (await c.query("update public.profiles set display_name = 'x' where user_id = $1", [bob])).rowCount,
      { userId: alice },
    );
    expect(count).toBe(0);
  });

  it("forbids changing user_id", async () => {
    await expect(
      asRole(client, "authenticated", (c) => c.query("update public.profiles set user_id = $1 where user_id = $2", [bob, alice]), {
        userId: alice,
      }),
    ).rejects.toThrow(/permission denied/);
  });

  it("rejects unsupported locales", async () => {
    await expect(
      asRole(client, "authenticated", (c) => c.query("update public.profiles set locale = 'fr' where user_id = $1", [alice]), {
        userId: alice,
      }),
    ).rejects.toThrow(/check constraint/);
  });

  it("is invisible to the anon database role", async () => {
    await expect(asRole(client, "anon", (c) => c.query("select * from public.profiles"))).rejects.toThrow(/permission denied/);
  });
});

describe("role_assignments", () => {
  it("cannot be self-granted by an authenticated user", async () => {
    await expect(
      asRole(
        client,
        "authenticated",
        (c) => c.query("insert into public.role_assignments (user_id, role) values ($1, 'admin')", [alice]),
        { userId: alice },
      ),
    ).rejects.toThrow(/permission denied/);
  });

  it("is granted by the server and visible only to its owner", async () => {
    await asRole(client, "service_role", async (c) => {
      await c.query("insert into public.role_assignments (user_id, role) values ($1, 'driver')", [alice]);
      await c.query("select set_config('role', 'authenticated', true)");
      await c.query("select set_config('request.jwt.claim.sub', $1, true)", [bob]);
      const bobView = await c.query("select * from public.role_assignments");
      expect(bobView.rows).toEqual([]);
      await c.query("select set_config('request.jwt.claim.sub', $1, true)", [alice]);
      const aliceView = await c.query("select role from public.role_assignments");
      expect(aliceView.rows).toEqual([{ role: "driver" }]);
    });
  });

  it("refuses staff roles for anonymous guests", async () => {
    await expect(
      asRole(client, "service_role", (c) =>
        c.query("insert into public.role_assignments (user_id, role) values ($1, 'support')", [guest]),
      ),
    ).rejects.toThrow(/anonymous users cannot hold staff roles/);
  });

  it("requires a hotel scope for hotel staff and a global scope otherwise", async () => {
    await expect(
      asRole(client, "service_role", (c) =>
        c.query("insert into public.role_assignments (user_id, role) values ($1, 'hotel_staff')", [bob]),
      ),
    ).rejects.toThrow(/role_assignments_(role_scope|scope_shape)/);
    await expect(
      asRole(client, "service_role", (c) =>
        c.query(
          "insert into public.role_assignments (user_id, role, scope_type, scope_id) values ($1, 'admin', 'hotel', (select id from public.hotels limit 1))",
          [bob],
        ),
      ),
    ).rejects.toThrow(/role_assignments_role_scope/);
  });

  it("prevents duplicate grants", async () => {
    await expect(
      asRole(client, "service_role", async (c) => {
        await c.query("insert into public.role_assignments (user_id, role) values ($1, 'finance')", [bob]);
        await c.query("insert into public.role_assignments (user_id, role) values ($1, 'finance')", [bob]);
      }),
    ).rejects.toThrow(/role_assignments_unique_scope/);
  });

  it("writes an audit event for every grant and revoke", async () => {
    const actions = await asRole(client, "service_role", async (c) => {
      const { rows } = await c.query<{ id: string }>(
        "insert into public.role_assignments (user_id, role, granted_by) values ($1, 'dispatcher', $2) returning id",
        [bob, alice],
      );
      await c.query("delete from public.role_assignments where id = $1", [rows[0]!.id]);
      return (
        await c.query("select action, actor_user_id from public.audit_events where target_id = $1 order by occurred_at, action", [
          rows[0]!.id,
        ])
      ).rows;
    });
    expect(actions.map((a) => a.action).sort()).toEqual(["role.granted", "role.revoked"]);
    expect(actions[0]!.actor_user_id).toBe(alice);
  });

  it("does not let authenticated users read or edit audit events", async () => {
    await expect(
      asRole(client, "authenticated", (c) => c.query("select * from public.audit_events"), { userId: alice }),
    ).rejects.toThrow(/permission denied/);
  });
});

describe("has_role", () => {
  it("requires AAL2 for admin, finance and dispatcher while preserving ordinary roles", async () => {
    await client.query("insert into public.role_assignments(user_id, role) values ($1,'admin'),($2,'driver')", [bob, alice]);
    try {
      const lowAdmin = await asRole(client, "authenticated", async (c) => (await c.query("select public.has_role('admin') as allowed")).rows[0]!.allowed, { userId: bob, aal: "aal1" });
      const highAdmin = await asRole(client, "authenticated", async (c) => (await c.query("select public.has_role('admin') as allowed")).rows[0]!.allowed, { userId: bob, aal: "aal2" });
      const lowDriver = await asRole(client, "authenticated", async (c) => (await c.query("select public.has_role('driver') as allowed")).rows[0]!.allowed, { userId: alice, aal: "aal1" });
      expect([lowAdmin, highAdmin, lowDriver]).toEqual([false, true, true]);
    } finally {
      await client.query("delete from public.role_assignments where user_id=any($1::uuid[]) and role in ('admin','driver')", [[bob, alice]]);
    }
  });
  it("checks only the caller's own roles, with admin implying all", async () => {
    const result = await asRole(client, "service_role", async (c) => {
      await c.query("insert into public.role_assignments (user_id, role) values ($1, 'admin')", [bob]);
      const hotel = (await c.query<{ id: string }>("select id from public.hotels where slug = 'sample-hotel-jeju-city'")).rows[0]!.id;
      await c.query("insert into public.role_assignments (user_id, role, scope_type, scope_id) values ($1, 'hotel_staff', 'hotel', $2)", [
        alice,
        hotel,
      ]);
      await c.query("select set_config('role', 'authenticated', true)");
      await c.query("select set_config('request.jwt.claim.sub', $1, true)", [alice]);
      const aliceChecks = (
        await c.query(
          `select public.has_role('hotel_staff', 'hotel', $1) as own_hotel,
                  public.has_role('hotel_staff', 'hotel', gen_random_uuid()) as other_hotel,
                  public.has_role('finance') as finance`,
          [hotel],
        )
      ).rows[0];
      await c.query("select set_config('request.jwt.claim.sub', $1, true)", [bob]);
      const bobChecks = (await c.query("select public.has_role('finance') as finance")).rows[0];
      return { aliceChecks, bobChecks };
    });
    expect(result.aliceChecks).toEqual({ own_hotel: true, other_hotel: false, finance: false });
    expect(result.bobChecks).toEqual({ finance: true });
  });
});

describe("account deletion", () => {
  it("removes profile and roles, keeping the audit trail", async () => {
    const temp = await createUser();
    const { rows } = await client.query<{ id: string }>(
      "insert into public.role_assignments (user_id, role) values ($1, 'support') returning id",
      [temp],
    );
    await client.query("delete from auth.users where id = $1", [temp]);
    const remaining = await client.query(
      "select (select count(*) from public.profiles where user_id = $1)::int as profiles, (select count(*) from public.role_assignments where user_id = $1)::int as roles",
      [temp],
    );
    expect(remaining.rows[0]).toEqual({ profiles: 0, roles: 0 });
    const audit = await client.query("select action from public.audit_events where target_id = $1 order by occurred_at", [rows[0]!.id]);
    expect(audit.rows.map((r) => r.action)).toEqual(["role.granted", "role.revoked"]);
  });
});
