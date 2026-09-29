import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      // 서버 전용 모듈의 순수 함수도 단위 테스트할 수 있게 한다.
      "server-only": fileURLToPath(new URL("./tests/support/empty-module.ts", import.meta.url)),
      "@": fileURLToPath(new URL("./apps/web/src", import.meta.url)),
    },
  },
  oxc: { jsx: { runtime: "automatic" } },
  test: {
    include: ["packages/*/src/**/*.test.ts", "apps/web/src/**/*.test.{ts,tsx}", "apps/wechat/**/*.test.js"],
    environment: "node",
  },
});
