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
  ('airport_to_hotel', 'jeju-airport', 'jeju-city', false)
) as v(route_type, origin, destination, enabled)
join public.service_zones o on o.code = v.origin
join public.service_zones d on d.code = v.destination
on conflict (route_type, origin_zone_id, destination_zone_id) do nothing;
