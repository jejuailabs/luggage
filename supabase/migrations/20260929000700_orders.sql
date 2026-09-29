-- B03 비회원 주문 (06 문서 3·4절, 04 문서 5·6절).
-- 주문 생성: 멱등 키 → 견적 소유·만료 → 슬롯 재검사 → 용량 행 잠금·홀드 → 주문·짐 행 → outbox → 멱등 결과 저장.
-- 예약 상태는 결제·배송 상태와 분리한다.

create type public.reservation_status as enum ('draft', 'held', 'confirmed', 'cancelled', 'expired', 'needs_review');
create type public.capacity_hold_status as enum ('held', 'committed', 'released');
create type public.outbox_status as enum ('pending', 'processing', 'done', 'dead');

-- 필수 동의 정책 (고객 언어로 게시돼 있어야 주문 가능)
alter table public.booking_settings
  add column required_policy_slugs text[] not null default array['bag-size-rules', 'prohibited-items'];

-- 멱등 키 -----------------------------------------------------------------
create table public.idempotency_keys (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references auth.users (id) on delete cascade,
  operation text not null,
  key text not null check (char_length(key) between 8 and 128),
  request_hash text not null,
  result_id uuid,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '24 hours',
  constraint idempotency_keys_scope_key unique (actor_id, operation, key)
);

-- Outbox -----------------------------------------------------------------
create table public.outbox_events (
  id uuid primary key default gen_random_uuid(),
  topic text not null check (topic ~ '^[a-z][a-z0-9_.]*$'),
  aggregate_id uuid not null,
  payload jsonb not null default '{}'::jsonb,
  status public.outbox_status not null default 'pending',
  attempts integer not null default 0,
  available_at timestamptz not null default now(),
  lease_until timestamptz,
  last_error text,
  created_at timestamptz not null default now()
);
create index outbox_events_ready_idx on public.outbox_events (available_at) where status = 'pending';

-- 주문 -------------------------------------------------------------------
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  -- 고객에게 보여 주는 참조 번호. 조회 권한을 주지 않는다 (소유 세션 필요).
  public_code text not null unique check (public_code ~ '^JC[A-HJ-NP-Z2-9]{8}$'),
  owner_id uuid not null references auth.users (id) on delete restrict,
  quote_id uuid not null unique references public.quotes (id) on delete restrict,
  slot_id uuid not null references public.service_slots (id) on delete restrict,
  route_offering_id uuid not null references public.route_offerings (id) on delete restrict,
  route_type public.route_type not null,
  origin_hotel_id uuid references public.hotels (id) on delete restrict,
  destination_hotel_id uuid references public.hotels (id) on delete restrict,
  flight_number text,
  flight_departs_at timestamptz,
  reservation_status public.reservation_status not null default 'held',
  hold_expires_at timestamptz,
  capacity_units integer not null check (capacity_units > 0),
  subtotal_minor integer not null check (subtotal_minor >= 0),
  discount_minor integer not null default 0 check (discount_minor >= 0),
  total_minor integer not null check (total_minor >= 0),
  tax_minor integer not null check (tax_minor >= 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  -- 주문 당시 연락처 스냅샷 {name, email, phone, wechat}
  contact jsonb not null check (jsonb_typeof(contact) = 'object'),
  locale text not null check (locale in ('zh-CN', 'ko', 'en')),
  version integer not null default 1,
  confirmed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orders_total check (total_minor = subtotal_minor - discount_minor and tax_minor <= total_minor),
  constraint orders_hold_shape check (reservation_status <> 'held' or hold_expires_at is not null)
);
create index orders_owner_idx on public.orders (owner_id, created_at desc);
create index orders_hold_expiry_idx on public.orders (hold_expires_at) where reservation_status = 'held';

create table public.order_bags (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  size public.bag_size not null,
  quantity integer not null check (quantity > 0),
  unit_amount_minor integer not null check (unit_amount_minor >= 0),
  amount_minor integer not null check (amount_minor >= 0),
  -- 부분환불용 세액 배분 스냅샷 (잔여는 금액이 가장 큰 행에 배분)
  tax_minor integer not null check (tax_minor >= 0),
  price_rule_id uuid references public.price_rules (id) on delete restrict,
  constraint order_bags_amount check (amount_minor = quantity * unit_amount_minor),
  constraint order_bags_order_size_key unique (order_id, size)
);

