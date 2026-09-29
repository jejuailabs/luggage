import { bookingZhCN } from "./booking.zh-CN";

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
  "staff.comingSoon": "工作功能正在准备中。",
  "staff.noAccess": "此账号没有访问该页面的权限。如需开通，请联系运营负责人。",
  "staff.login.title": "工作账号登录",
  "staff.login.email": "邮箱",
  "staff.login.password": "密码",
  "staff.login.submit": "登录",
  "staff.login.failed": "邮箱或密码不正确。",
  "staff.login.unavailable": "登录服务暂未配置。",

  "content.fallbackNotice": "此内容暂无简体中文版本，以下为{language}内容。",
  "content.criticalBlocked": "此项重要说明的简体中文版本正在审核中。审核完成前暂不开放预约，如有疑问请联系客服。",
  "content.unavailable": "内容暂时无法加载，请稍后再试。",
  "content.empty": "暂无内容。",

  "luggage.title": "济州行李配送服务",
  "luggage.intro": "退房后把行李交给我们，空手游玩济州，在约定时间和地点取回行李。",
  "luggage.howItWorks": "服务流程",
  "luggage.rules": "预约前请确认",
  "luggage.bookingBlocked": "部分必读说明尚未提供简体中文审核版本，暂不开放预约。",
  "guide.title": "使用指南",
  "legal.title": "条款与政策",
  "faq.title": "常见问题",

  "hotels.title": "查找酒店",
  "hotels.search.submit": "查找酒店",
  "hotels.search.resultCount": "{count, plural, =0 {没有找到酒店} other {找到 # 家酒店}}",
  "hotels.search.noResult": "没有找到匹配的酒店。请尝试酒店的中文名、英文名或韩文名。",
  "hotels.zone": "区域",
  "hotels.address": "地址（韩文）",
  "hotels.frontDesk": "前台寄存时间",
  "hotels.frontDeskHours": "{opensAt}–{closesAt}（韩国时间）",
  "hotels.frontDeskUnknown": "请向前台确认",
  "hotels.bookFromHere": "从这家酒店预约",

  "error.notFound": "页面不存在",
  "error.backHome": "返回首页",

  ...bookingZhCN,
} as const;

export type MessageKey = keyof typeof zhCN;
export type Messages = Record<MessageKey, string>;
