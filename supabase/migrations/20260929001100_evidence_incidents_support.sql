-- C03 인계 사진(비공개), C05 사고·보상·고객지원 (05 문서 8절, 07 문서 8·9절).

create type public.evidence_purpose as enum ('collection_photo', 'damage_photo', 'handoff_photo', 'return_photo');
create type public.incident_type as enum (
  'missing_at_origin', 'damage', 'quantity_mismatch', 'vehicle_breakdown', 'delay', 'flight_change',
  'customer_no_show', 'partial_missing', 'lost', 'location_change', 'other'
);
create type public.incident_status as enum ('open', 'investigating', 'resolved');
create type public.ticket_status as enum ('open', 'pending_customer', 'resolved');
create type public.message_visibility as enum ('customer', 'internal');
create type public.claim_status as enum ('submitted', 'under_review', 'approved', 'rejected', 'paid');

-- 증빙 파일 ---------------------------------------------------------------
create table public.evidence_files (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete restrict,
  job_id uuid not null references public.delivery_jobs (id) on delete restrict,
  bag_id uuid references public.bags (id) on delete restrict,
  purpose public.evidence_purpose not null,
  -- 비공개 버킷 내 경로. 이름·전화 등 개인정보를 넣지 않는다 ({order_id}/{id}.{ext}).
  storage_path text not null unique,
  content_type text not null check (content_type in ('image/jpeg', 'image/webp')),
  size_bytes integer not null check (size_bytes between 1 and 5242880),
  uploaded_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  -- 보존 기한 (정책값으로 조정). 기한이 지나면 정리 작업이 파일과 행을 지운다.
  retention_until timestamptz not null default now() + interval '180 days'
);
create index evidence_files_order_idx on public.evidence_files (order_id);

-- 짐 이벤트의 증빙은 같은 작업의 파일이어야 한다.
create or replace function public.validate_event_evidence()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if cardinality(new.evidence_ids) > 0 and exists (
    select 1 from unnest(new.evidence_ids) e(id)
    where not exists (select 1 from public.evidence_files f where f.id = e.id and f.job_id = new.job_id)
  ) then
    raise exception 'LUGGAGE:EVIDENCE_INVALID' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger bag_events_validate_evidence
  before insert on public.bag_events
  for each row execute function public.validate_event_evidence();

-- 업로드 의도: 권한 확인 후 경로를 정한다. 실제 업로드 URL은 서버가 짧은 서명 URL로 발급한다.
create or replace function public.create_evidence_intent(
  p_job_id uuid,
  p_tag_id text,
  p_purpose public.evidence_purpose,
  p_content_type text,
  p_size_bytes integer
)
returns public.evidence_files
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_job public.delivery_jobs;
  v_bag_id uuid;
  v_id uuid := gen_random_uuid();
  v_row public.evidence_files;
begin
  select * into v_job from public.delivery_jobs where id = p_job_id;
  if not found then
    perform public.luggage_error('JOB_NOT_FOUND');
  end if;
  if not (
    public.is_active_driver(v_job.id)
    or (v_job.origin_hotel_id is not null and public.has_role('hotel_staff', 'hotel', v_job.origin_hotel_id))
    or (select public.has_role('dispatcher'))
  ) then
    perform public.luggage_error('FORBIDDEN');
  end if;
  if p_tag_id is not null then
    select id into v_bag_id from public.bags where tag_id = upper(btrim(p_tag_id)) and order_id = v_job.order_id;
    if v_bag_id is null then
      perform public.luggage_error('BAG_NOT_IN_JOB');
    end if;
  end if;
  -- 작업당 증빙 수 제한 (남용 방지)
  if (select count(*) from public.evidence_files where job_id = v_job.id) >= 60 then
    perform public.luggage_error('EVIDENCE_LIMIT');
  end if;

  insert into public.evidence_files (id, order_id, job_id, bag_id, purpose, storage_path, content_type, size_bytes, uploaded_by)
  values (
    v_id, v_job.order_id, v_job.id, v_bag_id, p_purpose,
    v_job.order_id::text || '/' || v_id::text || case p_content_type when 'image/webp' then '.webp' else '.jpg' end,
    p_content_type, p_size_bytes, v_uid
  ) returning * into v_row;
  return v_row;
