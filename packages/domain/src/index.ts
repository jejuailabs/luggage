export * from "./runtime-environment";

/** 판매 노선 유형. 판매 여부는 운영 설정으로 제어한다. */
export const ROUTE_TYPES = ["hotel_to_airport", "airport_to_hotel", "hotel_to_hotel"] as const;
export type RouteType = (typeof ROUTE_TYPES)[number];
