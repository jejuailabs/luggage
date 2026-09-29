-- B04 결제·환불 (06 문서 4·5·7절).
-- 결제 확정은 서버(service_role)가 PG 웹훅·조회 결과를 검증한 뒤 record_payment_result()로만 한다.
-- 브라우저 성공 화면은 근거가 아니다. 원장(ledger_entries)은 추가 전용이다.

create type public.payment_attempt_status as enum ('created', 'pending', 'succeeded', 'failed', 'cancelled', 'unknown');
create type public.refund_request_status as enum ('requested', 'approved', 'rejected');
create type public.refund_status as enum ('queued', 'processing', 'succeeded', 'failed', 'unknown');
create type public.ledger_entry_type as enum ('payment_captured', 'refund_succeeded');

-- 결제 시도 ----------------------------------------------------------------
create table public.payment_attempts (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete restrict,
  provider text not null check (provider ~ '^[a-z][a-z0-9_]*$'),
  method text not null check (method in ('wechat_pay_jsapi', 'wechat_pay_h5', 'wechat_pay_miniprogram', 'alipay', 'card')),
  -- PG에 보내는 상점 주문 ID (재시도·조회 기준)
  merchant_order_id text not null unique,
  provider_transaction_id text,
  amount_minor integer not null check (amount_minor > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  status public.payment_attempt_status not null default 'created',
  client_key text not null,
  failure_code text,
  succeeded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payment_attempts_provider_txn_key unique (provider, provider_transaction_id),
  constraint payment_attempts_order_client_key unique (order_id, client_key)
);
create index payment_attempts_order_idx on public.payment_attempts (order_id);
create index payment_attempts_open_idx on public.payment_attempts (created_at) where status in ('created', 'pending', 'unknown');

-- 공급사 이벤트 (중복 처리 차단) ------------------------------------------------
create table public.payment_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  event_id text not null,
  payload_hash text not null,
  merchant_order_id text,
  reported_status text,
  result text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  constraint payment_events_provider_event_key unique (provider, event_id)
);

-- 환불 ------------------------------------------------------------------
create table public.refund_requests (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete restrict,
  requested_by uuid references auth.users (id) on delete set null,
  amount_minor integer not null check (amount_minor > 0),
  reason text not null check (char_length(reason) between 1 and 500),
  status public.refund_request_status not null default 'requested',
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- 한 주문에 검토 대기 요청은 하나만
create unique index refund_requests_one_open_per_order on public.refund_requests (order_id) where status = 'requested';

create table public.refunds (
  id uuid primary key default gen_random_uuid(),
  refund_request_id uuid not null unique references public.refund_requests (id) on delete restrict,
  payment_attempt_id uuid not null references public.payment_attempts (id) on delete restrict,
  amount_minor integer not null check (amount_minor > 0),
  currency text not null,
  provider_refund_id text,
  status public.refund_status not null default 'queued',
  failure_code text,
  succeeded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 원장 (추가 전용) -----------------------------------------------------------
create table public.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete restrict,
  payment_attempt_id uuid references public.payment_attempts (id) on delete restrict,
  refund_id uuid references public.refunds (id) on delete restrict,
  entry_type public.ledger_entry_type not null,
  -- 수납은 +, 환불은 −
  amount_minor integer not null check (amount_minor <> 0),
  currency text not null,
  created_at timestamptz not null default now(),
  constraint ledger_entries_sign check (
    (entry_type = 'payment_captured' and amount_minor > 0 and payment_attempt_id is not null)
    or (entry_type = 'refund_succeeded' and amount_minor < 0 and refund_id is not null)
  ),
  constraint ledger_entries_payment_once unique (payment_attempt_id, entry_type),
  constraint ledger_entries_refund_once unique (refund_id)
);

create or replace function public.forbid_ledger_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'ledger entries are append-only' using errcode = 'insufficient_privilege';
end;
$$;

create trigger ledger_entries_append_only
  before update or delete on public.ledger_entries
  for each row execute function public.forbid_ledger_mutation();

do $$
declare
  t text;
begin
  foreach t in array array['payment_attempts', 'refund_requests', 'refunds'] loop
    execute format(
      'create trigger %1$s_set_updated_at before update on public.%1$s for each row execute function public.set_updated_at()', t);
  end loop;
end
$$;

-- 권한 --------------------------------------------------------------------
alter table public.payment_attempts enable row level security;
alter table public.payment_events enable row level security;
alter table public.refund_requests enable row level security;
alter table public.refunds enable row level security;
alter table public.ledger_entries enable row level security;

revoke all on public.payment_attempts, public.payment_events, public.refund_requests, public.refunds, public.ledger_entries
  from anon, authenticated;
grant select on public.payment_attempts, public.refund_requests, public.refunds to authenticated;
grant select on public.ledger_entries to authenticated;
grant select, insert, update on public.payment_attempts, public.payment_events, public.refund_requests, public.refunds to service_role;
grant select, insert on public.ledger_entries to service_role;

create or replace function public.is_finance_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_role('finance');
$$;
revoke all on function public.is_finance_staff() from public;
grant execute on function public.is_finance_staff() to authenticated, service_role;

-- 고객은 자기 주문의 결제·환불 상태만 본다 (orders RLS를 따른다). 원장은 finance만.
create policy payment_attempts_select on public.payment_attempts for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id));
create policy refund_requests_select on public.refund_requests for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id) or (select public.is_finance_staff()));
create policy refunds_select on public.refunds for select to authenticated
  using (
    exists (select 1 from public.refund_requests r join public.orders o on o.id = r.order_id where r.id = refund_request_id)
    or (select public.is_finance_staff())
  );
