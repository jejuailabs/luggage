import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { enqueue, flushQueue, readQueue } from "./field-client";

class MemoryStorage {
  private store = new Map<string, string>();
  getItem(key: string) {
    return this.store.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.store.set(key, value);
  }
  removeItem(key: string) {
    this.store.delete(key);
  }
}

const event = (id: string) => ({ clientEventId: id, body: { tagId: "TABCDEFGHJK", clientEventId: id }, queuedAt: "2026-09-29T00:00:00Z" });

beforeEach(() => {
  vi.stubGlobal("localStorage", new MemoryStorage());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("offline event queue", () => {
  it("keeps one entry per clientEventId", () => {
    enqueue(event("evt-1"));
    enqueue(event("evt-1"));
    expect(readQueue()).toHaveLength(1);
  });

  it("resends with the same clientEventId and clears on success", async () => {
    enqueue(event("evt-1"));
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ data: {} }), { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await flushQueue();
    expect(result).toEqual({ sent: 1, rejected: [] });
    expect(JSON.parse(String((fetchMock.mock.calls[0] as unknown[])[1] && ((fetchMock.mock.calls[0] as unknown[])[1] as RequestInit).body))).toMatchObject({
      clientEventId: "evt-1",
    });
    expect(readQueue()).toEqual([]);
  });

  it("keeps events while the network is still down", async () => {
    enqueue(event("evt-1"));
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("offline"))));
    const result = await flushQueue();
    expect(result.sent).toBe(0);
    expect(readQueue()).toHaveLength(1);
  });

  it("drops and reports events the server rejects (e.g. reassigned job)", async () => {
    enqueue(event("evt-1"));
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ error: { code: "FORBIDDEN", messageKey: "booking.error.FORBIDDEN" } }), { status: 403 })),
    );
    const result = await flushQueue();
    expect(result.rejected).toHaveLength(1);
    expect(result.rejected[0]!.code).toBe("FORBIDDEN");
    expect(readQueue()).toEqual([]);
  });
});