create table public.capacity_holds (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete restrict,
  bucket_id uuid not null references public.capacity_buckets (id) on delete restrict,
  units integer not null check (units > 0),
  status public.capacity_hold_status not null default 'held',
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint capacity_holds_order_bucket_key unique (order_id, bucket_id)
);

create table public.policy_acceptances (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  policy_slug text not null,
  policy_version integer not null,
  locale text not null,
  -- 동의 당시 제목·본문 스냅샷. 이후 번역 변경으로 덮어쓰지 않는다.
  title text not null,
  body text not null,
  accepted_at timestamptz not null default now(),
  constraint policy_acceptances_order_policy_key unique (order_id, policy_slug)
);

create trigger orders_set_updated_at before update on public.orders
  for each row execute function public.set_updated_at();
create trigger capacity_holds_set_updated_at before update on public.capacity_holds
  for each row execute function public.set_updated_at();

-- 예약 상태 전이 규칙 (06 문서 4절)
create or replace function public.guard_reservation_transition()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.reservation_status = old.reservation_status then
    return new;
  end if;
  if not (
    (old.reservation_status = 'draft' and new.reservation_status in ('held', 'cancelled'))
    or (old.reservation_status = 'held' and new.reservation_status in ('confirmed', 'cancelled', 'expired', 'needs_review'))
    or (old.reservation_status = 'expired' and new.reservation_status in ('confirmed', 'needs_review'))
    or (old.reservation_status = 'needs_review' and new.reservation_status in ('confirmed', 'cancelled'))
    or (old.reservation_status = 'confirmed' and new.reservation_status in ('cancelled'))
  ) then
    raise exception 'invalid reservation transition % -> %', old.reservation_status, new.reservation_status
      using errcode = 'check_violation';
  end if;
  new.version := old.version + 1;
  if new.reservation_status <> 'held' then
    new.hold_expires_at := null;
  end if;
  return new;
end;
$$;

create trigger orders_reservation_transition before update of reservation_status on public.orders
  for each row execute function public.guard_reservation_transition();

-- 권한 --------------------------------------------------------------------
alter table public.idempotency_keys enable row level security;
alter table public.outbox_events enable row level security;
alter table public.orders enable row level security;
alter table public.order_bags enable row level security;
alter table public.capacity_holds enable row level security;
alter table public.policy_acceptances enable row level security;

revoke all on public.idempotency_keys, public.outbox_events, public.orders, public.order_bags,
  public.capacity_holds, public.policy_acceptances from anon, authenticated;
grant select on public.orders, public.order_bags, public.policy_acceptances to authenticated;
grant select, insert, update, delete on public.idempotency_keys, public.outbox_events, public.orders, public.order_bags,
  public.capacity_holds, public.policy_acceptances to service_role;

-- 고객은 자기 주문만 본다. 운영자(dispatcher·support·admin)는 전체를 본다.
create policy orders_select on public.orders for select to authenticated
  using (owner_id = (select auth.uid()) or (select public.is_operations_staff()));
create policy order_bags_select on public.order_bags for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id));
create policy policy_acceptances_select on public.policy_acceptances for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id));

-- 주문 참조 번호 -----------------------------------------------------------
create or replace function public.generate_order_code()
returns text
language plpgsql
set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text;
begin
  loop
    code := 'JC';
    for i in 1..8 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::integer, 1);
    end loop;
    exit when not exists (select 1 from public.orders where public_code = code);
  end loop;
  return code;
end;
$$;

-- 주문 생성 ----------------------------------------------------------------
create or replace function public.create_order(
  p_quote_id uuid,
  p_idempotency_key text,
  p_contact jsonb,
  p_locale text,
  p_accepted_policies text[]
)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_settings public.booking_settings;
  v_quote public.quotes;
  v_slot public.service_slots;
  v_offering public.route_offerings;
  v_bucket public.capacity_buckets;
  v_order public.orders;
  v_idem public.idempotency_keys;
  v_hash text;
  v_contact jsonb;
  v_name text := btrim(coalesce(p_contact ->> 'name', ''));
  v_email text := nullif(lower(btrim(coalesce(p_contact ->> 'email', ''))), '');
  v_phone text := nullif(regexp_replace(coalesce(p_contact ->> 'phone', ''), '[\s()-]', '', 'g'), '');
  v_wechat text := nullif(btrim(coalesce(p_contact ->> 'wechat', '')), '');
  v_slug text;
  v_policy record;
  v_item jsonb;
  v_tax_left integer;
  v_line_tax integer;
  v_largest_size text;
