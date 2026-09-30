-- 필수 안내 4종(짐 규격·금지 품목·취소/환불·파손/분실 보상) 게시와 쿠폰 할인.
-- 사업 규칙 기준: docs/06-booking-payments-settlement.md "운영 규칙 v1 (2026-10-01)".

-- 1) 필수 안내 ------------------------------------------------------------
insert into public.content_items (slug, kind, criticality, source_locale, sort_order)
values
  ('bag-size-rules', 'legal', 'critical', 'ko', 10),
  ('prohibited-items', 'legal', 'critical', 'ko', 20),
  ('cancellation-refund', 'legal', 'critical', 'ko', 30),
  ('damage-compensation', 'legal', 'critical', 'ko', 40)
on conflict (slug) do update set kind = 'legal', criticality = 'critical';

create temporary table policy_text (slug text, locale text, title text, body text) on commit drop;
insert into policy_text values
('bag-size-rules', 'ko', '짐 규격·수량 안내', $t$시행일 2026-10-01 · 버전 1

1. 보통 짐: 가로·세로·높이 합 158cm 이하(약 28인치 이하), 23kg 이하
2. 대형 짐: 가로·세로·높이 합 203cm 이하(29~32인치), 32kg 이하
3. 한 예약에 최대 8개까지 맡길 수 있습니다. 더 많으면 예약을 나눠 주세요.
4. 32kg 또는 203cm를 넘는 짐, 골프백·자전거·유모차·서핑보드 같은 특수 짐은 온라인 예약이 되지 않습니다. 고객지원으로 먼저 문의해 주세요.
5. 모든 짐은 닫히고 잠긴 상태로 맡겨 주세요. 깨지기 쉬운 물건은 직접 완충 포장해 주세요. 쇼핑백·종이상자는 테이프로 밀봉한 경우에만 짐 1개로 받습니다.
6. 인수할 때 예약과 규격이 다르면 차액을 결제한 뒤 맡기거나, 해당 짐의 인수를 거절하고 그 짐 요금을 환불합니다.
7. 짐마다 붙인 태그는 떼지 마세요. 인계할 때 태그로 짐을 하나씩 확인합니다.$t$),
('bag-size-rules', 'zh-CN', '行李规格与数量', $t$生效日期 2026-10-01 · 第1版

1. 普通行李：长宽高之和 158cm 以内（约 28 寸以内），23kg 以下
2. 大件行李：长宽高之和 203cm 以内（29~32 寸），32kg 以下
3. 每笔预约最多 8 件。超过请分开预约。
4. 超过 32kg 或 203cm 的行李，以及高尔夫球包、自行车、婴儿车、冲浪板等特殊行李无法在线预约，请先联系客服。
5. 所有行李请拉好拉链并上锁。易碎物品请自行做好缓冲包装。购物袋、纸箱须用胶带封好，才可按 1 件行李接收。
6. 交接时如规格与预约不符，可补差价后寄存；或拒收该件行李并退还该件费用。
7. 请勿撕下行李标签，交付时将按标签逐件核对。$t$),
('bag-size-rules', 'en', 'Bag size and quantity', $t$Effective 2026-10-01 · Version 1

1. Standard bag: length + width + height up to 158 cm (about 28 inches), up to 23 kg
2. Large bag: up to 203 cm in total (29–32 inches), up to 32 kg
3. Up to 8 bags per booking. Please make separate bookings for more.
4. Bags over 32 kg or 203 cm, and special items such as golf bags, bicycles, strollers or surfboards, cannot be booked online. Please contact support first.
5. Close and lock every bag. Pack fragile items with your own padding. Shopping bags and boxes count as one bag only when sealed with tape.
6. If a bag differs from the booked size at handover, pay the difference to proceed, or we decline that bag and refund its price.
7. Do not remove the tags attached to each bag. We check every bag by its tag at handover.$t$),