create policy ledger_entries_select on public.ledger_entries for select to authenticated
  using ((select public.is_finance_staff()));

-- 결제 요약 (06 문서 4절: unpaid, pending, paid, partially_refunded, refunded) --------
create or replace function public.order_payment_summary(p_order_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  with totals as (
    select
      coalesce(sum(amount_minor) filter (where entry_type = 'payment_captured'), 0) as captured,
      coalesce(-sum(amount_minor) filter (where entry_type = 'refund_succeeded'), 0) as refunded
    from public.ledger_entries where order_id = p_order_id
  )
  select case
    when captured = 0 and exists (
      select 1 from public.payment_attempts where order_id = p_order_id and status in ('created', 'pending', 'unknown')
    ) then 'pending'
    when captured = 0 then 'unpaid'
    when refunded = 0 then 'paid'
    when refunded < captured then 'partially_refunded'
    else 'refunded'
  end
  from totals
  where exists (select 1 from public.orders o where o.id = p_order_id and (o.owner_id = (select auth.uid()) or (select public.is_operations_staff()) or (select public.is_finance_staff()) or current_setting('role', true) = 'service_role'));
$$;
revoke all on function public.order_payment_summary(uuid) from public;
grant execute on function public.order_payment_summary(uuid) to authenticated, service_role;

-- 결제 시작 (고객) ----------------------------------------------------------
create or replace function public.start_payment(p_order_id uuid, p_provider text, p_method text, p_client_key text)
returns public.payment_attempts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_order public.orders;
  v_attempt public.payment_attempts;
  v_seq integer;
begin
  if v_uid is null then
    perform public.luggage_error('SESSION_REQUIRED');
  end if;
  if p_client_key is null or char_length(p_client_key) not between 8 and 128 then
    perform public.luggage_error('IDEMPOTENCY_CONFLICT');
  end if;

  select * into v_order from public.orders where id = p_order_id and owner_id = v_uid for update;
  if not found then
    perform public.luggage_error('ORDER_NOT_FOUND');
  end if;

  -- 같은 키 재요청은 같은 결제 시도
  select * into v_attempt from public.payment_attempts where order_id = v_order.id and client_key = p_client_key;
  if found then
    if v_attempt.provider <> p_provider or v_attempt.method <> p_method then
      perform public.luggage_error('IDEMPOTENCY_CONFLICT');
    end if;
    return v_attempt;
  end if;

  if v_order.reservation_status <> 'held' or v_order.hold_expires_at <= now() then
    perform public.luggage_error('ORDER_NOT_PAYABLE');
  end if;
  if exists (select 1 from public.payment_attempts where order_id = v_order.id and status = 'succeeded') then
    perform public.luggage_error('ORDER_NOT_PAYABLE');
  end if;

  select count(*) + 1 into v_seq from public.payment_attempts where order_id = v_order.id;
  insert into public.payment_attempts (order_id, provider, method, merchant_order_id, amount_minor, currency, client_key)
  values (v_order.id, p_provider, p_method, v_order.public_code || '-' || v_seq, v_order.total_minor, v_order.currency, p_client_key)
  returning * into v_attempt;
  return v_attempt;
end;
$$;
revoke all on function public.start_payment(uuid, text, text, text) from public;
grant execute on function public.start_payment(uuid, text, text, text) to authenticated, service_role;

-- 결제 세션 생성 후 pending 표시 (서버)
create or replace function public.mark_payment_pending(p_attempt_id uuid, p_provider_transaction_id text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.payment_attempts
     set status = 'pending', provider_transaction_id = coalesce(provider_transaction_id, p_provider_transaction_id)
   where id = p_attempt_id and status = 'created';
$$;
revoke all on function public.mark_payment_pending(uuid, text) from public;
grant execute on function public.mark_payment_pending(uuid, text) to service_role;

-- 결제 결과 반영 (서버 전용) -------------------------------------------------------
-- p_status: succeeded | failed | cancelled | pending | unknown (PG 조회로 확인한 현재 상태)
create or replace function public.record_payment_result(
  p_provider text,
  p_event_id text,
  p_payload_hash text,
  p_merchant_order_id text,
  p_provider_transaction_id text,
  p_status text,
  p_amount_minor integer,
  p_currency text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attempt public.payment_attempts;
  v_order public.orders;
  v_hold public.capacity_holds;
  v_bucket public.capacity_buckets;
  v_result text;
begin
  -- 1) 같은 이벤트는 한 번만 처리한다.
  insert into public.payment_events (provider, event_id, payload_hash, merchant_order_id, reported_status)
  values (p_provider, p_event_id, p_payload_hash, p_merchant_order_id, p_status)
  on conflict (provider, event_id) do nothing;
  if not found then
    return 'duplicate_event';
  end if;

  select * into v_attempt from public.payment_attempts
   where merchant_order_id = p_merchant_order_id and provider = p_provider
   for update;
  if not found then
    v_result := 'unknown_attempt';
    update public.payment_events set result = v_result, processed_at = now() where provider = p_provider and event_id = p_event_id;
    return v_result;
  end if;
  select * into v_order from public.orders where id = v_attempt.order_id for update;

  if p_status <> 'succeeded' then
    -- 성공을 늦게 도착한 실패로 덮지 않는다.
    if v_attempt.status <> 'succeeded' then
      update public.payment_attempts
         set status = case p_status
               when 'failed' then 'failed'::public.payment_attempt_status
               when 'cancelled' then 'cancelled'::public.payment_attempt_status
               when 'pending' then 'pending'::public.payment_attempt_status
               else 'unknown'::public.payment_attempt_status end,
             provider_transaction_id = coalesce(provider_transaction_id, p_provider_transaction_id),
             failure_code = case when p_status in ('failed', 'cancelled') then p_status end
       where id = v_attempt.id;
      v_result := 'recorded_' || p_status;
    else
      v_result := 'ignored_after_success';
    end if;
    update public.payment_events set result = v_result, processed_at = now() where provider = p_provider and event_id = p_event_id;
    return v_result;
  end if;

  -- 2) 금액·통화 대조. 불일치면 확정하지 않고 금융 검토로 보낸다.
  if p_amount_minor is distinct from v_attempt.amount_minor or p_currency is distinct from v_attempt.currency then
    update public.payment_attempts set status = 'unknown', failure_code = 'amount_mismatch' where id = v_attempt.id;
    if v_order.reservation_status in ('held', 'expired') then
      update public.orders set reservation_status = 'needs_review' where id = v_order.id;
    end if;
    insert into public.outbox_events (topic, aggregate_id, payload)
    values ('payment.amount_mismatch', v_order.id, jsonb_build_object('attempt_id', v_attempt.id, 'reported_amount', p_amount_minor, 'reported_currency', p_currency));
    v_result := 'amount_mismatch';
    update public.payment_events set result = v_result, processed_at = now() where provider = p_provider and event_id = p_event_id;
    return v_result;
  end if;

  if v_attempt.status = 'succeeded' then
    v_result := 'already_succeeded';
    update public.payment_events set result = v_result, processed_at = now() where provider = p_provider and event_id = p_event_id;
    return v_result;
  end if;

  update public.payment_attempts
     set status = 'succeeded', succeeded_at = now(),
         provider_transaction_id = coalesce(provider_transaction_id, p_provider_transaction_id), failure_code = null
   where id = v_attempt.id;
  insert into public.ledger_entries (order_id, payment_attempt_id, entry_type, amount_minor, currency)
  values (v_order.id, v_attempt.id, 'payment_captured', v_attempt.amount_minor, v_attempt.currency);

  -- 3) 예약 확정과 용량 commit
  if v_order.reservation_status = 'confirmed' then
    -- 다른 결제창도 성공: 예약은 한 번만 확정하고 초과 수납은 환불 검토
    insert into public.outbox_events (topic, aggregate_id, payload)
    values ('payment.duplicate_capture', v_order.id, jsonb_build_object('attempt_id', v_attempt.id));
    v_result := 'duplicate_capture';
  elsif v_order.reservation_status = 'held' then
    select * into v_hold from public.capacity_holds where order_id = v_order.id and status = 'held' for update;
    update public.capacity_buckets
       set held_units = held_units - v_hold.units, committed_units = committed_units + v_hold.units
     where id = v_hold.bucket_id;
    update public.capacity_holds set status = 'committed' where id = v_hold.id;
    update public.orders set reservation_status = 'confirmed', confirmed_at = now() where id = v_order.id;
    insert into public.outbox_events (topic, aggregate_id) values ('order.confirmed', v_order.id);
    v_result := 'confirmed';
  elsif v_order.reservation_status = 'expired' then
    -- 홀드 만료 후 늦게 확인된 성공: 용량을 다시 원자적으로 확보한다.
    select b.* into v_bucket from public.capacity_buckets b where b.slot_id = v_order.slot_id for update;
    if v_bucket.max_units - v_bucket.held_units - v_bucket.committed_units >= v_order.capacity_units then
      update public.capacity_buckets set committed_units = committed_units + v_order.capacity_units where id = v_bucket.id;
      update public.capacity_holds set status = 'committed' where order_id = v_order.id and bucket_id = v_bucket.id;
      update public.orders set reservation_status = 'confirmed', confirmed_at = now() where id = v_order.id;
      insert into public.outbox_events (topic, aggregate_id) values ('order.confirmed', v_order.id);
      v_result := 'confirmed_after_expiry';
    else
      -- 과예약을 감추지 않는다: 운영 검토와 환불/대안 처리
      update public.orders set reservation_status = 'needs_review' where id = v_order.id;
      insert into public.outbox_events (topic, aggregate_id, payload)
      values ('order.needs_review', v_order.id, jsonb_build_object('reason', 'capacity_unavailable_after_late_payment'));
      v_result := 'needs_review_capacity';
    end if;
  else
    -- 취소·검토 중 주문의 결제 성공: 확정하지 않고 검토
    insert into public.outbox_events (topic, aggregate_id, payload)
    values ('payment.unexpected_capture', v_order.id, jsonb_build_object('attempt_id', v_attempt.id, 'reservation_status', v_order.reservation_status));
    v_result := 'captured_for_review';
  end if;

  update public.payment_events set result = v_result, processed_at = now() where provider = p_provider and event_id = p_event_id;
  return v_result;
