-- D02 호텔 제휴·정산 (06 문서 8절, 08 문서 2절).
-- - 제휴 귀속은 주문 생성 트랜잭션에서 한 번만 확정한다. 이후 수정·삭제 불가.
-- - 수수료는 예약 확정 시 계약 규칙 스냅샷으로 계산하고, 배송 완료 후 정산 대상이 된다.
-- - 지급 후 취소되면 과거 기록을 고치지 않고 환수(clawback) 항목을 새로 만든다.

create type public.attribution_channel as enum ('hotel_qr', 'search', 'xiaohongshu', 'share', 'direct', 'unknown');
create type public.commission_kind as enum ('flat_per_order', 'percent_of_total');
create type public.commission_entry_kind as enum ('commission', 'clawback');
create type public.commission_status as enum ('pending', 'eligible', 'batched', 'paid', 'reversed');
create type public.settlement_status as enum ('draft', 'confirmed', 'paid');

-- 제휴 코드 (호텔 QR에 들어가는 공개 코드) ---------------------------------------------
create table public.partner_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9]{4,16}$'),
  partner_id uuid not null references public.hotel_partners (id) on delete restrict,
  hotel_id uuid not null references public.hotels (id) on delete restrict,
  status public.record_status not null default 'active',
  valid_from date not null default current_date,
  valid_until date,
  applicable_routes public.route_type[] not null default array['hotel_to_airport', 'airport_to_hotel', 'hotel_to_hotel']::public.route_type[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint partner_codes_valid_range check (valid_until is null or valid_until >= valid_from)
);

-- 수수료 계약 규칙 (재무 관리) -----------------------------------------------------
create table public.commission_rules (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.hotel_partners (id) on delete restrict,
  kind public.commission_kind not null,
  amount_minor integer check (amount_minor >= 0),
  rate_bp integer check (rate_bp between 0 and 10000),
  currency text not null default 'KRW',
  valid_from date not null,
  valid_until date,
  status public.record_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint commission_rules_shape check (
    (kind = 'flat_per_order' and amount_minor is not null and rate_bp is null)
    or (kind = 'percent_of_total' and rate_bp is not null and amount_minor is null)
  ),
  constraint commission_rules_no_overlap exclude using gist (
    partner_id with =,
    daterange(valid_from, valid_until, '[]') with &&
  ) where (status <> 'archived')
);

-- 주문 유입 귀속 (추가 전용) --------------------------------------------------------
create table public.order_attributions (
  order_id uuid primary key references public.orders (id) on delete restrict,
  channel public.attribution_channel not null default 'unknown',
  partner_code_id uuid references public.partner_codes (id) on delete restrict,
  partner_id uuid references public.hotel_partners (id) on delete restrict,
  hotel_id uuid references public.hotels (id) on delete restrict,
  campaign_code text check (campaign_code ~ '^[A-Za-z0-9_-]{1,40}$'),
  landing_path text check (char_length(landing_path) <= 200),
  created_at timestamptz not null default now(),
  constraint order_attributions_partner_shape check ((partner_code_id is null) = (partner_id is null))
);

create trigger order_attributions_append_only
  before update or delete on public.order_attributions
  for each row execute function public.forbid_ledger_mutation();

-- 호텔 수수료 ---------------------------------------------------------------------
create table public.hotel_commissions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete restrict,
  kind public.commission_entry_kind not null default 'commission',
  partner_id uuid not null references public.hotel_partners (id) on delete restrict,
  hotel_id uuid not null references public.hotels (id) on delete restrict,
  -- 계산에 쓴 계약 규칙 스냅샷 (규칙이 바뀌어도 이 주문의 계산은 그대로)
  rule_snapshot jsonb not null,
  base_amount_minor integer not null check (base_amount_minor >= 0),
  -- 수수료는 +, 환수는 −
  amount_minor integer not null,
  currency text not null,
  status public.commission_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hotel_commissions_order_kind_key unique (order_id, kind),
  constraint hotel_commissions_sign check ((kind = 'commission') = (amount_minor >= 0))
);
create index hotel_commissions_partner_status_idx on public.hotel_commissions (partner_id, status);

-- 정산 ---------------------------------------------------------------------------
create table public.settlement_batches (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.hotel_partners (id) on delete restrict,
  period_start date not null,
  period_end date not null,
  status public.settlement_status not null default 'draft',
  total_minor integer not null default 0,
  currency text not null default 'KRW',
  -- 실제 지급 증빙 참조 (이체 번호 등). 자동 송금은 검증된 공급사 연동 후 별도로 켠다.
  payout_reference text,
  created_by uuid references auth.users (id) on delete set null,
  confirmed_by uuid references auth.users (id) on delete set null,
  confirmed_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint settlement_batches_period check (period_end >= period_start),
  constraint settlement_batches_paid_reference check (status <> 'paid' or payout_reference is not null)
);

