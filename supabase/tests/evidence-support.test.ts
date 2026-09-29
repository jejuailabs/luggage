import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { as, confirmedOrder, createUser, setupBookingFixture } from "./support/booking";
import { asRole, connect } from "./support/db";

let client: pg.Client;
let fixture: Awaited<ReturnType<typeof setupBookingFixture>>;
let customer: string;
let otherCustomer: string;
let driver: string;
let otherDriver: string;
let dispatcher: string;
let support: string;
let seq = 0;
const key = () => `client-key-${++seq}-${Date.now()}`;

async function assignedJob(bags = { standard: 1 }) {
  const order = await confirmedOrder(fixture, customer, bags);
  const job = (await client.query("select id from public.delivery_jobs where order_id = $1", [order.id])).rows[0].id as string;
  await as("authenticated", dispatcher, "select public.assign_driver($1, $2)", [job, driver]);
  const tag = (await client.query("select tag_id from public.bags where order_id = $1 order by seq limit 1", [order.id])).rows[0].tag_id as string;
  return { order, job, tag };
}

function intent(actor: string, job: string, tag: string | null, contentType = "image/jpeg", size = 200_000) {
  return as<{ id: string; storage_path: string; order_id: string }>(
    "authenticated",
    actor,
    "select * from public.create_evidence_intent($1, $2, 'collection_photo', $3, $4)",
    [job, tag, contentType, size],
  );
}

beforeAll(async () => {
  client = await connect();
  fixture = await setupBookingFixture(client, 5);
  customer = await createUser(client, { anonymous: true });
  otherCustomer = await createUser(client, { anonymous: true });
  driver = await createUser(client, { role: "driver" });
  otherDriver = await createUser(client, { role: "driver" });
  dispatcher = await createUser(client, { role: "dispatcher" });
  support = await createUser(client, { role: "support" });
});

afterAll(async () => {
  await client.end();
});

describe("evidence files", () => {
  it("lets the assigned driver create a private upload path without personal data", async () => {
    const { order, job, tag } = await assignedJob();
    const row = await intent(driver, job, tag);
    expect(row.storage_path).toMatch(new RegExp(`^${order.id}/[0-9a-f-]{36}\\.jpg$`));
    expect(row.storage_path).not.toContain("王");
  });

  it("refuses unassigned drivers, bad types and oversized files", async () => {
    const { job, tag } = await assignedJob();
    await expect(intent(otherDriver, job, tag)).rejects.toThrow("LUGGAGE:FORBIDDEN");
    await expect(intent(driver, job, tag, "image/gif")).rejects.toThrow(/content_type/);
    await expect(intent(driver, job, tag, "image/jpeg", 6_000_000)).rejects.toThrow(/size_bytes/);
  });

  it("accepts a photo as collection evidence only from the same job", async () => {
    const a = await assignedJob();
    const b = await assignedJob();
    const photoA = await intent(driver, a.job, a.tag);
    await expect(
      as("authenticated", driver, "select public.record_bag_event($1, $2, 'collected', $3, now(), null, $4)", [b.tag, b.job, key(), [photoA.id]]),
    ).rejects.toThrow("LUGGAGE:EVIDENCE_INVALID");
    const ok = await as<{ to_status: string }>("authenticated", driver, "select * from public.record_bag_event($1, $2, 'collected', $3, now(), null, $4)", [
      a.tag,
      a.job,
      key(),
      [photoA.id],
    ]);
    expect(ok.to_status).toBe("collected");
  });

  it("shows evidence rows only to people related to the order", async () => {
    const { order, job, tag } = await assignedJob();
    await intent(driver, job, tag);
    const view = (userId: string) =>
      asRole(client, "authenticated", async (c) => (await c.query("select id from public.evidence_files where order_id = $1", [order.id])).rows.length, { userId });
    expect(await view(customer)).toBe(1);
    expect(await view(otherCustomer)).toBe(0);
    expect(await view(otherDriver)).toBe(0);
  });
});

