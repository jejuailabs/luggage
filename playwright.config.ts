import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.E2E_PORT ?? 3100);
const baseURL = `http://127.0.0.1:${port}`;

// 모바일 우선: 기본 프로젝트는 360px 폭이다 (09 문서 14절 A).
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: { baseURL, trace: "retain-on-failure" },
  projects: [
    {
      name: "mobile-360",
      use: { ...devices["Pixel 5"], viewport: { width: 360, height: 740 } },
    },
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"] },
      testMatch: /layout\.spec\.ts/,
    },
  ],
  webServer: {
    // 운영 빌드로 검증한다 (개발 서버의 HMR·지연 컴파일 영향을 배제).
    command: `pnpm build && pnpm --filter @luggage/web exec next start --port ${port}`,
    url: `${baseURL}/api/v1/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: { APP_ENV: "local" },
  },
});
