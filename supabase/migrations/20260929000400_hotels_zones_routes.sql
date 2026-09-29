-- A05 호텔·권역·노선·인계 장소 (05 문서 2절, 06 문서 1절).
-- 공개 정보(호텔·권역·인계 장소·판매 노선)와 계약·정산 정보(hotel_partners)를 분리한다.
-- 쓰기는 admin만, 삭제 대신 상태(archived)로 보관한다. 중요 변경은 audit_events에 남긴다.

create schema if not exists extensions;
create extension if not exists btree_gist with schema extensions;

create type public.record_status as enum ('draft', 'active', 'suspended', 'archived');
create type public.zone_kind as enum ('area', 'airport');
create type public.route_type as enum ('hotel_to_airport', 'airport_to_hotel', 'hotel_to_hotel');
create type public.handoff_location_type as enum ('hotel_front_desk', 'airport_counter', 'airport_meeting_point');

-- 공통 감사 트리거 ----------------------------------------------------------
create or replace function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  before_row jsonb := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
  after_row jsonb := case when tg_op = 'DELETE' then null else to_jsonb(new) end;
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
    coalesce((after_row ->> 'id'), (before_row ->> 'id'))::uuid,
    changed
  );
  return coalesce(new, old);
end;
$$;

-- 권역 -------------------------------------------------------------------
create table public.service_zones (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z0-9][a-z0-9-]*$'),
  kind public.zone_kind not null default 'area',
  name_ko text not null check (char_length(name_ko) between 1 and 80),
  -- 고객 언어별 표시명 {"zh-CN": "...", "en": "..."}
  display_names jsonb not null default '{}'::jsonb check (jsonb_typeof(display_names) = 'object'),
  status public.record_status not null default 'draft',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 호텔 제휴 계약 (비공개) ----------------------------------------------------
create table public.hotel_partners (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  status public.record_status not null default 'draft',
  -- 실제 계약·정산 설정은 외부 값 참조로만 둔다. 계약 번호를 임의 생성하지 않는다.
  contract_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 호텔 지점 ---------------------------------------------------------------
create table public.hotels (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid references public.hotel_partners (id) on delete restrict,
  zone_id uuid not null references public.service_zones (id) on delete restrict,
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]*$'),
  -- 한국어 원명과 주소. 같은 이름의 다른 지점은 주소·slug로 구분한다.
  name_ko text not null check (char_length(name_ko) between 1 and 120),
  address_ko text not null check (char_length(address_ko) between 1 and 300),
  latitude numeric(9, 6) check (latitude between -90 and 90),
  longitude numeric(9, 6) check (longitude between -180 and 180),
  -- 프런트 인계 가능 시각 (Asia/Seoul 현지 시각)
  front_desk_opens_at time,
  front_desk_closes_at time,
  status public.record_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hotels_name_address_key unique (name_ko, address_ko),
  constraint hotels_front_desk_hours check (
    (front_desk_opens_at is null) = (front_desk_closes_at is null)
  )
);

create index hotels_zone_idx on public.hotels (zone_id) where status = 'active';

create table public.hotel_translations (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels (id) on delete cascade,
  locale text not null check (locale in ('zh-CN', 'ko', 'en', 'zh-TW', 'ja')),
  name text not null check (char_length(name) between 1 and 120),
  -- 고객이 검색할 별칭 (중국어 약칭, 영문명 등)
  aliases text[] not null default '{}',
  handoff_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hotel_translations_hotel_locale_key unique (hotel_id, locale)
);

-- 인계 장소 (호텔 프런트·공항). 공항 장소는 유효기간으로 버전 관리한다. --------------
create table public.handoff_locations (
  id uuid primary key default gen_random_uuid(),
  code text not null check (code ~ '^[a-z0-9][a-z0-9-]*$'),
  type public.handoff_location_type not null,
  zone_id uuid not null references public.service_zones (id) on delete restrict,
  hotel_id uuid references public.hotels (id) on delete restrict,
  name_ko text not null,
  floor text,
  landmark_ko text,
  latitude numeric(9, 6) check (latitude between -90 and 90),
  longitude numeric(9, 6) check (longitude between -180 and 180),
  -- 비공개 Storage 경로. 공개 URL을 저장하지 않는다.
  photo_path text,
  valid_from timestamptz not null default now(),
  valid_until timestamptz,
  status public.record_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint handoff_locations_valid_range check (valid_until is null or valid_until > valid_from),
  constraint handoff_locations_hotel_shape check ((type = 'hotel_front_desk') = (hotel_id is not null)),
  -- 같은 장소 코드의 유효기간이 겹치지 않는다.
  constraint handoff_locations_no_overlap exclude using gist (
    code with =,
    tstzrange(valid_from, valid_until) with &&
  ) where (status <> 'archived')
);

create table public.handoff_location_translations (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.handoff_locations (id) on delete cascade,
  locale text not null check (locale in ('zh-CN', 'ko', 'en', 'zh-TW', 'ja')),
  name text not null,
  directions text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint handoff_location_translations_key unique (location_id, locale)
);

-- 판매 노선 ---------------------------------------------------------------
create table public.route_offerings (
  id uuid primary key default gen_random_uuid(),
  route_type public.route_type not null,
  origin_zone_id uuid not null references public.service_zones (id) on delete restrict,
  destination_zone_id uuid not null references public.service_zones (id) on delete restrict,
  enabled boolean not null default false,
  available_from date,
  available_until date,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint route_offerings_route_zones_key unique (route_type, origin_zone_id, destination_zone_id),
  constraint route_offerings_date_range check (available_until is null or available_from is null or available_until >= available_from)
);

-- 노선 방향과 권역 종류가 맞아야 한다 (예: 숙소→공항은 area → airport).
create or replace function public.validate_route_offering()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  origin_kind public.zone_kind;
  destination_kind public.zone_kind;
