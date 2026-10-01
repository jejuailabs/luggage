-- 공개 안내(상황별 가이드 4종·공항 수령 안내)와 FAQ 13개를 ko/zh-CN/en으로 게시한다. '[예시]' 표시 없는 운영 문구 v1.
-- 문구 기준: docs/06 8-1절 운영 규칙 v1. 공항 인계 장소 운영 시간 열을 추가한다.

alter table public.handoff_locations add column if not exists opening_hours text check (opening_hours is null or char_length(opening_hours) <= 60);
comment on column public.handoff_locations.opening_hours is '고객에게 보여 줄 운영 시간 (예: 08:00–21:00, 한국 시간)';

insert into public.content_items (slug, kind, criticality, source_locale, sort_order, related_route)
select v.slug, v.kind::public.content_kind, v.criticality::public.content_criticality, v.source_locale, v.sort_order, v.related_route::public.route_type
from (values
  ('checkout-day', 'guide', 'general', 'ko', 1, 'hotel_to_airport'),
  ('arrival-day', 'guide', 'general', 'ko', 2, 'airport_to_hotel'),
  ('hotel-move', 'guide', 'general', 'ko', 3, 'hotel_to_hotel'),
  ('how-it-works', 'guide', 'general', 'ko', 10, NULL),
  ('airport-pickup-point', 'guide', 'general', 'ko', 20, NULL),
  ('faq-no-korean-phone', 'faq', 'general', 'ko', 10, NULL),
  ('faq-price', 'faq', 'general', 'ko', 11, NULL),
  ('faq-booking-cutoff', 'faq', 'general', 'ko', 12, NULL),
  ('faq-flight-timing', 'faq', 'general', 'ko', 13, NULL),
  ('faq-airport-pickup', 'faq', 'general', 'ko', 14, NULL),
  ('faq-bag-limits', 'faq', 'general', 'ko', 15, NULL),
  ('faq-valuables', 'faq', 'general', 'ko', 16, NULL),
  ('faq-tracking', 'faq', 'general', 'ko', 17, NULL),
  ('faq-hotel-not-listed', 'faq', 'general', 'ko', 18, NULL),
  ('faq-cancel', 'faq', 'general', 'ko', 19, NULL),
  ('faq-delay-damage', 'faq', 'general', 'ko', 20, NULL),
  ('faq-payment', 'faq', 'general', 'ko', 21, NULL),
  ('faq-other-device', 'faq', 'general', 'ko', 22, NULL)
) as v(slug, kind, criticality, source_locale, sort_order, related_route)
on conflict (slug) do update set kind = excluded.kind, sort_order = excluded.sort_order, related_route = excluded.related_route;

