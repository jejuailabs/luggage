import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const config = [
  {
    ignores: ["**/node_modules/**", "**/.next/**", ".tmp/**", "playwright-report/**", "test-results/**", "**/next-env.d.ts"],
  },
  ...nextVitals,
  ...nextTs,
  {
    // 위챗 미니프로그램: CommonJS + 플랫폼 전역
    files: ["apps/wechat/**/*.js"],
    languageOptions: {
      sourceType: "commonjs",
      globals: { wx: "readonly", App: "readonly", Page: "readonly", getApp: "readonly", require: "readonly", module: "writable" },
    },
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
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
