import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const config = [
  {
    ignores: ["**/node_modules/**", "**/.next/**", ".tmp/**", "playwright-report/**", "test-results/**", "**/next-env.d.ts"],
  },
  ...nextVitals,
  ...nextTs,
  {
    settings: { next: { rootDir: "apps/web/" } },
    rules: {
      // 고객 화면은 구글 서비스에 의존하지 않는다 (04 문서 8절).
      "no-restricted-imports": [
        "error",
        { paths: [{ name: "next/font/google", message: "Self-host fonts; Google Fonts is blocked on China-routed networks." }] },
      ],
    },
  },
];

export default config;
