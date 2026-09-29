const { SUBSCRIBE_TEMPLATE_IDS } = require("../../config");
const { post, login } = require("../../utils/request");
const { parsePayQuery } = require("../../utils/url");

const TEXT = {
  "zh-CN": {
    preparing: "正在准备付款…",
    confirming: "正在确认付款结果，请返回订单页面查看。",
    failed: "付款未完成，可以返回订单页面重新付款。",
    invalid: "付款链接已失效，请返回订单页面重新发起付款。",
    mock: "测试环境：模拟付款，不会产生真实扣款。",
  },
  ko: {
    preparing: "결제를 준비하고 있습니다…",
    confirming: "결제 결과를 확인하고 있습니다. 주문 화면으로 돌아가 확인하세요.",
    failed: "결제가 완료되지 않았습니다. 주문 화면에서 다시 결제할 수 있습니다.",
    invalid: "결제 링크가 만료됐습니다. 주문 화면에서 다시 결제하세요.",
    mock: "테스트 환경: 모의 결제이며 실제로 돈이 나가지 않습니다.",
  },
  en: {
    preparing: "Preparing payment…",
    confirming: "Confirming your payment. Go back to your booking to see the result.",
    failed: "The payment was not completed. You can pay again from your booking.",
    invalid: "This payment link expired. Start the payment again from your booking.",
    mock: "Test environment: simulated payment, no real charge.",
  },
};

/**
 * 미니프로그램 결제 페이지.
 * 1) web-view가 넘긴 1회용 티켓 + wx.login code로 결제 파라미터를 받는다.
 * 2) wx.requestPayment를 호출한다. 여기서 성공해도 예약 확정은 서버의 PG 확인으로만 한다.
 * 3) 구독 메시지 동의(템플릿이 있을 때)를 요청하고 주문 화면(web-view)으로 돌아간다.
 */
Page({
  data: { status: "preparing", message: "", mock: false, attemptId: "", token: "" },

  async onLoad(query) {
    const parsed = parsePayQuery(query);
    this.text = TEXT[(parsed && parsed.locale) || "zh-CN"];
    this.setData({ message: this.text.preparing });
    if (!parsed) return this.finish("invalid");

    let code;
    try {
      code = await login();
    } catch {
      return this.finish("failed");
    }
    const res = await post("/api/v1/wechat/pay-tickets/redeem", { ticket: parsed.ticket, code });
    if (!res.ok || !res.body || !res.body.data) return this.finish(res.status === 422 || res.status === 404 ? "invalid" : "failed");

    const data = res.body.data;
    if (data.mock) {
      // 모의 결제: 실제 wx.requestPayment 대신 결과 버튼을 보여 준다 (비운영 전용).
      this.setData({ status: "mock", mock: true, message: this.text.mock, attemptId: data.attemptId, token: data.mockCompletionToken || "" });
      return;
    }
    wx.requestPayment({
      ...data.params,
      complete: () => this.afterPayment(),
    });
  },

  async onMockResult(event) {
    const outcome = event.currentTarget.dataset.outcome;
    await post("/api/v1/wechat/mock-complete", { attemptId: this.data.attemptId, token: this.data.token, outcome });
    this.afterPayment();
  },

  afterPayment() {
    const back = () => this.finish("confirming");
    if (SUBSCRIBE_TEMPLATE_IDS.length === 0) return back();
    wx.requestSubscribeMessage({ tmplIds: SUBSCRIBE_TEMPLATE_IDS, complete: back });
  },

  finish(kind) {
    this.setData({ status: kind, message: this.text[kind] });
    // 주문 화면(web-view)은 결제 확인 중 상태를 서버에서 다시 읽는다.
    setTimeout(() => wx.navigateBack({ delta: 1 }), kind === "confirming" ? 800 : 2500);
  },
});