('prohibited-items', 'ko', '맡길 수 없는 물품', $t$시행일 2026-10-01 · 버전 1

1. 반드시 직접 가지고 다니세요: 현금·수표·상품권, 귀금속·보석, 여권·신분증·항공권, 노트북·태블릿·카메라 같은 고가 전자기기, 복용 중인 의약품
2. 운송 금지: 가스·부탄·라이터 연료 등 인화성·폭발성 물질, 보조배터리·리튬배터리 단품, 무기·도검, 독극물·화학약품, 마약 등 불법 물품, 살아 있는 동식물, 냉장·냉동 식품과 상하기 쉬운 음식, 액체가 샐 수 있는 물품
3. 직원은 짐 겉모습만 확인하고 내용물을 열지 않습니다. 안전이 의심되면 고객 동의를 받아 확인합니다.
4. 금지 물품이 발견되면 인수를 거절하거나 운송을 중단하고, 필요한 경우 관계 기관에 알립니다.
5. 1번·2번 물품을 넣어 생긴 분실·파손·손해는 보상하지 않습니다.$t$),
('prohibited-items', 'zh-CN', '禁止寄存物品', $t$生效日期 2026-10-01 · 第1版

1. 请务必随身携带：现金、支票、礼品卡，贵金属与珠宝，护照、身份证件、机票，笔记本电脑、平板、相机等贵重电子产品，正在服用的药品
2. 禁止运送：燃气、丁烷、打火机燃料等易燃易爆物品，单独的充电宝或锂电池，武器与刀具，有毒物质与化学品，毒品等违法物品，活体动植物，冷藏冷冻及易腐食品，可能漏液的物品
3. 工作人员只检查行李外观，不开箱。如对安全有疑问，会在征得顾客同意后检查。
4. 发现禁止物品时，我们将拒收或中止运送，必要时通知有关机关。
5. 因放入第 1、2 项物品造成的丢失、损坏或损失不予赔偿。$t$),
('prohibited-items', 'en', 'Items we cannot carry', $t$Effective 2026-10-01 · Version 1

1. Always keep with you: cash, cheques and gift cards, precious metals and jewellery, passports, ID and flight tickets, valuable electronics such as laptops, tablets and cameras, and any medicine you are taking
2. Not allowed: flammable or explosive items such as gas, butane or lighter fuel, loose power banks or lithium batteries, weapons and blades, poisons and chemicals, illegal items including drugs, live animals or plants, chilled, frozen or perishable food, and anything that may leak
3. Staff check only the outside of bags and never open them. If safety is in doubt, we check with your consent.
4. If a prohibited item is found, we decline the bag or stop the delivery and may notify the authorities.
5. We do not compensate loss, damage or harm caused by items in sections 1 or 2.$t$),

