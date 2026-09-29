import type pg from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { asRole, connect } from "./support/db";

let client: pg.Client;
let editor: string;
let admin: string;
let customer: string;
let contentId: string;

async function createUser(): Promise<string> {
  const { rows } = await client.query<{ id: string }>("insert into auth.users default values returning id");
  return rows[0]!.id;
}

async function translations() {
  const { rows } = await client.query(
    "select locale, status, needs_review, based_on_version from public.content_translations where content_id = $1 order by locale",
    [contentId],
  );
  return rows;
}

beforeAll(async () => {
  client = await connect();
  editor = await createUser();
  admin = await createUser();
  customer = await createUser();
  await client.query("insert into public.role_assignments (user_id, role) values ($1, 'content_editor'), ($2, 'admin')", [
    editor,
    admin,
  ]);
});

beforeEach(async () => {
  await client.query("delete from public.content_items");
  const { rows } = await client.query<{ id: string }>(
    "insert into public.content_items (slug, kind, criticality) values ('airport-pickup', 'guide', 'general') returning id",
  );
  contentId = rows[0]!.id;
  await client.query(
    `insert into public.content_translations (content_id, locale, title, body, status, published_at) values
      ($1, 'ko', '공항 수령 안내', '원문', 'published', now()),
      ($1, 'zh-CN', '机场取件说明', '译文', 'published', now()),
      ($1, 'en', 'Airport pickup', 'draft text', 'draft', null)`,
    [contentId],
  );
});

afterAll(async () => {
  await client.query("delete from public.content_items");
  await client.query("delete from auth.users where id = any($1)", [[editor, admin, customer]]);
  await client.end();
});

describe("public visibility", () => {
  it("shows only published translations to visitors", async () => {
    const rows = await asRole(client, "anon", async (c) =>
      (await c.query("select locale from public.content_translations order by locale")).rows,
    );
    expect(rows.map((r) => r.locale)).toEqual(["ko", "zh-CN"]);
  });

  it("hides content items that have no published translation", async () => {
    await client.query("insert into public.content_items (slug, kind) values ('hidden-draft', 'faq')");
    const rows = await asRole(client, "anon", async (c) => (await c.query("select slug from public.content_items")).rows);
    expect(rows.map((r) => r.slug)).toEqual(["airport-pickup"]);
  });

  it("does not let customers write content", async () => {
    await expect(
      asRole(client, "authenticated", (c) => c.query("insert into public.content_items (slug, kind) values ('x', 'faq')"), {
        userId: customer,
      }),
    ).rejects.toThrow(/row-level security/);
  });
});

describe("source changes", () => {
  it("bumps the source version and sends other locales back to review", async () => {
    await client.query("update public.content_translations set body = '원문 수정' where content_id = $1 and locale = 'ko'", [
      contentId,
    ]);
    const { rows } = await client.query("select source_version from public.content_items where id = $1", [contentId]);
    expect(rows[0].source_version).toBe(2);
    expect(await translations()).toEqual([
      { locale: "en", status: "draft", needs_review: true, based_on_version: 1 },
      { locale: "ko", status: "published", needs_review: false, based_on_version: 2 },
      { locale: "zh-CN", status: "review", needs_review: true, based_on_version: 1 },
    ]);
  });

  it("ignores edits that do not change title or body", async () => {
    await client.query("update public.content_translations set title = title where content_id = $1 and locale = 'ko'", [contentId]);
    const { rows } = await client.query("select source_version from public.content_items where id = $1", [contentId]);
    expect(rows[0].source_version).toBe(1);
  });

  it("refuses to clear needs_review without rebasing on the latest source", async () => {
    await client.query("update public.content_translations set body = '원문 수정' where content_id = $1 and locale = 'ko'", [
      contentId,
    ]);
    await expect(
      client.query("update public.content_translations set needs_review = false where content_id = $1 and locale = 'zh-CN'", [
        contentId,
      ]),
    ).rejects.toThrow(/outdated source version/);
    await client.query(
      "update public.content_translations set needs_review = false, based_on_version = 2 where content_id = $1 and locale = 'zh-CN'",
      [contentId],
    );
  });

  it("cannot publish a translation that still needs review", async () => {
    await client.query("update public.content_translations set body = '원문 수정' where content_id = $1 and locale = 'ko'", [
      contentId,
    ]);
    await expect(
      client.query(
        "update public.content_translations set status = 'published', published_at = now() where content_id = $1 and locale = 'zh-CN'",
        [contentId],
      ),
    ).rejects.toThrow(/content_translations_no_publish_needs_review/);
  });
});

describe("editorial permissions", () => {
  it("lets editors draft but not publish", async () => {
    await asRole(
      client,
      "authenticated",
      async (c) => {
        await c.query("update public.content_translations set body = 'edited', status = 'review' where content_id = $1 and locale = 'en'", [
          contentId,
        ]);
      },
      { userId: editor },
    );
    await expect(
      asRole(
        client,
        "authenticated",
        (c) =>
          c.query(
            "update public.content_translations set status = 'published', published_at = now() where content_id = $1 and locale = 'en'",
            [contentId],
          ),
        { userId: editor },
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("lets admins publish", async () => {
    const count = await asRole(
      client,
      "authenticated",
      async (c) =>
        (
          await c.query(
            "update public.content_translations set status = 'published', published_at = now() where content_id = $1 and locale = 'en'",
            [contentId],
          )
        ).rowCount,
      { userId: admin },
    );
    expect(count).toBe(1);
  });

  it("keeps a published_at timestamp consistent with status", async () => {
    await expect(
      client.query("update public.content_translations set status = 'published' where content_id = $1 and locale = 'en'", [contentId]),
    ).rejects.toThrow(/content_translations_published_at/);
  });
});
