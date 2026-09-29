import { describe, expect, it } from "vitest";
import { planNotification } from "./notify";

describe("planNotification", () => {
  it("notifies the assigned driver only", () => {
    expect(planNotification("job.assigned", { driver_id: "d1" }, "job1")).toMatchObject({ audience: { userIds: ["d1"] }, url: "/ko/driver" });
    expect(planNotification("job.assigned", {}, "job1")).toBeNull();
  });

  it("escalates severe incidents to dispatch", () => {
    const plan = planNotification("incident.opened", { type: "lost", severity: 3 }, "order1");
    expect(plan).toMatchObject({ audience: { roles: ["dispatcher", "admin"] }, title: "긴급 현장 사고" });
    expect(plan!.body).toContain("분실");
  });

  it("routes payment anomalies to dispatch and finance", () => {
    expect(planNotification("payment.duplicate_capture", {}, "o")?.audience.roles).toEqual(["dispatcher", "finance", "admin"]);
  });

  it("links a support ticket to its thread", () => {
    expect(planNotification("support.ticket_opened", { locale: "zh-CN" }, "t1")?.url).toBe("/ko/admin/support/t1");
  });

  it("does not plan customer notifications until a channel is configured", () => {
    for (const topic of ["order.confirmed", "bag.collected", "bag.delivered", "refund.succeeded"]) {
      expect(planNotification(topic, {}, "x")).toBeNull();
    }
  });

  it("never puts customer contact data in the message", () => {
    const plan = planNotification("support.ticket_opened", { locale: "ko", email: "a@b.cn", name: "王" }, "t1");
    expect(JSON.stringify(plan)).not.toMatch(/a@b\.cn|王/);
  });
});
