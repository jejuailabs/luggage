import { expect, test } from "@playwright/test";

test.describe("hotel QR landing", () => {
  test("preselects the hotel and remembers the partner code", async ({ page, context }) => {
    await page.goto("/zh-CN/h/sample01");
    await expect(page).toHaveURL(/\/zh-CN\/hotels\/sample-hotel-jeju-city$/);
    const cookie = (await context.cookies()).find((c) => c.name === "luggage_attr");
    expect(cookie?.httpOnly).toBe(true);
    expect(JSON.parse(decodeURIComponent(cookie!.value))).toMatchObject({ partnerCode: "SAMPLE01", channel: "hotel_qr" });
    // 판매 중인 노선마다 예약 버튼
    await expect(page.getByTestId("hotel-book-hotel_to_airport")).toBeVisible();
  });

  test("an unknown code goes to hotel search without attribution", async ({ page, context }) => {
    await page.goto("/zh-CN/h/NOPE9999");
    await expect(page).toHaveURL(/\/zh-CN\/hotels$/);
    expect((await context.cookies()).find((c) => c.name === "luggage_attr")).toBeUndefined();
  });

  test("a campaign link keeps an earlier hotel QR attribution", async ({ page, context }) => {
    await page.goto("/zh-CN/h/SAMPLE01");
    await page.goto("/zh-CN/guide/checkout-day?cid=xhs_checkout_01&ch=xiaohongshu");
    const value = JSON.parse(decodeURIComponent((await context.cookies()).find((c) => c.name === "luggage_attr")!.value));
    expect(value).toMatchObject({ partnerCode: "SAMPLE01", channel: "hotel_qr", campaign: "xhs_checkout_01" });
  });

  test("a campaign link alone records its channel", async ({ page, context }) => {
    await page.goto("/zh-CN/guide/arrival-day?cid=xhs_arrival&ch=xiaohongshu");
    const value = JSON.parse(decodeURIComponent((await context.cookies()).find((c) => c.name === "luggage_attr")!.value));
    expect(value).toEqual({ channel: "xiaohongshu", campaign: "xhs_arrival", landing: "/zh-CN/guide/arrival-day" });
  });
});

test.describe("scenario content", () => {
  test("the service page links the three situations", async ({ page }) => {
    await page.goto("/zh-CN/luggage");
    await expect(page.getByTestId("scenario-link")).toHaveCount(3);
  });

  test("a situation guide leads to booking for its route", async ({ page }) => {
    await page.goto("/zh-CN/guide/hotel-move");
    await expect(page.getByTestId("guide-cta")).toContainText("酒店 → 酒店");
    await page.getByTestId("guide-cta").click();
    await expect(page).toHaveURL(/\/zh-CN\/hotels$/);
  });
});

test.describe("staff acquisition tools", () => {
  test("QR print page and campaigns require staff sign-in", async ({ page }) => {
    for (const path of ["/ko/partner/qr", "/ko/admin/campaigns"]) {
      await page.goto(path);
      await expect(page.getByTestId("staff-login")).toBeVisible();
    }
  });

  test("campaign API requires a session", async ({ request, baseURL }) => {
    const response = await request.post("/api/v1/campaigns", {
      headers: { Origin: new URL(baseURL!).origin },
      data: { code: "x1", channel: "xiaohongshu", name: "n", landingPath: "/zh-CN" },
    });
    expect(response.status()).toBe(401);
  });
});
