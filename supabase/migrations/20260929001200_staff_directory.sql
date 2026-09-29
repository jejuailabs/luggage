-- 배차 화면용 기사 목록 (dispatcher 전용). 역할 원장 전체를 노출하지 않고 이름만 돌려준다.
create or replace function public.list_drivers()
returns table (user_id uuid, display_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select ra.user_id, coalesce(p.display_name, '기사 ' || left(ra.user_id::text, 8))
    from public.role_assignments ra
    left join public.profiles p on p.user_id = ra.user_id
   where ra.role = 'driver' and public.has_role('dispatcher')
   order by 2;
$$;
revoke all on function public.list_drivers() from public;
grant execute on function public.list_drivers() to authenticated;