('cancellation-refund', 'ko', '취소·환불 규정', $t$시행일 2026-10-01 · 버전 1

1. 예약 마감(수거일 전날 20:00, 한국 시간) 전에 취소하면 수수료 없이 전액 환불합니다. 마감 시각은 예약증에 표시됩니다.
2. 예약 마감 후부터 짐 수거 전까지는 온라인 취소가 되지 않습니다. 고객지원으로 요청하면 요금의 50%를 환불합니다.
3. 짐을 수거한 뒤에는 취소·환불할 수 없습니다.
4. 기사가 약속한 수거 시간 안에 도착한 뒤 30분 동안 연락이 되지 않거나 짐이 준비되지 않으면 이용하지 않은 것으로 처리하며 환불하지 않습니다.
5. 차량 고장·기상 악화 등 회사 사정으로 서비스를 제공하지 못하면 전액 환불하고 대안을 안내합니다.
6. 약속한 인계 시간보다 60분 이상 늦게 전달하면 요금의 50%를 환불합니다.
7. 환불은 결제한 수단으로 돌려드리며, 결제사에 따라 3~7영업일이 걸릴 수 있습니다.
8. 짐 수량 변경은 예약 마감 전에 고객지원으로 요청해 주세요.$t$),
('cancellation-refund', 'zh-CN', '取消与退款规定', $t$生效日期 2026-10-01 · 第1版

1. 在预约截止时间（取件日前一天 20:00，韩国时间）前取消，全额退款，不收手续费。截止时间显示在预约凭证上。
2. 预约截止后至取件前无法在线取消。通过客服申请可退还 50% 费用。
3. 行李取件后不可取消或退款。
4. 司机在约定取件时间内到达后，30 分钟内无法联系到顾客或行李未准备好，视为未使用，不予退款。
5. 因车辆故障、恶劣天气等公司原因无法提供服务时，全额退款并提供替代方案。
6. 如比约定交付时间晚 60 分钟以上送达，退还 50% 费用。
7. 退款将原路退回，视支付机构需要 3~7 个工作日。
8. 如需修改行李数量，请在预约截止前联系客服。$t$),
('cancellation-refund', 'en', 'Cancellation and refunds', $t$Effective 2026-10-01 · Version 1

1. Cancel before the booking cutoff (8:00 pm Korea time the day before pickup) for a full refund with no fee. The cutoff is shown on your voucher.
2. From the cutoff until pickup, online cancellation is closed. Ask support and we refund 50% of the price.
3. Once your bags are picked up, the booking cannot be cancelled or refunded.
4. If the driver arrives within the pickup window and cannot reach you or your bags are not ready for 30 minutes, the booking counts as used and is not refunded.
5. If we cannot provide the service for our own reasons, such as a vehicle breakdown or severe weather, you get a full refund and an alternative.
6. If we deliver more than 60 minutes after the promised handoff time, we refund 50% of the price.
7. Refunds go back to your original payment method and may take 3–7 business days depending on the provider.
8. To change the number of bags, contact support before the booking cutoff.$t$),

('damage-compensation', 'ko', '파손·분실 보상 기준', $t$시행일 2026-10-01 · 버전 1

1. 짐을 맡긴 때부터 인계할 때까지 회사 책임으로 생긴 파손·분실을 보상합니다. 짐마다 인수·인계 사진을 기록합니다.
2. 보상 한도는 짐 1개당 50만 원입니다.
3. 분실: 구매 증빙을 기준으로 사용 기간을 반영한 현재 가치를 한도 안에서 보상합니다. 증빙이 없으면 한도 안에서 협의합니다.
4. 파손: 수리비를 보상하고, 수리할 수 없으면 현재 가치를 한도 안에서 보상합니다.
5. 겉면 파손은 짐을 받을 때 현장에서 알려 주세요. 내용물 파손·분실은 받은 날부터 7일 안에 고객지원으로 신고해 주세요.
6. 회사가 늦게 인계해 항공편을 놓친 경우, 실제로 낸 항공권 변경 수수료를 1명당 20만 원까지 보상합니다.
7. 보상하지 않는 경우: 금지 물품, 포장 불량으로 생긴 파손, 인수 사진에 이미 있던 손상, 바퀴·손잡이 등의 가벼운 긁힘과 자연 마모, 천재지변
8. 신고 후 5영업일 안에 1차 안내, 14일 안에 결과를 알려 드립니다. 보상은 결제 환불과 별도로 처리합니다.$t$),
('damage-compensation', 'zh-CN', '损坏与丢失赔偿标准', $t$生效日期 2026-10-01 · 第1版

1. 自接收行李起至交付为止，因公司责任造成的损坏或丢失予以赔偿。每件行李在交接时都会拍照记录。
2. 赔偿上限为每件行李 50 万韩元。
3. 丢失：以购买凭证为准，按使用年限折算现值，在上限内赔偿。无凭证时在上限内协商。
4. 损坏：赔偿维修费用；无法维修时，按现值在上限内赔偿。
5. 外观损坏请在取件时当场告知。内部物品损坏或丢失请在取件后 7 天内联系客服。
6. 因公司延误交付导致误机的，实际产生的机票改签费用每人最高赔偿 20 万韩元。
7. 不予赔偿：禁止物品，包装不当造成的损坏，交接照片中已有的损伤，轮子、把手等的轻微划痕和自然磨损，不可抗力
8. 申报后 5 个工作日内初步答复，14 天内告知结果。赔偿与付款退款分开处理。$t$),
('damage-compensation', 'en', 'Damage and loss compensation', $t$Effective 2026-10-01 · Version 1

1. We compensate damage or loss caused by us from the moment we receive your bags until handoff. Each bag is photographed at every handover.
2. Compensation is limited to KRW 500,000 per bag.
3. Loss: we pay the current value based on proof of purchase, adjusted for age, within the limit. Without proof, we agree an amount within the limit.
4. Damage: we pay the repair cost, or the current value within the limit if it cannot be repaired.
5. Report visible damage on the spot when you collect your bags. Report damage or loss of contents to support within 7 days of collection.
6. If our late handoff makes you miss your flight, we reimburse the change fee you actually paid, up to KRW 200,000 per person.
7. Not covered: prohibited items, damage from poor packing, damage already visible in handover photos, light scratches or wear on wheels and handles, and natural disasters
8. We reply within 5 business days and give a decision within 14 days. Compensation is handled separately from payment refunds.$t$);

