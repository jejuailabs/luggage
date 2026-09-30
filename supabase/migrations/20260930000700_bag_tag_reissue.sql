create table public.bag_tag_reissues (
  id uuid primary key default gen_random_uuid(),
  bag_id uuid not null references public.bags(id) on delete restrict,
  old_tag text not null,
  new_tag text not null unique,
  reason text not null check (char_length(reason) between 1 and 500),
  reissued_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);
create index bag_tag_reissues_bag_idx on public.bag_tag_reissues(bag_id, created_at desc);
alter table public.bag_tag_reissues enable row level security;
revoke all on public.bag_tag_reissues from anon, authenticated;
grant select on public.bag_tag_reissues to authenticated;
grant select, insert on public.bag_tag_reissues to service_role;
create policy bag_tag_reissues_staff_read on public.bag_tag_reissues for select to authenticated
  using ((select public.has_role('admin')) or exists (
    select 1 from public.bags b join public.orders o on o.id = b.order_id
     where b.id = bag_id and o.origin_hotel_id is not null
       and public.has_role('hotel_staff', 'hotel', o.origin_hotel_id)
  ));

create or replace function public.reissue_bag_tag(p_bag_id uuid, p_reason text)
returns public.bags
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_bag public.bags;
  v_origin uuid;
  v_old text;
  v_new text;
begin
  if char_length(btrim(coalesce(p_reason, ''))) not between 1 and 500 then
    perform public.luggage_error('VALIDATION_FAILED');
  end if;
  select * into v_bag from public.bags where id = p_bag_id for update;
  if not found then perform public.luggage_error('TAG_NOT_FOUND'); end if;
  select origin_hotel_id into v_origin from public.orders where id = v_bag.order_id;
  if not (select public.has_role('admin')) and
     not (v_origin is not null and public.has_role('hotel_staff', 'hotel', v_origin)) then
    perform public.luggage_error('FORBIDDEN');
  end if;
  if v_bag.bag_status not in ('registered', 'at_origin') then
    perform public.luggage_error('INVALID_TRANSITION');
  end if;
  v_old := v_bag.tag_id;
  v_new := public.generate_bag_tag();
  update public.bags set tag_id = v_new, version = version + 1 where id = v_bag.id returning * into v_bag;
  insert into public.bag_tag_reissues(bag_id, old_tag, new_tag, reason, reissued_by)
  values (v_bag.id, v_old, v_new, btrim(p_reason), (select auth.uid()));
  return v_bag;
end;
$$;
revoke all on function public.reissue_bag_tag(uuid, text) from public, anon;
grant execute on function public.reissue_bag_tag(uuid, text) to authenticated, service_role;
