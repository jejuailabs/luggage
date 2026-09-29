import { describe, expect, it } from "vitest";
import { canEnterStaffArea, hotelScopes, type RoleGrant } from "./access";

const grant = (role: RoleGrant["role"], scopeId: string | null = null): RoleGrant => ({
  role,
  scopeType: scopeId ? "hotel" : "global",
  scopeId,
});

describe("canEnterStaffArea", () => {
  it("denies users without staff roles, including guests", () => {
    expect(canEnterStaffArea("driver", [])).toBe(false);
    expect(canEnterStaffArea("admin", [])).toBe(false);
  });

  it("keeps drivers out of hotel and admin areas", () => {
    const grants = [grant("driver")];
    expect(canEnterStaffArea("driver", grants)).toBe(true);
    expect(canEnterStaffArea("partner", grants)).toBe(false);
    expect(canEnterStaffArea("admin", grants)).toBe(false);
  });

  it("lets hotel staff into the partner area only", () => {
    const grants = [grant("hotel_staff", "h1")];
    expect(canEnterStaffArea("partner", grants)).toBe(true);
    expect(canEnterStaffArea("driver", grants)).toBe(false);
  });

  it("lets admin into every area", () => {
    for (const area of ["driver", "partner", "admin"] as const) {
      expect(canEnterStaffArea(area, [grant("admin")])).toBe(true);
    }
  });
});

describe("hotelScopes", () => {
  it("returns only the assigned hotels", () => {
    expect(hotelScopes([grant("hotel_staff", "h1"), grant("driver")])).toEqual(["h1"]);
    expect(hotelScopes([grant("admin")])).toBe("all");
  });
});
