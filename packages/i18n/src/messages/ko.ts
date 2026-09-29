import { bookingKo } from "./booking.ko";
import type { Messages } from "./zh-CN";

export const ko: Messages = {
  "brand.name": "제주 커넥트",
  "brand.tagline": "제주 짐배송",

  "nav.home": "홈",
  "nav.book": "예약",
  "nav.orders": "내 예약",
  "nav.help": "고객지원",
  "nav.primary": "주 메뉴",

  "home.headline": "짐은 맡기고, 제주는 가볍게",
  "home.subheadline": "약속한 곳에서 내 짐을 하나하나 정확히 돌려받으세요.",
  "home.routes.title": "배송 노선",
  "home.search.title": "이용 가능 시간 조회",
  "home.search.hotel": "숙소",
  "home.search.hotelPlaceholder": "숙소 이름 입력",
  "home.search.date": "배송 날짜",
  "home.search.submit": "이용 가능 시간 조회",
  "home.search.unavailable": "온라인 예약 준비 중",
  "home.notice.title": "인계 마감과 공항 수령 장소",
  "home.notice.body": "모든 시간은 한국 시간(KST)입니다. 예약 전에 인계 마감 시각과 공항 수령 장소를 다시 안내합니다.",
  "home.trust.title": "안심하고 맡길 수 있는 이유",
  "home.trust.perBag": "짐마다 태그를 붙이고 인계 때 하나씩 확인",
  "home.trust.noKoreanPhone": "한국 전화번호 없이 예약 가능",
  "home.trust.support": "지연·문제 발생 시 주문 화면에서 처리 상황 안내",

  "route.hotel_to_airport": "숙소 → 공항",
  "route.airport_to_hotel": "공항 → 숙소",
  "route.hotel_to_hotel": "숙소 → 숙소",
  "route.status.open": "예약 가능",
  "route.status.comingSoon": "오픈 예정",

  "theme.label": "화면 모드",
  "theme.light": "라이트",
  "theme.dark": "다크",
  "theme.system": "기기 설정 따르기",
  "theme.current": "현재: {mode}",

  "locale.label": "언어",

  "time.kstLabel": "한국 시간",

  "env.testMode": "테스트 모드 · 실제 결제·알림이 발생하지 않습니다",

  "help.title": "고객지원·자주 묻는 질문",
  "help.body": "자주 묻는 질문과 문의 접수를 준비하고 있습니다.",

  "staff.title": "업무 화면",
  "staff.loginRequired": "업무 계정으로 로그인하세요.",
  "staff.driver": "기사 작업",
  "staff.partner": "호텔 보관·인계",
  "staff.admin": "운영 관리",
  "staff.comingSoon": "업무 기능을 준비하고 있습니다.",
  "staff.noAccess": "이 계정에는 이 화면 권한이 없습니다. 운영 담당자에게 권한을 요청하세요.",
  "staff.login.title": "업무 계정 로그인",
  "staff.login.email": "이메일",
  "staff.login.password": "비밀번호",
  "staff.login.submit": "로그인",
  "staff.login.failed": "이메일 또는 비밀번호가 올바르지 않습니다.",
  "staff.login.unavailable": "로그인 설정이 아직 없습니다.",

  "content.fallbackNotice": "이 내용은 아직 한국어 버전이 없어 {language}로 보여 드립니다.",
  "content.criticalBlocked": "이 필수 안내의 한국어 승인본을 검토 중입니다. 검토가 끝나기 전에는 예약할 수 없습니다. 궁금한 점은 고객지원에 문의하세요.",
  "content.unavailable": "내용을 불러오지 못했습니다. 잠시 후 다시 시도하세요.",
  "content.empty": "아직 내용이 없습니다.",

  "luggage.title": "제주 짐배송 서비스",
  "luggage.intro": "체크아웃 후 짐을 맡기고 가볍게 제주를 여행한 뒤, 약속한 시간과 장소에서 짐을 돌려받으세요.",
  "luggage.howItWorks": "이용 방법",
  "luggage.rules": "예약 전 확인하세요",
  "luggage.bookingBlocked": "일부 필수 안내의 한국어 승인본이 없어 지금은 예약할 수 없습니다.",
  "guide.title": "이용 안내",
  "legal.title": "약관·정책",
  "faq.title": "자주 묻는 질문",

  "hotels.title": "숙소 찾기",
  "hotels.search.submit": "숙소 찾기",
  "hotels.search.resultCount": "{count, plural, =0 {숙소가 없습니다} other {숙소 #곳}}",
  "hotels.search.noResult": "일치하는 숙소가 없습니다. 한국어·중국어·영어 이름으로 다시 검색해 보세요.",
  "hotels.zone": "권역",
  "hotels.address": "주소",
  "hotels.frontDesk": "프런트 짐 맡김 시간",
  "hotels.frontDeskHours": "{opensAt}–{closesAt} (한국 시간)",
  "hotels.frontDeskUnknown": "프런트에 확인하세요",
  "hotels.bookFromHere": "이 숙소에서 예약",

  "error.notFound": "페이지를 찾을 수 없습니다",
  "error.backHome": "홈으로",

  ...bookingKo,
};
