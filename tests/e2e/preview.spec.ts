import { expect, test } from "@playwright/test";

// 이용 미리보기: 상황을 고르고 '다음'으로 9단계 모션 안내를 따라간 뒤 실제 시뮬레이션으로 넘어간다 (서버 호출 없음).
// 흐름만 확인하므로 움직임 줄이기 모드로 실행한다 (애니메이션 중인 요소 때문에 병렬 실행에서 클릭이 늦어지는 것을 막고, 정지 화면 경로도 함께 검사).
test.use({ reducedMotion: "reduce" });

test("motion preview steps through nine scenes and links to the simulation", async ({ page }) => {
  await page.goto("/ko/luggage");
  const preview = page.getByTestId("motion-preview");
  await expect(preview.getByRole("tab", { name: /체크아웃 날/ })).toHaveAttribute("aria-selected", "true");
  await expect(preview.locator(".mp-caption h3")).toHaveText("숙소 이름을 입력해요");
  await expect(preview.locator(".mp-input")).toContainText("제주시", { timeout: 4000 });

  await preview.getByRole("tab", { name: /제주 도착 직후/ }).click();
  await expect(preview.locator(".mp-caption h3")).toHaveText("짐을 받을 숙소를 입력해요");
  for (let step = 2; step <= 9; step += 1) {
    await preview.getByRole("button", { name: /다음/ }).click();
    await expect(preview.locator(".mp-count")).toContainText(`${step} / 9`);
  }
  await expect(preview.locator(".mp-caption h3")).toHaveText("숙소 프런트에서 짐을 찾아요");
  await expect(preview.getByRole("button", { name: /다시 보기/ })).toBeVisible();
  await expect(page.getByTestId("simulation-cta").getByRole("link", { name: /실제 시뮬레이션 해보기/ })).toHaveAttribute("href", "/ko/demo?route=airport_to_hotel");
});

test("header menu names the service page as a preview", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/zh-CN");
  await expect(page.locator(".customer-header nav").getByRole("link", { name: "服务预览" })).toHaveAttribute("href", "/zh-CN/luggage");
});
