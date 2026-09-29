-- D01 노선 확장: 공항→숙소, 숙소→숙소 (06 문서 1절, 07 문서 4절).
-- - 공항→숙소: 항공편 도착 후 공항에서 짐을 건넬 여유를 검사한다 (arrival_buffer_minutes).
-- - 숙소 도착 노선: 도착 호텔 직원이 태그를 확인해 인수(delivered)한다. 고객 수령 코드는 공항 인계에만 쓴다.

alter table public.booking_settings
  add column arrival_buffer_minutes integer not null default 60 check (arrival_buffer_minutes between 0 and 300);
comment on column public.booking_settings.arrival_buffer_minutes is '항공편 도착부터 공항 수거 창 종료까지 최소 여유(분).';

alter table public.quotes add column flight_arrives_at timestamptz;
alter table public.orders add column flight_arrives_at timestamptz;

-- 주문은 견적의 항공편 도착 시각을 그대로 가져온다 (create_order 본문 변경 없이).
create or replace function public.copy_quote_arrival()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  select q.flight_arrives_at into new.flight_arrives_at from public.quotes q where q.id = new.quote_id;
  return new;
end;
$$;

create trigger orders_copy_quote_arrival
  before insert on public.orders
  for each row execute function public.copy_quote_arrival();

-- 견적: 도착 시각 인자 추가 ------------------------------------------------------
drop function public.create_quote(uuid, uuid, uuid, jsonb, text, timestamptz);

create or replace function public.create_quote(
  p_slot_id uuid,
  p_origin_hotel_id uuid,
  p_destination_hotel_id uuid,
  p_bag_counts jsonb,
  p_flight_number text default null,
  p_flight_departs_at timestamptz default null,
  p_flight_arrives_at timestamptz default null
)
returns public.quotes
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_settings public.booking_settings;
  v_slot public.service_slots;
  v_offering public.route_offerings;
  v_remaining integer;
  v_key text;
  v_qty integer;
  v_total_bags integer := 0;
  v_units integer := 0;
  v_rule public.price_rules;
  v_items jsonb := '[]'::jsonb;
  v_subtotal bigint := 0;
  v_supply bigint;
  v_flight text := nullif(upper(regexp_replace(coalesce(p_flight_number, ''), '\s', '', 'g')), '');
  v_quote public.quotes;
