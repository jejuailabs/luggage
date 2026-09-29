-- D05 위챗 미니프로그램 결제 위임 (04 문서 8절, 09 문서 11절).
-- web-view 안의 웹(쿠키 세션, 주문 소유자)이 결제 시도를 만들고 1회용 결제 티켓을 발급한다.
-- 미니프로그램 결제 페이지는 티켓 + wx.login 코드로 결제 파라미터를 받는다. 티켓 원문은 저장하지 않는다.
-- 결제 확정은 다른 채널과 같이 서버의 PG 조회·웹훅(record_payment_result)으로만 한다.

create table public.miniprogram_pay_tickets (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.payment_attempts (id) on delete cascade,
  ticket_hash text not null unique,
  expires_at timestamptz not null default now() + interval '5 minutes',
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.miniprogram_pay_tickets enable row level security;
revoke all on public.miniprogram_pay_tickets from anon, authenticated;
grant select, insert, update on public.miniprogram_pay_tickets to service_role;

-- 주문 소유자가 자기 결제 시도에 대해 티켓을 만든다. 원문은 이 응답에서만 보인다.
create or replace function public.create_miniprogram_pay_ticket(p_attempt_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attempt public.payment_attempts;
  v_ticket text;
begin
  select a.* into v_attempt
    from public.payment_attempts a
    join public.orders o on o.id = a.order_id
   where a.id = p_attempt_id and o.owner_id = (select auth.uid())
     and a.method = 'wechat_pay_miniprogram' and a.status in ('created', 'pending');
  if not found then
    perform public.luggage_error('ORDER_NOT_PAYABLE');
  end if;
  v_ticket := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  insert into public.miniprogram_pay_tickets (attempt_id, ticket_hash)
  values (v_attempt.id, encode(sha256(convert_to(v_ticket, 'UTF8')), 'hex'));
  return v_ticket;
end;
$$;
revoke all on function public.create_miniprogram_pay_ticket(uuid) from public;
grant execute on function public.create_miniprogram_pay_ticket(uuid) to authenticated, service_role;

-- 서버 전용: 티켓을 한 번만 소비하고 결제 시도를 돌려준다 (행 잠금으로 동시 소비 차단).
create or replace function public.redeem_miniprogram_pay_ticket(p_ticket text)
returns public.payment_attempts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.miniprogram_pay_tickets;
  v_attempt public.payment_attempts;
begin
  select * into v_row from public.miniprogram_pay_tickets
   where ticket_hash = encode(sha256(convert_to(coalesce(p_ticket, ''), 'UTF8')), 'hex')
   for update;
  if not found or v_row.consumed_at is not null or v_row.expires_at <= now() then
    perform public.luggage_error('PAY_TICKET_INVALID');
  end if;
  update public.miniprogram_pay_tickets set consumed_at = now() where id = v_row.id;
  select * into v_attempt from public.payment_attempts where id = v_row.attempt_id;
  if v_attempt.status not in ('created', 'pending') then
    perform public.luggage_error('ORDER_NOT_PAYABLE');
  end if;
  return v_attempt;
end;
$$;
revoke all on function public.redeem_miniprogram_pay_ticket(text) from public;
grant execute on function public.redeem_miniprogram_pay_ticket(text) to service_role;