describe("incidents and compensation", () => {
  it("records an incident from the driver and lets only dispatch resolve it", async () => {
    const { job, tag } = await assignedJob();
    const incident = await as<{ id: string; status: string }>(
      "authenticated",
      driver,
      "select * from public.report_incident($1, $2, 'damage', 2::smallint, '수거 전 바퀴 파손 발견, 사진 첨부')",
      [job, tag],
    );
    expect(incident.status).toBe("open");
    const updatedByDriver = await asRole(
      client,
      "authenticated",
      async (c) => (await c.query("update public.incidents set status = 'resolved', resolution = 'x', resolved_at = now() where id = $1", [incident.id])).rowCount,
      { userId: driver },
    );
    expect(updatedByDriver).toBe(0);
    const updatedByDispatch = await asRole(
      client,
      "authenticated",
      async (c) =>
        (await c.query("update public.incidents set status = 'resolved', resolution = '고객 확인 후 인수', resolved_at = now(), resolved_by = $2 where id = $1", [
          incident.id,
          dispatcher,
        ])).rowCount,
      { userId: dispatcher },
    );
    expect(updatedByDispatch).toBe(1);
  });

  it("keeps compensation separate from payment refunds", async () => {
    const { order, job } = await assignedJob();
    const incident = await as<{ id: string }>("authenticated", driver, "select * from public.report_incident($1, null, 'lost', 3::smallint, '짐 1개 분실 의심')", [job]);
    await client.query("insert into public.compensation_claims (incident_id, order_id, requested_amount_minor) values ($1, $2, 100000)", [incident.id, order.id]);
    const summary = await as<{ s: string }>("authenticated", customer, "select public.order_payment_summary($1) as s", [order.id]);
    expect(summary.s).toBe("paid");
    const claims = await asRole(client, "authenticated", async (c) => (await c.query("select status from public.compensation_claims where order_id = $1", [order.id])).rows, {
      userId: customer,
    });
    expect(claims).toEqual([{ status: "submitted" }]);
  });
});

describe("customer support", () => {
  it("opens a ticket on the customer's own order, idempotently", async () => {
    const { order } = await assignedJob();
    const k = key();
    const call = () =>
      as<{ id: string }>("authenticated", customer, "select * from public.create_support_ticket($1, 'zh-CN', '行李延误', '请问什么时候到机场？', $2)", [order.id, k]);
    const a = await call();
    const b = await call();
    expect(a.id).toBe(b.id);
    await expect(
      as("authenticated", otherCustomer, "select * from public.create_support_ticket($1, 'zh-CN', 'x', 'y', $2)", [order.id, key()]),
    ).rejects.toThrow("LUGGAGE:ORDER_NOT_FOUND");
  });

  it("never shows internal notes to the customer", async () => {
    const { order } = await assignedJob();
    const ticket = await as<{ id: string }>("authenticated", customer, "select * from public.create_support_ticket($1, 'zh-CN', '问题', '内容', $2)", [
      order.id,
      key(),
    ]);
    await as("authenticated", support, "select public.add_support_message($1, '기사 지연 확인 중 (내부)', 'internal', $2)", [ticket.id, key()]);
    await as("authenticated", support, "select public.add_support_message($1, '您好，司机预计15分钟后到达。', 'customer', $2)", [ticket.id, key()]);
    await expect(
      as("authenticated", customer, "select public.add_support_message($1, 'x', 'internal', $2)", [ticket.id, key()]),
    ).rejects.toThrow("LUGGAGE:FORBIDDEN");

    const customerView = await asRole(
      client,
      "authenticated",
      async (c) => (await c.query("select body, author_role from public.support_messages where ticket_id = $1 order by created_at", [ticket.id])).rows,
      { userId: customer },
    );
    expect(customerView.map((m) => m.body)).toEqual(["内容", "您好，司机预计15分钟后到达。"]);
    const staffView = await asRole(
      client,
      "authenticated",
      async (c) => (await c.query("select count(*)::int as n from public.support_messages where ticket_id = $1", [ticket.id])).rows[0].n,
      { userId: support },
    );
    expect(staffView).toBe(3);
    const status = (await client.query("select status from public.support_tickets where id = $1", [ticket.id])).rows[0].status;
    expect(status).toBe("pending_customer");
  });

  it("hides other customers' tickets", async () => {
    const { order } = await assignedJob();
    await as("authenticated", customer, "select * from public.create_support_ticket($1, 'ko', '문의', '내용', $2)", [order.id, key()]);
    const rows = await asRole(client, "authenticated", async (c) => (await c.query("select id from public.support_tickets where order_id = $1", [order.id])).rows, {
      userId: otherCustomer,
    });
    expect(rows).toEqual([]);
  });
});
