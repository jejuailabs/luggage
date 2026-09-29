-- A02 계정·역할: profiles, role_assignments, audit_events.
-- 05 문서 2·6절: 사용자는 profile로 역할을 바꿀 수 없다. 역할은 서버(service_role)만 부여한다.
-- guest는 Supabase anonymous auth 사용자(auth.users.is_anonymous = true)다. DB의 anon 역할과 다르다.

create type public.staff_role as enum (
  'driver', 'hotel_staff', 'support', 'dispatcher', 'finance', 'content_editor', 'admin'
);
create type public.role_scope as enum ('global', 'hotel');
create type public.theme_preference as enum ('light', 'dark', 'system');

-- 프로필 ------------------------------------------------------------------
create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 80),
  locale text not null default 'zh-CN' check (locale in ('zh-CN', 'ko', 'en')),
  theme public.theme_preference not null default 'system',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- auth 사용자 생성 시 프로필을 만든다 (guest 포함).
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

alter table public.profiles enable row level security;
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
-- 사용자가 바꿀 수 있는 열만 허용한다. user_id·시각은 변경 불가.
grant update (display_name, locale, theme) on public.profiles to authenticated;
grant select, insert, update, delete on public.profiles to service_role;

create policy profiles_select_own on public.profiles
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- 역할 부여 ---------------------------------------------------------------
create table public.role_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.staff_role not null,
  scope_type public.role_scope not null default 'global',
  -- hotel 범위일 때 호텔 ID. hotels 테이블(A05)이 생기면 FK를 추가한다.
  scope_id uuid,
  granted_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint role_assignments_scope_shape check (
    (scope_type = 'global' and scope_id is null) or (scope_type = 'hotel' and scope_id is not null)
  ),
  -- 호텔 직원은 반드시 지점 범위, 나머지 업무 역할은 전역 범위다.
  constraint role_assignments_role_scope check (
    (role = 'hotel_staff') = (scope_type = 'hotel')
  )
);

create unique index role_assignments_unique_scope
  on public.role_assignments (user_id, role, scope_type, coalesce(scope_id, '00000000-0000-0000-0000-000000000000'::uuid));
create index role_assignments_user_idx on public.role_assignments (user_id);

-- guest(anonymous) 사용자에게 업무 역할을 줄 수 없다.
create or replace function public.guard_role_assignment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from auth.users u where u.id = new.user_id and u.is_anonymous) then
    raise exception 'anonymous users cannot hold staff roles'
      using errcode = 'check_violation', constraint = 'role_assignments_no_anonymous';
  end if;
  return new;
end;
$$;

create trigger role_assignments_guard
  before insert or update on public.role_assignments
  for each row execute function public.guard_role_assignment();

alter table public.role_assignments enable row level security;
revoke all on public.role_assignments from anon, authenticated;
grant select on public.role_assignments to authenticated;
grant select, insert, update, delete on public.role_assignments to service_role;

create policy role_assignments_select_own on public.role_assignments
  for select to authenticated
  using (user_id = (select auth.uid()));

-- RLS에서 쓰는 역할 확인 함수. 호출자 본인의 역할만 확인한다.
create or replace function public.has_role(
  check_role public.staff_role,
  check_scope_type public.role_scope default 'global',
  check_scope_id uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.role_assignments ra
    where ra.user_id = (select auth.uid())
      and (
        ra.role = 'admin'
        or (
          ra.role = check_role
          and ra.scope_type = check_scope_type
          and ra.scope_id is not distinct from check_scope_id
        )
      )
  );
$$;

revoke all on function public.has_role(public.staff_role, public.role_scope, uuid) from public;
grant execute on function public.has_role(public.staff_role, public.role_scope, uuid) to authenticated, service_role;

-- 감사 기록 ---------------------------------------------------------------
create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  actor_user_id uuid,
  action text not null check (action ~ '^[a-z][a-z0-9_.]*$'),
  target_table text not null,
  target_id uuid,
  detail jsonb not null default '{}'::jsonb
);

create index audit_events_target_idx on public.audit_events (target_table, target_id, occurred_at desc);

alter table public.audit_events enable row level security;
revoke all on public.audit_events from anon, authenticated;
-- 감사 기록은 추가만 한다. 수정·삭제 권한을 주지 않는다.
grant select, insert on public.audit_events to service_role;

create or replace function public.audit_role_assignment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  row_data public.role_assignments;
begin
  row_data := coalesce(new, old);
  insert into public.audit_events (actor_user_id, action, target_table, target_id, detail)
  values (
    coalesce((select auth.uid()), row_data.granted_by),
    case tg_op when 'INSERT' then 'role.granted' when 'DELETE' then 'role.revoked' else 'role.changed' end,
    'role_assignments',
    row_data.id,
    jsonb_build_object(
      'user_id', row_data.user_id,
      'role', row_data.role,
      'scope_type', row_data.scope_type,
      'scope_id', row_data.scope_id
    )
  );
  return row_data;
end;
$$;

create trigger role_assignments_audit
  after insert or update or delete on public.role_assignments
  for each row execute function public.audit_role_assignment();
