create or replace function public.queue_handoff_location_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status <> 'active' or new.type not in ('airport_counter', 'airport_meeting_point') then return new; end if;
  if tg_op = 'UPDATE' and
     row(new.status, new.name_ko, new.floor, new.landmark_ko, new.photo_path, new.valid_from, new.valid_until)
     is not distinct from
     row(old.status, old.name_ko, old.floor, old.landmark_ko, old.photo_path, old.valid_from, old.valid_until) then
    return new;
  end if;
  insert into public.outbox_events(topic, aggregate_id, payload)
  select 'handoff_location.changed', o.id,
         jsonb_build_object('location_id', new.id, 'code', new.code, 'name_ko', new.name_ko)
    from public.orders o
    join public.service_slots s on s.id = o.slot_id
    join public.route_offerings r on r.id = o.route_offering_id
   where o.reservation_status = 'confirmed'
     and ((o.route_type = 'hotel_to_airport' and r.destination_zone_id = new.zone_id
            and s.delivery_starts_at >= greatest(now(), new.valid_from)
            and (new.valid_until is null or s.delivery_starts_at < new.valid_until))
       or (o.route_type = 'airport_to_hotel' and r.origin_zone_id = new.zone_id
            and s.pickup_starts_at >= greatest(now(), new.valid_from)
            and (new.valid_until is null or s.pickup_starts_at < new.valid_until)));
  return new;
end;
$$;
revoke all on function public.queue_handoff_location_changes() from public, anon, authenticated;
create trigger handoff_location_changed_outbox
  after insert or update of status, name_ko, floor, landmark_ko, photo_path, valid_from, valid_until
  on public.handoff_locations for each row execute function public.queue_handoff_location_changes();
