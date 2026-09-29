import { describe, expect, it } from "vitest";
import { detectRuntimeEnvironment, paymentOptionsFor } from "./runtime-environment";

const WECHAT_IOS =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.50(0x1800322c) NetType/WIFI Language/zh_CN";
const WECHAT_MINIPROGRAM_ANDROID =
  "Mozilla/5.0 (Linux; Android 14; HUAWEI) AppleWebKit/537.36 Chrome/111.0 Mobile Safari/537.36 XWEB/1160117 MMWEBSDK/20240301 MicroMessenger/8.0.49.2600 WeChat/arm64 Weixin NetType/WIFI Language/zh_CN miniProgram/wx0000000000000000";
const ALIPAY =
  "Mozilla/5.0 (Linux; Android 13; Xiaomi) AppleWebKit/537.36 Chrome/100.0 Mobile Safari/537.36 AlipayClient/10.5.86.8000 Language/zh-Hans";
const SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";

describe("detectRuntimeEnvironment", () => {
  it.each([
    [WECHAT_IOS, undefined, "wechat"],
    [WECHAT_MINIPROGRAM_ANDROID, undefined, "wechat_miniprogram"],
    [WECHAT_IOS, "miniprogram", "wechat_miniprogram"],
    [ALIPAY, undefined, "alipay"],
    [SAFARI, undefined, "browser"],
    [null, undefined, "browser"],
  ])("%#", (userAgent, wxjsEnvironment, expected) => {
    expect(detectRuntimeEnvironment({ userAgent, wxjsEnvironment })).toBe(expected);
  });
});

describe("paymentOptionsFor", () => {
  it("delegates mini program payment to the native page", () => {
    expect(paymentOptionsFor("wechat_miniprogram")).toEqual([
      { method: "wechat_pay_miniprogram", handoff: "delegate_to_miniprogram_page" },
    ]);
  });

  it("offers WeChat Pay JSAPI first inside WeChat and routes Alipay outside", () => {
    const options = paymentOptionsFor("wechat");
    expect(options[0]?.method).toBe("wechat_pay_jsapi");
    expect(options.find((o) => o.method === "alipay")?.handoff).toBe("open_in_external_browser");
  });

  it("never offers JSAPI outside WeChat", () => {
    for (const env of ["browser", "alipay"] as const) {
      expect(paymentOptionsFor(env).some((o) => o.method === "wechat_pay_jsapi")).toBe(false);
    }
  });
});
