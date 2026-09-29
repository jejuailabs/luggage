export type AppEnv = "local" | "preview" | "staging" | "production";
export type IntegrationMode = "mock" | "sandbox" | "live";
export type IntegrationName = "payment" | "notification" | "maps" | "wechat";

export const APP_ENVS: readonly AppEnv[] = ["local", "preview", "staging", "production"];
export const INTEGRATION_MODES: readonly IntegrationMode[] = ["mock", "sandbox", "live"];

export class IntegrationConfigError extends Error {
  override name = "IntegrationConfigError";
}

/**
 * 설정된 연동 모드를 검증한다.
 * - 값이 없으면 mock (외부 키 없이 업무 흐름 개발)
 * - production에서 mock은 허용하지 않는다 (배포 검사 실패)
 * - live는 production에서만 허용해 개발 환경의 실결제를 막는다
 */
export function resolveIntegrationMode(
  name: IntegrationName,
  appEnv: AppEnv,
  configured: string | undefined,
): IntegrationMode {
  const mode = (configured?.trim() || "mock") as IntegrationMode;
  if (!INTEGRATION_MODES.includes(mode)) {
    throw new IntegrationConfigError(`${name}: unknown integration mode "${configured}"`);
  }
  if (appEnv === "production" && mode === "mock") {
    throw new IntegrationConfigError(`${name}: mock mode is not allowed in production`);
  }
  if (appEnv !== "production" && mode === "live") {
    throw new IntegrationConfigError(`${name}: live mode is only allowed in production`);
  }
  return mode;
}
