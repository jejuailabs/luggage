import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { as, createUser } from "./support/booking";
import { asRole, connect } from "./support/db";

let client: pg.Client;
let staff: string;
let other: string;

beforeAll(async () => {
  client = await connect();
  staff = await createUser(client, { role: "dispatcher" });
  other = await createUser(client, { anonymous: true });
  // 다른 테스트가 남긴 대기 이벤트는 이 테스트 범위 밖으로 돌린다.
  await client.query("update public.outbox_events set status = 'done' where status in ('pending', 'processing')");
});

afterAll(async () => {
  await client.end();
});

describe("outbox consumption", () => {
  it("leases events once and retries failures with backoff until dead", async () => {
    const id = (await client.query("insert into public.outbox_events (topic, aggregate_id) values ('test.event', gen_random_uuid()) returning id")).rows[0].id;
    const [first, second] = await Promise.all([
      as<{ id: string } | undefined>("service_role", null, "select * from public.claim_outbox(10) where id = $1", [id]),
      as<{ id: string } | undefined>("service_role", null, "select * from public.claim_outbox(10) where id = $1", [id]),
    ]);
    expect([first, second].filter(Boolean)).toHaveLength(1);

    expect((await as<{ s: string }>("service_role", null, "select public.complete_outbox($1, false, 'push failed') as s", [id])).s).toBe("pending");
    const retry = (await client.query("select available_at > now() as later, attempts from public.outbox_events where id = $1", [id])).rows[0];
    expect(retry).toEqual({ later: true, attempts: 1 });

    // 5회 시도 후 dead
    await client.query("update public.outbox_events set attempts = 5, status = 'processing' where id = $1", [id]);
    expect((await as<{ s: string }>("service_role", null, "select public.complete_outbox($1, false, 'still failing') as s", [id])).s).toBe("dead");
  });

  it("reclaims events whose lease expired (crashed worker)", async () => {
    const id = (await client.query("insert into public.outbox_events (topic, aggregate_id) values ('test.lease', gen_random_uuid()) returning id")).rows[0].id;
    await as("service_role", null, "select * from public.claim_outbox(10)");
    await client.query("update public.outbox_events set lease_until = now() - interval '1 second' where id = $1", [id]);
    const again = await as<{ id: string } | undefined>("service_role", null, "select * from public.claim_outbox(10) where id = $1", [id]);
    expect(again?.id).toBe(id);
  });

  it("cannot be driven by customers", async () => {
    await expect(asRole(client, "authenticated", (c) => c.query("select * from public.claim_outbox(1)"), { userId: other })).rejects.toThrow(/permission denied/);
  });
});

describe("notifications and push subscriptions", () => {
  it("are private to their owner and only read_at is editable", async () => {
    const event = (await client.query("insert into public.outbox_events (topic, aggregate_id, status) values ('job.assigned', gen_random_uuid(), 'done') returning id")).rows[0].id;
    await client.query("insert into public.notifications (user_id, topic, title, body, url, outbox_event_id) values ($1, 'job.assigned', '새 작업', '배정됐습니다', '/ko/driver', $2)", [
      staff,
      event,
    ]);
    await expect(
      client.query("insert into public.notifications (user_id, topic, title, body, outbox_event_id) values ($1, 'job.assigned', 'dup', 'dup', $2)", [staff, event]),
    ).rejects.toThrow(/notifications_user_event_key/);

    const mine = await asRole(client, "authenticated", async (c) => (await c.query("select title from public.notifications")).rows, { userId: staff });
    expect(mine).toEqual([{ title: "새 작업" }]);
    const theirs = await asRole(client, "authenticated", async (c) => (await c.query("select title from public.notifications")).rows, { userId: other });
    expect(theirs).toEqual([]);
    await expect(
      asRole(client, "authenticated", (c) => c.query("update public.notifications set title = 'x' where user_id = $1", [staff]), { userId: staff }),
    ).rejects.toThrow(/permission denied/);
    const read = await asRole(
      client,
      "authenticated",
      async (c) => (await c.query("update public.notifications set read_at = now() where user_id = $1", [staff])).rowCount,
      { userId: staff },
    );
    expect(read).toBe(1);
  });

  it("stores push subscriptions per user and rejects non-https endpoints", async () => {
    await asRole(
      client,
      "authenticated",
      (c) => c.query("insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) values ($1, 'https://push.example/abc', 'k', 'a')", [staff]),
      { userId: staff },
    );
    await expect(
      asRole(client, "authenticated", (c) => c.query("insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) values ($1, 'https://push.example/x', 'k', 'a')", [staff]), {
        userId: other,
      }),
    ).rejects.toThrow(/row-level security/);
    await expect(client.query("insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) values ($1, 'http://insecure', 'k', 'a')", [staff])).rejects.toThrow(
      /endpoint/,
    );
  });
});
