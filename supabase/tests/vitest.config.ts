import { defineConfig } from "vitest/config";

// pnpm test:db 전용. scripts/test-db.mjs가 embedded Postgres를 띄운 뒤 실행한다.
export default defineConfig({
  test: {
    root: "supabase/tests",
    include: ["**/*.test.ts"],
    environment: "node",
    fileParallelism: false,
    // 역할별 연결을 여러 번 여는 흐름 테스트가 있어 기본 5초보다 길게 둔다.
    testTimeout: 30_000,
  },
});
