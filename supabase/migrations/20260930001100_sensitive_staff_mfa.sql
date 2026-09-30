-- OPS-A7: admin, finance, dispatcher 역할의 모든 RLS/SECURITY DEFINER 검사는 AAL2 세션만 통과한다.
create or replace function public.has_role(
  check_role public.staff_role,
  check_scope_type public.role_scope default 'global',
  check_scope_id uuid default null
)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.role_assignments ra
    where ra.user_id = (select auth.uid())
      and (ra.role not in ('admin','finance','dispatcher') or (select auth.jwt()->>'aal') = 'aal2')
      and (
        ra.role = 'admin'
        or (ra.role = check_role and ra.scope_type = check_scope_type and ra.scope_id is not distinct from check_scope_id)
      )
  );
$$;
revoke all on function public.has_role(public.staff_role,public.role_scope,uuid) from public, anon;
grant execute on function public.has_role(public.staff_role,public.role_scope,uuid) to authenticated, service_role;
