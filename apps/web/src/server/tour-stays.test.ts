import { describe, expect, it } from "vitest";
import { parseTourStays } from "./tour-stays";

describe("TourAPI Jeju stay data", () => {
  it("keeps usable Jeju stays and does not trust malformed records", () => {
    const result = parseTourStays({
      response: {
        header: { resultCode: "0000" },
        body: {
          totalCount: 3,
          items: { item: [
            { contentid: "1896032", title: "가름게스트하우스", addr1: "제주특별자치도 서귀포시 법환하로9번길 10", mapx: "126.5", mapy: "33.2", firstimage: "https://example.com/stay.jpg" },
            { contentid: "2", title: "다른 지역", addr1: "서울특별시 중구" },
            { contentid: "bad", title: "오류", addr1: "제주특별자치도 제주시" },
          ] },
        },
      },
    });
    expect(result.total).toBe(3);
    expect(result.stays).toEqual([{
      id: "1896032", name: "가름게스트하우스", address: "제주특별자치도 서귀포시 법환하로9번길 10",
      image: "https://example.com/stay.jpg", longitude: 126.5, latitude: 33.2,
    }]);
  });

  it("rejects provider error responses", () => {
    expect(() => parseTourStays({ response: { header: { resultCode: "20" } } })).toThrow("TourAPI request failed");
  });
});
