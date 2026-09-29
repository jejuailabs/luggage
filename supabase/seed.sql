-- 합성 데이터만 넣는다. 실제 고객·호텔·계약 정보를 넣지 않는다.
insert into public.feature_settings (feature, environment, mode, enabled, note) values
  ('route.hotel_to_airport', 'local', 'mock', true, 'A단계 기본 노선'),
  ('route.airport_to_hotel', 'local', 'mock', false, 'D단계 오픈 예정'),
  ('route.hotel_to_hotel', 'local', 'mock', false, 'D단계 오픈 예정'),
  ('payment', 'local', 'mock', true, 'mock PG'),
  ('notification', 'local', 'mock', true, 'mock 알림')
on conflict (feature, environment) do nothing;

-- 합성 권역·호텔·노선 (A05). 실제 제휴 호텔이 아니다.
insert into public.service_zones (code, kind, name_ko, display_names, status, sort_order) values
  ('jeju-city', 'area', '제주시', '{"zh-CN": "济州市", "en": "Jeju City"}', 'active', 10),
  ('seogwipo', 'area', '서귀포', '{"zh-CN": "西归浦", "en": "Seogwipo"}', 'active', 20),
  ('jeju-airport', 'airport', '제주국제공항', '{"zh-CN": "济州国际机场", "en": "Jeju International Airport"}', 'active', 0)
on conflict (code) do nothing;

insert into public.hotels (zone_id, slug, name_ko, address_ko, front_desk_opens_at, front_desk_closes_at, status)
select z.id, v.slug, v.name_ko, v.address_ko, '07:00', '22:00', 'active'
from (values
  ('jeju-city', 'sample-hotel-jeju-city', '예시 호텔 제주시점', '제주특별자치도 제주시 예시로 1'),
  ('seogwipo', 'sample-hotel-seogwipo', '예시 호텔 서귀포점', '제주특별자치도 서귀포시 예시로 2')
) as v(zone_code, slug, name_ko, address_ko)
join public.service_zones z on z.code = v.zone_code
on conflict (slug) do nothing;

insert into public.hotel_translations (hotel_id, locale, name, aliases)
select h.id, v.locale, v.name, v.aliases
from (values
  ('sample-hotel-jeju-city', 'zh-CN', '示例酒店 济州市店', array['示例酒店', '济州示例']),
  ('sample-hotel-jeju-city', 'en', 'Sample Hotel Jeju City', array['Sample Hotel']),
  ('sample-hotel-seogwipo', 'zh-CN', '示例酒店 西归浦店', array['示例酒店'])
) as v(slug, locale, name, aliases)
join public.hotels h on h.slug = v.slug
on conflict (hotel_id, locale) do nothing;

insert into public.route_offerings (route_type, origin_zone_id, destination_zone_id, enabled)
select v.route_type::public.route_type, o.id, d.id, v.enabled
from (values
  ('hotel_to_airport', 'jeju-city', 'jeju-airport', true),
  ('hotel_to_airport', 'seogwipo', 'jeju-airport', true),
  ('airport_to_hotel', 'jeju-airport', 'jeju-city', true),
  ('airport_to_hotel', 'jeju-airport', 'seogwipo', true),
  ('hotel_to_hotel', 'jeju-city', 'seogwipo', true),
  ('hotel_to_hotel', 'seogwipo', 'jeju-city', true)
) as v(route_type, origin, destination, enabled)
join public.service_zones o on o.code = v.origin
join public.service_zones d on d.code = v.destination
on conflict (route_type, origin_zone_id, destination_zone_id) do nothing;

-- 합성 요금·슬롯 (B01·B02). 금액과 시간은 개발용 예시이며 실제 판매 요금이 아니다.
insert into public.price_rules (route_offering_id, bag_size, unit_amount_minor, valid_from)
select r.id, v.size::public.bag_size, v.amount, current_date - 1
from public.route_offerings r
cross join (values ('standard', 15000), ('large', 20000)) as v(size, amount)
where not exists (select 1 from public.price_rules p where p.route_offering_id = r.id and p.bag_size = v.size::public.bag_size);

-- 오늘부터 14일간 (한국 시간). 숙소→공항 하루 2회, 공항→숙소·숙소→숙소 하루 1회
insert into public.service_slots (
  route_offering_id, service_date, pickup_starts_at, pickup_ends_at, delivery_starts_at, delivery_ends_at, booking_cutoff_at
)
select r.id, d::date,
       (d::date + w.pickup_start) at time zone 'Asia/Seoul',
       (d::date + w.pickup_end) at time zone 'Asia/Seoul',
       (d::date + w.delivery_start) at time zone 'Asia/Seoul',
       (d::date + w.delivery_end) at time zone 'Asia/Seoul',
       (d::date - 1 + time '20:00') at time zone 'Asia/Seoul'
from public.route_offerings r
cross join generate_series(current_date, current_date + 13, interval '1 day') as d
join (values
  ('hotel_to_airport', time '09:00', time '11:00', time '14:00', time '16:00'),
  ('hotel_to_airport', time '12:00', time '14:00', time '17:00', time '19:00'),
  ('airport_to_hotel', time '10:00', time '13:00', time '15:00', time '18:00'),
  ('hotel_to_hotel', time '10:00', time '12:00', time '15:00', time '18:00')
) as w(route_type, pickup_start, pickup_end, delivery_start, delivery_end) on w.route_type = r.route_type::text
on conflict (route_offering_id, pickup_starts_at, delivery_ends_at) do nothing;

insert into public.capacity_buckets (slot_id, max_units)
select s.id, 20 from public.service_slots s
on conflict (slot_id) do nothing;

-- 합성 제휴 (D02). 계약 번호·실제 수수료가 아니다.
insert into public.hotel_partners (name, status, contract_reference)
select '예시 제휴사', 'active', null
where not exists (select 1 from public.hotel_partners where name = '예시 제휴사');

update public.hotels set partner_id = (select id from public.hotel_partners where name = '예시 제휴사')
 where slug = 'sample-hotel-jeju-city' and partner_id is null;

insert into public.partner_codes (code, partner_id, hotel_id, valid_from)
select 'SAMPLE01', p.id, h.id, current_date - 1
from public.hotel_partners p join public.hotels h on h.slug = 'sample-hotel-jeju-city'
where p.name = '예시 제휴사'
on conflict (code) do nothing;

insert into public.commission_rules (partner_id, kind, rate_bp, valid_from)
select p.id, 'percent_of_total', 1000, current_date - 30
from public.hotel_partners p
where p.name = '예시 제휴사'
  and not exists (select 1 from public.commission_rules r where r.partner_id = p.id);
