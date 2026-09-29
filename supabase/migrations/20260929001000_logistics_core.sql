-- C01·C02·C04 배송 코어 (07 문서 2–5·7절).
-- 짐 상태 변경은 record_bag_event()와 verify_handoff()로만 한다: 배정·범위 권한, 태그-작업 일치, 상태 전이,
-- 버전, client_event_id 멱등, 서버 시각 기준. 이벤트는 추가 전용이며 정정은 새 이벤트로 남긴다.

create type public.job_status as enum (
  'planned', 'assigned', 'picking_up', 'transporting', 'ready', 'completed', 'exception', 'returning', 'returned', 'cancelled'
);
create type public.bag_event_type as enum (
  'origin_received', 'collected', 'loaded', 'arrived', 'ready_for_handoff', 'delivered',
  'exception_reported', 'exception_resolved', 'return_started', 'returned', 'correction'
);

-- 배송 작업 (주문당 1건) --------------------------------------------------------
create table public.delivery_jobs (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders (id) on delete restrict,
  slot_id uuid not null references public.service_slots (id) on delete restrict,
  origin_hotel_id uuid references public.hotels (id) on delete restrict,
  destination_hotel_id uuid references public.hotels (id) on delete restrict,
  status public.job_status not null default 'planned',
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index delivery_jobs_slot_idx on public.delivery_jobs (slot_id);

create table public.job_assignments (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.delivery_jobs (id) on delete restrict,
  driver_id uuid not null references auth.users (id) on delete restrict,
  assigned_by uuid references auth.users (id) on delete set null,
  assigned_at timestamptz not null default now(),
  released_at timestamptz,
  constraint job_assignments_release check (released_at is null or released_at >= assigned_at)
);
-- 작업당 현재 담당자는 한 명
create unique index job_assignments_one_active on public.job_assignments (job_id) where released_at is null;
create index job_assignments_driver_idx on public.job_assignments (driver_id) where released_at is null;

-- 짐 이벤트 (추가 전용) ----------------------------------------------------------
create table public.bag_events (
  id uuid primary key default gen_random_uuid(),
  bag_id uuid not null references public.bags (id) on delete restrict,
  job_id uuid not null references public.delivery_jobs (id) on delete restrict,
  order_id uuid not null references public.orders (id) on delete restrict,
  actor_id uuid not null references auth.users (id) on delete restrict,
  actor_role text not null,
  event_type public.bag_event_type not null,
  from_status public.bag_status not null,
  to_status public.bag_status not null,
  client_event_id text not null check (char_length(client_event_id) between 8 and 128),
  -- 기기 시각은 참고용. 판단은 server_received_at 기준.
  device_occurred_at timestamptz,
  server_received_at timestamptz not null default now(),
  evidence_ids uuid[] not null default '{}',
  note text check (char_length(note) <= 1000),
  details jsonb not null default '{}'::jsonb,
  constraint bag_events_actor_client_key unique (actor_id, client_event_id, bag_id)
);
create index bag_events_bag_idx on public.bag_events (bag_id, server_received_at);
create index bag_events_order_idx on public.bag_events (order_id, server_received_at);

create trigger bag_events_append_only
  before update or delete on public.bag_events
  for each row execute function public.forbid_ledger_mutation();

-- 수령 코드 ---------------------------------------------------------------
create table public.handoff_challenges (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete restrict,
  job_id uuid not null references public.delivery_jobs (id) on delete restrict,
  bag_ids uuid[] not null check (cardinality(bag_ids) > 0),
  code_hash text not null,
  expires_at timestamptz not null,
  attempts integer not null default 0,
  max_attempts integer not null default 5,
  consumed_at timestamptz,
  consumed_by uuid references auth.users (id) on delete set null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index handoff_challenges_open_idx on public.handoff_challenges (job_id) where consumed_at is null and revoked_at is null;

do $$
declare
  t text;
begin
  foreach t in array array['delivery_jobs'] loop
    execute format(
      'create trigger %1$s_set_updated_at before update on public.%1$s for each row execute function public.set_updated_at()', t);
  end loop;
end
$$;

-- 권한 헬퍼 ---------------------------------------------------------------
create or replace function public.is_active_driver(p_job_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.job_assignments a
     where a.job_id = p_job_id and a.driver_id = (select auth.uid()) and a.released_at is null
  ) and public.has_role('driver');
$$;

-- 권한 --------------------------------------------------------------------
alter table public.delivery_jobs enable row level security;
alter table public.job_assignments enable row level security;
alter table public.bag_events enable row level security;
alter table public.handoff_challenges enable row level security;

revoke all on public.delivery_jobs, public.job_assignments, public.bag_events, public.handoff_challenges from anon, authenticated;
grant select on public.delivery_jobs, public.job_assignments, public.bag_events to authenticated;
grant select, insert, update on public.delivery_jobs, public.job_assignments, public.handoff_challenges to service_role;
grant select, insert on public.bag_events to service_role;
revoke all on function public.is_active_driver(uuid) from public;
grant execute on function public.is_active_driver(uuid) to authenticated, service_role;

-- 고객: 자기 주문 작업·이벤트 / 운영자: 전체 / 기사: 현재 배정 작업 / 호텔: 자기 지점 출발 작업
create policy delivery_jobs_select on public.delivery_jobs for select to authenticated
  using (
    exists (select 1 from public.orders o where o.id = order_id and o.owner_id = (select auth.uid()))
    or (select public.is_operations_staff())
    or public.is_active_driver(id)
    or (origin_hotel_id is not null and public.has_role('hotel_staff', 'hotel', origin_hotel_id))
  );
create policy job_assignments_select on public.job_assignments for select to authenticated
  using ((select public.is_operations_staff()) or driver_id = (select auth.uid()));
create policy bag_events_select on public.bag_events for select to authenticated
  using (exists (select 1 from public.delivery_jobs j where j.id = job_id));

-- 기사·호텔이 짐 행을 볼 수 있게 bags 정책을 넓힌다 (배정·지점 범위).
drop policy if exists bags_select on public.bags;
create policy bags_select on public.bags for select to authenticated
  using (
    exists (select 1 from public.orders o where o.id = order_id)
    or exists (select 1 from public.delivery_jobs j where j.order_id = bags.order_id)
  );

-- 예약 확정 시 배송 작업 생성, 취소 시 수거 전이면 작업 취소 -----------------------------
create or replace function public.sync_job_with_reservation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.reservation_status = 'confirmed' and old.reservation_status is distinct from 'confirmed' then
    insert into public.delivery_jobs (order_id, slot_id, origin_hotel_id, destination_hotel_id)
    values (new.id, new.slot_id, new.origin_hotel_id, new.destination_hotel_id)
    on conflict (order_id) do nothing;
  elsif new.reservation_status = 'cancelled' and old.reservation_status is distinct from 'cancelled' then
    -- 수거된 짐이 있으면 작업을 유지한다 (반환 작업은 운영자가 연다).
    update public.delivery_jobs j set status = 'cancelled', version = j.version + 1
     where j.order_id = new.id
       and not exists (
         select 1 from public.bags b where b.order_id = new.id
            and b.bag_status not in ('registered', 'at_origin', 'cancelled_before_pickup')
       );
  end if;
  return new;
end;
$$;

create trigger orders_sync_job
  after update of reservation_status on public.orders
  for each row execute function public.sync_job_with_reservation();

-- 작업 상태를 짐 상태에서 다시 계산한다 --------------------------------------------
create or replace function public.recompute_job_status(p_job_id uuid)
returns public.job_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.delivery_jobs;
  v_active integer;
  v_new public.job_status;
begin
  select * into v_job from public.delivery_jobs where id = p_job_id for update;
  if v_job.status = 'cancelled' then
    return v_job.status;
  end if;
  select count(*) into v_active from public.bags where order_id = v_job.order_id and bag_status <> 'cancelled_before_pickup';

  select case
    when v_active = 0 then 'cancelled'::public.job_status
    when bool_or(bag_status = 'exception_hold') then 'exception'
    when bool_and(bag_status = 'returned') then 'returned'
    when bool_or(bag_status in ('return_in_progress')) then 'returning'
    -- 모든 대상 짐이 인계돼야 완료 (3개 중 2개는 완료가 아니다)
    when bool_and(bag_status = 'delivered') then 'completed'
    when bool_and(bag_status in ('ready_for_handoff', 'delivered')) then 'ready'
    when bool_or(bag_status in ('collected', 'in_transit', 'ready_for_handoff', 'delivered')) then 'transporting'
    when bool_or(bag_status = 'at_origin') and exists (
      select 1 from public.job_assignments a where a.job_id = v_job.id and a.released_at is null
    ) then 'picking_up'
    when exists (select 1 from public.job_assignments a where a.job_id = v_job.id and a.released_at is null) then 'assigned'
    else 'planned'
  end into v_new
  from public.bags where order_id = v_job.order_id and bag_status <> 'cancelled_before_pickup';

  if v_new is distinct from v_job.status then
    update public.delivery_jobs set status = v_new, version = version + 1 where id = v_job.id;
  end if;
  return v_new;
end;
$$;
revoke all on function public.recompute_job_status(uuid) from public;

-- 기사 배정·재배정 (운영자) -------------------------------------------------------
-- 새 담당자 권한 부여와 이전 담당자 권한 종료를 한 트랜잭션에서 처리한다 (LOG-04).
create or replace function public.assign_driver(p_job_id uuid, p_driver_id uuid)
returns public.job_assignments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_job public.delivery_jobs;
  v_current public.job_assignments;
  v_assignment public.job_assignments;
begin
  if not (select public.has_role('dispatcher')) then
    perform public.luggage_error('FORBIDDEN');
  end if;
  select * into v_job from public.delivery_jobs where id = p_job_id for update;
  if not found or v_job.status in ('cancelled', 'completed', 'returned') then
    perform public.luggage_error('JOB_NOT_ASSIGNABLE');
  end if;
  if not exists (select 1 from public.role_assignments where user_id = p_driver_id and role = 'driver') then
    perform public.luggage_error('DRIVER_INVALID');
  end if;

  select * into v_current from public.job_assignments where job_id = p_job_id and released_at is null for update;
  if found then
    if v_current.driver_id = p_driver_id then
      return v_current;
    end if;
    update public.job_assignments set released_at = now() where id = v_current.id;
  end if;

  insert into public.job_assignments (job_id, driver_id, assigned_by)
  values (p_job_id, p_driver_id, v_uid)
  returning * into v_assignment;
  perform public.recompute_job_status(p_job_id);
  insert into public.audit_events (actor_user_id, action, target_table, target_id, detail)
  values (v_uid, 'job.assigned', 'delivery_jobs', p_job_id,
          jsonb_build_object('driver_id', p_driver_id, 'previous_driver_id', v_current.driver_id));
  insert into public.outbox_events (topic, aggregate_id, payload)
  values ('job.assigned', p_job_id, jsonb_build_object('driver_id', p_driver_id));
  return v_assignment;
end;
$$;
revoke all on function public.assign_driver(uuid, uuid) from public;
grant execute on function public.assign_driver(uuid, uuid) to authenticated, service_role;

-- 짐 이벤트 기록 -----------------------------------------------------------------
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
    else
      -- delivered는 verify_handoff(), correction은 운영 정정 경로에서만
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

-- 고객 수령 코드 발급 ---------------------------------------------------------------
-- 인계 준비된 짐에 대해 6자리 코드를 만든다. 원문은 한 번만 돌려주고 해시만 저장한다.
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

-- 수령 코드 검증과 인계 완료 (배정 기사·운영자, 온라인 전용) ------------------------------------
-- challenge 행을 잠가 동시 검증에도 한 번만 완료된다 (LOG-08). 일부 짐만 인계할 수 있다.
create or replace function public.verify_handoff(
  p_job_id uuid,
  p_code text,
  p_tag_ids text[],
  p_client_event_id text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_job public.delivery_jobs;
  v_challenge public.handoff_challenges;
  v_role text;
  v_bag public.bags;
  v_count integer := 0;
begin
  if v_uid is null then
    perform public.luggage_error('SESSION_REQUIRED');
  end if;
  select * into v_job from public.delivery_jobs where id = p_job_id for update;
  if not found then
    perform public.luggage_error('JOB_NOT_FOUND');
  end if;
  v_role := case
    when public.is_active_driver(v_job.id) then 'driver'
    when (select public.has_role('dispatcher')) then 'dispatcher'
    else null
  end;
  if v_role is null then
    perform public.luggage_error('FORBIDDEN');
  end if;

  -- 같은 요청 재전송이면 이미 기록된 인계 수를 돌려준다.
  select count(*) into v_count from public.bag_events
   where actor_id = v_uid and client_event_id = p_client_event_id and event_type = 'delivered';
  if v_count > 0 then
    return v_count;
  end if;

  select * into v_challenge from public.handoff_challenges
   where job_id = v_job.id and consumed_at is null and revoked_at is null
   order by created_at desc limit 1
   for update;
  if not found or v_challenge.expires_at <= now() then
    perform public.luggage_error('HANDOFF_CODE_EXPIRED');
  end if;
  if v_challenge.attempts >= v_challenge.max_attempts then
    perform public.luggage_error('HANDOFF_CODE_LOCKED');
  end if;
  if v_challenge.code_hash <> encode(sha256(convert_to(v_challenge.id::text || ':' || coalesce(p_code, ''), 'UTF8')), 'hex') then
    update public.handoff_challenges set attempts = attempts + 1 where id = v_challenge.id;
    -- 실패 횟수를 남겨야 하므로 예외(롤백) 대신 -1을 돌려준다.
    return -1;
  end if;

  if p_tag_ids is null or cardinality(p_tag_ids) = 0 then
    perform public.luggage_error('BAGS_INVALID');
  end if;
  for v_bag in
    select * from public.bags where tag_id = any (select upper(btrim(x)) from unnest(p_tag_ids) x) order by seq for update
  loop
    if not (v_bag.id = any (v_challenge.bag_ids)) or v_bag.bag_status <> 'ready_for_handoff' then
      perform public.luggage_error('BAG_NOT_IN_JOB');
    end if;
    insert into public.bag_events (
      bag_id, job_id, order_id, actor_id, actor_role, event_type, from_status, to_status, client_event_id, details
    ) values (
      v_bag.id, v_job.id, v_job.order_id, v_uid, v_role, 'delivered', v_bag.bag_status, 'delivered', p_client_event_id,
      jsonb_build_object('challenge_id', v_challenge.id)
    );
    update public.bags set bag_status = 'delivered', version = version + 1 where id = v_bag.id;
    v_count := v_count + 1;
  end loop;
  if v_count <> cardinality(p_tag_ids) then
    perform public.luggage_error('BAG_NOT_IN_JOB');
  end if;

  update public.handoff_challenges set consumed_at = now(), consumed_by = v_uid where id = v_challenge.id;
  perform public.recompute_job_status(v_job.id);
  insert into public.outbox_events (topic, aggregate_id, payload)
  values ('bag.delivered', v_job.order_id, jsonb_build_object('count', v_count));
  return v_count;
end;
$$;
revoke all on function public.verify_handoff(uuid, text, text[], text) from public;
grant execute on function public.verify_handoff(uuid, text, text[], text) to authenticated, service_role;

-- 업무 화면용 최소 정보 조회 -------------------------------------------------------
-- 기사: 현재 배정 작업만. 연락처는 이름만 (전화·이메일 노출 금지, 연락은 운영자 경유).
create or replace function public.driver_jobs()
returns table (
  job_id uuid, job_status public.job_status, order_code text, customer_name text, route_type public.route_type,
  origin_hotel_name text, pickup_starts_at timestamptz, pickup_ends_at timestamptz,
  delivery_starts_at timestamptz, delivery_ends_at timestamptz, bag_count integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select j.id, j.status, o.public_code, o.contact ->> 'name', o.route_type, h.name_ko,
         s.pickup_starts_at, s.pickup_ends_at, s.delivery_starts_at, s.delivery_ends_at,
         (select count(*)::integer from public.bags b where b.order_id = o.id and b.bag_status <> 'cancelled_before_pickup')
    from public.job_assignments a
    join public.delivery_jobs j on j.id = a.job_id
    join public.orders o on o.id = j.order_id
    join public.service_slots s on s.id = j.slot_id
    left join public.hotels h on h.id = j.origin_hotel_id
   where a.driver_id = (select auth.uid()) and a.released_at is null and public.has_role('driver')
     and j.status not in ('cancelled', 'completed', 'returned')
   order by s.pickup_starts_at;
$$;
revoke all on function public.driver_jobs() from public;
grant execute on function public.driver_jobs() to authenticated;

-- 호텔: 자기 지점 출발 작업 (서비스 날짜 범위). 결제 정보·연락처 없음.
create or replace function public.partner_jobs(p_hotel_id uuid, p_from date, p_to date)
returns table (
  job_id uuid, job_status public.job_status, order_code text, customer_name text,
  service_date date, pickup_starts_at timestamptz, pickup_ends_at timestamptz, bag_count integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select j.id, j.status, o.public_code, o.contact ->> 'name', s.service_date, s.pickup_starts_at, s.pickup_ends_at,
         (select count(*)::integer from public.bags b where b.order_id = o.id and b.bag_status <> 'cancelled_before_pickup')
    from public.delivery_jobs j
    join public.orders o on o.id = j.order_id
    join public.service_slots s on s.id = j.slot_id
   where j.origin_hotel_id = p_hotel_id
     and public.has_role('hotel_staff', 'hotel', p_hotel_id)
     and s.service_date between p_from and p_to
     and j.status <> 'cancelled'
   order by s.pickup_starts_at;
$$;
revoke all on function public.partner_jobs(uuid, date, date) from public;
grant execute on function public.partner_jobs(uuid, date, date) to authenticated;