-- 원문(한국어)을 먼저 게시해 원문 버전을 확정한 뒤 번역을 같은 버전 기준으로 게시한다.
insert into public.content_translations (content_id, locale, title, body, status, published_at, needs_review, based_on_version)
select ci.id, p.locale, p.title, p.body, 'published', now(), false, ci.source_version
  from policy_text p join public.content_items ci on ci.slug = p.slug
 where p.locale = 'ko'
on conflict (content_id, locale) do update
  set title = excluded.title, body = excluded.body, status = 'published', published_at = now(), needs_review = false;

insert into public.content_translations (content_id, locale, title, body, status, published_at, needs_review, based_on_version)
select ci.id, p.locale, p.title, p.body, 'published', now(), false, ci.source_version
  from policy_text p join public.content_items ci on ci.slug = p.slug
 where p.locale <> 'ko'
on conflict (content_id, locale) do update
  set title = excluded.title, body = excluded.body, status = 'published', published_at = now(),
      needs_review = false, based_on_version = excluded.based_on_version;

update public.booking_settings
   set required_policy_slugs = array['bag-size-rules', 'prohibited-items', 'cancellation-refund', 'damage-compensation'];

-- 2) 쿠폰 --------------------------------------------------------------------
-- 규칙: 견적당 쿠폰 1개, 호텔 제휴 코드는 수수료 귀속 전용(할인 없음), 할인 후 최소 결제 금액 유지,
-- 부가세는 할인 후 금액 기준, 1인 사용 횟수·전체 한도는 취소·만료되지 않은 주문 기준으로 센다.
alter table public.booking_settings
  add column if not exists min_charge_minor integer not null default 1000 check (min_charge_minor >= 0);

create table public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9]{4,20}$'),
  kind text not null check (kind in ('percent', 'fixed')),
  value integer not null check (value > 0),
  max_discount_minor integer check (max_discount_minor > 0),
  min_subtotal_minor integer not null default 0 check (min_subtotal_minor >= 0),
  route_types public.route_type[],
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  total_limit integer check (total_limit > 0),
  per_user_limit integer not null default 1 check (per_user_limit > 0),
  status text not null default 'active' check (status in ('active', 'paused', 'archived')),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint coupons_percent_range check (kind <> 'percent' or value <= 100),
  constraint coupons_window check (ends_at is null or ends_at > starts_at)
);

create trigger coupons_set_updated_at before update on public.coupons
  for each row execute function public.set_updated_at();

alter table public.coupons enable row level security;
revoke all on public.coupons from anon, authenticated;
grant select, insert, update on public.coupons to authenticated;
create policy coupons_staff_select on public.coupons for select to authenticated
  using ((select public.has_role('admin')) or (select public.has_role('finance')));