end;
$$;
revoke all on function public.record_payment_result(text, text, text, text, text, text, integer, text) from public;
grant execute on function public.record_payment_result(text, text, text, text, text, text, integer, text) to service_role;

-- 취소·환불 ---------------------------------------------------------------
-- 고객 취소 요청: 확정 주문, 수거 시작 전(예약 마감 전)에는 전액 환불 요청을 만든다.
-- 마감 후 취소·부분환불은 고객지원 경로로 처리한다 (운영 정책 설정 전 자동 약속 금지).
create or replace function public.request_cancellation(p_order_id uuid, p_reason text)
returns public.refund_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_order public.orders;
  v_slot public.service_slots;
  v_captured integer;
  v_request public.refund_requests;
begin
  if v_uid is null then
    perform public.luggage_error('SESSION_REQUIRED');
  end if;
  select * into v_order from public.orders where id = p_order_id and owner_id = v_uid for update;
  if not found then
    perform public.luggage_error('ORDER_NOT_FOUND');
  end if;

  select * into v_request from public.refund_requests where order_id = v_order.id and status = 'requested';
  if found then
    return v_request;
  end if;

  if v_order.reservation_status = 'held' then
    -- 미결제 주문은 바로 취소하고 홀드를 푼다.
    update public.capacity_buckets b set held_units = b.held_units - h.units
      from public.capacity_holds h where h.order_id = v_order.id and h.status = 'held' and b.id = h.bucket_id;
    update public.capacity_holds set status = 'released' where order_id = v_order.id and status = 'held';
    update public.orders set reservation_status = 'cancelled', cancelled_at = now() where id = v_order.id;
    insert into public.outbox_events (topic, aggregate_id) values ('order.cancelled', v_order.id);
    return null;
  end if;

  if v_order.reservation_status <> 'confirmed' then
    perform public.luggage_error('ORDER_NOT_CANCELLABLE');
  end if;
  select * into v_slot from public.service_slots where id = v_order.slot_id;
  if v_slot.booking_cutoff_at <= now() then
    perform public.luggage_error('CANCELLATION_WINDOW_CLOSED');
  end if;

  select coalesce(sum(amount_minor), 0) into v_captured from public.ledger_entries where order_id = v_order.id;
  if v_captured <= 0 then
    perform public.luggage_error('ORDER_NOT_CANCELLABLE');
  end if;

  insert into public.refund_requests (order_id, requested_by, amount_minor, reason)
  values (v_order.id, v_uid, v_captured, coalesce(nullif(btrim(p_reason), ''), 'customer_cancellation'))
  returning * into v_request;
  insert into public.outbox_events (topic, aggregate_id, payload)
  values ('refund.requested', v_order.id, jsonb_build_object('refund_request_id', v_request.id));
  return v_request;
