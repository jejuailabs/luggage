-- E02 검증된 차량 위치 (07 문서 6절, 05 문서 8절).
-- - 짐 자체 GPS가 아니라 배송 차량(또는 작업 중 기사 기기)의 최근 위치다.
-- - 위치는 작업이 활성일 때만 받고, 짧게 보관한다. 고객에게는 대략 좌표·마지막 관측 시각·stale 여부만 보여 준다.
-- - 기사 개인 위치나 다른 고객 경유지는 노출하지 않는다.

create type public.location_source as enum ('driver_device', 'telematics', 'mock');

create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  label text not null check (char_length(label) between 1 and 60),
  -- 관제 단말 식별값 (공급사 웹훅의 deviceId)
  telematics_device_id text unique check (telematics_device_id ~ '^[A-Za-z0-9_.:-]{1,80}$'),
  status public.record_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.job_assignments add column vehicle_id uuid references public.vehicles (id) on delete set null;

create table public.vehicle_locations (
  id bigint generated always as identity primary key,
  job_id uuid not null references public.delivery_jobs (id) on delete cascade,
  vehicle_id uuid references public.vehicles (id) on delete set null,
  driver_id uuid references auth.users (id) on delete set null,
  source public.location_source not null,
  latitude numeric(9, 6) not null check (latitude between -90 and 90),
  longitude numeric(9, 6) not null check (longitude between -180 and 180),
  accuracy_m integer check (accuracy_m between 0 and 5000),
  observed_at timestamptz not null,
  received_at timestamptz not null default now()
);
create index vehicle_locations_job_idx on public.vehicle_locations (job_id, observed_at desc);
create index vehicle_locations_received_idx on public.vehicle_locations (received_at);

create trigger vehicles_set_updated_at before update on public.vehicles
  for each row execute function public.set_updated_at();
create trigger vehicles_audit after insert or update or delete on public.vehicles
  for each row execute function public.audit_row_change();

alter table public.vehicles enable row level security;
alter table public.vehicle_locations enable row level security;
revoke all on public.vehicles, public.vehicle_locations from anon, authenticated;
grant select on public.vehicles to authenticated;
grant insert, update on public.vehicles to authenticated;
grant select on public.vehicle_locations to authenticated;
grant select, insert, update, delete on public.vehicles, public.vehicle_locations to service_role;

create policy vehicles_select on public.vehicles for select to authenticated using ((select public.is_operations_staff()));
create policy vehicles_insert on public.vehicles for insert to authenticated with check ((select public.has_role('admin')));
create policy vehicles_update on public.vehicles for update to authenticated
  using ((select public.has_role('admin'))) with check ((select public.has_role('admin')));
-- 원시 위치는 운영자만. 고객은 latest_vehicle_location()으로 요약만 받는다.
create policy vehicle_locations_select on public.vehicle_locations for select to authenticated using ((select public.is_operations_staff()));

-- 활성 작업 상태 (위치 수집 대상)
create or replace function public.is_tracking_active(p_status public.job_status)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_status in ('assigned', 'picking_up', 'transporting', 'ready');
$$;

-- 작업 차량 지정 (dispatcher) ----------------------------------------------------
create or replace function public.set_job_vehicle(p_job_id uuid, p_vehicle_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select public.has_role('dispatcher')) then
    perform public.luggage_error('FORBIDDEN');
  end if;
  if p_vehicle_id is not null and not exists (select 1 from public.vehicles where id = p_vehicle_id and status = 'active') then
    perform public.luggage_error('VALIDATION_FAILED');
  end if;
  update public.job_assignments set vehicle_id = p_vehicle_id where job_id = p_job_id and released_at is null;
  if not found then
    perform public.luggage_error('JOB_NOT_ASSIGNABLE');
  end if;
end;
$$;
revoke all on function public.set_job_vehicle(uuid, uuid) from public;
grant execute on function public.set_job_vehicle(uuid, uuid) to authenticated, service_role;

