import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createUser } from "./support/booking";
import { asRole, connect } from "./support/db";

let client: pg.Client;
let editor: string;
let customer: string;

beforeAll(async () => {
  client = await connect();
  editor = await createUser(client, { role: "content_editor" });
  customer = await createUser(client, { anonymous: true });
});

afterAll(async () => {
  await client.end();
});

describe("marketing campaigns", () => {
  it("are recorded by content editors and hidden from customers", async () => {
    const inserted = await asRole(
      client,
      "authenticated",
      async (c) =>
        (
          await c.query(
            "insert into public.marketing_campaigns (code, channel, name, landing_path, owner_id) values ('xhs_test_1', 'xiaohongshu', '체크아웃 후 관광', '/zh-CN/guide/checkout-day', $1) returning code",
            [editor],
          )
        ).rows,
      { userId: editor },
    );
    expect(inserted).toEqual([{ code: "xhs_test_1" }]);
    await expect(
      asRole(client, "authenticated", (c) => c.query("insert into public.marketing_campaigns (code, channel, name, landing_path) values ('x2', 'search', 'n', '/zh-CN')"), {
        userId: customer,
      }),
    ).rejects.toThrow(/row-level security/);
    const seen = await asRole(client, "authenticated", async (c) => (await c.query("select code from public.marketing_campaigns")).rows, { userId: customer });
    expect(seen).toEqual([]);
  });

  it("rejects non-https post URLs and relative landings", async () => {
    await expect(
      client.query("insert into public.marketing_campaigns (code, channel, name, landing_path, post_url) values ('x3', 'search', 'n', '/zh-CN', 'http://x')"),
    ).rejects.toThrow(/post_url/);
    await expect(client.query("insert into public.marketing_campaigns (code, channel, name, landing_path) values ('x4', 'search', 'n', 'zh-CN')")).rejects.toThrow(
      /landing_path/,
    );
  });
});

describe("scenario content", () => {
  it("can point to the route it describes", async () => {
    await client.query("insert into public.content_items (slug, kind, related_route) values ('arrival-day-test', 'guide', 'airport_to_hotel')");
    const row = (await client.query("select related_route from public.content_items where slug = 'arrival-day-test'")).rows[0];
    expect(row.related_route).toBe("airport_to_hotel");
  });
});
