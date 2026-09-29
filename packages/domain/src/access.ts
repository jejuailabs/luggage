/** DB enum public.staff_role 과 같은 값이다. */
export const STAFF_ROLES = ["driver", "hotel_staff", "support", "dispatcher", "finance", "content_editor", "admin"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export interface RoleGrant {
  role: StaffRole;
  scopeType: "global" | "hotel";
  scopeId: string | null;
}

export type StaffArea = "driver" | "partner" | "admin";

/**
 * 업무 화면 진입 역할 (05 문서 6절). admin은 모든 화면에 들어갈 수 있다.
 * 화면 진입은 첫 관문일 뿐이며 개별 주문·호텔·배정 권한은 API와 RLS에서 다시 검사한다.
 */
const AREA_ROLES: Record<StaffArea, readonly StaffRole[]> = {
  driver: ["driver", "dispatcher"],
  partner: ["hotel_staff"],
  admin: ["support", "dispatcher", "finance", "content_editor"],
};

export function canEnterStaffArea(area: StaffArea, grants: readonly RoleGrant[]): boolean {
  return grants.some((grant) => grant.role === "admin" || AREA_ROLES[area].includes(grant.role));
}

/** 호텔 범위 확인. admin은 전체 호텔을 다룰 수 있다. */
export function hotelScopes(grants: readonly RoleGrant[]): "all" | string[] {
  if (grants.some((g) => g.role === "admin")) return "all";
  return grants.filter((g) => g.role === "hotel_staff" && g.scopeId).map((g) => g.scopeId as string);
}
