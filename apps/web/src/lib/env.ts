import "server-only";
import { z } from "zod";
import { resolveIntegrationMode, type AppEnv, type IntegrationMode, type IntegrationName } from "@luggage/integrations";

/** .env에 빈 값으로 남긴 항목은 설정하지 않은 것으로 본다. */
const blank = <T extends z.ZodType>(schema: T) => z.preprocess((value) => (value === "" ? undefined : value), schema);

const schema = z.object({
  APP_ENV: blank(z.enum(["local", "preview", "staging", "production"]).default("local")),
  NEXT_PUBLIC_SUPABASE_URL: blank(z.string().url().optional()),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: blank(z.string().min(1).optional()),
  PAYMENT_MODE: blank(z.string().optional()),
  NOTIFICATION_MODE: blank(z.string().optional()),
  MAPS_MODE: blank(z.string().optional()),
  WECHAT_MODE: blank(z.string().optional()),
  APP_URL: blank(z.string().url().default("http://localhost:3000")),
  PUBLIC_DATA_SOURCE: blank(z.enum(["supabase", "fixture"]).default("supabase")),
  SUPABASE_SERVER_SECRET: blank(z.string().min(1).optional()),
  MOCK_PAYMENT_SECRET: blank(z.string().min(16).optional()),
  CRON_SECRET: blank(z.string().min(16).optional()),
  NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY: blank(z.string().min(40).optional()),
  WEB_PUSH_PRIVATE_KEY: blank(z.string().min(20).optional()),
  WEB_PUSH_SUBJECT: blank(z.string().regex(/^(mailto:|https:\/\/)/).optional()),
  TRACKING_WEBHOOK_SECRET: blank(z.string().min(16).optional()),
  TOUR_API_SERVICE_KEY: blank(z.string().min(20).optional()),
});

export interface ServerConfig {
  appEnv: AppEnv;
  integrations: Record<IntegrationName, IntegrationMode>;
  supabase: { url: string; publishableKey: string } | null;
  appUrl: string;
  publicDataSource: "supabase" | "fixture";
  /** 서버 전용 비밀값. 클라이언트로 보내지 않는다. */
  secrets: { supabaseServer: string | null; mockPayment: string | null; cron: string | null; trackingWebhook: string | null };
  /** 웹 푸시(VAPID). 세 값이 모두 있어야 켜진다. */
  webPush: { publicKey: string; privateKey: string; subject: string } | null;
  tourApiServiceKey: string | null;
}

let cached: ServerConfig | undefined;

/** 서버 설정을 검증한다. 잘못된 연동 모드는 기동 시 즉시 실패한다. */
export function getServerConfig(): ServerConfig {
  if (cached) return cached;
  const env = schema.parse(process.env);
  const appEnv = env.APP_ENV;
  if (appEnv === "production" && env.PUBLIC_DATA_SOURCE === "fixture") {
    throw new Error("PUBLIC_DATA_SOURCE=fixture is not allowed in production");
  }
  cached = {
    appEnv,
    integrations: {
      payment: resolveIntegrationMode("payment", appEnv, env.PAYMENT_MODE),
      notification: resolveIntegrationMode("notification", appEnv, env.NOTIFICATION_MODE),
      maps: resolveIntegrationMode("maps", appEnv, env.MAPS_MODE),
      wechat: resolveIntegrationMode("wechat", appEnv, env.WECHAT_MODE),
    },
    supabase:
      env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
        ? { url: env.NEXT_PUBLIC_SUPABASE_URL, publishableKey: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY }
        : null,
    appUrl: env.APP_URL.replace(/\/$/, ""),
    publicDataSource: env.PUBLIC_DATA_SOURCE,
    secrets: {
      supabaseServer: env.SUPABASE_SERVER_SECRET ?? null,
      // mock 결제 서명 키: 비운영에서만 쓰며 값이 없으면 로컬 기본값을 쓴다 (운영은 mock 자체가 금지).
      mockPayment: env.MOCK_PAYMENT_SECRET ?? (appEnv === "production" ? null : "local-mock-payment-secret"),
      cron: env.CRON_SECRET ?? null,
      trackingWebhook: env.TRACKING_WEBHOOK_SECRET ?? null,
    },
    webPush:
      env.NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY && env.WEB_PUSH_PRIVATE_KEY && env.WEB_PUSH_SUBJECT
        ? { publicKey: env.NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY, privateKey: env.WEB_PUSH_PRIVATE_KEY, subject: env.WEB_PUSH_SUBJECT }
        : null,
    tourApiServiceKey: env.TOUR_API_SERVICE_KEY ?? null,
  };
  return cached;
}

export function isTestMode(config = getServerConfig()): boolean {
  return config.appEnv !== "production" || Object.values(config.integrations).some((mode) => mode !== "live");
}