begin
  if v_uid is null then
    perform public.luggage_error('SESSION_REQUIRED');
  end if;

  select * into v_settings from public.booking_settings;

  select * into v_slot from public.service_slots where id = p_slot_id and status = 'active';
  if not found then
    perform public.luggage_error('SLOT_NOT_FOUND');
  end if;
  select * into v_offering from public.route_offerings where id = v_slot.route_offering_id;
  if not v_offering.enabled
     or (v_offering.available_from is not null and v_slot.service_date < v_offering.available_from)
     or (v_offering.available_until is not null and v_slot.service_date > v_offering.available_until) then
    perform public.luggage_error('ROUTE_NOT_AVAILABLE');
  end if;
  if v_slot.booking_cutoff_at <= now() then
    perform public.luggage_error('BOOKING_CUTOFF_PASSED');
  end if;

  -- 노선 방향별 출발·도착 호텔 검사
  if v_offering.route_type in ('hotel_to_airport', 'hotel_to_hotel') then
    if p_origin_hotel_id is null or not exists (
      select 1 from public.hotels h
       where h.id = p_origin_hotel_id and h.status = 'active' and h.zone_id = v_offering.origin_zone_id
    ) then
      perform public.luggage_error('ORIGIN_HOTEL_INVALID');
    end if;
  elsif p_origin_hotel_id is not null then
    perform public.luggage_error('ORIGIN_HOTEL_INVALID');
  end if;
  if v_offering.route_type in ('airport_to_hotel', 'hotel_to_hotel') then
    if p_destination_hotel_id is null or not exists (
      select 1 from public.hotels h
       where h.id = p_destination_hotel_id and h.status = 'active' and h.zone_id = v_offering.destination_zone_id
    ) then
      perform public.luggage_error('DESTINATION_HOTEL_INVALID');
    end if;
  elsif p_destination_hotel_id is not null then
    perform public.luggage_error('DESTINATION_HOTEL_INVALID');
  end if;
  if v_offering.route_type = 'hotel_to_hotel' and p_origin_hotel_id = p_destination_hotel_id then
    perform public.luggage_error('DESTINATION_HOTEL_INVALID');
  end if;

  -- 공항행은 항공편 출발 전 안전 여유를 지켜야 한다.
  if v_flight is not null and v_flight !~ '^[A-Z0-9]{2}[0-9]{1,4}[A-Z]?$' then
    perform public.luggage_error('FLIGHT_NUMBER_INVALID');
  end if;
  if v_offering.route_type = 'hotel_to_airport' then
    if p_flight_departs_at is null then
      perform public.luggage_error('FLIGHT_REQUIRED');
    end if;
    if p_flight_departs_at < v_slot.delivery_ends_at + make_interval(mins => v_settings.flight_buffer_minutes) then
      perform public.luggage_error('FLIGHT_TOO_EARLY');
    end if;
  end if;
  -- 공항 출발 노선은 항공편 도착 후 짐을 건넬 여유가 있어야 한다.
  if v_offering.route_type = 'airport_to_hotel' then
    if p_flight_arrives_at is null then
      perform public.luggage_error('FLIGHT_REQUIRED');
    end if;
    if p_flight_arrives_at > v_slot.pickup_ends_at - make_interval(mins => v_settings.arrival_buffer_minutes) then
      perform public.luggage_error('FLIGHT_TOO_LATE');
    end if;
  end if;

  -- 짐 수량 검사와 요금 계산
  if p_bag_counts is null or jsonb_typeof(p_bag_counts) <> 'object' then
    perform public.luggage_error('BAGS_INVALID');
  end if;
  for v_key in select jsonb_object_keys(p_bag_counts) loop
    if v_key not in ('standard', 'large') or jsonb_typeof(p_bag_counts -> v_key) <> 'number' then
      perform public.luggage_error('BAGS_INVALID');
    end if;
  end loop;

  for v_key in select unnest(array['standard', 'large']) loop
    v_qty := coalesce((p_bag_counts ->> v_key)::numeric, 0);
    if v_qty <> coalesce((p_bag_counts ->> v_key)::numeric, 0) or v_qty < 0 then
      perform public.luggage_error('BAGS_INVALID');
    end if;
    continue when v_qty = 0;

    select * into v_rule
      from public.price_rules pr
     where pr.route_offering_id = v_offering.id
       and pr.bag_size = v_key::public.bag_size
       and pr.status = 'active'
       and v_slot.service_date >= pr.valid_from
       and (pr.valid_until is null or v_slot.service_date <= pr.valid_until);
    if not found or v_rule.currency <> v_settings.currency then
      perform public.luggage_error('PRICE_UNAVAILABLE');
    end if;

    v_total_bags := v_total_bags + v_qty;
    v_units := v_units + v_qty * (select capacity_units from public.bag_size_rules where size = v_key::public.bag_size);
    v_subtotal := v_subtotal + v_qty::bigint * v_rule.unit_amount_minor;
    v_items := v_items || jsonb_build_object(
      'size', v_key,
      'quantity', v_qty,
      'unit_amount_minor', v_rule.unit_amount_minor,
      'amount_minor', v_qty * v_rule.unit_amount_minor,
      'price_rule_id', v_rule.id
    );
  end loop;

  if v_total_bags < 1 or v_total_bags > v_settings.max_bags_per_order then
    perform public.luggage_error('BAGS_INVALID');
  end if;
  if v_subtotal > 2000000000 then
    perform public.luggage_error('BAGS_INVALID');
  end if;

  -- 견적 시점의 용량 확인 (확보는 주문 생성 때 원자적으로 한다)
  select greatest(b.max_units - b.held_units - b.committed_units, 0) into v_remaining
    from public.capacity_buckets b where b.slot_id = v_slot.id;
  if coalesce(v_remaining, 0) < v_units then
    perform public.luggage_error('CAPACITY_UNAVAILABLE');
  end if;

  -- 부가세 포함가에서 공급가를 반올림(half-up)으로 구하고 나머지를 세액으로 둔다.
  v_supply := (v_subtotal * 10000 * 2 + (10000 + v_settings.vat_rate_bp)) / ((10000 + v_settings.vat_rate_bp) * 2);

  insert into public.quotes (
    owner_id, slot_id, route_offering_id, route_type, origin_hotel_id, destination_hotel_id,
    flight_number, flight_departs_at, flight_arrives_at, bag_counts, capacity_units, line_items,
    subtotal_minor, discount_minor, total_minor, tax_minor, currency, input_hash, expires_at
  ) values (
    v_uid, v_slot.id, v_offering.id, v_offering.route_type, p_origin_hotel_id, p_destination_hotel_id,
    case when v_offering.route_type = 'hotel_to_hotel' then null else v_flight end,
    case when v_offering.route_type = 'hotel_to_airport' then p_flight_departs_at end,
    case when v_offering.route_type = 'airport_to_hotel' then p_flight_arrives_at end,
    jsonb_build_object('standard', coalesce((p_bag_counts ->> 'standard')::integer, 0), 'large', coalesce((p_bag_counts ->> 'large')::integer, 0)),
    v_units, v_items,
    v_subtotal, 0, v_subtotal, v_subtotal - v_supply, v_settings.currency,
    encode(sha256(convert_to(jsonb_build_object(
      'slot', v_slot.id, 'origin', p_origin_hotel_id, 'destination', p_destination_hotel_id,
      'bags', v_items, 'flight', v_flight, 'departs', p_flight_departs_at, 'arrives', p_flight_arrives_at
    )::text, 'UTF8')), 'hex'),
    now() + make_interval(mins => v_settings.quote_ttl_minutes)
  )
  returning * into v_quote;

  return v_quote;
