import { defineConfig } from "vitest/config";

// pnpm test:db 전용. scripts/test-db.mjs가 embedded Postgres를 띄운 뒤 실행한다.
export default defineConfig({
  test: {
    root: "supabase/tests",
    include: ["**/*.test.ts"],
    environment: "node",
    fileParallelism: false,
  },
});