create table public.settlement_items (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.settlement_batches (id) on delete cascade,
  -- 한 수수료 항목은 한 정산에만 들어간다 (이중 지급 방지)
  commission_id uuid not null unique references public.hotel_commissions (id) on delete restrict,
  amount_minor integer not null
);

do $$
declare
  t text;
begin
  foreach t in array array['partner_codes', 'commission_rules', 'hotel_commissions', 'settlement_batches'] loop
    execute format(
      'create trigger %1$s_set_updated_at before update on public.%1$s for each row execute function public.set_updated_at()', t);
  end loop;
  foreach t in array array['partner_codes', 'commission_rules', 'settlement_batches'] loop
    execute format(
      'create trigger %1$s_audit after insert or update or delete on public.%1$s for each row execute function public.audit_row_change()', t);
  end loop;
end
$$;

-- 공개: 제휴 코드 → 호텔 (QR 랜딩용). 계약·정산 정보는 돌려주지 않는다. ---------------------------
create or replace function public.resolve_partner_code(p_code text)
returns table (hotel_slug text, applicable_routes public.route_type[])
language sql
stable
security definer
set search_path = ''
as $$
  select h.slug, pc.applicable_routes
    from public.partner_codes pc
    join public.hotels h on h.id = pc.hotel_id and h.status = 'active'
   where pc.code = upper(btrim(p_code))
     and pc.status = 'active'
     and current_date >= pc.valid_from
     and (pc.valid_until is null or current_date <= pc.valid_until);
$$;
revoke all on function public.resolve_partner_code(text) from public;
grant execute on function public.resolve_partner_code(text) to anon, authenticated, service_role;

-- 주문 생성 + 유입 귀속을 한 트랜잭션으로 -------------------------------------------------
-- create_order()는 같은 키 재요청에 기존 주문을 돌려준다. 귀속은 처음 기록만 유지한다 (결제 후 변경 불가).
create or replace function public.create_order_with_attribution(
  p_quote_id uuid,
  p_idempotency_key text,
  p_contact jsonb,
  p_locale text,
  p_accepted_policies text[],
  p_attribution jsonb
)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_code public.partner_codes;
  v_channel public.attribution_channel := 'unknown';
  v_campaign text := nullif(btrim(coalesce(p_attribution ->> 'campaign', '')), '');
  v_landing text := left(nullif(btrim(coalesce(p_attribution ->> 'landing', '')), ''), 200);
begin
  v_order := public.create_order(p_quote_id, p_idempotency_key, p_contact, p_locale, p_accepted_policies);

  if coalesce(p_attribution ->> 'channel', '') in ('hotel_qr', 'search', 'xiaohongshu', 'share', 'direct') then
    v_channel := (p_attribution ->> 'channel')::public.attribution_channel;
  end if;
  if v_campaign is not null and v_campaign !~ '^[A-Za-z0-9_-]{1,40}$' then
    v_campaign := null;
  end if;

  -- 유효한 제휴 코드이고 이 노선에 적용될 때만 귀속한다.
  select pc.* into v_code
    from public.partner_codes pc
   where pc.code = upper(btrim(coalesce(p_attribution ->> 'partnerCode', '')))
     and pc.status = 'active'
     and current_date >= pc.valid_from
     and (pc.valid_until is null or current_date <= pc.valid_until)
     and v_order.route_type = any (pc.applicable_routes);

  insert into public.order_attributions (order_id, channel, partner_code_id, partner_id, hotel_id, campaign_code, landing_path)
  values (
    v_order.id,
    case when v_code.id is not null and v_channel = 'unknown' then 'hotel_qr'::public.attribution_channel else v_channel end,
    v_code.id, v_code.partner_id, v_code.hotel_id, v_campaign, v_landing
  )
  on conflict (order_id) do nothing;
  return v_order;
end;
$$;
revoke all on function public.create_order_with_attribution(uuid, text, jsonb, text, text[], jsonb) from public;
grant execute on function public.create_order_with_attribution(uuid, text, jsonb, text, text[], jsonb) to authenticated, service_role;

-- 수수료 생성·상태 변화 ------------------------------------------------------------
-- 예약 확정: 제휴 귀속 주문이면 확정일의 계약 규칙으로 수수료(pending)를 만든다.
-- 예약 취소: 미정산 수수료는 reversed, 정산·지급된 수수료는 환수 항목(eligible, 음수)을 만든다.
create or replace function public.sync_commission_with_reservation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attr public.order_attributions;
  v_rule public.commission_rules;
  v_amount integer;
  v_commission public.hotel_commissions;