end;
$$;
revoke all on function public.create_evidence_intent(uuid, text, public.evidence_purpose, text, integer) from public;
grant execute on function public.create_evidence_intent(uuid, text, public.evidence_purpose, text, integer) to authenticated, service_role;

-- 사고 ------------------------------------------------------------------
create table public.incidents (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete restrict,
  job_id uuid references public.delivery_jobs (id) on delete restrict,
  bag_id uuid references public.bags (id) on delete restrict,
  type public.incident_type not null,
  severity smallint not null default 2 check (severity between 1 and 3),
  status public.incident_status not null default 'open',
  description text not null check (char_length(description) between 1 and 2000),
  resolution text,
  reported_by uuid not null references auth.users (id) on delete restrict,
  resolved_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  constraint incidents_resolution check ((status = 'resolved') = (resolved_at is not null and resolution is not null))
);
create index incidents_open_idx on public.incidents (created_at) where status <> 'resolved';

-- 분실·파손 보상은 PG 환불과 별도로 추적한다.
create table public.compensation_claims (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.incidents (id) on delete restrict,
  order_id uuid not null references public.orders (id) on delete restrict,
  status public.claim_status not null default 'submitted',
  requested_amount_minor integer check (requested_amount_minor >= 0),
  approved_amount_minor integer check (approved_amount_minor >= 0),
  currency text not null default 'KRW',
  -- 보험 접수 등 외부 참조 (계약 번호를 임의 생성하지 않는다)
  insurance_reference text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.report_incident(
  p_job_id uuid,
  p_tag_id text,
  p_type public.incident_type,
  p_severity smallint,
  p_description text
)
returns public.incidents
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_job public.delivery_jobs;
  v_bag_id uuid;
  v_row public.incidents;
begin
  select * into v_job from public.delivery_jobs where id = p_job_id;
  if not found then
    perform public.luggage_error('JOB_NOT_FOUND');
  end if;
  if not (
    public.is_active_driver(v_job.id)
    or (v_job.origin_hotel_id is not null and public.has_role('hotel_staff', 'hotel', v_job.origin_hotel_id))
    or (select public.is_operations_staff())
  ) then
    perform public.luggage_error('FORBIDDEN');
  end if;
  if p_tag_id is not null then
    select id into v_bag_id from public.bags where tag_id = upper(btrim(p_tag_id)) and order_id = v_job.order_id;
    if v_bag_id is null then
      perform public.luggage_error('BAG_NOT_IN_JOB');
    end if;
  end if;
  if coalesce(btrim(p_description), '') = '' then
    perform public.luggage_error('EVIDENCE_REQUIRED');
  end if;
  insert into public.incidents (order_id, job_id, bag_id, type, severity, description, reported_by)
  values (v_job.order_id, v_job.id, v_bag_id, p_type, coalesce(p_severity, 2), btrim(p_description), v_uid)
  returning * into v_row;
  insert into public.outbox_events (topic, aggregate_id, payload)
  values ('incident.opened', v_job.order_id, jsonb_build_object('incident_id', v_row.id, 'type', p_type, 'severity', v_row.severity));
  return v_row;
end;
$$;
revoke all on function public.report_incident(uuid, text, public.incident_type, smallint, text) from public;
grant execute on function public.report_incident(uuid, text, public.incident_type, smallint, text) to authenticated, service_role;

-- 고객지원 ----------------------------------------------------------------
create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete restrict,
  order_id uuid references public.orders (id) on delete restrict,
  locale text not null check (locale in ('zh-CN', 'ko', 'en')),
  subject text not null check (char_length(subject) between 1 and 200),
  status public.ticket_status not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index support_tickets_owner_idx on public.support_tickets (owner_id, created_at desc);
create index support_tickets_open_idx on public.support_tickets (created_at) where status <> 'resolved';

create table public.support_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets (id) on delete cascade,
  author_id uuid not null references auth.users (id) on delete restrict,
  author_role text not null check (author_role in ('customer', 'staff')),
  -- 내부 메모는 고객에게 절대 보이지 않는다.
  visibility public.message_visibility not null,
  body text not null check (char_length(body) between 1 and 4000),
  client_message_id text,
  created_at timestamptz not null default now(),
  constraint support_messages_customer_visibility check (author_role = 'staff' or visibility = 'customer'),
  constraint support_messages_client_key unique (author_id, client_message_id)
);
create index support_messages_ticket_idx on public.support_messages (ticket_id, created_at);

