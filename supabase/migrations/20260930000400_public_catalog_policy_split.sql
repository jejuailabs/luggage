-- Public catalog policies must not invoke staff-only helper functions for
-- anonymous visitors. Keep the anonymous branch limited to published rows.
drop policy if exists service_zones_read on public.service_zones;
create policy service_zones_public_read on public.service_zones for select to anon
  using (status = 'active');
create policy service_zones_staff_read on public.service_zones for select to authenticated
  using (status = 'active' or (select public.is_operations_staff()));

drop policy if exists hotels_read on public.hotels;
create policy hotels_public_read on public.hotels for select to anon
  using (status = 'active');
create policy hotels_staff_read on public.hotels for select to authenticated
  using (status = 'active' or (select public.is_operations_staff()) or public.has_role('hotel_staff', 'hotel', id));

drop policy if exists handoff_locations_read on public.handoff_locations;
create policy handoff_locations_public_read on public.handoff_locations for select to anon
  using (status = 'active' and valid_from <= now() and (valid_until is null or valid_until > now()));
create policy handoff_locations_staff_read on public.handoff_locations for select to authenticated
  using (
    (status = 'active' and valid_from <= now() and (valid_until is null or valid_until > now()))
    or (select public.is_operations_staff())
    or (hotel_id is not null and public.has_role('hotel_staff', 'hotel', hotel_id))
  );

drop policy if exists route_offerings_read on public.route_offerings;
create policy route_offerings_public_read on public.route_offerings for select to anon
  using (enabled);
create policy route_offerings_staff_read on public.route_offerings for select to authenticated
  using (enabled or (select public.is_operations_staff()));

drop policy if exists price_rules_read on public.price_rules;
create policy price_rules_public_read on public.price_rules for select to anon
  using (status = 'active');
create policy price_rules_staff_read on public.price_rules for select to authenticated
  using (status = 'active' or (select public.is_operations_staff()));

drop policy if exists service_slots_read on public.service_slots;
create policy service_slots_public_read on public.service_slots for select to anon
  using (status = 'active');
create policy service_slots_staff_read on public.service_slots for select to authenticated
  using (status = 'active' or (select public.is_operations_staff()));
