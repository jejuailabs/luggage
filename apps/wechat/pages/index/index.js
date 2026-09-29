const { WEB_ORIGIN, DEFAULT_LOCALE } = require("../../config");
const { buildWebViewUrl } = require("../../utils/url");

/**
 * web-view 첫 화면. 공유·QR로 들어온 경우 path 쿼리의 같은 웹 경로를 연다.
 * 예: 호텔 QR → /zh-CN/h/SAMPLE01
 */
Page({
  data: { src: "" },
  onLoad(query) {
    this.setData({ src: buildWebViewUrl(WEB_ORIGIN, query && query.path, DEFAULT_LOCALE) });
  },
  onShareAppMessage() {
    return { title: "济州行李配送 · 空手游济州", path: "/pages/index/index" };
  },
});