begin
  select kind into origin_kind from public.service_zones where id = new.origin_zone_id;
  select kind into destination_kind from public.service_zones where id = new.destination_zone_id;
  if (new.route_type = 'hotel_to_airport' and (origin_kind, destination_kind) <> ('area', 'airport'))
     or (new.route_type = 'airport_to_hotel' and (origin_kind, destination_kind) <> ('airport', 'area'))
     or (new.route_type = 'hotel_to_hotel' and (origin_kind, destination_kind) <> ('area', 'area')) then
    raise exception 'route type % does not match zone kinds (%, %)', new.route_type, origin_kind, destination_kind
      using errcode = 'check_violation', constraint = 'route_offerings_zone_kinds';
  end if;
  return new;
end;
$$;

create trigger route_offerings_validate
  before insert or update on public.route_offerings
  for each row execute function public.validate_route_offering();

-- 호텔 범위 역할은 실제 호텔을 가리켜야 한다 (A02 role_assignments 보강).
create or replace function public.validate_role_scope_target()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.scope_type = 'hotel' and not exists (select 1 from public.hotels where id = new.scope_id) then
    raise exception 'hotel scope % does not exist', new.scope_id
      using errcode = 'foreign_key_violation', constraint = 'role_assignments_hotel_scope_fk';
  end if;
  return new;
end;
$$;

create trigger role_assignments_scope_target
  before insert or update on public.role_assignments
  for each row execute function public.validate_role_scope_target();

-- updated_at·감사 ---------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'service_zones', 'hotel_partners', 'hotels', 'hotel_translations',
    'handoff_locations', 'handoff_location_translations', 'route_offerings'
  ] loop
    execute format(
      'create trigger %1$s_set_updated_at before update on public.%1$s for each row execute function public.set_updated_at()', t);
    execute format(
      'create trigger %1$s_audit after insert or update or delete on public.%1$s for each row execute function public.audit_row_change()', t);
  end loop;
end
$$;

-- 권한 --------------------------------------------------------------------
alter table public.service_zones enable row level security;
alter table public.hotel_partners enable row level security;
alter table public.hotels enable row level security;
alter table public.hotel_translations enable row level security;
alter table public.handoff_locations enable row level security;
alter table public.handoff_location_translations enable row level security;
alter table public.route_offerings enable row level security;

revoke all on public.service_zones, public.hotel_partners, public.hotels, public.hotel_translations,
  public.handoff_locations, public.handoff_location_translations, public.route_offerings from anon, authenticated;

-- 공개 읽기 대상 (계약 정보 제외)
grant select on public.service_zones, public.hotels, public.hotel_translations,
  public.handoff_locations, public.handoff_location_translations, public.route_offerings to anon, authenticated;
grant select on public.hotel_partners to authenticated;
-- 쓰기는 RLS에서 admin으로 제한한다. 삭제는 허용하지 않는다 (archived로 보관).
grant insert, update on public.service_zones, public.hotel_partners, public.hotels, public.hotel_translations,
  public.handoff_locations, public.handoff_location_translations, public.route_offerings to authenticated;
grant select, insert, update, delete on public.service_zones, public.hotel_partners, public.hotels, public.hotel_translations,
  public.handoff_locations, public.handoff_location_translations, public.route_offerings to service_role;

-- 운영 조회 권한: admin·dispatcher·support는 비활성 데이터도 본다.
create or replace function public.is_operations_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_role('dispatcher') or public.has_role('support');
$$;
revoke all on function public.is_operations_staff() from public;
grant execute on function public.is_operations_staff() to authenticated, service_role;
-- 공개 읽기 정책이 anon에서도 평가하므로 실행 권한을 준다. 비로그인 호출은 항상 false다.
grant execute on function public.is_operations_staff() to anon;
grant execute on function public.has_role(public.staff_role, public.role_scope, uuid) to anon;

create policy service_zones_read on public.service_zones for select to anon, authenticated
  using (status = 'active' or (select public.is_operations_staff()));

create policy hotel_partners_read on public.hotel_partners for select to authenticated
  using ((select public.has_role('admin')) or (select public.has_role('finance')));

create policy hotels_read on public.hotels for select to anon, authenticated
  using (
    status = 'active'
    or (select public.is_operations_staff())
    or public.has_role('hotel_staff', 'hotel', id)
  );

create policy hotel_translations_read on public.hotel_translations for select to anon, authenticated
  using (exists (select 1 from public.hotels h where h.id = hotel_id));

create policy handoff_locations_read on public.handoff_locations for select to anon, authenticated
  using (
    (status = 'active' and valid_from <= now() and (valid_until is null or valid_until > now()))
    or (select public.is_operations_staff())
    or (hotel_id is not null and public.has_role('hotel_staff', 'hotel', hotel_id))
  );

create policy handoff_location_translations_read on public.handoff_location_translations for select to anon, authenticated
  using (exists (select 1 from public.handoff_locations l where l.id = location_id));

create policy route_offerings_read on public.route_offerings for select to anon, authenticated
  using (enabled or (select public.is_operations_staff()));

-- admin 쓰기
do $$
declare
  t text;
begin
  foreach t in array array[
    'service_zones', 'hotel_partners', 'hotels', 'hotel_translations',
    'handoff_locations', 'handoff_location_translations', 'route_offerings'
  ] loop
    execute format(
      'create policy %1$s_admin_insert on public.%1$s for insert to authenticated with check ((select public.has_role(''admin'')))', t);
    execute format(
      'create policy %1$s_admin_update on public.%1$s for update to authenticated using ((select public.has_role(''admin''))) with check ((select public.has_role(''admin'')))', t);
  end loop;
end
$$;
