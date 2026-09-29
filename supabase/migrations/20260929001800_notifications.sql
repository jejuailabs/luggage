-- E01 알림: outbox 소비자, 앱 내 알림함, 웹 푸시 구독 (04 문서 6절, 07 문서 9절, 09 문서 9절).
-- - outbox는 lease로 가져가고 지수 백오프로 재시도하며 5회 실패하면 dead로 남긴다.
-- - 알림 발송 실패는 이미 기록된 수거·인계·결제를 취소하지 않는다.
-- - 전달·읽음 상태는 실제로 알 수 있는 범위(푸시 발송 성공, 알림함 읽음)만 기록한다.

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  topic text not null,
  title text not null check (char_length(title) between 1 and 120),
  body text not null check (char_length(body) <= 500),
  -- 같은 서비스 안의 상대 경로만
  url text check (url ~ '^/[A-Za-z0-9/_?=&.-]*$'),
  outbox_event_id uuid references public.outbox_events (id) on delete set null,
  push_sent_at timestamptz,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint notifications_user_event_key unique (user_id, outbox_event_id)
);
create index notifications_user_unread_idx on public.notifications (user_id, created_at desc) where read_at is null;

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null unique check (endpoint ~ '^https://'),
  p256dh text not null,
  auth text not null,
  failure_count integer not null default 0,
  last_success_at timestamptz,
  created_at timestamptz not null default now()
);
create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.notifications enable row level security;
alter table public.push_subscriptions enable row level security;
revoke all on public.notifications, public.push_subscriptions from anon, authenticated;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
grant select, insert, delete on public.push_subscriptions to authenticated;
grant select, insert, update, delete on public.notifications, public.push_subscriptions to service_role;

create policy notifications_select_own on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));
create policy notifications_read_own on public.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy push_subscriptions_own_select on public.push_subscriptions for select to authenticated
  using (user_id = (select auth.uid()));
create policy push_subscriptions_own_insert on public.push_subscriptions for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy push_subscriptions_own_delete on public.push_subscriptions for delete to authenticated
  using (user_id = (select auth.uid()));

-- outbox 소비 -------------------------------------------------------------------
create or replace function public.claim_outbox(p_limit integer default 50, p_lease_seconds integer default 120)
returns setof public.outbox_events
language sql
security definer
set search_path = ''
as $$
  update public.outbox_events e
     set status = 'processing', lease_until = now() + make_interval(secs => p_lease_seconds), attempts = e.attempts + 1
   where e.id in (
     select id from public.outbox_events
      where (status = 'pending' and available_at <= now())
         or (status = 'processing' and lease_until < now())
      order by created_at
      limit p_limit
      for update skip locked
   )
  returning e.*;
$$;
revoke all on function public.claim_outbox(integer, integer) from public;
grant execute on function public.claim_outbox(integer, integer) to service_role;

create or replace function public.complete_outbox(p_id uuid, p_ok boolean, p_error text default null)
returns public.outbox_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.outbox_events;
begin
  select * into v_event from public.outbox_events where id = p_id for update;
  if not found or v_event.status <> 'processing' then
    return v_event.status;
  end if;
  if p_ok then
    update public.outbox_events set status = 'done', lease_until = null, last_error = null where id = p_id;
    return 'done';
  end if;
  if v_event.attempts >= 5 then
    update public.outbox_events set status = 'dead', lease_until = null, last_error = left(p_error, 500) where id = p_id;
    return 'dead';
  end if;
  update public.outbox_events
     set status = 'pending', lease_until = null, last_error = left(p_error, 500),
         available_at = now() + make_interval(mins => power(2, v_event.attempts)::integer)
   where id = p_id;
  return 'pending';
end;
$$;
revoke all on function public.complete_outbox(uuid, boolean, text) from public;
grant execute on function public.complete_outbox(uuid, boolean, text) to service_role;