end;
$$;
revoke all on function public.request_cancellation(uuid, text) from public;
grant execute on function public.request_cancellation(uuid, text) to authenticated, service_role;

-- 환불 승인 (finance): 요청 승인 → 환불 실행 행(queued) 생성. 총 환불액이 수납액을 넘지 않는다.
create or replace function public.approve_refund(p_refund_request_id uuid)
returns public.refunds
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_request public.refund_requests;
  v_order public.orders;
  v_attempt public.payment_attempts;
  v_refunded integer;
  v_refund public.refunds;
begin
  if not (select public.is_finance_staff()) and current_setting('role', true) is distinct from 'service_role' then
    perform public.luggage_error('FORBIDDEN');
  end if;
  select * into v_request from public.refund_requests where id = p_refund_request_id for update;
  if not found then
    perform public.luggage_error('REFUND_NOT_FOUND');
  end if;
  if v_request.status = 'approved' then
    select * into v_refund from public.refunds where refund_request_id = v_request.id;
    return v_refund;
  end if;
  if v_request.status <> 'requested' then
    perform public.luggage_error('REFUND_NOT_APPROVABLE');
  end if;

  -- 결제 행을 잠가 동시 환불 합계를 직렬화한다.
  select * into v_attempt from public.payment_attempts
   where order_id = v_request.order_id and status = 'succeeded'
   order by succeeded_at limit 1 for update;
  if not found then
    perform public.luggage_error('REFUND_NOT_APPROVABLE');
  end if;
  select coalesce(sum(r.amount_minor), 0) into v_refunded
    from public.refunds r where r.payment_attempt_id = v_attempt.id and r.status in ('queued', 'processing', 'succeeded', 'unknown');
  if v_refunded + v_request.amount_minor > v_attempt.amount_minor then
    perform public.luggage_error('REFUND_EXCEEDS_CAPTURED');
  end if;

  update public.refund_requests set status = 'approved', reviewed_by = v_uid, reviewed_at = now() where id = v_request.id;
  insert into public.refunds (refund_request_id, payment_attempt_id, amount_minor, currency)
  values (v_request.id, v_attempt.id, v_request.amount_minor, v_attempt.currency)
  returning * into v_refund;

  -- 전액 환불 승인이면 예약을 취소하고 확정 용량을 푼다 (이미 수거한 짐의 반환 작업은 배송 쪽에서 유지).
  select * into v_order from public.orders where id = v_request.order_id for update;
  if v_order.reservation_status = 'confirmed' and v_refunded + v_request.amount_minor = v_attempt.amount_minor then
    update public.capacity_buckets b set committed_units = b.committed_units - h.units
      from public.capacity_holds h where h.order_id = v_order.id and h.status = 'committed' and b.id = h.bucket_id;
    update public.capacity_holds set status = 'released' where order_id = v_order.id and status = 'committed';
    update public.orders set reservation_status = 'cancelled', cancelled_at = now() where id = v_order.id;
    insert into public.outbox_events (topic, aggregate_id) values ('order.cancelled', v_order.id);
  end if;
  insert into public.outbox_events (topic, aggregate_id, payload)
  values ('refund.approved', v_request.order_id, jsonb_build_object('refund_id', v_refund.id));
  return v_refund;
