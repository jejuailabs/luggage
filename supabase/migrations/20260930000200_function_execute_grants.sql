-- PostgreSQL grants EXECUTE on new functions to PUBLIC by default.  Keep
-- SECURITY DEFINER entry points private unless a browser flow uses them.
do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as signature, p.proname
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.signature);
    execute format('grant execute on function %s to service_role', f.signature);

    if f.proname in ('available_slots', 'resolve_partner_code', 'track_public_event') then
      execute format('grant execute on function %s to anon', f.signature);
    end if;

    if f.proname in (
      'add_support_message', 'admin_list_members', 'admin_set_member_role',
      'approve_refund', 'assign_driver', 'available_slots',
      'confirm_settlement', 'create_evidence_intent',
      'create_miniprogram_pay_ticket', 'create_order_with_attribution',
      'create_quote', 'create_settlement_draft', 'create_support_ticket',
      'driver_jobs', 'has_role', 'is_active_driver', 'is_finance_staff',
      'is_operations_staff', 'is_partner_staff_of', 'is_support_staff',
      'issue_handoff_challenge', 'latest_vehicle_location', 'list_drivers',
      'mark_settlement_paid', 'ops_metrics', 'order_payment_summary',
      'partner_jobs', 'record_bag_event', 'record_driver_location',
      'report_incident', 'request_cancellation', 'resolve_partner_code',
      'set_job_vehicle', 'start_payment', 'verify_handoff'
    ) then
      execute format('grant execute on function %s to authenticated', f.signature);
    end if;
  end loop;
end $$;
