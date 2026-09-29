import { describe, expect, it } from "vitest";
import { IntegrationConfigError, resolveIntegrationMode } from "./index";

describe("resolveIntegrationMode", () => {
  it("defaults to mock outside production", () => {
    expect(resolveIntegrationMode("payment", "local", undefined)).toBe("mock");
    expect(resolveIntegrationMode("payment", "preview", "")).toBe("mock");
  });

  it("refuses mock in production", () => {
    expect(() => resolveIntegrationMode("payment", "production", undefined)).toThrow(IntegrationConfigError);
  });

  it("refuses live outside production", () => {
    expect(() => resolveIntegrationMode("payment", "staging", "live")).toThrow(IntegrationConfigError);
  });

  it("rejects unknown modes", () => {
    expect(() => resolveIntegrationMode("maps", "local", "real")).toThrow(IntegrationConfigError);
  });

  it("allows sandbox in staging and live in production", () => {
    expect(resolveIntegrationMode("payment", "staging", "sandbox")).toBe("sandbox");
    expect(resolveIntegrationMode("payment", "production", "live")).toBe("live");
  });
});
