import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearFieldStorage, enqueue, flushQueue, readQueue } from "./field-client";

const event = (id: string) => ({ clientEventId: id, body: { tagId: "TABCDEFGHJK", clientEventId: id }, queuedAt: "2026-09-29T00:00:00Z" });

beforeEach(async () => {
  await clearFieldStorage();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("offline event queue", () => {
  it("keeps one entry per clientEventId", async () => {
    await enqueue(event("evt-1"));
    await enqueue(event("evt-1"));
    expect(await readQueue()).toHaveLength(1);
  });

  it("resends with the same clientEventId and clears on success", async () => {
    await enqueue(event("evt-1"));
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ data: {} }), { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await flushQueue();
    expect(result).toEqual({ sent: 1, rejected: [] });
    expect(JSON.parse(String((fetchMock.mock.calls[0] as unknown[])[1] && ((fetchMock.mock.calls[0] as unknown[])[1] as RequestInit).body))).toMatchObject({
      clientEventId: "evt-1",
    });
    expect(await readQueue()).toEqual([]);
  });

  it("keeps events while the network is still down", async () => {
    await enqueue(event("evt-1"));
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("offline"))));
    const result = await flushQueue();
    expect(result.sent).toBe(0);
    expect(await readQueue()).toHaveLength(1);
  });

  it("drops and reports events the server rejects (e.g. reassigned job)", async () => {
    await enqueue(event("evt-1"));
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ error: { code: "FORBIDDEN", messageKey: "booking.error.FORBIDDEN" } }), { status: 403 })),
    );
    const result = await flushQueue();
    expect(result.rejected).toHaveLength(1);
    expect(result.rejected[0]!.code).toBe("FORBIDDEN");
    expect(await readQueue()).toEqual([]);
  });
});

describe("local data cleanup", () => {
  it("removes queued events on sign-out", async () => {
    await enqueue(event("evt-9"));
    await clearFieldStorage();
    expect(await readQueue()).toEqual([]);
  });
});
