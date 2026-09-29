import type { ContentRecord } from "./content";

/**
 * 로컬·E2E용 합성 콘텐츠. 실제 요금·보상·금지 품목 정책이 아니다.
 * 각 본문에 ‘예시’임을 표시한다. 운영 콘텐츠는 DB에서 승인·게시한다.
 */
export const CONTENT_FIXTURES: ContentRecord[] = [
  {
    slug: "how-it-works",
    kind: "guide",
    criticality: "general",
    sortOrder: 10,
    translations: [
      {
        locale: "zh-CN",
        title: "服务流程",
        body: "【示例】1. 在线预约并完成付款\n2. 退房时把行李交给酒店前台，出示预约凭证\n3. 司机逐件扫码取件并拍照\n4. 在约定时间到机场指定地点凭取件码领取",
      },
      {
        locale: "ko",
        title: "이용 방법",
        body: "[예시] 1. 온라인 예약·결제\n2. 체크아웃 때 호텔 프런트에 짐을 맡기고 예약증 제시\n3. 기사가 짐마다 QR 스캔·사진 기록 후 수거\n4. 약속한 시간에 공항 지정 장소에서 수령 코드로 수령",
      },
      {
        locale: "en",
        title: "How it works",
        body: "[Sample] 1. Book and pay online\n2. Leave bags at the hotel front desk at checkout and show your voucher\n3. The driver scans and photographs each bag\n4. Collect your bags at the agreed airport point with your pickup code",
      },
    ],
  },
  {
    slug: "airport-pickup-point",
    kind: "guide",
    criticality: "general",
    sortOrder: 20,
    // 중국어 승인본이 없는 일반 안내: 대체 언어 표시를 확인하는 합성 데이터
    translations: [
      { locale: "ko", title: "공항 수령 장소", body: "[예시] 실제 수령 장소는 운영 승인 후 공지합니다." },
      { locale: "en", title: "Airport pickup point", body: "[Sample] The actual pickup point will be announced after approval." },
    ],
  },
  {
    slug: "bag-size-rules",
    kind: "legal",
    criticality: "critical",
    sortOrder: 10,
    translations: [
      { locale: "zh-CN", title: "行李尺寸与数量", body: "【示例】具体尺寸与重量限制以运营审核后的版本为准。" },
      { locale: "ko", title: "짐 규격·수량", body: "[예시] 실제 크기·무게 제한은 운영 승인본을 따릅니다." },
      { locale: "en", title: "Bag size and quantity", body: "[Sample] Actual size and weight limits follow the approved version." },
    ],
  },
  {
    slug: "prohibited-items",
    kind: "legal",
    criticality: "critical",
    sortOrder: 20,
    // 중국어 승인본이 없는 필수 문구: 대체 없이 차단되는지 확인하는 합성 데이터
    translations: [
      { locale: "ko", title: "금지 품목", body: "[예시] 현금·귀중품·위험물 등 금지 품목 목록은 운영 승인본을 따릅니다." },
      { locale: "en", title: "Prohibited items", body: "[Sample] The prohibited items list follows the approved version." },
    ],
  },
  {
    slug: "faq-no-korean-phone",
    kind: "faq",
    criticality: "general",
    sortOrder: 10,
    translations: [
      { locale: "zh-CN", title: "没有韩国手机号可以预约吗？", body: "【示例】可以。可使用邮箱等方式接收预约信息。" },
      { locale: "ko", title: "한국 전화번호 없이 예약할 수 있나요?", body: "[예시] 네. 이메일 등으로 예약 정보를 받을 수 있습니다." },
      { locale: "en", title: "Can I book without a Korean phone number?", body: "[Sample] Yes. You can receive booking details by email and other channels." },
    ],
  },
];