-- 기사 기기 위치 (작업 화면이 열린 동안) -------------------------------------------------
-- 반환: recorded | throttled. 기기 시각은 서버 시각 ±범위 안이어야 한다.
create or replace function public.record_driver_location(
  p_job_id uuid,
  p_latitude numeric,
  p_longitude numeric,
  p_accuracy_m integer,
  p_observed_at timestamptz
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_job public.delivery_jobs;
  v_assignment public.job_assignments;
begin
  select * into v_job from public.delivery_jobs where id = p_job_id;
  if not found or not public.is_active_driver(p_job_id) then
    perform public.luggage_error('FORBIDDEN');
  end if;
  if not public.is_tracking_active(v_job.status) then
    perform public.luggage_error('TRACKING_NOT_ACTIVE');
  end if;
  if p_observed_at < now() - interval '2 minutes' or p_observed_at > now() + interval '1 minute' then
    perform public.luggage_error('LOCATION_STALE');
  end if;
  if p_accuracy_m is null or p_accuracy_m > 1000 then
    perform public.luggage_error('LOCATION_INACCURATE');
  end if;
  -- 과도한 전송 제한 (기사·작업당 15초)
  if exists (
    select 1 from public.vehicle_locations
     where job_id = p_job_id and driver_id = v_uid and received_at > now() - interval '15 seconds'
  ) then
    return 'throttled';
  end if;
  select * into v_assignment from public.job_assignments where job_id = p_job_id and released_at is null;
  insert into public.vehicle_locations (job_id, vehicle_id, driver_id, source, latitude, longitude, accuracy_m, observed_at)
  values (p_job_id, v_assignment.vehicle_id, v_uid, 'driver_device', p_latitude, p_longitude, p_accuracy_m, p_observed_at);
  return 'recorded';
end;
$$;
revoke all on function public.record_driver_location(uuid, numeric, numeric, integer, timestamptz) from public;
grant execute on function public.record_driver_location(uuid, numeric, numeric, integer, timestamptz) to authenticated, service_role;

-- 관제 단말 위치 (서버 전용, 서명 검증 후) -------------------------------------------------
-- 단말이 붙은 차량의 활성 작업마다 기록한다. 반환: 기록한 작업 수.
create or replace function public.ingest_telematics_location(
  p_device_id text,
  p_latitude numeric,
  p_longitude numeric,
  p_accuracy_m integer,
  p_observed_at timestamptz,
  p_source public.location_source default 'telematics'
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_vehicle public.vehicles;
  v_count integer;
begin
  select * into v_vehicle from public.vehicles where telematics_device_id = p_device_id and status = 'active';
  if not found then
    return 0;
  end if;
  if p_observed_at < now() - interval '10 minutes' or p_observed_at > now() + interval '1 minute' then
    perform public.luggage_error('LOCATION_STALE');
  end if;
  insert into public.vehicle_locations (job_id, vehicle_id, source, latitude, longitude, accuracy_m, observed_at)
  select j.id, v_vehicle.id, p_source, p_latitude, p_longitude, p_accuracy_m, p_observed_at
    from public.job_assignments a
    join public.delivery_jobs j on j.id = a.job_id
   where a.vehicle_id = v_vehicle.id and a.released_at is null and public.is_tracking_active(j.status);
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke all on function public.ingest_telematics_location(text, numeric, numeric, integer, timestamptz, public.location_source) from public;
grant execute on function public.ingest_telematics_location(text, numeric, numeric, integer, timestamptz, public.location_source) to service_role;

-- 고객용 최근 위치 요약 -----------------------------------------------------------
-- 짐이 차량에 있는 동안(수거~운송)만. 좌표는 소수 셋째 자리(약 100m)로 줄인다. 5분이 지나면 stale.
create or replace function public.latest_vehicle_location(p_order_id uuid)
returns table (latitude numeric, longitude numeric, observed_at timestamptz, source public.location_source, stale boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_job public.delivery_jobs;
begin
  if not exists (
    select 1 from public.orders o
     where o.id = p_order_id and (o.owner_id = (select auth.uid()) or (select public.is_operations_staff()))
  ) then
    perform public.luggage_error('ORDER_NOT_FOUND');
  end if;
  select * into v_job from public.delivery_jobs where order_id = p_order_id;
  if v_job.id is null or v_job.status not in ('picking_up', 'transporting') then
    return;
  end if;
  return query
  select round(l.latitude, 3), round(l.longitude, 3), l.observed_at, l.source, l.observed_at < now() - interval '5 minutes'
    from public.vehicle_locations l
   where l.job_id = v_job.id
   order by l.observed_at desc
   limit 1;
end;
$$;
revoke all on function public.latest_vehicle_location(uuid) from public;
grant execute on function public.latest_vehicle_location(uuid) to authenticated, service_role;

-- 보존 기간 정리 (스케줄러) ----------------------------------------------------------
create or replace function public.purge_vehicle_locations(p_keep_days integer default 7)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  delete from public.vehicle_locations where received_at < now() - make_interval(days => greatest(p_keep_days, 1));
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke all on function public.purge_vehicle_locations(integer) from public;
grant execute on function public.purge_vehicle_locations(integer) to service_role;