create policy coupons_admin_insert on public.coupons for insert to authenticated
  with check ((select public.has_role('admin')));
create policy coupons_admin_update on public.coupons for update to authenticated
  using ((select public.has_role('admin'))) with check ((select public.has_role('admin')));

alter table public.quotes add column if not exists coupon_id uuid references public.coupons (id) on delete restrict;

create or replace function public.apply_quote_coupon(p_quote_id uuid, p_code text)
returns public.quotes
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_quote public.quotes;
  v_coupon public.coupons;
  v_settings public.booking_settings;
  v_code text := nullif(upper(regexp_replace(coalesce(p_code, ''), '\s', '', 'g')), '');
  v_discount bigint := 0;
  v_total bigint;
  v_supply bigint;
  v_used integer;
begin
  if v_uid is null then
    perform public.luggage_error('SESSION_REQUIRED');
  end if;
  select * into v_quote from public.quotes where id = p_quote_id and owner_id = v_uid for update;
  if not found then
    perform public.luggage_error('QUOTE_NOT_FOUND');
  end if;
  if v_quote.expires_at <= now() then
    perform public.luggage_error('QUOTE_EXPIRED');
  end if;
  if exists (select 1 from public.orders where quote_id = v_quote.id) then
    perform public.luggage_error('QUOTE_ALREADY_ORDERED');
  end if;
  select * into v_settings from public.booking_settings;

  if v_code is not null then
    select * into v_coupon from public.coupons
     where code = v_code and status = 'active' and starts_at <= now() and (ends_at is null or ends_at > now());
    if not found then
      perform public.luggage_error('COUPON_INVALID');
    end if;
    if (v_coupon.route_types is not null and not (v_quote.route_type = any (v_coupon.route_types)))
       or v_quote.subtotal_minor < v_coupon.min_subtotal_minor then
      perform public.luggage_error('COUPON_NOT_APPLICABLE');
    end if;
    select count(*) into v_used from public.orders o join public.quotes q on q.id = o.quote_id
     where q.coupon_id = v_coupon.id and o.owner_id = v_uid and o.reservation_status not in ('cancelled', 'expired');
    if v_used >= v_coupon.per_user_limit then
      perform public.luggage_error('COUPON_LIMIT_REACHED');
    end if;
    if v_coupon.total_limit is not null then
      select count(*) into v_used from public.orders o join public.quotes q on q.id = o.quote_id
       where q.coupon_id = v_coupon.id and o.reservation_status not in ('cancelled', 'expired');
      if v_used >= v_coupon.total_limit then
        perform public.luggage_error('COUPON_LIMIT_REACHED');
      end if;
    end if;

    v_discount := case when v_coupon.kind = 'percent'
      then (v_quote.subtotal_minor::bigint * v_coupon.value) / 100
      else v_coupon.value end;
    if v_coupon.max_discount_minor is not null then
      v_discount := least(v_discount, v_coupon.max_discount_minor);
    end if;
    v_discount := least(v_discount, greatest(v_quote.subtotal_minor - v_settings.min_charge_minor, 0));
    if v_discount <= 0 then
      perform public.luggage_error('COUPON_NOT_APPLICABLE');
    end if;
  end if;

  v_total := v_quote.subtotal_minor - v_discount;
  v_supply := (v_total * 10000 * 2 + (10000 + v_settings.vat_rate_bp)) / ((10000 + v_settings.vat_rate_bp) * 2);
  update public.quotes
     set coupon_id = case when v_code is null then null else v_coupon.id end,
         discount_minor = v_discount,
         total_minor = v_total,
         tax_minor = v_total - v_supply
   where id = v_quote.id
  returning * into v_quote;
  return v_quote;
end;
$$;

revoke execute on function public.apply_quote_coupon(uuid, text) from public, anon;
grant execute on function public.apply_quote_coupon(uuid, text) to authenticated, service_role;
