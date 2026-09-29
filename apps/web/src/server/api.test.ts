import { describe, expect, it } from "vitest";
import { businessErrorCode, failFromDb } from "./api";

describe("businessErrorCode", () => {
  it("extracts known codes only", () => {
    expect(businessErrorCode({ message: "LUGGAGE:CAPACITY_UNAVAILABLE" })).toBe("CAPACITY_UNAVAILABLE");
    expect(businessErrorCode({ message: "LUGGAGE:SOMETHING_ELSE" })).toBeNull();
    expect(businessErrorCode({ message: "duplicate key value violates unique constraint" })).toBeNull();
  });
});

describe("failFromDb", () => {
  it("maps capacity errors to 422 with a customer message key", async () => {
    const response = failFromDb({ message: "LUGGAGE:CAPACITY_UNAVAILABLE" }, "00000000-0000-4000-8000-000000000000");
    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.error).toMatchObject({ code: "CAPACITY_UNAVAILABLE", messageKey: "booking.error.CAPACITY_UNAVAILABLE" });
  });

  it("hides unexpected database errors behind a retryable 503", async () => {
    const response = failFromDb({ message: 'relation "x" does not exist', code: "42P01" }, "00000000-0000-4000-8000-000000000000");
    expect(response.status).toBe(503);
    expect(JSON.stringify(await response.json())).not.toContain("relation");
  });
});
