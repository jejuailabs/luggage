alter table public.refund_requests
  add column review_note text check (review_note is null or char_length(review_note) between 1 and 500);

-- Finance reviewers need the order reference and amount beside each request.
create policy orders_finance_read on public.orders for select to authenticated
  using ((select public.is_finance_staff()));

create trigger refund_requests_audit
  after update on public.refund_requests
  for each row execute function public.audit_row_change();

create or replace function public.reject_refund(p_refund_request_id uuid, p_reason text)
returns public.refund_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.refund_requests;
begin
  if not (select public.is_finance_staff()) and current_setting('role', true) is distinct from 'service_role' then
    perform public.luggage_error('FORBIDDEN');
  end if;
  if char_length(btrim(coalesce(p_reason, ''))) not between 1 and 500 then
    perform public.luggage_error('VALIDATION_FAILED');
  end if;
  select * into v_request from public.refund_requests where id = p_refund_request_id for update;
  if not found then
    perform public.luggage_error('REFUND_NOT_FOUND');
  end if;
  if v_request.status = 'rejected' then
    return v_request;
  end if;
  if v_request.status <> 'requested' then
    perform public.luggage_error('REFUND_NOT_APPROVABLE');
  end if;
  update public.refund_requests
     set status = 'rejected', reviewed_by = (select auth.uid()), reviewed_at = now(), review_note = btrim(p_reason)
   where id = v_request.id returning * into v_request;
  insert into public.outbox_events (topic, aggregate_id, payload)
  values ('refund.rejected', v_request.order_id, jsonb_build_object('refund_request_id', v_request.id));
  return v_request;
end;
$$;
revoke all on function public.reject_refund(uuid, text) from public, anon;
grant execute on function public.reject_refund(uuid, text) to authenticated, service_role;