begin
  select * into v_attr from public.order_attributions where order_id = new.id;
  if v_attr.partner_id is null then
    return new;
  end if;

  if new.reservation_status = 'confirmed' and old.reservation_status is distinct from 'confirmed' then
    select * into v_rule from public.commission_rules r
     where r.partner_id = v_attr.partner_id and r.status = 'active'
       and (now() at time zone 'Asia/Seoul')::date >= r.valid_from
       and (r.valid_until is null or (now() at time zone 'Asia/Seoul')::date <= r.valid_until);
    if not found then
      -- 계약 규칙이 없으면 0원으로 기록하고 재무 검토 대상으로 남긴다 (임의 금액 금지).
      v_amount := 0;
    elsif v_rule.kind = 'flat_per_order' then
      v_amount := v_rule.amount_minor;
    else
      -- 비율 수수료는 원 단위 내림 (고정 반올림 규칙)
      v_amount := floor(new.total_minor::numeric * v_rule.rate_bp / 10000)::integer;
    end if;
    insert into public.hotel_commissions (order_id, kind, partner_id, hotel_id, rule_snapshot, base_amount_minor, amount_minor, currency)
    values (
      new.id, 'commission', v_attr.partner_id, v_attr.hotel_id,
      case when v_rule.id is null then jsonb_build_object('missing_rule', true) else to_jsonb(v_rule) end,
      new.total_minor, v_amount, new.currency
    )
    on conflict (order_id, kind) do nothing;
  elsif new.reservation_status = 'cancelled' and old.reservation_status is distinct from 'cancelled' then
    select * into v_commission from public.hotel_commissions where order_id = new.id and kind = 'commission' for update;
    if found then
      if v_commission.status in ('pending', 'eligible') then
        update public.hotel_commissions set status = 'reversed' where id = v_commission.id;
      elsif v_commission.status in ('batched', 'paid') and v_commission.amount_minor > 0 then
        insert into public.hotel_commissions (order_id, kind, partner_id, hotel_id, rule_snapshot, base_amount_minor, amount_minor, currency, status)
        values (new.id, 'clawback', v_commission.partner_id, v_commission.hotel_id, v_commission.rule_snapshot,
                v_commission.base_amount_minor, -v_commission.amount_minor, v_commission.currency, 'eligible')
        on conflict (order_id, kind) do nothing;
      end if;
    end if;
  end if;
  return new;
end;
$$;

create trigger orders_sync_commission
  after update of reservation_status on public.orders
  for each row execute function public.sync_commission_with_reservation();

-- 배송 완료 → 수수료 정산 대상
create or replace function public.commission_eligible_on_completion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'completed' and old.status is distinct from 'completed' then
    update public.hotel_commissions set status = 'eligible'
     where order_id = new.order_id and kind = 'commission' and status = 'pending';
  end if;
  return new;
end;
$$;

create trigger delivery_jobs_commission_eligible
  after update of status on public.delivery_jobs
  for each row execute function public.commission_eligible_on_completion();

-- 정산 초안·확정·지급 (재무) ----------------------------------------------------------
create or replace function public.create_settlement_draft(p_partner_id uuid, p_period_start date, p_period_end date)
returns public.settlement_batches
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_batch public.settlement_batches;
begin
  if not (select public.is_finance_staff()) then
    perform public.luggage_error('FORBIDDEN');
  end if;
  insert into public.settlement_batches (partner_id, period_start, period_end, created_by)
  values (p_partner_id, p_period_start, p_period_end, (select auth.uid()))
  returning * into v_batch;

  -- 기간 안에 적격이 된 수수료·환수 항목 (행 잠금으로 다른 초안과 겹치지 않게)
  with picked as (
    select c.id, c.amount_minor from public.hotel_commissions c
     where c.partner_id = p_partner_id and c.status = 'eligible'
       and (c.updated_at at time zone 'Asia/Seoul')::date <= p_period_end
     for update skip locked
  ), items as (
    insert into public.settlement_items (batch_id, commission_id, amount_minor)
    select v_batch.id, id, amount_minor from picked
    returning commission_id, amount_minor
  ), marked as (
    update public.hotel_commissions set status = 'batched' where id in (select commission_id from items)
  )
  update public.settlement_batches set total_minor = coalesce((select sum(amount_minor) from items), 0)
   where id = v_batch.id
  returning * into v_batch;
  return v_batch;
end;
$$;
revoke all on function public.create_settlement_draft(uuid, date, date) from public;
grant execute on function public.create_settlement_draft(uuid, date, date) to authenticated, service_role;

create or replace function public.confirm_settlement(p_batch_id uuid)
returns public.settlement_batches
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_batch public.settlement_batches;
begin
  if not (select public.is_finance_staff()) then
    perform public.luggage_error('FORBIDDEN');
  end if;
  update public.settlement_batches set status = 'confirmed', confirmed_by = (select auth.uid()), confirmed_at = now()
   where id = p_batch_id and status = 'draft'
  returning * into v_batch;
  if not found then
    perform public.luggage_error('SETTLEMENT_NOT_CONFIRMABLE');
  end if;
  return v_batch;