end;
$$;
revoke all on function public.approve_refund(uuid) from public;
grant execute on function public.approve_refund(uuid) to authenticated, service_role;

-- 환불 실행 결과 반영 (서버 전용). timeout은 unknown으로 두고 재조회한다.
create or replace function public.record_refund_result(p_refund_id uuid, p_status text, p_provider_refund_id text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_refund public.refunds;
  v_order_id uuid;
begin
  select * into v_refund from public.refunds where id = p_refund_id for update;
  if not found then
    perform public.luggage_error('REFUND_NOT_FOUND');
  end if;
  if v_refund.status = 'succeeded' then
    return 'already_succeeded';
  end if;
  if p_status not in ('processing', 'succeeded', 'failed', 'unknown') then
    perform public.luggage_error('REFUND_NOT_APPROVABLE');
  end if;

  update public.refunds
     set status = p_status::public.refund_status,
         provider_refund_id = coalesce(provider_refund_id, p_provider_refund_id),
         succeeded_at = case when p_status = 'succeeded' then now() end,
         failure_code = case when p_status = 'failed' then 'provider_failed' end
   where id = v_refund.id;

  if p_status = 'succeeded' then
    select order_id into v_order_id from public.payment_attempts where id = v_refund.payment_attempt_id;
    insert into public.ledger_entries (order_id, refund_id, entry_type, amount_minor, currency)
    values (v_order_id, v_refund.id, 'refund_succeeded', -v_refund.amount_minor, v_refund.currency);
    insert into public.outbox_events (topic, aggregate_id, payload)
    values ('refund.succeeded', v_order_id, jsonb_build_object('refund_id', v_refund.id));
  end if;
  return 'recorded_' || p_status;
end;
$$;
revoke all on function public.record_refund_result(uuid, text, text) from public;
grant execute on function public.record_refund_result(uuid, text, text) to service_role;
