-- B02 슬롯·용량, B01 요금 규칙 (06 문서 1–3절).
-- 용량 불변식: held_units + committed_units <= max_units (DB 제약으로 강제).
-- 실제 판매 요금·마감·여유 시간은 운영 설정값이다. 시드 값은 개발용 예시다.

-- 감사 트리거 보강: id가 UUID가 아닌 설정 테이블(booking_settings 등)도 기록할 수 있게 한다.
create or replace function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  before_row jsonb := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
  after_row jsonb := case when tg_op = 'DELETE' then null else to_jsonb(new) end;
  row_id text := coalesce(after_row ->> 'id', before_row ->> 'id');
  changed jsonb;
begin
  if tg_op = 'UPDATE' then
    select coalesce(jsonb_object_agg(key, jsonb_build_object('from', before_row -> key, 'to', value)), '{}'::jsonb)
      into changed
      from jsonb_each(after_row)
     where key not in ('updated_at') and (before_row -> key) is distinct from value;
    if changed = '{}'::jsonb then
      return new;
    end if;
  else
    changed := coalesce(after_row, before_row);
  end if;

  insert into public.audit_events (actor_user_id, action, target_table, target_id, detail)
  values (
    (select auth.uid()),
    tg_table_name || '.' || lower(tg_op),
    tg_table_name,
    case when row_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then row_id::uuid end,
    changed
  );
  return coalesce(new, old);
end;
$$;

create type public.bag_size as enum ('standard', 'large');

-- 예약 공통 설정 (한 행) ------------------------------------------------------
create table public.booking_settings (
  id boolean primary key default true check (id),
  currency text not null default 'KRW' check (currency ~ '^[A-Z]{3}$'),
  quote_ttl_minutes integer not null default 15 check (quote_ttl_minutes between 1 and 120),
  hold_minutes integer not null default 10 check (hold_minutes between 1 and 60),
  -- 공항 인계 종료부터 항공편 출발까지 최소 여유
  flight_buffer_minutes integer not null default 120 check (flight_buffer_minutes between 0 and 600),
  max_bags_per_order integer not null default 8 check (max_bags_per_order between 1 and 50),
  updated_at timestamptz not null default now()
);
insert into public.booking_settings default values;

-- 짐 규격별 점유 단위 ---------------------------------------------------------
create table public.bag_size_rules (
  size public.bag_size primary key,
  capacity_units integer not null check (capacity_units between 1 and 10),
  updated_at timestamptz not null default now()
);
insert into public.bag_size_rules (size, capacity_units) values ('standard', 1), ('large', 2);

-- 요금 규칙 (가격 버전) ----------------------------------------------------------
create table public.price_rules (
  id uuid primary key default gen_random_uuid(),
  route_offering_id uuid not null references public.route_offerings (id) on delete restrict,
  bag_size public.bag_size not null,
  unit_amount_minor integer not null check (unit_amount_minor >= 0),
  currency text not null default 'KRW' check (currency ~ '^[A-Z]{3}$'),
  valid_from date not null,
  valid_until date,
  status public.record_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint price_rules_valid_range check (valid_until is null or valid_until >= valid_from),
  -- 같은 노선·규격의 유효 요금이 겹치지 않는다. 기존 규칙은 수정 대신 종료일을 두고 새 규칙을 추가한다.
  constraint price_rules_no_overlap exclude using gist (
    route_offering_id with =,
    bag_size with =,
    daterange(valid_from, valid_until, '[]') with &&
  ) where (status <> 'archived')
);

-- 슬롯과 용량 ---------------------------------------------------------------
create table public.service_slots (
  id uuid primary key default gen_random_uuid(),
  route_offering_id uuid not null references public.route_offerings (id) on delete restrict,
  -- 한국 기준 서비스 날짜
  service_date date not null,
  pickup_starts_at timestamptz not null,
  pickup_ends_at timestamptz not null,
  delivery_starts_at timestamptz not null,
  delivery_ends_at timestamptz not null,
  -- 이 시각 이후 신규 예약 불가
  booking_cutoff_at timestamptz not null,
  status public.record_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint service_slots_windows check (
    pickup_starts_at < pickup_ends_at
    and delivery_starts_at < delivery_ends_at
    and pickup_starts_at <= delivery_starts_at
    and booking_cutoff_at <= pickup_starts_at
  ),
  constraint service_slots_unique_window unique (route_offering_id, pickup_starts_at, delivery_ends_at)
);

create index service_slots_offering_date_idx on public.service_slots (route_offering_id, service_date) where status = 'active';

