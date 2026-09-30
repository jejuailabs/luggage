-- 운영자 회원 조회·업무 역할 관리. 공개 Data API에 auth.users를 직접 노출하지 않는다.
create or replace function public.admin_list_members()
returns table (
  user_id uuid,
  email text,
  display_name text,
  is_anonymous boolean,
  created_at timestamptz,
  order_count bigint,
  roles jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not (select public.has_role('admin')) then
    perform public.luggage_error('FORBIDDEN');
  end if;

  return query
  select u.id, u.email::text, p.display_name, u.is_anonymous, u.created_at,
    (select count(*) from public.orders o where o.owner_id = u.id),
    coalesce((select jsonb_agg(jsonb_build_object('role', r.role, 'scope_id', r.scope_id) order by r.created_at)
      from public.role_assignments r where r.user_id = u.id), '[]'::jsonb)
  from auth.users u
  left join public.profiles p on p.user_id = u.id
  order by u.created_at desc
  limit 500;
end;
$$;

revoke all on function public.admin_list_members() from public;
grant execute on function public.admin_list_members() to authenticated, service_role;

create or replace function public.admin_set_member_role(
  p_user_id uuid,
  p_role public.staff_role,
  p_scope_id uuid,
  p_enabled boolean
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_scope public.role_scope;
begin
  if (select auth.uid()) is null or not (select public.has_role('admin')) then
    perform public.luggage_error('FORBIDDEN');
  end if;
  if p_user_id is null or p_role is null or p_enabled is null then
    perform public.luggage_error('VALIDATION_FAILED');
  end if;
  if not exists (select 1 from auth.users u where u.id = p_user_id and not u.is_anonymous) then
    perform public.luggage_error('VALIDATION_FAILED');
  end if;
  if p_role = 'hotel_staff' then
    if p_scope_id is null or not exists (select 1 from public.hotels h where h.id = p_scope_id) then
      perform public.luggage_error('VALIDATION_FAILED');
    end if;
    v_scope := 'hotel';
  else
    if p_scope_id is not null then perform public.luggage_error('VALIDATION_FAILED'); end if;
    v_scope := 'global';
  end if;
  if not p_enabled and p_user_id = (select auth.uid()) and p_role = 'admin' then
    perform public.luggage_error('FORBIDDEN');
  end if;

  if p_enabled then
    insert into public.role_assignments (user_id, role, scope_type, scope_id, granted_by)
    values (p_user_id, p_role, v_scope, p_scope_id, (select auth.uid()))
    on conflict do nothing;
  else
    delete from public.role_assignments
    where user_id = p_user_id and role = p_role and scope_type = v_scope and scope_id is not distinct from p_scope_id;
  end if;
  return true;
end;
$$;

revoke all on function public.admin_set_member_role(uuid, public.staff_role, uuid, boolean) from public;
grant execute on function public.admin_set_member_role(uuid, public.staff_role, uuid, boolean) to authenticated, service_role;