end;
$$;

revoke all on function public.create_quote(uuid, uuid, uuid, jsonb, text, timestamptz, timestamptz) from public;
grant execute on function public.create_quote(uuid, uuid, uuid, jsonb, text, timestamptz, timestamptz) to authenticated, service_role;

-- 짐 이벤트: 도착 호텔 직원의 인수 추가 --------------------------------------------
create or replace function public.record_bag_event(
  p_tag_id text,
  p_job_id uuid,
  p_event_type public.bag_event_type,
  p_client_event_id text,
  p_device_occurred_at timestamptz default null,
  p_expected_version integer default null,
  p_evidence_ids uuid[] default '{}',
  p_note text default null
)
returns public.bag_events
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_job public.delivery_jobs;
  v_bag public.bags;
  v_event public.bag_events;
  v_role text;
  v_to public.bag_status;
  v_details jsonb := '{}'::jsonb;
  v_previous text;
begin
  if v_uid is null then
    perform public.luggage_error('SESSION_REQUIRED');
  end if;

  select * into v_bag from public.bags where tag_id = upper(btrim(p_tag_id)) for update;
  if not found then
    perform public.luggage_error('TAG_NOT_FOUND');
  end if;

  -- 같은 스캔 재전송이면 기존 이벤트를 돌려준다 (이벤트·알림 중복 없음, LOG-03).
  select * into v_event from public.bag_events
   where actor_id = v_uid and client_event_id = p_client_event_id and bag_id = v_bag.id;
  if found then
    return v_event;
  end if;

  select * into v_job from public.delivery_jobs where id = p_job_id for update;
  if not found then
    perform public.luggage_error('JOB_NOT_FOUND');
  end if;
  -- 다른 주문의 태그는 이 작업에 붙이지 않는다 (LOG-01).
  if v_bag.order_id <> v_job.order_id then
    perform public.luggage_error('BAG_NOT_IN_JOB');
  end if;
  if v_job.status = 'cancelled' and p_event_type not in ('return_started', 'returned', 'correction') then
    perform public.luggage_error('JOB_CANCELLED');
  end if;

  -- 수행자 권한
  v_role := case
    when public.is_active_driver(v_job.id) then 'driver'
    when v_job.origin_hotel_id is not null and public.has_role('hotel_staff', 'hotel', v_job.origin_hotel_id) then 'hotel_staff'
    when v_job.destination_hotel_id is not null and public.has_role('hotel_staff', 'hotel', v_job.destination_hotel_id) then 'destination_hotel'
    when (select public.has_role('dispatcher')) then 'dispatcher'
    else null
  end;
  if v_role is null then
    perform public.luggage_error('FORBIDDEN');
  end if;

  if p_expected_version is not null and p_expected_version <> v_bag.version then
    perform public.luggage_error('VERSION_CONFLICT');
  end if;

  -- 상태 전이 규칙 (07 문서 2·4절)
  case p_event_type
    when 'origin_received' then
      if v_bag.bag_status <> 'registered' or v_role not in ('hotel_staff', 'dispatcher') then
        perform public.luggage_error('INVALID_TRANSITION');
      end if;
      v_to := 'at_origin';
    when 'collected' then
      if v_bag.bag_status not in ('registered', 'at_origin') or v_role not in ('driver', 'dispatcher') then
        perform public.luggage_error('INVALID_TRANSITION');
      end if;
      -- 사진 또는 승인된 예외 사유가 필요하다.
      if cardinality(coalesce(p_evidence_ids, '{}')) = 0 and coalesce(btrim(p_note), '') = '' then
        perform public.luggage_error('EVIDENCE_REQUIRED');
      end if;
      v_to := 'collected';
    when 'loaded' then
      if v_bag.bag_status <> 'collected' or v_role not in ('driver', 'dispatcher') then
        perform public.luggage_error('INVALID_TRANSITION');
      end if;
      v_to := 'in_transit';
    when 'arrived' then
      if v_bag.bag_status <> 'in_transit' or v_role not in ('driver', 'dispatcher') then
        perform public.luggage_error('INVALID_TRANSITION');
      end if;
      v_to := 'in_transit';
    when 'ready_for_handoff' then
      if v_bag.bag_status <> 'in_transit' or v_role not in ('driver', 'dispatcher') then
        perform public.luggage_error('INVALID_TRANSITION');
      end if;
      v_to := 'ready_for_handoff';
    when 'exception_reported' then
      if v_bag.bag_status in ('delivered', 'returned', 'cancelled_before_pickup', 'exception_hold') then
        perform public.luggage_error('INVALID_TRANSITION');
      end if;
      if coalesce(btrim(p_note), '') = '' then
        perform public.luggage_error('EVIDENCE_REQUIRED');
      end if;
      v_to := 'exception_hold';
      v_details := jsonb_build_object('previous_status', v_bag.bag_status);
    when 'exception_resolved' then
      if v_bag.bag_status <> 'exception_hold' or v_role <> 'dispatcher' then
        perform public.luggage_error('INVALID_TRANSITION');
      end if;
      select e.details ->> 'previous_status' into v_previous
        from public.bag_events e
       where e.bag_id = v_bag.id and e.event_type = 'exception_reported'
       order by e.server_received_at desc limit 1;
      v_to := coalesce(v_previous, 'registered')::public.bag_status;
    when 'return_started' then
      if v_bag.bag_status not in ('collected', 'in_transit', 'ready_for_handoff', 'exception_hold') or v_role <> 'dispatcher' then
        perform public.luggage_error('INVALID_TRANSITION');
      end if;
      v_to := 'return_in_progress';
    when 'returned' then
      if v_bag.bag_status <> 'return_in_progress' or v_role not in ('driver', 'dispatcher') then
        perform public.luggage_error('INVALID_TRANSITION');
      end if;
      if cardinality(coalesce(p_evidence_ids, '{}')) = 0 and coalesce(btrim(p_note), '') = '' then
        perform public.luggage_error('EVIDENCE_REQUIRED');
      end if;
      v_to := 'returned';
    when 'delivered' then
      -- 숙소 도착 노선: 도착 호텔 직원이 태그를 확인하고 인수한다. 공항 인계는 verify_handoff()로만 한다.
      if v_job.destination_hotel_id is null or v_bag.bag_status <> 'ready_for_handoff'
         or v_role not in ('destination_hotel', 'dispatcher') then
        perform public.luggage_error('INVALID_TRANSITION');
      end if;
      v_to := 'delivered';
    else
      -- correction은 운영 정정 경로에서만
      perform public.luggage_error('INVALID_TRANSITION');
  end case;

  insert into public.bag_events (
    bag_id, job_id, order_id, actor_id, actor_role, event_type, from_status, to_status,
    client_event_id, device_occurred_at, evidence_ids, note, details
  ) values (
    v_bag.id, v_job.id, v_job.order_id, v_uid, v_role, p_event_type, v_bag.bag_status, v_to,
    p_client_event_id, p_device_occurred_at, coalesce(p_evidence_ids, '{}'), nullif(btrim(p_note), ''), v_details
  ) returning * into v_event;

  update public.bags set bag_status = v_to, version = version + 1 where id = v_bag.id;
  perform public.recompute_job_status(v_job.id);
  insert into public.outbox_events (topic, aggregate_id, payload)
  values ('bag.' || p_event_type, v_job.order_id, jsonb_build_object('bag_id', v_bag.id, 'event_id', v_event.id));
  return v_event;
