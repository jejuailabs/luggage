import type { ContentRecord } from "./content";

/**
 * 로컬·E2E용 합성 콘텐츠. 실제 요금·보상·금지 품목 정책이 아니다.
 * 각 본문에 ‘예시’임을 표시한다. 운영 콘텐츠는 DB에서 승인·게시한다.
 */
export const CONTENT_FIXTURES: ContentRecord[] = [
  // 상황별 안내 (08 문서 3절). 가격·장소는 본문에 복사하지 않고 예약 화면에서 운영 설정을 보여 준다.
  {
    slug: "checkout-day",
    kind: "guide",
    criticality: "general",
    sortOrder: 1,
    relatedRoute: "hotel_to_airport",
    translations: [
      {
        locale: "zh-CN",
        title: "退房当天：先寄行李，轻松逛到登机前",
        body: "【示例】退房时把行李交给酒店前台，我们按约定时间送到机场。你可以空手去看海、吃饭、购物，到机场凭取件码领取。\n可预约时间、截止时间和机场取件地点以预约页面显示为准。",
      },
      { locale: "ko", title: "체크아웃 날: 짐 맡기고 비행기 타기 전까지 가볍게", body: "[예시] 체크아웃 때 프런트에 짐을 맡기면 약속한 시간에 공항으로 보내 드립니다." },
      { locale: "en", title: "Checkout day: drop your bags and explore until your flight", body: "[Sample] Leave your bags at the front desk at checkout and pick them up at the airport." },
    ],
  },
  {
    slug: "arrival-day",
    kind: "guide",
    criticality: "general",
    sortOrder: 2,
    relatedRoute: "airport_to_hotel",
    translations: [
      {
        locale: "zh-CN",
        title: "刚到济州：行李直接送酒店，先去玩",
        body: "【示例】下飞机后在机场把行李交给我们，我们送到你的酒店前台。入住前也能轻松出发。\n航班到达时间需在机场取件时段结束前留出余量。",
      },
      { locale: "ko", title: "제주 도착 직후: 짐은 숙소로, 여행은 바로", body: "[예시] 공항에서 짐을 맡기면 숙소 프런트로 보내 드립니다." },
      { locale: "en", title: "Just landed: send your bags to the hotel and start exploring", body: "[Sample] Hand us your bags at the airport and we deliver them to your hotel." },
    ],
  },
  {
    slug: "hotel-move",
    kind: "guide",
    criticality: "general",
    sortOrder: 3,
    relatedRoute: "hotel_to_hotel",
    translations: [
      {
        locale: "zh-CN",
        title: "换酒店：行李帮你搬过去",
        body: "【示例】从济州市换到西归浦？把行李交给现在的酒店，我们送到下一家酒店前台。",
      },
      { locale: "ko", title: "숙소 이동: 짐은 다음 숙소로", body: "[예시] 지금 숙소에 맡기면 다음 숙소 프런트로 보내 드립니다." },
      { locale: "en", title: "Changing hotels: we move your bags", body: "[Sample] Leave your bags at your current hotel and we deliver them to the next one." },
    ],
  },
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
  // 필수 안내 본문은 supabase/migrations/20261001000200_policies_and_coupons.sql과 같은 문구다.
  {
    slug: "bag-size-rules",
    kind: "legal",
    criticality: "critical",
    sortOrder: 10,
    translations: [
      { locale: "ko", title: "짐 규격·수량 안내", body: "시행일 2026-10-01 · 버전 1\n\n1. 보통 짐: 가로·세로·높이 합 158cm 이하(약 28인치 이하), 23kg 이하\n2. 대형 짐: 가로·세로·높이 합 203cm 이하(29~32인치), 32kg 이하\n3. 한 예약에 최대 8개까지 맡길 수 있습니다. 더 많으면 예약을 나눠 주세요.\n4. 32kg 또는 203cm를 넘는 짐, 골프백·자전거·유모차·서핑보드 같은 특수 짐은 온라인 예약이 되지 않습니다. 고객지원으로 먼저 문의해 주세요.\n5. 모든 짐은 닫히고 잠긴 상태로 맡겨 주세요. 깨지기 쉬운 물건은 직접 완충 포장해 주세요. 쇼핑백·종이상자는 테이프로 밀봉한 경우에만 짐 1개로 받습니다.\n6. 인수할 때 예약과 규격이 다르면 차액을 결제한 뒤 맡기거나, 해당 짐의 인수를 거절하고 그 짐 요금을 환불합니다.\n7. 짐마다 붙인 태그는 떼지 마세요. 인계할 때 태그로 짐을 하나씩 확인합니다." },
      { locale: "zh-CN", title: "行李规格与数量", body: "生效日期 2026-10-01 · 第1版\n\n1. 普通行李：长宽高之和 158cm 以内（约 28 寸以内），23kg 以下\n2. 大件行李：长宽高之和 203cm 以内（29~32 寸），32kg 以下\n3. 每笔预约最多 8 件。超过请分开预约。\n4. 超过 32kg 或 203cm 的行李，以及高尔夫球包、自行车、婴儿车、冲浪板等特殊行李无法在线预约，请先联系客服。\n5. 所有行李请拉好拉链并上锁。易碎物品请自行做好缓冲包装。购物袋、纸箱须用胶带封好，才可按 1 件行李接收。\n6. 交接时如规格与预约不符，可补差价后寄存；或拒收该件行李并退还该件费用。\n7. 请勿撕下行李标签，交付时将按标签逐件核对。" },
      { locale: "en", title: "Bag size and quantity", body: "Effective 2026-10-01 · Version 1\n\n1. Standard bag: length + width + height up to 158 cm (about 28 inches), up to 23 kg\n2. Large bag: up to 203 cm in total (29–32 inches), up to 32 kg\n3. Up to 8 bags per booking. Please make separate bookings for more.\n4. Bags over 32 kg or 203 cm, and special items such as golf bags, bicycles, strollers or surfboards, cannot be booked online. Please contact support first.\n5. Close and lock every bag. Pack fragile items with your own padding. Shopping bags and boxes count as one bag only when sealed with tape.\n6. If a bag differs from the booked size at handover, pay the difference to proceed, or we decline that bag and refund its price.\n7. Do not remove the tags attached to each bag. We check every bag by its tag at handover." },
    ],
  },
  {
    slug: "prohibited-items",
    kind: "legal",
    criticality: "critical",
    sortOrder: 20,
    // 중국어 승인본이 없는 필수 문구: 대체 없이 차단되는지 확인하는 합성 데이터 (DB에는 중국어도 게시됨)
    translations: [
      { locale: "ko", title: "맡길 수 없는 물품", body: "시행일 2026-10-01 · 버전 1\n\n1. 반드시 직접 가지고 다니세요: 현금·수표·상품권, 귀금속·보석, 여권·신분증·항공권, 노트북·태블릿·카메라 같은 고가 전자기기, 복용 중인 의약품\n2. 운송 금지: 가스·부탄·라이터 연료 등 인화성·폭발성 물질, 보조배터리·리튬배터리 단품, 무기·도검, 독극물·화학약품, 마약 등 불법 물품, 살아 있는 동식물, 냉장·냉동 식품과 상하기 쉬운 음식, 액체가 샐 수 있는 물품\n3. 직원은 짐 겉모습만 확인하고 내용물을 열지 않습니다. 안전이 의심되면 고객 동의를 받아 확인합니다.\n4. 금지 물품이 발견되면 인수를 거절하거나 운송을 중단하고, 필요한 경우 관계 기관에 알립니다.\n5. 1번·2번 물품을 넣어 생긴 분실·파손·손해는 보상하지 않습니다." },
      { locale: "en", title: "Items we cannot carry", body: "Effective 2026-10-01 · Version 1\n\n1. Always keep with you: cash, cheques and gift cards, precious metals and jewellery, passports, ID and flight tickets, valuable electronics such as laptops, tablets and cameras, and any medicine you are taking\n2. Not allowed: flammable or explosive items such as gas, butane or lighter fuel, loose power banks or lithium batteries, weapons and blades, poisons and chemicals, illegal items including drugs, live animals or plants, chilled, frozen or perishable food, and anything that may leak\n3. Staff check only the outside of bags and never open them. If safety is in doubt, we check with your consent.\n4. If a prohibited item is found, we decline the bag or stop the delivery and may notify the authorities.\n5. We do not compensate loss, damage or harm caused by items in sections 1 or 2." },
    ],
  },
  {
    slug: "cancellation-refund",
    kind: "legal",
    criticality: "critical",
    sortOrder: 30,
    translations: [
      { locale: "ko", title: "취소·환불 규정", body: "시행일 2026-10-01 · 버전 1\n\n1. 예약 마감(수거일 전날 20:00, 한국 시간) 전에 취소하면 수수료 없이 전액 환불합니다. 마감 시각은 예약증에 표시됩니다.\n2. 예약 마감 후부터 짐 수거 전까지는 온라인 취소가 되지 않습니다. 고객지원으로 요청하면 요금의 50%를 환불합니다.\n3. 짐을 수거한 뒤에는 취소·환불할 수 없습니다.\n4. 기사가 약속한 수거 시간 안에 도착한 뒤 30분 동안 연락이 되지 않거나 짐이 준비되지 않으면 이용하지 않은 것으로 처리하며 환불하지 않습니다.\n5. 차량 고장·기상 악화 등 회사 사정으로 서비스를 제공하지 못하면 전액 환불하고 대안을 안내합니다.\n6. 약속한 인계 시간보다 60분 이상 늦게 전달하면 요금의 50%를 환불합니다.\n7. 환불은 결제한 수단으로 돌려드리며, 결제사에 따라 3~7영업일이 걸릴 수 있습니다.\n8. 짐 수량 변경은 예약 마감 전에 고객지원으로 요청해 주세요." },
      { locale: "zh-CN", title: "取消与退款规定", body: "生效日期 2026-10-01 · 第1版\n\n1. 在预约截止时间（取件日前一天 20:00，韩国时间）前取消，全额退款，不收手续费。截止时间显示在预约凭证上。\n2. 预约截止后至取件前无法在线取消。通过客服申请可退还 50% 费用。\n3. 行李取件后不可取消或退款。\n4. 司机在约定取件时间内到达后，30 分钟内无法联系到顾客或行李未准备好，视为未使用，不予退款。\n5. 因车辆故障、恶劣天气等公司原因无法提供服务时，全额退款并提供替代方案。\n6. 如比约定交付时间晚 60 分钟以上送达，退还 50% 费用。\n7. 退款将原路退回，视支付机构需要 3~7 个工作日。\n8. 如需修改行李数量，请在预约截止前联系客服。" },
      { locale: "en", title: "Cancellation and refunds", body: "Effective 2026-10-01 · Version 1\n\n1. Cancel before the booking cutoff (8:00 pm Korea time the day before pickup) for a full refund with no fee. The cutoff is shown on your voucher.\n2. From the cutoff until pickup, online cancellation is closed. Ask support and we refund 50% of the price.\n3. Once your bags are picked up, the booking cannot be cancelled or refunded.\n4. If the driver arrives within the pickup window and cannot reach you or your bags are not ready for 30 minutes, the booking counts as used and is not refunded.\n5. If we cannot provide the service for our own reasons, such as a vehicle breakdown or severe weather, you get a full refund and an alternative.\n6. If we deliver more than 60 minutes after the promised handoff time, we refund 50% of the price.\n7. Refunds go back to your original payment method and may take 3–7 business days depending on the provider.\n8. To change the number of bags, contact support before the booking cutoff." },
    ],
  },
  {
    slug: "damage-compensation",
    kind: "legal",
    criticality: "critical",
    sortOrder: 40,
    translations: [
      { locale: "ko", title: "파손·분실 보상 기준", body: "시행일 2026-10-01 · 버전 1\n\n1. 짐을 맡긴 때부터 인계할 때까지 회사 책임으로 생긴 파손·분실을 보상합니다. 짐마다 인수·인계 사진을 기록합니다.\n2. 보상 한도는 짐 1개당 50만 원입니다.\n3. 분실: 구매 증빙을 기준으로 사용 기간을 반영한 현재 가치를 한도 안에서 보상합니다. 증빙이 없으면 한도 안에서 협의합니다.\n4. 파손: 수리비를 보상하고, 수리할 수 없으면 현재 가치를 한도 안에서 보상합니다.\n5. 겉면 파손은 짐을 받을 때 현장에서 알려 주세요. 내용물 파손·분실은 받은 날부터 7일 안에 고객지원으로 신고해 주세요.\n6. 회사가 늦게 인계해 항공편을 놓친 경우, 실제로 낸 항공권 변경 수수료를 1명당 20만 원까지 보상합니다.\n7. 보상하지 않는 경우: 금지 물품, 포장 불량으로 생긴 파손, 인수 사진에 이미 있던 손상, 바퀴·손잡이 등의 가벼운 긁힘과 자연 마모, 천재지변\n8. 신고 후 5영업일 안에 1차 안내, 14일 안에 결과를 알려 드립니다. 보상은 결제 환불과 별도로 처리합니다." },
      { locale: "zh-CN", title: "损坏与丢失赔偿标准", body: "生效日期 2026-10-01 · 第1版\n\n1. 自接收行李起至交付为止，因公司责任造成的损坏或丢失予以赔偿。每件行李在交接时都会拍照记录。\n2. 赔偿上限为每件行李 50 万韩元。\n3. 丢失：以购买凭证为准，按使用年限折算现值，在上限内赔偿。无凭证时在上限内协商。\n4. 损坏：赔偿维修费用；无法维修时，按现值在上限内赔偿。\n5. 外观损坏请在取件时当场告知。内部物品损坏或丢失请在取件后 7 天内联系客服。\n6. 因公司延误交付导致误机的，实际产生的机票改签费用每人最高赔偿 20 万韩元。\n7. 不予赔偿：禁止物品，包装不当造成的损坏，交接照片中已有的损伤，轮子、把手等的轻微划痕和自然磨损，不可抗力\n8. 申报后 5 个工作日内初步答复，14 天内告知结果。赔偿与付款退款分开处理。" },
      { locale: "en", title: "Damage and loss compensation", body: "Effective 2026-10-01 · Version 1\n\n1. We compensate damage or loss caused by us from the moment we receive your bags until handoff. Each bag is photographed at every handover.\n2. Compensation is limited to KRW 500,000 per bag.\n3. Loss: we pay the current value based on proof of purchase, adjusted for age, within the limit. Without proof, we agree an amount within the limit.\n4. Damage: we pay the repair cost, or the current value within the limit if it cannot be repaired.\n5. Report visible damage on the spot when you collect your bags. Report damage or loss of contents to support within 7 days of collection.\n6. If our late handoff makes you miss your flight, we reimburse the change fee you actually paid, up to KRW 200,000 per person.\n7. Not covered: prohibited items, damage from poor packing, damage already visible in handover photos, light scratches or wear on wheels and handles, and natural disasters\n8. We reply within 5 business days and give a decision within 14 days. Compensation is handled separately from payment refunds." },
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
