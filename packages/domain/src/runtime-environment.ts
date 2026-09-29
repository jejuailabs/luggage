/**
 * 고객이 페이지를 연 실행 환경. 결제 수단·로그인·알림 동의 경로가 달라진다.
 * - browser: 일반 모바일/데스크톱 브라우저
 * - wechat: 위챗 내장 브라우저 (호텔 QR 스캔의 기본 진입)
 * - wechat_miniprogram: 위챗 미니프로그램 web-view
 * - alipay: 알리페이 내장 브라우저
 */
export type RuntimeEnvironment = "browser" | "wechat" | "wechat_miniprogram" | "alipay";

export type PaymentMethod = "wechat_pay_jsapi" | "wechat_pay_h5" | "wechat_pay_miniprogram" | "alipay" | "card";

export interface EnvironmentHints {
  userAgent: string | null | undefined;
  /** 미니프로그램 JS-SDK가 설정하는 window.__wxjs_environment 값 */
  wxjsEnvironment?: string | null | undefined;
}

export function detectRuntimeEnvironment({ userAgent, wxjsEnvironment }: EnvironmentHints): RuntimeEnvironment {
  const ua = (userAgent ?? "").toLowerCase();
  if (wxjsEnvironment === "miniprogram" || (ua.includes("micromessenger") && ua.includes("miniprogram"))) {
    return "wechat_miniprogram";
  }
  if (ua.includes("micromessenger")) return "wechat";
  if (ua.includes("alipayclient")) return "alipay";
  return "browser";
}

export interface PaymentOption {
  method: PaymentMethod;
  /** 이 환경에서 바로 결제할 수 없으면 사용자에게 보여줄 안내 */
  handoff?: "open_in_external_browser" | "delegate_to_miniprogram_page";
}

/**
 * 환경별 결제 수단 노출 순서. 실제 활성 여부는 PG 계약·feature_settings로 한 번 더 거른다.
 * - 위챗 안에서는 알리페이가 막히므로 외부 브라우저 열기 안내로 돌린다.
 * - 미니프로그램 web-view에서는 위챗페이를 직접 호출할 수 없어 네이티브 결제 페이지로 넘긴다.
 */
export function paymentOptionsFor(environment: RuntimeEnvironment): PaymentOption[] {
  switch (environment) {
    case "wechat_miniprogram":
      return [{ method: "wechat_pay_miniprogram", handoff: "delegate_to_miniprogram_page" }];
    case "wechat":
      return [
        { method: "wechat_pay_jsapi" },
        { method: "alipay", handoff: "open_in_external_browser" },
        { method: "card" },
      ];
    case "alipay":
      return [{ method: "alipay" }, { method: "card" }];
    case "browser":
      return [{ method: "alipay" }, { method: "wechat_pay_h5" }, { method: "card" }];
  }
}
