-- FLD-2: 원본 사건은 보존하고 운영자가 비종결 상태의 잘못된 기록을 새 이벤트로 정정한다.
create or replace function public.correct_bag_status(
  p_original_event_id uuid,
  p_to_status public.bag_status,
  p_reason text,
  p_expected_version integer,
  p_client_event_id text
)
returns public.bag_events
language plpgsql security definer set search_path = ''
as $$
declare
  v_original public.bag_events;
  v_bag public.bags;
  v_event public.bag_events;
begin
  if (select auth.uid()) is null or not public.has_role('dispatcher') then
    perform public.luggage_error('FORBIDDEN');
  end if;
  if length(btrim(coalesce(p_reason, ''))) < 10 or length(p_reason) > 1000
     or length(coalesce(p_client_event_id, '')) not between 8 and 128 then
    perform public.luggage_error('VALIDATION_FAILED');
  end if;
  select * into v_original from public.bag_events where id = p_original_event_id;
  if not found or v_original.event_type = 'correction' then
    perform public.luggage_error('EVENT_NOT_FOUND');
  end if;
  select * into v_bag from public.bags where id = v_original.bag_id for update;
  if not found then perform public.luggage_error('TAG_NOT_FOUND'); end if;
  select * into v_event from public.bag_events
    where bag_id = v_bag.id and actor_id = (select auth.uid()) and client_event_id = p_client_event_id;
  if found then return v_event; end if;
  if v_bag.version <> p_expected_version then perform public.luggage_error('VERSION_CONFLICT'); end if;
  -- 완료·반환·취소를 정정 UI로 되돌리거나 완료로 뛰어넘는 것은 금지한다.
  if v_bag.bag_status in ('delivered', 'returned', 'cancelled_before_pickup')
     or p_to_status not in ('registered', 'at_origin', 'collected', 'in_transit', 'ready_for_handoff', 'exception_hold')
     or p_to_status = v_bag.bag_status then
    perform public.luggage_error('INVALID_TRANSITION');
  end if;
  insert into public.bag_events (
    bag_id, job_id, order_id, actor_id, actor_role, event_type,
    from_status, to_status, client_event_id, note, details
  ) values (
    v_bag.id, v_original.job_id, v_original.order_id, (select auth.uid()), 'dispatcher', 'correction',
    v_bag.bag_status, p_to_status, p_client_event_id, btrim(p_reason),
    jsonb_build_object('original_event_id', v_original.id, 'original_event_type', v_original.event_type,
      'original_from_status', v_original.from_status, 'original_to_status', v_original.to_status)
  ) returning * into v_event;
  update public.bags set bag_status = p_to_status, version = version + 1 where id = v_bag.id;
  perform public.recompute_job_status(v_original.job_id);
  insert into public.outbox_events (topic, aggregate_id, payload)
    values ('bag.correction', v_original.order_id,
      jsonb_build_object('bag_id', v_bag.id, 'event_id', v_event.id, 'original_event_id', v_original.id));
  return v_event;
end;
$$;
revoke all on function public.correct_bag_status(uuid, public.bag_status, text, integer, text) from public, anon;
grant execute on function public.correct_bag_status(uuid, public.bag_status, text, integer, text) to authenticated, service_role;
