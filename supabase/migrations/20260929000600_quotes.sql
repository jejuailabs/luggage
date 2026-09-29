-- B01 서버 견적 (06 문서 2절).
-- 견적은 create_quote()로만 만든다. 클라이언트가 보낸 금액을 받지 않고 요금 규칙에서 정수로 계산한다.
-- 오류는 'LUGGAGE:<ERROR_CODE>' 메시지로 올리고 API가 공통 오류 코드로 바꾼다.

alter table public.booking_settings
  add column vat_rate_bp integer not null default 1000 check (vat_rate_bp between 0 and 5000);
comment on column public.booking_settings.vat_rate_bp is '부가세율(베이시스 포인트). 판매가는 부가세 포함 금액이다.';

create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  slot_id uuid not null references public.service_slots (id) on delete restrict,
  route_offering_id uuid not null references public.route_offerings (id) on delete restrict,
  route_type public.route_type not null,
  origin_hotel_id uuid references public.hotels (id) on delete restrict,
  destination_hotel_id uuid references public.hotels (id) on delete restrict,
  flight_number text,
  flight_departs_at timestamptz,
  -- {"standard": 2, "large": 1}
  bag_counts jsonb not null,
  capacity_units integer not null check (capacity_units > 0),
  -- [{size, quantity, unit_amount_minor, amount_minor, price_rule_id}]
  line_items jsonb not null,
  subtotal_minor integer not null check (subtotal_minor >= 0),
  discount_minor integer not null default 0 check (discount_minor >= 0),
  total_minor integer not null check (total_minor >= 0),
  -- total_minor에 포함된 부가세
  tax_minor integer not null check (tax_minor >= 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  input_hash text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint quotes_total check (total_minor = subtotal_minor - discount_minor and tax_minor <= total_minor)
);

create index quotes_owner_idx on public.quotes (owner_id, created_at desc);

alter table public.quotes enable row level security;
revoke all on public.quotes from anon, authenticated;
grant select on public.quotes to authenticated;
grant select, insert, update, delete on public.quotes to service_role;

create policy quotes_select_own on public.quotes for select to authenticated
  using (owner_id = (select auth.uid()));

create or replace function public.luggage_error(code text)
returns void
language plpgsql
set search_path = ''
as $$
begin
  raise exception using errcode = 'P0001', message = 'LUGGAGE:' || code;
end;
$$;

create or replace function public.create_quote(
  p_slot_id uuid,
  p_origin_hotel_id uuid,
  p_destination_hotel_id uuid,
  p_bag_counts jsonb,
  p_flight_number text default null,
  p_flight_departs_at timestamptz default null
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
    flight_number, flight_departs_at, bag_counts, capacity_units, line_items,
    subtotal_minor, discount_minor, total_minor, tax_minor, currency, input_hash, expires_at
  ) values (
    v_uid, v_slot.id, v_offering.id, v_offering.route_type, p_origin_hotel_id, p_destination_hotel_id,
    v_flight, p_flight_departs_at,
    jsonb_build_object('standard', coalesce((p_bag_counts ->> 'standard')::integer, 0), 'large', coalesce((p_bag_counts ->> 'large')::integer, 0)),
    v_units, v_items,
    v_subtotal, 0, v_subtotal, v_subtotal - v_supply, v_settings.currency,
    encode(sha256(convert_to(jsonb_build_object(
      'slot', v_slot.id, 'origin', p_origin_hotel_id, 'destination', p_destination_hotel_id,
      'bags', v_items, 'flight', v_flight, 'departs', p_flight_departs_at
    )::text, 'UTF8')), 'hex'),
    now() + make_interval(mins => v_settings.quote_ttl_minutes)
  )
  returning * into v_quote;

  return v_quote;
end;
$$;

revoke all on function public.create_quote(uuid, uuid, uuid, jsonb, text, timestamptz) from public;
grant execute on function public.create_quote(uuid, uuid, uuid, jsonb, text, timestamptz) to authenticated, service_role;
revoke all on function public.luggage_error(text) from public;