create or replace function public.is_support_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_role('support') or public.has_role('dispatcher');
$$;
revoke all on function public.is_support_staff() from public;
grant execute on function public.is_support_staff() to authenticated, service_role;

create or replace function public.create_support_ticket(
  p_order_id uuid,
  p_locale text,
  p_subject text,
  p_body text,
  p_client_message_id text
)
returns public.support_tickets
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_ticket public.support_tickets;
  v_existing uuid;
begin
  if v_uid is null then
    perform public.luggage_error('SESSION_REQUIRED');
  end if;
  -- 같은 요청 재전송이면 기존 문의
  select m.ticket_id into v_existing from public.support_messages m
   where m.author_id = v_uid and m.client_message_id = p_client_message_id;
  if v_existing is not null then
    select * into v_ticket from public.support_tickets where id = v_existing;
    return v_ticket;
  end if;
  if p_order_id is not null and not exists (select 1 from public.orders where id = p_order_id and owner_id = v_uid) then
    perform public.luggage_error('ORDER_NOT_FOUND');
  end if;
  if coalesce(btrim(p_subject), '') = '' or coalesce(btrim(p_body), '') = '' or p_locale not in ('zh-CN', 'ko', 'en') then
    perform public.luggage_error('SUPPORT_INVALID');
  end if;
  -- 남용 방지: 사용자당 열린 문의 5건
  if (select count(*) from public.support_tickets where owner_id = v_uid and status <> 'resolved') >= 5 then
    perform public.luggage_error('SUPPORT_LIMIT');
  end if;

  insert into public.support_tickets (owner_id, order_id, locale, subject)
  values (v_uid, p_order_id, p_locale, btrim(p_subject))
  returning * into v_ticket;
  insert into public.support_messages (ticket_id, author_id, author_role, visibility, body, client_message_id)
  values (v_ticket.id, v_uid, 'customer', 'customer', btrim(p_body), p_client_message_id);
  insert into public.outbox_events (topic, aggregate_id, payload)
  values ('support.ticket_opened', v_ticket.id, jsonb_build_object('order_id', p_order_id, 'locale', p_locale));
  return v_ticket;
end;
$$;
revoke all on function public.create_support_ticket(uuid, text, text, text, text) from public;
grant execute on function public.create_support_ticket(uuid, text, text, text, text) to authenticated, service_role;

create or replace function public.add_support_message(
  p_ticket_id uuid,
  p_body text,
  p_visibility public.message_visibility,
  p_client_message_id text
)
returns public.support_messages
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_ticket public.support_tickets;
  v_staff boolean := (select public.is_support_staff());
  v_message public.support_messages;
begin
  select * into v_ticket from public.support_tickets where id = p_ticket_id for update;
  if not found or (v_ticket.owner_id <> v_uid and not v_staff) then
    perform public.luggage_error('NOT_FOUND');
  end if;
  select * into v_message from public.support_messages where author_id = v_uid and client_message_id = p_client_message_id;
  if found then
    return v_message;
  end if;
  if coalesce(btrim(p_body), '') = '' then
    perform public.luggage_error('SUPPORT_INVALID');
  end if;
  -- 고객은 내부 메모를 쓸 수 없다.
  if not v_staff and p_visibility <> 'customer' then
    perform public.luggage_error('FORBIDDEN');
  end if;

  insert into public.support_messages (ticket_id, author_id, author_role, visibility, body, client_message_id)
  values (v_ticket.id, v_uid, case when v_staff and v_ticket.owner_id <> v_uid then 'staff' else 'customer' end,
          p_visibility, btrim(p_body), p_client_message_id)
  returning * into v_message;
  update public.support_tickets
     set status = case when v_message.author_role = 'staff' and p_visibility = 'customer' then 'pending_customer'::public.ticket_status
                       when v_message.author_role = 'customer' then 'open'::public.ticket_status
                       else status end
   where id = v_ticket.id;
  if p_visibility = 'customer' and v_message.author_role = 'staff' then
    insert into public.outbox_events (topic, aggregate_id, payload)
    values ('support.replied', v_ticket.id, jsonb_build_object('message_id', v_message.id));
  end if;
  return v_message;
