-- A03 운영 콘텐츠 다국어 구조 (03 문서 4절).
-- 콘텐츠 ID + 언어별 번역 행. 게시 상태는 언어별로 관리한다.
-- 원문이 바뀌면 다른 언어 번역을 needs_review로 표시하고 자동 게시하지 않는다.

create type public.content_kind as enum ('guide', 'faq', 'notice', 'legal');
-- critical: 가격·취소·보험·금지 품목·필수 동의. 해당 언어 승인본이 없으면 대체 언어로 보여 주지 않는다.
create type public.content_criticality as enum ('general', 'critical');
create type public.translation_status as enum ('draft', 'review', 'published', 'archived');

create table public.content_items (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]*$'),
  kind public.content_kind not null,
  criticality public.content_criticality not null default 'general',
  -- 원문 언어. 한국어 운영 원문을 기본으로 한다.
  source_locale text not null default 'ko',
  -- 원문이 바뀔 때마다 증가한다.
  source_version integer not null default 1 check (source_version > 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- 구조만 열어 둔 언어(zh-TW, ja)도 저장할 수 있다. 공개 라우팅은 승인 후 연다.
  constraint content_items_source_locale check (source_locale in ('zh-CN', 'ko', 'en', 'zh-TW', 'ja'))
);

create table public.content_translations (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null references public.content_items (id) on delete cascade,
  locale text not null check (locale in ('zh-CN', 'ko', 'en', 'zh-TW', 'ja')),
  title text not null check (char_length(title) between 1 and 200),
  body text not null default '',
  status public.translation_status not null default 'draft',
  -- 이 번역이 기준으로 삼은 원문 버전
  based_on_version integer not null default 1,
  needs_review boolean not null default false,
  reviewed_by uuid references auth.users (id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint content_translations_content_locale_key unique (content_id, locale),
  constraint content_translations_published_at check ((status = 'published') = (published_at is not null)),
  -- 검토가 필요한 번역은 게시 상태로 둘 수 없다.
  constraint content_translations_no_publish_needs_review check (not (status = 'published' and needs_review))
);

create index content_translations_public_idx on public.content_translations (locale, status) where status = 'published';

create trigger content_items_set_updated_at
  before update on public.content_items
  for each row execute function public.set_updated_at();
create trigger content_translations_set_updated_at
  before update on public.content_translations
  for each row execute function public.set_updated_at();

-- 원문 번역의 제목·본문이 바뀌면 원문 버전을 올리고 다른 언어를 검토 대기로 돌린다.
-- 게시 중이던 번역은 needs_review 표시 후에도 기존 게시본이 유지되도록 review 상태로 내린다.
create or replace function public.flag_translations_for_review()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  item public.content_items;
begin
  if new.title is not distinct from old.title and new.body is not distinct from old.body then
    return new;
  end if;
  select * into item from public.content_items where id = new.content_id;
  if item.source_locale <> new.locale then
    return new;
  end if;

  update public.content_items set source_version = source_version + 1 where id = new.content_id
    returning source_version into item.source_version;
  new.based_on_version := item.source_version;

  update public.content_translations t
     set needs_review = true,
         status = case when t.status = 'published' then 'review'::public.translation_status else t.status end,
         published_at = case when t.status = 'published' then null else t.published_at end
   where t.content_id = new.content_id
     and t.locale <> new.locale
     and t.status <> 'archived';
  return new;
end;
$$;

create trigger content_translations_flag_review
  before update of title, body on public.content_translations
  for each row execute function public.flag_translations_for_review();

-- 번역이 최신 원문을 반영했다고 표시(needs_review = false)하려면 최신 원문 버전을 기준으로 해야 한다.
create or replace function public.validate_translation_version()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  item public.content_items;
begin
  select * into item from public.content_items where id = new.content_id;
  if new.based_on_version > item.source_version then
    raise exception 'translation cannot be based on a future source version'
      using errcode = 'check_violation', constraint = 'content_translations_version_range';
  end if;
  if new.locale <> item.source_locale and not new.needs_review and new.based_on_version < item.source_version then
    raise exception 'translation is based on an outdated source version'
      using errcode = 'check_violation', constraint = 'content_translations_outdated_source';
  end if;
  return new;
end;
$$;

create trigger content_translations_validate_version
  before insert or update on public.content_translations
  for each row execute function public.validate_translation_version();

-- 권한 --------------------------------------------------------------------
alter table public.content_items enable row level security;
alter table public.content_translations enable row level security;

revoke all on public.content_items, public.content_translations from anon, authenticated;
grant select on public.content_items, public.content_translations to anon, authenticated;
grant insert, update on public.content_items, public.content_translations to authenticated;
grant select, insert, update, delete on public.content_items, public.content_translations to service_role;

-- 공개: 게시된 번역과 그 콘텐츠만 보인다.
create policy content_translations_public_read on public.content_translations
  for select to anon, authenticated
  using (status = 'published');

create policy content_items_public_read on public.content_items
  for select to anon, authenticated
  using (exists (
    select 1 from public.content_translations t
    where t.content_id = content_items.id and t.status = 'published'
  ));

-- 편집자: 모든 상태를 보고 초안·검토본을 만든다.
create policy content_translations_editor_read on public.content_translations
  for select to authenticated
  using ((select public.has_role('content_editor')));

create policy content_items_editor_read on public.content_items
  for select to authenticated
  using ((select public.has_role('content_editor')));

create policy content_items_editor_write on public.content_items
  for insert to authenticated
  with check ((select public.has_role('content_editor')));

create policy content_items_editor_update on public.content_items
  for update to authenticated
  using ((select public.has_role('content_editor')))
  with check ((select public.has_role('content_editor')));

create policy content_translations_editor_insert on public.content_translations
  for insert to authenticated
  with check ((select public.has_role('content_editor')) and status in ('draft', 'review'));

-- 게시(published)와 보관(archived)은 admin만 한다. has_role('admin')은 admin 역할만 참이다.
create policy content_translations_editor_update on public.content_translations
  for update to authenticated
  using ((select public.has_role('content_editor')))
  with check (
    (select public.has_role('content_editor'))
    and (status in ('draft', 'review') or (select public.has_role('admin')))
  );
