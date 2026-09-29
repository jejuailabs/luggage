-- D04 운영 지표 (08 문서 5절, 07 문서 10절).
-- - 거래·인계 지표는 DB 트리거가 서버 이벤트로 기록한다 (클라이언트 분석이 막혀도 유지).
-- - 분석 데이터에 이메일·전화·이름·사진 URL·정밀 위치·수령 코드·주문 접근 토큰을 넣지 않는다.
-- - 비율은 분모·기간과 함께 보여 준다.

create type public.analytics_event_type as enum (
  'landing_viewed', 'hotel_selected', 'quote_created', 'order_held', 'payment_confirmed',
  'order_cancelled', 'bag_collected', 'handoff_ready', 'bag_delivered', 'support_created'
);

create table public.analytics_events (
  id bigint generated always as identity primary key,
  event_type public.analytics_event_type not null,
  occurred_at timestamptz not null default now(),
  -- 한국 기준 날짜 (집계용)
  service_day date not null default (now() at time zone 'Asia/Seoul')::date,
  locale text check (locale in ('zh-CN', 'ko', 'en')),
  route_type public.route_type,
  hotel_id uuid,
  channel public.attribution_channel,
  campaign_code text check (campaign_code ~ '^[A-Za-z0-9_-]{1,40}$'),
  -- 비식별 참조 (주문 ID의 해시). 주문 조회 권한을 주지 않는다.
  subject_ref text,
  bag_count integer check (bag_count between 0 and 50),
  on_time boolean,
  -- 허용된 속성만 (path 등). 개인정보 키는 트리거가 넣지 않고 API가 거른다.
  props jsonb not null default '{}'::jsonb check (jsonb_typeof(props) = 'object'),
  constraint analytics_events_no_pii check (
    not (props ?| array['email', 'phone', 'name', 'wechat', 'code', 'photo', 'latitude', 'longitude', 'token'])
  )
);
create index analytics_events_day_type_idx on public.analytics_events (service_day, event_type);

alter table public.analytics_events enable row level security;
revoke all on public.analytics_events from anon, authenticated;
grant select, insert on public.analytics_events to service_role;

create or replace function public.subject_ref(p_id uuid)
returns text
language sql
immutable
set search_path = ''
as $$
  select left(encode(sha256(convert_to('subject:' || p_id::text, 'UTF8')), 'hex'), 16);
$$;

-- 서버 이벤트 기록 트리거 ------------------------------------------------------------
create or replace function public.track_quote_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.analytics_events (event_type, route_type, hotel_id, subject_ref, bag_count)
  values ('quote_created', new.route_type, coalesce(new.origin_hotel_id, new.destination_hotel_id), public.subject_ref(new.id),
          coalesce((new.bag_counts ->> 'standard')::integer, 0) + coalesce((new.bag_counts ->> 'large')::integer, 0));
  return new;
end;
$$;
create trigger quotes_track after insert on public.quotes for each row execute function public.track_quote_created();

-- 주문 홀드: 유입 귀속이 같은 트랜잭션에서 기록되므로 귀속 행 삽입 시점에 채널과 함께 남긴다.
create or replace function public.track_order_held()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
begin
  select * into v_order from public.orders where id = new.order_id;
  insert into public.analytics_events (event_type, locale, route_type, hotel_id, channel, campaign_code, subject_ref, bag_count)
  values ('order_held', v_order.locale, v_order.route_type, coalesce(v_order.origin_hotel_id, v_order.destination_hotel_id),
          new.channel, new.campaign_code, public.subject_ref(v_order.id),
          (select coalesce(sum(quantity), 0)::integer from public.order_bags where order_id = v_order.id));
  return new;
end;
$$;
create trigger order_attributions_track after insert on public.order_attributions for each row execute function public.track_order_held();

create or replace function public.track_reservation_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_channel public.attribution_channel;
  v_campaign text;
begin
  if new.reservation_status = old.reservation_status or new.reservation_status not in ('confirmed', 'cancelled') then
    return new;
  end if;
  select channel, campaign_code into v_channel, v_campaign from public.order_attributions where order_id = new.id;
  insert into public.analytics_events (event_type, locale, route_type, hotel_id, channel, campaign_code, subject_ref, props)
  values (
    case new.reservation_status when 'confirmed' then 'payment_confirmed'::public.analytics_event_type else 'order_cancelled' end,
    new.locale, new.route_type, coalesce(new.origin_hotel_id, new.destination_hotel_id), coalesce(v_channel, 'unknown'), v_campaign,
    public.subject_ref(new.id),
    case when new.reservation_status = 'confirmed' then jsonb_build_object('amount_minor', new.total_minor, 'currency', new.currency) else '{}'::jsonb end
  );
  return new;
end;
$$;
create trigger orders_track after update of reservation_status on public.orders for each row execute function public.track_reservation_change();

-- 짐 이벤트: 인계 준비 정시(약속 창 종료 전 준비)와 실제 인계 정시를 따로 기록한다.
create or replace function public.track_bag_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_slot public.service_slots;
  v_type public.analytics_event_type;
