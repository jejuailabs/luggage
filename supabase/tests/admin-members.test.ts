import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asRole, connect } from "./support/db";

let client: pg.Client;
let adminId: string;
let memberId: string;
let guestId: string;

beforeAll(async () => {
  client = await connect();
  const { rows } = await client.query<{ id: string; is_anonymous: boolean }>("insert into auth.users (is_anonymous) values (false), (false), (true) returning id, is_anonymous");
  adminId = rows[0]!.id;
  memberId = rows[1]!.id;
  guestId = rows[2]!.id;
  await client.query("insert into public.role_assignments (user_id, role) values ($1, 'admin')", [adminId]);
});
afterAll(async () => {
  await client.query("delete from auth.users where id = any($1)", [[adminId, memberId, guestId]]);
  await client.end();
});

describe("admin member management", () => {
  it("limits the member directory to admins", async () => {
    await expect(asRole(client, "authenticated", (c) => c.query("select * from public.admin_list_members()"), { userId: memberId })).rejects.toThrow(/FORBIDDEN/);
    const rows = await asRole(client, "authenticated", (c) => c.query("select user_id from public.admin_list_members() where user_id = $1", [memberId]), { userId: adminId });
    expect(rows.rows).toEqual([{ user_id: memberId }]);
  });
  it("grants and revokes a scoped staff role without letting an admin revoke their own access", async () => {
    await asRole(client, "authenticated", async (c) => {
      const added = await c.query("select public.admin_set_member_role($1, 'support', null, true) as saved", [memberId]);
      expect(added.rows[0]?.saved).toBe(true);
      await c.query("select set_config('role', 'service_role', true)");
      const granted = await c.query("select role from public.role_assignments where user_id = $1", [memberId]);
      expect(granted.rows).toEqual([{ role: "support" }]);
      await c.query("select set_config('role', 'authenticated', true)");
      await c.query("select public.admin_set_member_role($1, 'support', null, false)", [memberId]);
      await c.query("select set_config('role', 'service_role', true)");
      const revoked = await c.query("select role from public.role_assignments where user_id = $1", [memberId]);
      expect(revoked.rows).toEqual([]);
    }, { userId: adminId });
    await expect(asRole(client, "authenticated", (c) => c.query("select public.admin_set_member_role($1, 'admin', null, false)", [adminId]), { userId: adminId })).rejects.toThrow(/FORBIDDEN/);
  });
  it("refuses staff access to anonymous guests", async () => {
    await expect(asRole(client, "authenticated", (c) => c.query("select public.admin_set_member_role($1, 'support', null, true)", [guestId]), { userId: adminId })).rejects.toThrow(/VALIDATION_FAILED/);
  });
});
