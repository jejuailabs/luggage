-- A01 기반: 공통 트리거, 환경·연동 모드 타입, 기능 설정.
-- 원칙(05 문서 1절): UUID 기본키, 생성·변경 시각, 노출 스키마는 grants와 RLS를 모두 설정한다.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create type public.app_env as enum ('local', 'preview', 'staging', 'production');
create type public.integration_mode as enum ('mock', 'sandbox', 'live');

-- 기능·연동별 판매/활성 설정. 미연동 기능의 판매를 서버에서 막는 기준이다.
create table public.feature_settings (
  id uuid primary key default gen_random_uuid(),
  feature text not null check (feature ~ '^[a-z][a-z0-9_.]*$'),
  environment public.app_env not null,
  mode public.integration_mode not null default 'mock',
  enabled boolean not null default false,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint feature_settings_feature_environment_key unique (feature, environment),
  -- 운영에서 mock 연동을 활성화할 수 없다.
  constraint feature_settings_no_mock_in_production
    check (not (environment = 'production' and mode = 'mock' and enabled)),
  -- 실연동(live)은 운영 환경에서만 허용한다.
  constraint feature_settings_live_only_in_production
    check (mode <> 'live' or environment = 'production')
);

create trigger feature_settings_set_updated_at
  before update on public.feature_settings
  for each row execute function public.set_updated_at();

alter table public.feature_settings enable row level security;
-- 서버 전용 설정이다. anon·authenticated에는 권한도 정책도 주지 않는다.
revoke all on public.feature_settings from anon, authenticated;
grant select, insert, update, delete on public.feature_settings to service_role;
