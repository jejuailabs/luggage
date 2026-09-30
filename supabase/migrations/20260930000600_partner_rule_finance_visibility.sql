-- Finance staff must identify the hotel tied to each partner code. Limit this
-- additional read scope to staff with the finance role; writes stay in RLS.
create policy hotels_finance_read on public.hotels for select to authenticated
  using ((select public.is_finance_staff()));
