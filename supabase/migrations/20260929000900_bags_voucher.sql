-- B05 예약증과 개별 짐 (07 문서 2·3절).
-- 예약이 확정되면 짐 1개당 1행과 무작위 태그 ID를 만든다. 태그는 개인정보·주문 접근 권한을 담지 않는다.
-- 짐 상태 이벤트·인계 기록은 C단계에서 추가한다.

create type public.bag_status as enum (
  'registered', 'at_origin', 'collected', 'in_transit', 'ready_for_handoff', 'delivered',
  'exception_hold', 'return_in_progress', 'returned', 'cancelled_before_pickup'
);

create table public.bags (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete restrict,
  -- 주문 안에서 1부터 매기는 짐 번호 (예: 2/3번 짐)
  seq integer not null check (seq > 0),
  size public.bag_size not null,
  -- 무작위 태그 식별값. 추측 가능한 순번·주문번호를 쓰지 않는다.
  tag_id text not null unique check (tag_id ~ '^T[A-HJ-NP-Z2-9]{10}$'),
  bag_status public.bag_status not null default 'registered',
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bags_order_seq_key unique (order_id, seq)
);
create index bags_order_idx on public.bags (order_id);

create trigger bags_set_updated_at before update on public.bags
  for each row execute function public.set_updated_at();

create or replace function public.generate_bag_tag()
returns text
language plpgsql
set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  tag text;
begin
  loop
    tag := 'T';
    for i in 1..10 loop
      tag := tag || substr(alphabet, 1 + floor(random() * length(alphabet))::integer, 1);
    end loop;
    exit when not exists (select 1 from public.bags where tag_id = tag);
  end loop;
  return tag;
end;
$$;

-- 예약 확정 시 짐 행 생성, 수거 전 취소 시 짐 취소 (한 번만, 재실행 안전)
create or replace function public.sync_bags_with_reservation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_line record;
  v_seq integer := 0;
begin
  if new.reservation_status = 'confirmed' and old.reservation_status is distinct from 'confirmed'
     and not exists (select 1 from public.bags where order_id = new.id) then
    for v_line in
      select size, quantity from public.order_bags where order_id = new.id order by size
    loop
      for i in 1..v_line.quantity loop
        v_seq := v_seq + 1;
        insert into public.bags (order_id, seq, size, tag_id)
        values (new.id, v_seq, v_line.size, public.generate_bag_tag());
      end loop;
    end loop;
  elsif new.reservation_status = 'cancelled' and old.reservation_status is distinct from 'cancelled' then
    -- 이미 수거한 짐은 그대로 둔다 (반환 작업은 배송 쪽에서 유지).
    update public.bags
       set bag_status = 'cancelled_before_pickup', version = version + 1
     where order_id = new.id and bag_status in ('registered', 'at_origin');
  end if;
  return new;
end;
$$;

create trigger orders_sync_bags
  after update of reservation_status on public.orders
  for each row execute function public.sync_bags_with_reservation();

alter table public.bags enable row level security;
revoke all on public.bags from anon, authenticated;
grant select on public.bags to authenticated;
grant select, insert, update on public.bags to service_role;

-- 고객은 자기 주문의 짐, 운영자는 전체. 기사·호텔 범위는 C단계 배정 모델과 함께 추가한다.
create policy bags_select on public.bags for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id));
