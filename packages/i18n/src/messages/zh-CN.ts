/**
 * 중국어 간체가 기준 메시지다. 다른 언어는 같은 키를 모두 가져야 한다.
 * 고객 노출 문구는 승인 전 초안이며 운영 승인본으로 교체한다.
 */
export const zhCN = {
  "brand.name": "济州Connect",
  "brand.tagline": "济州行李配送",

  "nav.home": "首页",
  "nav.book": "预约",
  "nav.orders": "我的订单",
  "nav.help": "客服",
  "nav.primary": "主导航",

  "home.headline": "行李交给我们，轻松畅游济州",
  "home.subheadline": "在约定的地点，取回属于您的每一件行李。",
  "home.routes.title": "配送路线",
  "home.search.title": "查询可预约时间",
  "home.search.hotel": "入住酒店",
  "home.search.hotelPlaceholder": "输入酒店名称",
  "home.search.date": "寄送日期",
  "home.search.submit": "查询可预约时间",
  "home.search.unavailable": "在线预约即将开放",
  "home.notice.title": "寄存截止时间与机场取件地点",
  "home.notice.body": "所有时间均为韩国时间（KST）。预约前会再次向您确认寄存截止时间和机场取件地点。",
  "home.trust.title": "为什么放心",
  "home.trust.perBag": "每件行李单独贴码，交接逐件确认",
  "home.trust.noKoreanPhone": "无需韩国手机号即可预约",
  "home.trust.support": "延误或异常时，订单页面实时说明处理进度",

  "route.hotel_to_airport": "酒店 → 机场",
  "route.airport_to_hotel": "机场 → 酒店",
  "route.hotel_to_hotel": "酒店 → 酒店",
  "route.status.open": "可预约",
  "route.status.comingSoon": "即将开通",

  "theme.label": "显示模式",
  "theme.light": "浅色",
  "theme.dark": "深色",
  "theme.system": "跟随系统",
  "theme.current": "当前：{mode}",

  "locale.label": "语言",

  "time.kstLabel": "韩国时间",

  "env.testMode": "测试模式 · 不会产生真实付款或通知",

  "help.title": "客服与常见问题",
  "help.body": "常见问题和在线咨询正在准备中。",

  "staff.title": "工作人员入口",
  "staff.loginRequired": "请使用工作账号登录。",
  "staff.driver": "司机作业",
  "staff.partner": "酒店寄存",
  "staff.admin": "运营管理",

  "error.notFound": "页面不存在",
  "error.backHome": "返回首页",
} as const;

export type MessageKey = keyof typeof zhCN;
export type Messages = Record<MessageKey, string>;