begin
  v_type := case new.event_type
    when 'collected' then 'bag_collected'::public.analytics_event_type
    when 'ready_for_handoff' then 'handoff_ready'
    when 'delivered' then 'bag_delivered'
    else null end;
  if v_type is null then
    return new;
  end if;
  select * into v_order from public.orders where id = new.order_id;
  select * into v_slot from public.service_slots where id = v_order.slot_id;
  insert into public.analytics_events (event_type, locale, route_type, hotel_id, subject_ref, bag_count, on_time)
  values (
    v_type, v_order.locale, v_order.route_type, coalesce(v_order.origin_hotel_id, v_order.destination_hotel_id),
    public.subject_ref(v_order.id), 1,
    case v_type
      when 'bag_collected' then new.server_received_at <= v_slot.pickup_ends_at
      else new.server_received_at <= v_slot.delivery_ends_at
    end
  );
  return new;
end;
$$;
create trigger bag_events_track after insert on public.bag_events for each row execute function public.track_bag_event();

create or replace function public.track_support_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_route public.route_type;
begin
  select route_type into v_route from public.orders where id = new.order_id;
  insert into public.analytics_events (event_type, locale, route_type, subject_ref)
  values ('support_created', new.locale, v_route, public.subject_ref(new.id));
  return new;
end;
$$;
create trigger support_tickets_track after insert on public.support_tickets for each row execute function public.track_support_created();

-- 공개 페이지 조회 기록 (서버 API 경유, 식별자 없음) ------------------------------------------
create or replace function public.track_public_event(
  p_event_type public.analytics_event_type,
  p_locale text,
  p_route_type public.route_type,
  p_hotel_slug text,
  p_channel public.attribution_channel,
  p_campaign text,
  p_path text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_event_type not in ('landing_viewed', 'hotel_selected') then
    perform public.luggage_error('FORBIDDEN');
  end if;
  insert into public.analytics_events (event_type, locale, route_type, hotel_id, channel, campaign_code, props)
  values (
    p_event_type,
    case when p_locale in ('zh-CN', 'ko', 'en') then p_locale end,
    p_route_type,
    (select id from public.hotels where slug = p_hotel_slug and status = 'active'),
    coalesce(p_channel, 'unknown'),
    case when p_campaign ~ '^[A-Za-z0-9_-]{1,40}$' then p_campaign end,
    jsonb_build_object('path', left(coalesce(p_path, ''), 120))
  );
end;
$$;
revoke all on function public.track_public_event(public.analytics_event_type, text, public.route_type, text, public.attribution_channel, text, text) from public;
grant execute on function public.track_public_event(public.analytics_event_type, text, public.route_type, text, public.attribution_channel, text, text)
  to anon, authenticated, service_role;

-- 운영 지표 집계 (운영·재무·admin) -------------------------------------------------------
-- 차원별 건수를 돌려준다. 비율 계산과 표본 경고는 화면에서 분모와 함께 한다.
create or replace function public.ops_metrics(p_from date, p_to date, p_dimension text default 'overall')
returns table (
  dimension_value text,
  landing_views bigint,
  quotes bigint,
  orders_held bigint,
  payments_confirmed bigint,
  cancellations bigint,
  bags_collected bigint,
  bags_collected_on_time bigint,
  handoff_ready bigint,
  handoff_ready_on_time bigint,
  bags_delivered bigint,
  bags_delivered_on_time bigint,
  support_created bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not ((select public.is_operations_staff()) or (select public.is_finance_staff())) then
    perform public.luggage_error('FORBIDDEN');
  end if;
  if p_dimension not in ('overall', 'locale', 'route_type', 'hotel', 'channel', 'campaign') then
    perform public.luggage_error('VALIDATION_FAILED');
  end if;
  return query
  select
    case p_dimension
      when 'overall' then 'all'
      when 'locale' then coalesce(e.locale, 'unknown')
      when 'route_type' then coalesce(e.route_type::text, 'unknown')
      when 'hotel' then coalesce((select h.name_ko from public.hotels h where h.id = e.hotel_id), 'unknown')
      when 'channel' then coalesce(e.channel::text, 'unknown')
      else coalesce(e.campaign_code, 'unknown')
    end as dimension_value,
    count(*) filter (where e.event_type = 'landing_viewed'),
    count(*) filter (where e.event_type = 'quote_created'),
    count(*) filter (where e.event_type = 'order_held'),
    count(*) filter (where e.event_type = 'payment_confirmed'),
    count(*) filter (where e.event_type = 'order_cancelled'),
    count(*) filter (where e.event_type = 'bag_collected'),
    count(*) filter (where e.event_type = 'bag_collected' and e.on_time),
    count(*) filter (where e.event_type = 'handoff_ready'),
    count(*) filter (where e.event_type = 'handoff_ready' and e.on_time),
    count(*) filter (where e.event_type = 'bag_delivered'),
    count(*) filter (where e.event_type = 'bag_delivered' and e.on_time),
    count(*) filter (where e.event_type = 'support_created')
  from public.analytics_events e
  where e.service_day between p_from and p_to
  group by 1
  order by 5 desc, 1;
end;
$$;
revoke all on function public.ops_metrics(date, date, text) from public;
grant execute on function public.ops_metrics(date, date, text) to authenticated, service_role;
