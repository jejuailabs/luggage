import "server-only";
import { z } from "zod";
import { resolveIntegrationMode, type AppEnv, type IntegrationMode, type IntegrationName } from "@luggage/integrations";

const schema = z.object({
  APP_ENV: z.enum(["local", "preview", "staging", "production"]).default("local"),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1).optional(),
  PAYMENT_MODE: z.string().optional(),
  NOTIFICATION_MODE: z.string().optional(),
  MAPS_MODE: z.string().optional(),
  WECHAT_MODE: z.string().optional(),
  APP_URL: z.string().url().default("http://localhost:3000"),
  PUBLIC_DATA_SOURCE: z.enum(["supabase", "fixture"]).default("supabase"),
});

export interface ServerConfig {
  appEnv: AppEnv;
  integrations: Record<IntegrationName, IntegrationMode>;
  supabase: { url: string; publishableKey: string } | null;
  appUrl: string;
  publicDataSource: "supabase" | "fixture";
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
  };
  return cached;
}

export function isTestMode(config = getServerConfig()): boolean {
  return config.appEnv !== "production" || Object.values(config.integrations).some((mode) => mode !== "live");
}