create table public.capacity_buckets (
  id uuid primary key default gen_random_uuid(),
  slot_id uuid not null unique references public.service_slots (id) on delete restrict,
  max_units integer not null check (max_units >= 0),
  held_units integer not null default 0 check (held_units >= 0),
  committed_units integer not null default 0 check (committed_units >= 0),
  updated_at timestamptz not null default now(),
  constraint capacity_buckets_within_max check (held_units + committed_units <= max_units)
);

do $$
declare
  t text;
begin
  foreach t in array array['booking_settings', 'bag_size_rules', 'price_rules', 'service_slots', 'capacity_buckets'] loop
    execute format(
      'create trigger %1$s_set_updated_at before update on public.%1$s for each row execute function public.set_updated_at()', t);
  end loop;
  -- 용량 행은 주문마다 바뀌므로 감사 대상에서 제외한다 (보류·확정 기록은 주문 쪽에 남는다).
  foreach t in array array['booking_settings', 'bag_size_rules', 'price_rules', 'service_slots'] loop
    execute format(
      'create trigger %1$s_audit after insert or update or delete on public.%1$s for each row execute function public.audit_row_change()', t);
  end loop;
end
$$;

-- 권한 --------------------------------------------------------------------
alter table public.booking_settings enable row level security;
alter table public.bag_size_rules enable row level security;
alter table public.price_rules enable row level security;
alter table public.service_slots enable row level security;
alter table public.capacity_buckets enable row level security;

revoke all on public.booking_settings, public.bag_size_rules, public.price_rules, public.service_slots, public.capacity_buckets
  from anon, authenticated;
grant select on public.booking_settings, public.bag_size_rules, public.price_rules, public.service_slots to anon, authenticated;
grant select on public.capacity_buckets to authenticated;
grant insert, update on public.booking_settings, public.bag_size_rules, public.price_rules, public.service_slots, public.capacity_buckets
  to authenticated;
grant select, insert, update, delete on public.booking_settings, public.bag_size_rules, public.price_rules, public.service_slots,
  public.capacity_buckets to service_role;

create policy booking_settings_read on public.booking_settings for select to anon, authenticated using (true);
create policy bag_size_rules_read on public.bag_size_rules for select to anon, authenticated using (true);
create policy price_rules_read on public.price_rules for select to anon, authenticated
  using (status = 'active' or (select public.is_operations_staff()));
create policy service_slots_read on public.service_slots for select to anon, authenticated
  using (status = 'active' or (select public.is_operations_staff()));
-- 용량 원장은 운영자만 직접 본다. 고객은 available_slots()로 가능 여부만 받는다.
create policy capacity_buckets_read on public.capacity_buckets for select to authenticated
  using ((select public.is_operations_staff()));

do $$
declare
  t text;
begin
  foreach t in array array['booking_settings', 'bag_size_rules', 'price_rules', 'service_slots', 'capacity_buckets'] loop
    execute format(
      'create policy %1$s_admin_insert on public.%1$s for insert to authenticated with check ((select public.has_role(''admin'')))', t);
    execute format(
      'create policy %1$s_admin_update on public.%1$s for update to authenticated using ((select public.has_role(''admin''))) with check ((select public.has_role(''admin'')))', t);
  end loop;
end
$$;

-- 공개 슬롯 조회 ------------------------------------------------------------
-- 판매 중 노선의 예약 가능한 슬롯과 남은 단위 수를 돌려준다. 용량 원장 자체는 노출하지 않는다.
create or replace function public.available_slots(p_route_offering_id uuid, p_service_date date)
returns table (
  slot_id uuid,
  service_date date,
  pickup_starts_at timestamptz,
  pickup_ends_at timestamptz,
  delivery_starts_at timestamptz,
  delivery_ends_at timestamptz,
  booking_cutoff_at timestamptz,
  remaining_units integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.service_date, s.pickup_starts_at, s.pickup_ends_at, s.delivery_starts_at, s.delivery_ends_at,
         s.booking_cutoff_at, greatest(b.max_units - b.held_units - b.committed_units, 0)
    from public.service_slots s
    join public.capacity_buckets b on b.slot_id = s.id
    join public.route_offerings r on r.id = s.route_offering_id
   where s.route_offering_id = p_route_offering_id
     and s.service_date = p_service_date
     and s.status = 'active'
     and r.enabled
     and (r.available_from is null or p_service_date >= r.available_from)
     and (r.available_until is null or p_service_date <= r.available_until)
     and s.booking_cutoff_at > now()
   order by s.pickup_starts_at;
$$;

revoke all on function public.available_slots(uuid, date) from public;
grant execute on function public.available_slots(uuid, date) to anon, authenticated, service_role;