create temporary table public_text (slug text, locale text, title text, body text) on commit drop;
insert into public_text values
  ('checkout-day', 'ko', $t$체크아웃 날: 짐 맡기고 비행기 타기 전까지 가볍게$t$, $t$체크아웃할 때 숙소 프런트에 짐을 맡기면 약속한 시간에 제주공항으로 보내 드려요.
오후 내내 짐 없이 관광하고, 공항 인계 장소에서 수령 코드를 보여 주고 짐을 받으세요.
항공편 출발 2시간 전까지 공항에서 받을 수 있는 시간대만 예약돼요.$t$),
  ('checkout-day', 'zh-CN', $t$退房当天：寄存行李，轻松玩到登机前$t$, $t$退房时把行李交给住宿前台，我们会在约定时间送到济州机场。
整个下午无需拖着行李游玩，到机场交付地点出示取件码即可取回。
只能预约在航班起飞 2 小时前于机场取回的时段。$t$),
  ('checkout-day', 'en', $t$Checkout day: drop your bags and explore until your flight$t$, $t$Leave your bags at the front desk when you check out, and we deliver them to Jeju Airport at the agreed time.
Spend the afternoon bag-free, then show your handoff code at the airport point to collect them.
Only windows that let you collect at least 2 hours before departure can be booked.$t$),
  ('arrival-day', 'ko', $t$제주 도착 직후: 짐은 숙소로, 여행은 바로$t$, $t$공항에 도착하면 약속 장소에서 기사에게 짐을 건네세요. 짐마다 QR을 스캔하고 사진을 남겨요.
무거운 짐 없이 바로 여행을 시작하고, 체크인할 때 숙소 프런트에서 예약증 QR을 보여 주면 짐을 받을 수 있어요.$t$),
  ('arrival-day', 'zh-CN', $t$刚到济州：行李送去住宿，旅程马上开始$t$, $t$抵达机场后，在约定地点把行李交给司机，每件行李都会扫码并拍照记录。
无需拖着行李即可开始旅程，入住时在住宿前台出示预约凭证二维码即可领取。$t$),
  ('arrival-day', 'en', $t$Just landed: send your bags to the hotel and start exploring$t$, $t$After landing, hand your bags to the driver at the meeting point. Each bag is scanned and photographed.
Start exploring right away, then show your voucher QR at your stay's front desk when you check in to collect them.$t$),
  ('hotel-move', 'ko', $t$숙소 이동: 짐은 다음 숙소로$t$, $t$체크아웃할 때 지금 숙소 프런트에 짐을 맡기면 같은 날 다음 숙소 프런트로 옮겨 드려요.
이동하는 날에도 짐 걱정 없이 관광하고, 다음 숙소 체크인 때 예약증 QR로 짐을 받으세요.$t$),
  ('hotel-move', 'zh-CN', $t$更换住宿：行李直接送到下一家$t$, $t$退房时把行李交给当前住宿前台，我们会在当天送到下一家住宿前台。
换住宿的日子也能轻松游玩，入住下一家时出示预约凭证二维码即可领取。$t$),
  ('hotel-move', 'en', $t$Changing hotels: we move your bags$t$, $t$Leave your bags at your current front desk when you check out, and we move them to your next stay the same day.
Explore freely on moving day, then collect them with your voucher QR when you check in.$t$),
  ('how-it-works', 'ko', $t$이용 방법$t$, $t$1. 숙소·날짜·짐 수량을 넣고 온라인으로 예약·결제
2. 숙소 프런트나 공항 약속 장소에서 예약증을 보여 주고 짐 맡기기
3. 기사가 짐마다 QR을 스캔하고 사진을 남긴 뒤 수거
4. 배송 차량 위치와 단계별 알림 확인
5. 약속한 장소에서 수령 코드나 예약증 QR로 짐 받기$t$),
  ('how-it-works', 'zh-CN', $t$服务流程$t$, $t$1. 填写住宿、日期和行李数量，在线预约并付款
2. 在住宿前台或机场约定地点出示预约凭证寄存行李
3. 司机逐件扫码拍照后取件
4. 查看配送车辆位置和各阶段通知
5. 在约定地点凭取件码或预约凭证二维码取回行李$t$),
  ('how-it-works', 'en', $t$How it works$t$, $t$1. Enter your stay, date and number of bags, then book and pay online
2. Show your voucher and hand over your bags at the front desk or airport meeting point
3. The driver scans and photographs each bag before pickup
4. Follow the delivery vehicle and stage-by-stage alerts
5. Collect your bags at the agreed point with your handoff code or voucher QR$t$),
  ('airport-pickup-point', 'ko', $t$공항 수령 장소$t$, $t$공항 인계 장소와 운영 시간은 홈 화면 지도와 예약증에 표시돼요.
장소가 바뀌면 영향을 받는 예약에 알림을 보내 드려요.
도착하면 수령 코드를 기사에게 보여 주세요. 짐 태그를 하나씩 확인한 뒤 돌려 드려요.$t$),
  ('airport-pickup-point', 'zh-CN', $t$机场取件地点$t$, $t$机场交付地点和服务时间显示在首页地图和预约凭证上。
地点如有变更，我们会通知受影响的预约。
到达后请向司机出示取件码，逐件核对行李标签后交还。$t$),
  ('airport-pickup-point', 'en', $t$Airport pickup point$t$, $t$The airport handoff point and its hours are shown on the home page map and on your voucher.
If the point changes, we notify every affected booking.
When you arrive, show your handoff code to the driver. We check each bag tag before handing them back.$t$),
  ('faq-no-korean-phone', 'ko', $t$한국 전화번호 없이 예약할 수 있나요?$t$, $t$네. 이메일이나 위챗 ID만 있으면 예약할 수 있어요. 예약 확인과 진행 알림도 위챗·이메일로 받아요.$t$),
  ('faq-no-korean-phone', 'zh-CN', $t$没有韩国手机号可以预约吗？$t$, $t$可以。只需邮箱或微信号即可预约，预约确认和进度通知也通过微信或邮件发送。$t$),
  ('faq-no-korean-phone', 'en', $t$Can I book without a Korean phone number?$t$, $t$Yes. An email address or WeChat ID is enough. Confirmations and updates arrive by WeChat or email.$t$),
  ('faq-price', 'ko', $t$요금은 얼마인가요?$t$, $t$짐 1개 기준으로 노선마다 보통 짐·대형 짐 요금이 정해져 있어요. 기본 요금은 홈과 예약 화면에 표시되고, 날짜와 짐 수량을 넣으면 서버가 최종 금액(부가세 포함)을 계산해 결제 전에 보여 드려요.$t$),
  ('faq-price', 'zh-CN', $t$费用是多少？$t$, $t$按每件行李计费，各路线分别设有普通行李和大件行李价格。基本价格显示在首页和预约页面，填写日期和数量后，服务器会在付款前计算并显示最终金额（含增值税）。$t$),
  ('faq-price', 'en', $t$How much does it cost?$t$, $t$Each route has a per-bag price for standard and large bags. Base prices are shown on the home and booking pages, and the server calculates your final total (VAT included) before you pay.$t$),
  ('faq-booking-cutoff', 'ko', $t$언제까지 예약해야 하나요?$t$, $t$수거일 전날 20:00(한국 시간)까지 예약할 수 있어요. 남은 자리가 있는 시간대만 보여 드려요.$t$),
  ('faq-booking-cutoff', 'zh-CN', $t$最晚什么时候预约？$t$, $t$最晚可在取件日前一天 20:00（韩国时间）前预约，只显示还有名额的时段。$t$),
  ('faq-booking-cutoff', 'en', $t$How late can I book?$t$, $t$You can book until 8:00 pm Korea time the day before pickup. Only time windows with space left are shown.$t$),
  ('faq-flight-timing', 'ko', $t$비행기 시간에 맞출 수 있나요?$t$, $t$항공편 출발 시각을 넣으면 출발 2시간 전까지 공항에서 짐을 받을 수 있는 시간대만 예약돼요. 공항→숙소는 도착 시각을 기준으로 공항 수거 시간을 정해요.$t$),
  ('faq-flight-timing', 'zh-CN', $t$能配合航班时间吗？$t$, $t$填写航班起飞时间后，只能预约在起飞 2 小时前于机场取回行李的时段。机场→住宿则按抵达时间安排机场取件。$t$),
  ('faq-flight-timing', 'en', $t$Will it fit my flight?$t$, $t$Enter your departure time and only windows that let you collect your bags at the airport at least 2 hours before departure can be booked. For airport-to-stay, pickup is planned around your arrival time.$t$),
  ('faq-airport-pickup', 'ko', $t$공항 어디에서 짐을 받나요?$t$, $t$공항 인계 장소와 운영 시간은 홈 화면 지도와 예약증에 표시되고, 출발 전날 알림으로 다시 안내해요. 수령 코드를 보여 주면 짐 태그를 하나씩 확인해 돌려 드려요.$t$),
  ('faq-airport-pickup', 'zh-CN', $t$在机场哪里取行李？$t$, $t$机场交付地点和服务时间显示在首页地图和预约凭证上，出发前一天还会再次通知。出示取件码后，我们逐件核对标签交还行李。$t$),
  ('faq-airport-pickup', 'en', $t$Where do I collect my bags at the airport?$t$, $t$The handoff point and its hours are on the home page map and your voucher, and we remind you the day before. Show your handoff code and we check each bag tag before handing them over.$t$),
  ('faq-bag-limits', 'ko', $t$어떤 짐을 몇 개까지 맡길 수 있나요?$t$, $t$보통 짐은 세 변 합 158cm·23kg 이하, 대형 짐은 203cm·32kg 이하예요. 예약 1건에 최대 8개까지 맡길 수 있어요. 골프백·자전거·유모차 같은 특수 짐은 고객지원으로 먼저 문의해 주세요.$t$),
  ('faq-bag-limits', 'zh-CN', $t$可以寄存什么行李、最多几件？$t$, $t$普通行李长宽高之和 158cm、23kg 以内，大件行李 203cm、32kg 以内。每笔预约最多 8 件。高尔夫球包、自行车、婴儿车等特殊行李请先联系客服。$t$),
  ('faq-bag-limits', 'en', $t$What bags can I send, and how many?$t$, $t$Standard bags up to 158 cm (L+W+H) and 23 kg, large bags up to 203 cm and 32 kg, and up to 8 bags per booking. Contact support first for golf bags, bicycles, strollers and other special items.$t$),
  ('faq-valuables', 'ko', $t$귀중품도 맡겨도 되나요?$t$, $t$아니요. 현금·여권·노트북·카메라·복용 중인 약은 직접 가지고 다니세요. 위험물·음식·살아 있는 동식물은 맡길 수 없어요. 자세한 내용은 ‘맡길 수 없는 물품’ 안내를 확인해 주세요.$t$),
  ('faq-valuables', 'zh-CN', $t$贵重物品可以寄存吗？$t$, $t$不可以。现金、护照、笔记本电脑、相机和正在服用的药品请随身携带。危险品、食品和活体动植物不能寄存，详情请查看“禁止寄存物品”。$t$),
  ('faq-valuables', 'en', $t$Can I send valuables?$t$, $t$No. Keep cash, passports, laptops, cameras and any medicine with you. Hazardous items, food and live animals or plants cannot be carried. See “Items we cannot carry” for details.$t$),
  ('faq-tracking', 'ko', $t$짐이 어디 있는지 알 수 있나요?$t$, $t$짐마다 태그 QR을 스캔해 맡김·수거·이동·인계 단계가 기록되고, 이동 중에는 배송 차량의 최근 위치를 지도에서 볼 수 있어요. 짐 자체에 GPS가 달린 것은 아니에요.$t$),
  ('faq-tracking', 'zh-CN', $t$能知道行李在哪里吗？$t$, $t$每件行李的标签二维码都会被扫描，记录寄存、取件、运送、交付各阶段；运送途中可在地图上查看配送车辆的最近位置。行李本身没有 GPS。$t$),
  ('faq-tracking', 'en', $t$Can I see where my bags are?$t$, $t$Each bag tag is scanned at drop-off, pickup, transit and handoff, and while in transit you can see the delivery vehicle's latest position on a map. The bags themselves do not carry GPS.$t$),
  ('faq-hotel-not-listed', 'ko', $t$제 숙소가 목록에 없어요.$t$, $t$‘제휴’ 표시가 있는 숙소는 바로 예약할 수 있어요. 목록에 없는 숙소도 이름을 입력해 견적을 요청하면 이용 가능 여부와 요금을 안내해 드려요.$t$),
  ('faq-hotel-not-listed', 'zh-CN', $t$我的住宿不在列表里。$t$, $t$带“合作”标记的住宿可直接预约。不在列表中的住宿，输入名称提交报价咨询后，我们会告知能否服务及价格。$t$),
  ('faq-hotel-not-listed', 'en', $t$My hotel isn't listed.$t$, $t$Stays marked “Partner” can be booked right away. For any other stay, type its name and request a quote — we'll tell you if we can serve it and the price.$t$),
  ('faq-cancel', 'ko', $t$예약을 취소할 수 있나요?$t$, $t$수거일 전날 20:00(한국 시간) 전에 취소하면 전액 환불돼요. 그 뒤부터 수거 전까지는 고객지원으로 요청하면 50%를 환불하고, 수거 후에는 취소할 수 없어요.$t$),
  ('faq-cancel', 'zh-CN', $t$可以取消预约吗？$t$, $t$取件日前一天 20:00（韩国时间）前取消可全额退款。之后至取件前通过客服申请可退 50%，取件后不可取消。$t$),
  ('faq-cancel', 'en', $t$Can I cancel?$t$, $t$Cancel before 8:00 pm Korea time the day before pickup for a full refund. After that and before pickup, support can refund 50%. Once picked up, the booking can't be cancelled.$t$),
  ('faq-delay-damage', 'ko', $t$늦거나 짐이 파손되면 어떻게 되나요?$t$, $t$약속한 인계 시간보다 60분 이상 늦으면 요금의 50%를 환불해요. 파손·분실은 짐 1개당 50만 원까지 보상하며, 겉면 파손은 받을 때 현장에서, 내용물 문제는 7일 안에 알려 주세요.$t$),
  ('faq-delay-damage', 'zh-CN', $t$延误或行李损坏怎么办？$t$, $t$比约定交付时间晚 60 分钟以上，退还 50% 费用。损坏或丢失每件最高赔偿 50 万韩元；外观损坏请在取件时当场告知，内部物品问题请在 7 天内联系我们。$t$),
  ('faq-delay-damage', 'en', $t$What if you're late or my bag is damaged?$t$, $t$If we hand over more than 60 minutes late, we refund 50%. Damage or loss is covered up to KRW 500,000 per bag — report visible damage on the spot and problems with contents within 7 days.$t$),
  ('faq-payment', 'ko', $t$어떤 결제 수단을 쓸 수 있나요?$t$, $t$위챗페이와 알리페이로 결제해요. 결제 화면이 끝나도 결제사 확인이 끝나야 예약이 확정되고, 확정되면 예약증이 발급돼요.$t$),
  ('faq-payment', 'zh-CN', $t$支持哪些付款方式？$t$, $t$支持微信支付和支付宝。支付页面完成后，还需支付机构确认，预约确认后即发放预约凭证。$t$),
  ('faq-payment', 'en', $t$How can I pay?$t$, $t$With WeChat Pay or Alipay. Your booking is confirmed — and your voucher issued — once the payment provider verifies the payment.$t$),
  ('faq-other-device', 'ko', $t$다른 휴대폰에서도 예약을 볼 수 있나요?$t$, $t$회원으로 가입하면 지금 기기에서 만든 예약이 계정에 이어져 다른 기기에서도 로그인해서 볼 수 있어요.$t$),
  ('faq-other-device', 'zh-CN', $t$换一部手机也能查看预约吗？$t$, $t$注册会员后，当前设备上的预约会关联到账号，在其他设备登录即可查看。$t$),
  ('faq-other-device', 'en', $t$Can I see my booking on another phone?$t$, $t$Sign up and the bookings made on this device are linked to your account, so you can sign in on any device to see them.$t$);

-- 원문(ko)을 먼저 게시해 원문 버전을 확정한 뒤 번역을 같은 버전 기준으로 게시한다.
insert into public.content_translations (content_id, locale, title, body, status, published_at, needs_review, based_on_version)
select ci.id, p.locale, p.title, p.body, 'published', now(), false, ci.source_version
  from public_text p join public.content_items ci on ci.slug = p.slug
 where p.locale = 'ko'
on conflict (content_id, locale) do update
  set title = excluded.title, body = excluded.body, status = 'published', published_at = now(), needs_review = false;

insert into public.content_translations (content_id, locale, title, body, status, published_at, needs_review, based_on_version)
select ci.id, p.locale, p.title, p.body, 'published', now(), false, ci.source_version
  from public_text p join public.content_items ci on ci.slug = p.slug
 where p.locale <> 'ko'
on conflict (content_id, locale) do update
  set title = excluded.title, body = excluded.body, status = 'published', published_at = now(),
      needs_review = false, based_on_version = excluded.based_on_version;
