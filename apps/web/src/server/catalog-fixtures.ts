import type { CatalogSnapshot } from "./catalog";

/** 로컬·E2E용 합성 카탈로그 (supabase/seed.sql과 같은 내용). 실제 제휴 호텔이 아니다. */
const CITY = "00000000-0000-4000-8000-000000000001";
const SEOGWIPO = "00000000-0000-4000-8000-000000000002";
const AIRPORT = "00000000-0000-4000-8000-000000000003";

export const CATALOG_FIXTURE: CatalogSnapshot = {
  zones: [
    {
      id: AIRPORT,
      code: "jeju-airport",
      kind: "airport",
      nameKo: "제주국제공항",
      displayNames: { "zh-CN": "济州国际机场", en: "Jeju International Airport" },
    },
    { id: CITY, code: "jeju-city", kind: "area", nameKo: "제주시", displayNames: { "zh-CN": "济州市", en: "Jeju City" } },
    { id: SEOGWIPO, code: "seogwipo", kind: "area", nameKo: "서귀포", displayNames: { "zh-CN": "西归浦", en: "Seogwipo" } },
  ],
  hotels: [
    {
      id: "00000000-0000-4000-8000-000000000011",
      slug: "sample-hotel-jeju-city",
      zoneId: CITY,
      nameKo: "예시 호텔 제주시점",
      addressKo: "제주특별자치도 제주시 예시로 1",
      frontDeskOpensAt: "07:00:00",
      frontDeskClosesAt: "22:00:00",
      translations: [
        { locale: "zh-CN", name: "示例酒店 济州市店", aliases: ["示例酒店", "济州示例"], handoffNote: null },
        { locale: "en", name: "Sample Hotel Jeju City", aliases: ["Sample Hotel"], handoffNote: null },
      ],
    },
    {
      id: "00000000-0000-4000-8000-000000000012",
      slug: "sample-hotel-seogwipo",
      zoneId: SEOGWIPO,
      nameKo: "예시 호텔 서귀포점",
      addressKo: "제주특별자치도 서귀포시 예시로 2",
      frontDeskOpensAt: "07:00:00",
      frontDeskClosesAt: "22:00:00",
      translations: [{ locale: "zh-CN", name: "示例酒店 西归浦店", aliases: ["示例酒店"], handoffNote: null }],
    },
  ],
  routes: [
    {
      id: "00000000-0000-4000-8000-000000000021",
      routeType: "hotel_to_airport",
      originZoneId: CITY,
      destinationZoneId: AIRPORT,
      enabled: true,
    },
    {
      id: "00000000-0000-4000-8000-000000000022",
      routeType: "hotel_to_airport",
      originZoneId: SEOGWIPO,
      destinationZoneId: AIRPORT,
      enabled: true,
    },
    {
      id: "00000000-0000-4000-8000-000000000023",
      routeType: "airport_to_hotel",
      originZoneId: AIRPORT,
      destinationZoneId: CITY,
      enabled: false,
    },
  ],
};
