/**
 * 미니프로그램 설정. 실제 값은 배포 환경별로 바꾼다.
 * - WEB_ORIGIN: web-view로 여는 웹 (미니프로그램 관리 화면의 ‘업무 도메인’으로 인증돼야 한다)
 * - API_ORIGIN: wx.request 대상 (‘서버 도메인(request 합법 도메인)’에 등록돼야 한다)
 * - SUBSCRIBE_TEMPLATE_IDS: 승인된 구독 메시지 템플릿 ID (없으면 동의 요청을 건너뛴다)
 * AppID·AppSecret은 여기에 두지 않는다. AppSecret은 서버 설정에만 둔다.
 */
module.exports = {
  WEB_ORIGIN: "https://example.invalid",
  API_ORIGIN: "https://example.invalid",
  DEFAULT_LOCALE: "zh-CN",
  SUBSCRIBE_TEMPLATE_IDS: [],
};
