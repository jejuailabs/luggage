-- D03 유입 (08 문서 2–4절).
-- - 상황별 콘텐츠는 관련 노선을 참조해 실제 예약 행동으로 연결한다 (가격·장소를 본문에 복사하지 않는다).
-- - 캠페인(샤오홍슈 등) 기록: 소재·게시 URL·랜딩·캠페인 코드. 자동 게시·수집은 하지 않는다.

alter table public.content_items add column related_route public.route_type;
comment on column public.content_items.related_route is '콘텐츠가 안내하는 노선. 페이지에서 해당 노선 예약으로 연결한다.';

create table public.marketing_campaigns (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Za-z0-9_-]{1,40}$'),
  channel public.attribution_channel not null,
  name text not null check (char_length(name) between 1 and 120),
  post_url text check (post_url ~ '^https://'),
  published_on date,
  keywords text[] not null default '{}',
  landing_path text not null check (landing_path ~ '^/'),
  owner_id uuid references auth.users (id) on delete set null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger marketing_campaigns_set_updated_at before update on public.marketing_campaigns
  for each row execute function public.set_updated_at();
create trigger marketing_campaigns_audit after insert or update or delete on public.marketing_campaigns
  for each row execute function public.audit_row_change();

alter table public.marketing_campaigns enable row level security;
revoke all on public.marketing_campaigns from anon, authenticated;
grant select, insert, update on public.marketing_campaigns to authenticated;
grant select, insert, update, delete on public.marketing_campaigns to service_role;

create policy marketing_campaigns_select on public.marketing_campaigns for select to authenticated
  using ((select public.has_role('content_editor')) or (select public.is_operations_staff()));
create policy marketing_campaigns_insert on public.marketing_campaigns for insert to authenticated
  with check ((select public.has_role('content_editor')));
create policy marketing_campaigns_update on public.marketing_campaigns for update to authenticated
  using ((select public.has_role('content_editor'))) with check ((select public.has_role('content_editor')));
