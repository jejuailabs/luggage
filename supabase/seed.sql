-- 합성 데이터만 넣는다. 실제 고객·호텔·계약 정보를 넣지 않는다.
insert into public.feature_settings (feature, environment, mode, enabled, note) values
  ('route.hotel_to_airport', 'local', 'mock', true, 'A단계 기본 노선'),
  ('route.airport_to_hotel', 'local', 'mock', false, 'D단계 오픈 예정'),
  ('route.hotel_to_hotel', 'local', 'mock', false, 'D단계 오픈 예정'),
  ('payment', 'local', 'mock', true, 'mock PG'),
  ('notification', 'local', 'mock', true, 'mock 알림')
on conflict (feature, environment) do nothing;
