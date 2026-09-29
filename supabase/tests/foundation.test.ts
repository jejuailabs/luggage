import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asRole, connect } from "./support/db";

let client: pg.Client;

beforeAll(async () => {
  client = await connect();
});

afterAll(async () => {
  await client.end();
});

describe("schema guards", () => {
  it("enables RLS on every table in the public schema", async () => {
    const { rows } = await client.query<{ table_name: string }>(`
      select c.relname as table_name
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
    `);
    expect(rows).toEqual([]);
  });
});

describe("feature_settings", () => {
  it("is invisible to anon and authenticated", async () => {
    for (const role of ["anon", "authenticated"] as const) {
      await expect(asRole(client, role, (c) => c.query("select * from public.feature_settings"))).rejects.toThrow(
        /permission denied/,
      );
    }
  });

  it("is readable by service_role and contains seed rows", async () => {
    const { rows } = await asRole(client, "service_role", (c) =>
      c.query("select feature from public.feature_settings where environment = 'local' order by feature"),
    );
    expect(rows.map((r) => r.feature)).toContain("route.hotel_to_airport");
  });

  it("rejects an enabled mock integration in production", async () => {
    await expect(
      asRole(client, "service_role", (c) =>
        c.query(
          "insert into public.feature_settings (feature, environment, mode, enabled) values ('payment', 'production', 'mock', true)",
        ),
      ),
    ).rejects.toThrow(/feature_settings_no_mock_in_production/);
  });

  it("rejects live mode outside production", async () => {
    await expect(
      asRole(client, "service_role", (c) =>
        c.query(
          "insert into public.feature_settings (feature, environment, mode, enabled) values ('payment', 'staging', 'live', true)",
        ),
      ),
    ).rejects.toThrow(/feature_settings_live_only_in_production/);
  });

  it("keeps one row per feature and environment", async () => {
    await expect(
      asRole(client, "service_role", (c) =>
        c.query("insert into public.feature_settings (feature, environment) values ('payment', 'local')"),
      ),
    ).rejects.toThrow(/feature_settings_feature_environment_key/);
  });

  it("updates updated_at on change", async () => {
    const result = await asRole(client, "service_role", async (c) => {
      await c.query("update public.feature_settings set updated_at = now() - interval '1 day' where feature = 'payment'");
      // 같은 트랜잭션의 now()는 고정이므로 비교 기준을 과거로 옮긴 뒤 다시 갱신한다.
      const { rows } = await c.query<{ changed: boolean }>(
        "update public.feature_settings set note = 'changed' where feature = 'payment' and environment = 'local' returning updated_at > now() - interval '1 minute' as changed",
      );
      return rows[0]?.changed;
    });
    expect(result).toBe(true);
  });
});
