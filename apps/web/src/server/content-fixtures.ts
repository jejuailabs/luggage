import type { ContentRecord } from "./content";

/**
 * 로컬·E2E용 콘텐츠. 문구는 DB 마이그레이션의 운영 문구 v1과 같고, 일부 번역은 대체 언어·차단 검사를 위해 일부러 뺐다.
 * 운영 콘텐츠의 기준은 DB 게시본이다.
 */
export const CONTENT_FIXTURES: ContentRecord[] = [
  // 상황별 안내 (08 문서 3절). 가격·장소는 본문에 복사하지 않고 예약 화면에서 운영 설정을 보여 준다.
  // 가이드·FAQ 본문은 supabase/migrations/20261001000300_public_content_v1.sql과 같은 문구다.
  {
    slug: "checkout-day",
    kind: "guide",
    criticality: "general",
    sortOrder: 1,
    relatedRoute: "hotel_to_airport",
    translations: [
      { locale: "zh-CN", title: "退房当天：寄存行李，轻松玩到登机前", body: "退房时把行李交给住宿前台，我们会在约定时间送到济州机场。\n整个下午无需拖着行李游玩，到机场交付地点出示取件码即可取回。\n只能预约在航班起飞 2 小时前于机场取回的时段。" },
      { locale: "ko", title: "체크아웃 날: 짐 맡기고 비행기 타기 전까지 가볍게", body: "체크아웃할 때 숙소 프런트에 짐을 맡기면 약속한 시간에 제주공항으로 보내 드려요.\n오후 내내 짐 없이 관광하고, 공항 인계 장소에서 수령 코드를 보여 주고 짐을 받으세요.\n항공편 출발 2시간 전까지 공항에서 받을 수 있는 시간대만 예약돼요." },
      { locale: "en", title: "Checkout day: drop your bags and explore until your flight", body: "Leave your bags at the front desk when you check out, and we deliver them to Jeju Airport at the agreed time.\nSpend the afternoon bag-free, then show your handoff code at the airport point to collect them.\nOnly windows that let you collect at least 2 hours before departure can be booked." },
    ],
  },
  {
    slug: "arrival-day",
    kind: "guide",
    criticality: "general",
    sortOrder: 2,
    relatedRoute: "airport_to_hotel",
    translations: [
      { locale: "zh-CN", title: "刚到济州：行李送去住宿，旅程马上开始", body: "抵达机场后，在约定地点把行李交给司机，每件行李都会扫码并拍照记录。\n无需拖着行李即可开始旅程，入住时在住宿前台出示预约凭证二维码即可领取。" },
      { locale: "ko", title: "제주 도착 직후: 짐은 숙소로, 여행은 바로", body: "공항에 도착하면 약속 장소에서 기사에게 짐을 건네세요. 짐마다 QR을 스캔하고 사진을 남겨요.\n무거운 짐 없이 바로 여행을 시작하고, 체크인할 때 숙소 프런트에서 예약증 QR을 보여 주면 짐을 받을 수 있어요." },
      { locale: "en", title: "Just landed: send your bags to the hotel and start exploring", body: "After landing, hand your bags to the driver at the meeting point. Each bag is scanned and photographed.\nStart exploring right away, then show your voucher QR at your stay's front desk when you check in to collect them." },
    ],
  },
  {
    slug: "hotel-move",
    kind: "guide",
    criticality: "general",
    sortOrder: 3,
    relatedRoute: "hotel_to_hotel",
    translations: [
      { locale: "zh-CN", title: "更换住宿：行李直接送到下一家", body: "退房时把行李交给当前住宿前台，我们会在当天送到下一家住宿前台。\n换住宿的日子也能轻松游玩，入住下一家时出示预约凭证二维码即可领取。" },
      { locale: "ko", title: "숙소 이동: 짐은 다음 숙소로", body: "체크아웃할 때 지금 숙소 프런트에 짐을 맡기면 같은 날 다음 숙소 프런트로 옮겨 드려요.\n이동하는 날에도 짐 걱정 없이 관광하고, 다음 숙소 체크인 때 예약증 QR로 짐을 받으세요." },
      { locale: "en", title: "Changing hotels: we move your bags", body: "Leave your bags at your current front desk when you check out, and we move them to your next stay the same day.\nExplore freely on moving day, then collect them with your voucher QR when you check in." },
    ],
  },
  {
    slug: "how-it-works",
    kind: "guide",
    criticality: "general",
    sortOrder: 10,
    translations: [
      { locale: "zh-CN", title: "服务流程", body: "1. 填写住宿、日期和行李数量，在线预约并付款\n2. 在住宿前台或机场约定地点出示预约凭证寄存行李\n3. 司机逐件扫码拍照后取件\n4. 查看配送车辆位置和各阶段通知\n5. 在约定地点凭取件码或预约凭证二维码取回行李" },
      { locale: "ko", title: "이용 방법", body: "1. 숙소·날짜·짐 수량을 넣고 온라인으로 예약·결제\n2. 숙소 프런트나 공항 약속 장소에서 예약증을 보여 주고 짐 맡기기\n3. 기사가 짐마다 QR을 스캔하고 사진을 남긴 뒤 수거\n4. 배송 차량 위치와 단계별 알림 확인\n5. 약속한 장소에서 수령 코드나 예약증 QR로 짐 받기" },
      { locale: "en", title: "How it works", body: "1. Enter your stay, date and number of bags, then book and pay online\n2. Show your voucher and hand over your bags at the front desk or airport meeting point\n3. The driver scans and photographs each bag before pickup\n4. Follow the delivery vehicle and stage-by-stage alerts\n5. Collect your bags at the agreed point with your handoff code or voucher QR" },
    ],
  },
  {
    slug: "airport-pickup-point",
    kind: "guide",
    criticality: "general",
    sortOrder: 20,
    // 중국어 번역이 없는 일반 안내: 대체 언어 표시를 확인하는 합성 데이터 (DB에는 중국어도 게시됨)
    translations: [
      { locale: "ko", title: "공항 수령 장소", body: "공항 인계 장소와 운영 시간은 홈 화면 지도와 예약증에 표시돼요.\n장소가 바뀌면 영향을 받는 예약에 알림을 보내 드려요.\n도착하면 수령 코드를 기사에게 보여 주세요. 짐 태그를 하나씩 확인한 뒤 돌려 드려요." },
      { locale: "en", title: "Airport pickup point", body: "The airport handoff point and its hours are shown on the home page map and on your voucher.\nIf the point changes, we notify every affected booking.\nWhen you arrive, show your handoff code to the driver. We check each bag tag before handing them back." },
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
      { locale: "zh-CN", title: "没有韩国手机号可以预约吗？", body: "可以。只需邮箱或微信号即可预约，预约确认和进度通知也通过微信或邮件发送。" },
      { locale: "ko", title: "한국 전화번호 없이 예약할 수 있나요?", body: "네. 이메일이나 위챗 ID만 있으면 예약할 수 있어요. 예약 확인과 진행 알림도 위챗·이메일로 받아요." },
      { locale: "en", title: "Can I book without a Korean phone number?", body: "Yes. An email address or WeChat ID is enough. Confirmations and updates arrive by WeChat or email." },
    ],
  },
  {
    slug: "faq-price",
    kind: "faq",
    criticality: "general",
    sortOrder: 11,
    translations: [
      { locale: "zh-CN", title: "费用是多少？", body: "按每件行李计费，各路线分别设有普通行李和大件行李价格。基本价格显示在首页和预约页面，填写日期和数量后，服务器会在付款前计算并显示最终金额（含增值税）。" },
      { locale: "ko", title: "요금은 얼마인가요?", body: "짐 1개 기준으로 노선마다 보통 짐·대형 짐 요금이 정해져 있어요. 기본 요금은 홈과 예약 화면에 표시되고, 날짜와 짐 수량을 넣으면 서버가 최종 금액(부가세 포함)을 계산해 결제 전에 보여 드려요." },
      { locale: "en", title: "How much does it cost?", body: "Each route has a per-bag price for standard and large bags. Base prices are shown on the home and booking pages, and the server calculates your final total (VAT included) before you pay." },
    ],
  },
  {
    slug: "faq-booking-cutoff",
    kind: "faq",
    criticality: "general",
    sortOrder: 12,
    translations: [
      { locale: "zh-CN", title: "最晚什么时候预约？", body: "最晚可在取件日前一天 20:00（韩国时间）前预约，只显示还有名额的时段。" },
      { locale: "ko", title: "언제까지 예약해야 하나요?", body: "수거일 전날 20:00(한국 시간)까지 예약할 수 있어요. 남은 자리가 있는 시간대만 보여 드려요." },
      { locale: "en", title: "How late can I book?", body: "You can book until 8:00 pm Korea time the day before pickup. Only time windows with space left are shown." },
    ],
  },
  {
    slug: "faq-flight-timing",
    kind: "faq",
    criticality: "general",
    sortOrder: 13,
    translations: [
      { locale: "zh-CN", title: "能配合航班时间吗？", body: "填写航班起飞时间后，只能预约在起飞 2 小时前于机场取回行李的时段。机场→住宿则按抵达时间安排机场取件。" },
      { locale: "ko", title: "비행기 시간에 맞출 수 있나요?", body: "항공편 출발 시각을 넣으면 출발 2시간 전까지 공항에서 짐을 받을 수 있는 시간대만 예약돼요. 공항→숙소는 도착 시각을 기준으로 공항 수거 시간을 정해요." },
      { locale: "en", title: "Will it fit my flight?", body: "Enter your departure time and only windows that let you collect your bags at the airport at least 2 hours before departure can be booked. For airport-to-stay, pickup is planned around your arrival time." },
    ],
  },
  {
    slug: "faq-airport-pickup",
    kind: "faq",
    criticality: "general",
    sortOrder: 14,
    translations: [
      { locale: "zh-CN", title: "在机场哪里取行李？", body: "机场交付地点和服务时间显示在首页地图和预约凭证上，出发前一天还会再次通知。出示取件码后，我们逐件核对标签交还行李。" },
      { locale: "ko", title: "공항 어디에서 짐을 받나요?", body: "공항 인계 장소와 운영 시간은 홈 화면 지도와 예약증에 표시되고, 출발 전날 알림으로 다시 안내해요. 수령 코드를 보여 주면 짐 태그를 하나씩 확인해 돌려 드려요." },
      { locale: "en", title: "Where do I collect my bags at the airport?", body: "The handoff point and its hours are on the home page map and your voucher, and we remind you the day before. Show your handoff code and we check each bag tag before handing them over." },
    ],
  },
  {
    slug: "faq-bag-limits",
    kind: "faq",
    criticality: "general",
    sortOrder: 15,
    translations: [
      { locale: "zh-CN", title: "可以寄存什么行李、最多几件？", body: "普通行李长宽高之和 158cm、23kg 以内，大件行李 203cm、32kg 以内。每笔预约最多 8 件。高尔夫球包、自行车、婴儿车等特殊行李请先联系客服。" },
      { locale: "ko", title: "어떤 짐을 몇 개까지 맡길 수 있나요?", body: "보통 짐은 세 변 합 158cm·23kg 이하, 대형 짐은 203cm·32kg 이하예요. 예약 1건에 최대 8개까지 맡길 수 있어요. 골프백·자전거·유모차 같은 특수 짐은 고객지원으로 먼저 문의해 주세요." },
      { locale: "en", title: "What bags can I send, and how many?", body: "Standard bags up to 158 cm (L+W+H) and 23 kg, large bags up to 203 cm and 32 kg, and up to 8 bags per booking. Contact support first for golf bags, bicycles, strollers and other special items." },
    ],
  },
  {
    slug: "faq-valuables",
    kind: "faq",
    criticality: "general",
    sortOrder: 16,
    translations: [
      { locale: "zh-CN", title: "贵重物品可以寄存吗？", body: "不可以。现金、护照、笔记本电脑、相机和正在服用的药品请随身携带。危险品、食品和活体动植物不能寄存，详情请查看“禁止寄存物品”。" },
      { locale: "ko", title: "귀중품도 맡겨도 되나요?", body: "아니요. 현금·여권·노트북·카메라·복용 중인 약은 직접 가지고 다니세요. 위험물·음식·살아 있는 동식물은 맡길 수 없어요. 자세한 내용은 ‘맡길 수 없는 물품’ 안내를 확인해 주세요." },
      { locale: "en", title: "Can I send valuables?", body: "No. Keep cash, passports, laptops, cameras and any medicine with you. Hazardous items, food and live animals or plants cannot be carried. See “Items we cannot carry” for details." },
    ],
  },
  {
    slug: "faq-tracking",
    kind: "faq",
    criticality: "general",
    sortOrder: 17,
    translations: [
      { locale: "zh-CN", title: "能知道行李在哪里吗？", body: "每件行李的标签二维码都会被扫描，记录寄存、取件、运送、交付各阶段；运送途中可在地图上查看配送车辆的最近位置。行李本身没有 GPS。" },
      { locale: "ko", title: "짐이 어디 있는지 알 수 있나요?", body: "짐마다 태그 QR을 스캔해 맡김·수거·이동·인계 단계가 기록되고, 이동 중에는 배송 차량의 최근 위치를 지도에서 볼 수 있어요. 짐 자체에 GPS가 달린 것은 아니에요." },
      { locale: "en", title: "Can I see where my bags are?", body: "Each bag tag is scanned at drop-off, pickup, transit and handoff, and while in transit you can see the delivery vehicle's latest position on a map. The bags themselves do not carry GPS." },
    ],
  },
  {
    slug: "faq-hotel-not-listed",
    kind: "faq",
    criticality: "general",
    sortOrder: 18,
    translations: [
      { locale: "zh-CN", title: "我的住宿不在列表里。", body: "带“合作”标记的住宿可直接预约。不在列表中的住宿，输入名称提交报价咨询后，我们会告知能否服务及价格。" },
      { locale: "ko", title: "제 숙소가 목록에 없어요.", body: "‘제휴’ 표시가 있는 숙소는 바로 예약할 수 있어요. 목록에 없는 숙소도 이름을 입력해 견적을 요청하면 이용 가능 여부와 요금을 안내해 드려요." },
      { locale: "en", title: "My hotel isn't listed.", body: "Stays marked “Partner” can be booked right away. For any other stay, type its name and request a quote — we'll tell you if we can serve it and the price." },
    ],
  },
  {
    slug: "faq-cancel",
    kind: "faq",
    criticality: "general",
    sortOrder: 19,
    translations: [
      { locale: "zh-CN", title: "可以取消预约吗？", body: "取件日前一天 20:00（韩国时间）前取消可全额退款。之后至取件前通过客服申请可退 50%，取件后不可取消。" },
      { locale: "ko", title: "예약을 취소할 수 있나요?", body: "수거일 전날 20:00(한국 시간) 전에 취소하면 전액 환불돼요. 그 뒤부터 수거 전까지는 고객지원으로 요청하면 50%를 환불하고, 수거 후에는 취소할 수 없어요." },
      { locale: "en", title: "Can I cancel?", body: "Cancel before 8:00 pm Korea time the day before pickup for a full refund. After that and before pickup, support can refund 50%. Once picked up, the booking can't be cancelled." },
    ],
  },
  {
    slug: "faq-delay-damage",
    kind: "faq",
    criticality: "general",
    sortOrder: 20,
    translations: [
      { locale: "zh-CN", title: "延误或行李损坏怎么办？", body: "比约定交付时间晚 60 分钟以上，退还 50% 费用。损坏或丢失每件最高赔偿 50 万韩元；外观损坏请在取件时当场告知，内部物品问题请在 7 天内联系我们。" },
      { locale: "ko", title: "늦거나 짐이 파손되면 어떻게 되나요?", body: "약속한 인계 시간보다 60분 이상 늦으면 요금의 50%를 환불해요. 파손·분실은 짐 1개당 50만 원까지 보상하며, 겉면 파손은 받을 때 현장에서, 내용물 문제는 7일 안에 알려 주세요." },
      { locale: "en", title: "What if you're late or my bag is damaged?", body: "If we hand over more than 60 minutes late, we refund 50%. Damage or loss is covered up to KRW 500,000 per bag — report visible damage on the spot and problems with contents within 7 days." },
    ],
  },
  {
    slug: "faq-payment",
    kind: "faq",
    criticality: "general",
    sortOrder: 21,
    translations: [
      { locale: "zh-CN", title: "支持哪些付款方式？", body: "支持微信支付和支付宝。支付页面完成后，还需支付机构确认，预约确认后即发放预约凭证。" },
      { locale: "ko", title: "어떤 결제 수단을 쓸 수 있나요?", body: "위챗페이와 알리페이로 결제해요. 결제 화면이 끝나도 결제사 확인이 끝나야 예약이 확정되고, 확정되면 예약증이 발급돼요." },
      { locale: "en", title: "How can I pay?", body: "With WeChat Pay or Alipay. Your booking is confirmed — and your voucher issued — once the payment provider verifies the payment." },
    ],
  },
  {
    slug: "faq-other-device",
    kind: "faq",
    criticality: "general",
    sortOrder: 22,
    translations: [
      { locale: "zh-CN", title: "换一部手机也能查看预约吗？", body: "注册会员后，当前设备上的预约会关联到账号，在其他设备登录即可查看。" },
      { locale: "ko", title: "다른 휴대폰에서도 예약을 볼 수 있나요?", body: "회원으로 가입하면 지금 기기에서 만든 예약이 계정에 이어져 다른 기기에서도 로그인해서 볼 수 있어요." },
      { locale: "en", title: "Can I see my booking on another phone?", body: "Sign up and the bookings made on this device are linked to your account, so you can sign in on any device to see them." },
    ],
  },
];