end;
$$;
revoke all on function public.add_support_message(uuid, text, public.message_visibility, text) from public;
grant execute on function public.add_support_message(uuid, text, public.message_visibility, text) to authenticated, service_role;

-- updated_at·감사 --------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['incidents', 'compensation_claims', 'support_tickets'] loop
    execute format(
      'create trigger %1$s_set_updated_at before update on public.%1$s for each row execute function public.set_updated_at()', t);
  end loop;
  foreach t in array array['incidents', 'compensation_claims'] loop
    execute format(
      'create trigger %1$s_audit after insert or update or delete on public.%1$s for each row execute function public.audit_row_change()', t);
  end loop;
end
$$;

-- 권한 --------------------------------------------------------------------
alter table public.evidence_files enable row level security;
alter table public.incidents enable row level security;
alter table public.compensation_claims enable row level security;
alter table public.support_tickets enable row level security;
alter table public.support_messages enable row level security;

revoke all on public.evidence_files, public.incidents, public.compensation_claims, public.support_tickets, public.support_messages
  from anon, authenticated;
grant select on public.evidence_files, public.incidents, public.compensation_claims, public.support_tickets, public.support_messages
  to authenticated;
grant update (status, resolution, resolved_by, resolved_at, severity) on public.incidents to authenticated;
grant update (status) on public.support_tickets to authenticated;
grant insert, update on public.compensation_claims to authenticated;
grant select, insert, update, delete on public.evidence_files, public.incidents, public.compensation_claims,
  public.support_tickets, public.support_messages to service_role;

-- 증빙: 주문 소유자·운영자·현재 배정 기사·출발 호텔 직원
create policy evidence_files_select on public.evidence_files for select to authenticated
  using (exists (select 1 from public.delivery_jobs j where j.id = job_id));

-- 사고: 운영자 전체, 보고자 본인
create policy incidents_select on public.incidents for select to authenticated
  using ((select public.is_operations_staff()) or reported_by = (select auth.uid()));
create policy incidents_update on public.incidents for update to authenticated
  using ((select public.has_role('dispatcher'))) with check ((select public.has_role('dispatcher')));

-- 보상: 운영자·재무, 고객은 자기 주문 건 조회
create policy compensation_claims_select on public.compensation_claims for select to authenticated
  using (
    (select public.is_operations_staff()) or (select public.is_finance_staff())
    or exists (select 1 from public.orders o where o.id = order_id and o.owner_id = (select auth.uid()))
  );
create policy compensation_claims_write on public.compensation_claims for insert to authenticated
  with check ((select public.has_role('dispatcher')) or (select public.is_finance_staff()));
create policy compensation_claims_update on public.compensation_claims for update to authenticated
  using ((select public.is_finance_staff())) with check ((select public.is_finance_staff()));

-- 문의: 본인 또는 지원 담당. 메시지는 고객에게 customer 공개분만.
create policy support_tickets_select on public.support_tickets for select to authenticated
  using (owner_id = (select auth.uid()) or (select public.is_support_staff()));
create policy support_tickets_update on public.support_tickets for update to authenticated
  using ((select public.is_support_staff())) with check ((select public.is_support_staff()));
create policy support_messages_select on public.support_messages for select to authenticated
  using (
    (select public.is_support_staff())
    or (visibility = 'customer' and exists (select 1 from public.support_tickets t where t.id = ticket_id and t.owner_id = (select auth.uid())))
  );

-- 비공개 Storage 버킷 (Supabase 환경에서만). 공개 URL 없음, 서버 서명 URL로만 접근한다.
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage')
     and exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'storage' and c.relname = 'buckets') then
    execute $sql$
      insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
      values ('evidence', 'evidence', false, 5242880, array['image/jpeg', 'image/webp'])
      on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types
    $sql$;
  end if;
end
$$;