end;
$$;
revoke all on function public.record_bag_event(text, uuid, public.bag_event_type, text, timestamptz, integer, uuid[], text) from public;
grant execute on function public.record_bag_event(text, uuid, public.bag_event_type, text, timestamptz, integer, uuid[], text)
  to authenticated, service_role;

-- 수령 코드: 공항 인계 전용 --------------------------------------------------------
create or replace function public.issue_handoff_challenge(p_order_id uuid)
returns table (challenge_id uuid, code text, expires_at timestamptz, bag_count integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_order public.orders;
  v_job public.delivery_jobs;
  v_bags uuid[];
  v_code text;
  v_challenge public.handoff_challenges;
begin
  select * into v_order from public.orders where id = p_order_id and owner_id = v_uid;
  if not found then
    perform public.luggage_error('ORDER_NOT_FOUND');
  end if;
  -- 수령 코드는 공항 인계에만 쓴다. 숙소 도착 노선은 도착 호텔이 태그로 인수한다.
  if v_order.route_type <> 'hotel_to_airport' then
    perform public.luggage_error('HANDOFF_NOT_APPLICABLE');
  end if;
  select * into v_job from public.delivery_jobs where order_id = v_order.id for update;
  select array_agg(id order by seq) into v_bags from public.bags where order_id = v_order.id and bag_status = 'ready_for_handoff';
  if v_job.id is null or v_bags is null then
    perform public.luggage_error('HANDOFF_NOT_READY');
  end if;

  -- 이전 코드는 무효화한다 (재발급)
  update public.handoff_challenges set revoked_at = now()
   where job_id = v_job.id and consumed_at is null and revoked_at is null;

  v_code := lpad((floor(random() * 1000000))::integer::text, 6, '0');
  insert into public.handoff_challenges (order_id, job_id, bag_ids, code_hash, expires_at)
  values (v_order.id, v_job.id, v_bags, '', now() + interval '15 minutes')
  returning * into v_challenge;
  update public.handoff_challenges
     set code_hash = encode(sha256(convert_to(v_challenge.id::text || ':' || v_code, 'UTF8')), 'hex')
   where id = v_challenge.id;

  return query select v_challenge.id, v_code, v_challenge.expires_at, cardinality(v_bags);
end;
$$;
revoke all on function public.issue_handoff_challenge(uuid) from public;
grant execute on function public.issue_handoff_challenge(uuid) to authenticated, service_role;

-- 도착 호텔 직원도 자기 지점으로 오는 작업을 본다 ---------------------------------------
drop policy delivery_jobs_select on public.delivery_jobs;
create policy delivery_jobs_select on public.delivery_jobs for select to authenticated
  using (
    exists (select 1 from public.orders o where o.id = order_id and o.owner_id = (select auth.uid()))
    or (select public.is_operations_staff())
    or public.is_active_driver(id)
    or (origin_hotel_id is not null and public.has_role('hotel_staff', 'hotel', origin_hotel_id))
    or (destination_hotel_id is not null and public.has_role('hotel_staff', 'hotel', destination_hotel_id))
  );

-- 호텔 작업 목록: 맡기는 짐(pickup)과 도착하는 짐(dropoff)을 함께 -----------------------------
drop function public.partner_jobs(uuid, date, date);
create function public.partner_jobs(p_hotel_id uuid, p_from date, p_to date)
returns table (
  job_id uuid, job_status public.job_status, direction text, order_code text, customer_name text,
  service_date date, window_starts_at timestamptz, window_ends_at timestamptz, bag_count integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select j.id, j.status,
         case when j.origin_hotel_id = p_hotel_id then 'pickup' else 'dropoff' end,
         o.public_code, o.contact ->> 'name', s.service_date,
         case when j.origin_hotel_id = p_hotel_id then s.pickup_starts_at else s.delivery_starts_at end,
         case when j.origin_hotel_id = p_hotel_id then s.pickup_ends_at else s.delivery_ends_at end,
         (select count(*)::integer from public.bags b where b.order_id = o.id and b.bag_status <> 'cancelled_before_pickup')
    from public.delivery_jobs j
    join public.orders o on o.id = j.order_id
    join public.service_slots s on s.id = j.slot_id
   where (j.origin_hotel_id = p_hotel_id or j.destination_hotel_id = p_hotel_id)
     and public.has_role('hotel_staff', 'hotel', p_hotel_id)
     and s.service_date between p_from and p_to
     and j.status <> 'cancelled'
   order by 7;
$$;
revoke all on function public.partner_jobs(uuid, date, date) from public;
grant execute on function public.partner_jobs(uuid, date, date) to authenticated;

-- 기사 작업 목록에 노선·도착 호텔 추가 -----------------------------------------------------
drop function public.driver_jobs();
create function public.driver_jobs()
returns table (
  job_id uuid, job_status public.job_status, order_code text, customer_name text, route_type public.route_type,
  origin_hotel_name text, destination_hotel_name text, pickup_starts_at timestamptz, pickup_ends_at timestamptz,
  delivery_starts_at timestamptz, delivery_ends_at timestamptz, bag_count integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select j.id, j.status, o.public_code, o.contact ->> 'name', o.route_type, oh.name_ko, dh.name_ko,
         s.pickup_starts_at, s.pickup_ends_at, s.delivery_starts_at, s.delivery_ends_at,
         (select count(*)::integer from public.bags b where b.order_id = o.id and b.bag_status <> 'cancelled_before_pickup')
    from public.job_assignments a
    join public.delivery_jobs j on j.id = a.job_id
    join public.orders o on o.id = j.order_id
    join public.service_slots s on s.id = j.slot_id
    left join public.hotels oh on oh.id = j.origin_hotel_id
    left join public.hotels dh on dh.id = j.destination_hotel_id
   where a.driver_id = (select auth.uid()) and a.released_at is null and public.has_role('driver')
     and j.status not in ('cancelled', 'completed', 'returned')
   order by s.pickup_starts_at;
$$;
revoke all on function public.driver_jobs() from public;
grant execute on function public.driver_jobs() to authenticated;