end;
$$;
revoke all on function public.confirm_settlement(uuid) from public;
grant execute on function public.confirm_settlement(uuid) to authenticated, service_role;

create or replace function public.mark_settlement_paid(p_batch_id uuid, p_payout_reference text)
returns public.settlement_batches
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_batch public.settlement_batches;
begin
  if not (select public.is_finance_staff()) then
    perform public.luggage_error('FORBIDDEN');
  end if;
  if coalesce(btrim(p_payout_reference), '') = '' then
    perform public.luggage_error('PAYOUT_REFERENCE_REQUIRED');
  end if;
  update public.settlement_batches set status = 'paid', payout_reference = btrim(p_payout_reference), paid_at = now()
   where id = p_batch_id and status = 'confirmed'
  returning * into v_batch;
  if not found then
    perform public.luggage_error('SETTLEMENT_NOT_PAYABLE');
  end if;
  update public.hotel_commissions set status = 'paid'
   where id in (select commission_id from public.settlement_items where batch_id = p_batch_id);
  return v_batch;
end;
$$;
revoke all on function public.mark_settlement_paid(uuid, text) from public;
grant execute on function public.mark_settlement_paid(uuid, text) to authenticated, service_role;

-- 권한 --------------------------------------------------------------------
alter table public.partner_codes enable row level security;
alter table public.commission_rules enable row level security;
alter table public.order_attributions enable row level security;
alter table public.hotel_commissions enable row level security;
alter table public.settlement_batches enable row level security;
alter table public.settlement_items enable row level security;

revoke all on public.partner_codes, public.commission_rules, public.order_attributions, public.hotel_commissions,
  public.settlement_batches, public.settlement_items from anon, authenticated;
grant select on public.partner_codes, public.commission_rules, public.order_attributions, public.hotel_commissions,
  public.settlement_batches, public.settlement_items to authenticated;
grant insert, update on public.partner_codes, public.commission_rules to authenticated;
grant select, insert, update on public.partner_codes, public.commission_rules, public.order_attributions, public.hotel_commissions,
  public.settlement_batches, public.settlement_items to service_role;

create or replace function public.is_partner_staff_of(p_partner_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.hotels h
     where h.partner_id = p_partner_id and public.has_role('hotel_staff', 'hotel', h.id)
  );
$$;
revoke all on function public.is_partner_staff_of(uuid) from public;
grant execute on function public.is_partner_staff_of(uuid) to authenticated, service_role;

-- 제휴 코드: admin·finance 관리, 호텔 직원은 자기 지점 코드 조회
create policy partner_codes_select on public.partner_codes for select to authenticated
  using ((select public.has_role('admin')) or (select public.is_finance_staff()) or public.has_role('hotel_staff', 'hotel', hotel_id));
create policy partner_codes_insert on public.partner_codes for insert to authenticated
  with check ((select public.has_role('admin')) or (select public.is_finance_staff()));
create policy partner_codes_update on public.partner_codes for update to authenticated
  using ((select public.has_role('admin')) or (select public.is_finance_staff()))
  with check ((select public.has_role('admin')) or (select public.is_finance_staff()));

-- 수수료 규칙·계좌 변경은 재무 권한 (감사 기록)
create policy commission_rules_select on public.commission_rules for select to authenticated
  using ((select public.is_finance_staff()));
create policy commission_rules_insert on public.commission_rules for insert to authenticated
  with check ((select public.is_finance_staff()));
create policy commission_rules_update on public.commission_rules for update to authenticated
  using ((select public.is_finance_staff())) with check ((select public.is_finance_staff()));

-- 귀속: 운영·재무 전체, 호텔 직원은 자기 지점 유입
create policy order_attributions_select on public.order_attributions for select to authenticated
  using (
    (select public.is_operations_staff()) or (select public.is_finance_staff())
    or (hotel_id is not null and public.has_role('hotel_staff', 'hotel', hotel_id))
  );

-- 수수료·정산: 재무 전체, 호텔 직원은 자기 지점·자기 제휴사 건만
create policy hotel_commissions_select on public.hotel_commissions for select to authenticated
  using ((select public.is_finance_staff()) or public.has_role('hotel_staff', 'hotel', hotel_id));
create policy settlement_batches_select on public.settlement_batches for select to authenticated
  using ((select public.is_finance_staff()) or public.is_partner_staff_of(partner_id));
create policy settlement_items_select on public.settlement_items for select to authenticated
  using (exists (select 1 from public.settlement_batches b where b.id = batch_id));