begin
  if v_uid is null then
    perform public.luggage_error('SESSION_REQUIRED');
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 8 and 128 then
    perform public.luggage_error('IDEMPOTENCY_CONFLICT');
  end if;
  if p_locale not in ('zh-CN', 'ko', 'en') then
    perform public.luggage_error('CONTACT_INVALID');
  end if;

  -- 1) 멱등 키: 같은 키·같은 본문이면 기존 주문, 다른 본문이면 충돌
  v_hash := encode(sha256(convert_to(jsonb_build_object(
    'quote', p_quote_id, 'contact', p_contact, 'locale', p_locale,
    'policies', (select coalesce(jsonb_agg(x order by x), '[]'::jsonb) from unnest(p_accepted_policies) x)
  )::text, 'UTF8')), 'hex');

  insert into public.idempotency_keys (actor_id, operation, key, request_hash)
  values (v_uid, 'create_order', p_idempotency_key, v_hash)
  on conflict (actor_id, operation, key) do nothing;

  select * into v_idem from public.idempotency_keys
   where actor_id = v_uid and operation = 'create_order' and key = p_idempotency_key
   for update;
  if v_idem.request_hash <> v_hash then
    perform public.luggage_error('IDEMPOTENCY_CONFLICT');
  end if;
  if v_idem.result_id is not null then
    select * into v_order from public.orders where id = v_idem.result_id;
    return v_order;
  end if;

  -- 2) 견적 소유·만료·재사용
  select * into v_quote from public.quotes where id = p_quote_id and owner_id = v_uid;
  if not found then
    perform public.luggage_error('QUOTE_NOT_FOUND');
  end if;
  if v_quote.expires_at <= now() then
    perform public.luggage_error('QUOTE_EXPIRED');
  end if;
  if exists (select 1 from public.orders where quote_id = v_quote.id) then
    perform public.luggage_error('QUOTE_ALREADY_ORDERED');
  end if;

  -- 3) 연락처: 이름과 하나 이상의 연락 수단. 한국 번호를 강제하지 않는다.
  if char_length(v_name) not between 1 and 80
     or (v_email is not null and v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')
     or (v_phone is not null and v_phone !~ '^\+[1-9][0-9]{6,14}$')
     or (v_wechat is not null and char_length(v_wechat) not between 1 and 40)
     or coalesce(v_email, v_phone, v_wechat) is null then
    perform public.luggage_error('CONTACT_INVALID');
  end if;
  v_contact := jsonb_strip_nulls(jsonb_build_object('name', v_name, 'email', v_email, 'phone', v_phone, 'wechat', v_wechat));

  -- 4) 필수 정책: 고객 언어로 게시된 현재 버전에 동의해야 한다.
  select * into v_settings from public.booking_settings;
  foreach v_slug in array v_settings.required_policy_slugs loop
    if not (v_slug = any (coalesce(p_accepted_policies, array[]::text[]))) or not exists (
      select 1 from public.content_items ci
      join public.content_translations ct on ct.content_id = ci.id
      where ci.slug = v_slug and ct.locale = p_locale and ct.status = 'published'
    ) then
      perform public.luggage_error('POLICY_ACCEPTANCE_REQUIRED');
    end if;
  end loop;

  -- 5) 슬롯·노선 재검사
  select * into v_slot from public.service_slots where id = v_quote.slot_id and status = 'active';
  select * into v_offering from public.route_offerings where id = v_quote.route_offering_id;
  if v_slot.id is null or not v_offering.enabled then
    perform public.luggage_error('ROUTE_NOT_AVAILABLE');
  end if;
  if v_slot.booking_cutoff_at <= now() then
    perform public.luggage_error('BOOKING_CUTOFF_PASSED');
  end if;
  if (v_quote.origin_hotel_id is not null and not exists (select 1 from public.hotels where id = v_quote.origin_hotel_id and status = 'active'))
     or (v_quote.destination_hotel_id is not null and not exists (select 1 from public.hotels where id = v_quote.destination_hotel_id and status = 'active')) then
    perform public.luggage_error('ROUTE_NOT_AVAILABLE');
  end if;

  -- 6) 용량 확보: 버킷 행을 잠그고 원자적으로 held를 늘린다.
  select * into v_bucket from public.capacity_buckets where slot_id = v_slot.id for update;
  if not found or v_bucket.max_units - v_bucket.held_units - v_bucket.committed_units < v_quote.capacity_units then
    perform public.luggage_error('CAPACITY_UNAVAILABLE');
  end if;
  update public.capacity_buckets set held_units = held_units + v_quote.capacity_units where id = v_bucket.id;

  -- 7) 주문·짐·홀드·동의·outbox
  insert into public.orders (
    public_code, owner_id, quote_id, slot_id, route_offering_id, route_type, origin_hotel_id, destination_hotel_id,
    flight_number, flight_departs_at, reservation_status, hold_expires_at, capacity_units,
    subtotal_minor, discount_minor, total_minor, tax_minor, currency, contact, locale
  ) values (
    public.generate_order_code(), v_uid, v_quote.id, v_slot.id, v_offering.id, v_quote.route_type,
    v_quote.origin_hotel_id, v_quote.destination_hotel_id, v_quote.flight_number, v_quote.flight_departs_at,
    'held', now() + make_interval(mins => v_settings.hold_minutes), v_quote.capacity_units,
    v_quote.subtotal_minor, v_quote.discount_minor, v_quote.total_minor, v_quote.tax_minor, v_quote.currency,
    v_contact, p_locale
  ) returning * into v_order;

  -- 세액을 행 금액 비율로 내림 배분하고 잔여를 금액이 가장 큰 행에 둔다 (고정 규칙).
  v_tax_left := v_quote.tax_minor;
  select item ->> 'size' into v_largest_size
    from jsonb_array_elements(v_quote.line_items) item
   order by (item ->> 'amount_minor')::integer desc, item ->> 'size'
   limit 1;
  for v_item in select * from jsonb_array_elements(v_quote.line_items) loop
    v_line_tax := case when v_quote.subtotal_minor = 0 then 0
      else ((v_item ->> 'amount_minor')::bigint * v_quote.tax_minor / v_quote.subtotal_minor)::integer end;
    v_tax_left := v_tax_left - v_line_tax;
    insert into public.order_bags (order_id, size, quantity, unit_amount_minor, amount_minor, tax_minor, price_rule_id)
    values (
      v_order.id, (v_item ->> 'size')::public.bag_size, (v_item ->> 'quantity')::integer,
      (v_item ->> 'unit_amount_minor')::integer, (v_item ->> 'amount_minor')::integer, v_line_tax,
      (v_item ->> 'price_rule_id')::uuid
    );
  end loop;
  update public.order_bags set tax_minor = tax_minor + v_tax_left
   where order_id = v_order.id and size = v_largest_size::public.bag_size;

  insert into public.capacity_holds (order_id, bucket_id, units, expires_at)
  values (v_order.id, v_bucket.id, v_quote.capacity_units, v_order.hold_expires_at);

  for v_policy in
    select ci.slug, ci.source_version, ct.title, ct.body
      from public.content_items ci
      join public.content_translations ct on ct.content_id = ci.id
     where ci.slug = any (v_settings.required_policy_slugs) and ct.locale = p_locale and ct.status = 'published'
  loop
    insert into public.policy_acceptances (order_id, policy_slug, policy_version, locale, title, body)
    values (v_order.id, v_policy.slug, v_policy.source_version, p_locale, v_policy.title, v_policy.body);
  end loop;

  insert into public.outbox_events (topic, aggregate_id, payload)
  values ('order.held', v_order.id, jsonb_build_object('hold_expires_at', v_order.hold_expires_at));

  update public.idempotency_keys set result_id = v_order.id where id = v_idem.id;
  return v_order;
end;
$$;

revoke all on function public.create_order(uuid, text, jsonb, text, text[]) from public;
grant execute on function public.create_order(uuid, text, jsonb, text, text[]) to authenticated, service_role;

-- 홀드 만료 (스케줄러가 호출, 중복·지연 실행에 안전) -----------------------------
create or replace function public.expire_holds(p_limit integer default 100)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order record;
  v_count integer := 0;
begin
  for v_order in
    select id from public.orders
     where reservation_status = 'held' and hold_expires_at <= now()
     order by hold_expires_at
     limit p_limit
     for update skip locked
  loop
    update public.capacity_buckets b
       set held_units = b.held_units - h.units
      from public.capacity_holds h
     where h.order_id = v_order.id and h.status = 'held' and b.id = h.bucket_id;
    update public.capacity_holds set status = 'released' where order_id = v_order.id and status = 'held';
    update public.orders set reservation_status = 'expired' where id = v_order.id;
    insert into public.outbox_events (topic, aggregate_id) values ('order.expired', v_order.id);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

revoke all on function public.expire_holds(integer) from public;
grant execute on function public.expire_holds(integer) to service_role;
