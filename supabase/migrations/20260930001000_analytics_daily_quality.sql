-- GRW-2/3: 일별 집계와 현장 누락·증빙률. 고객 식별정보를 보관하지 않는다.
create table public.analytics_daily_summary (
  service_day date not null,
  dimension text not null check (dimension in ('overall','locale','route_type','hotel','channel','campaign')),
  dimension_value text not null,
  landing_views bigint not null default 0,
  quotes bigint not null default 0,
  orders_held bigint not null default 0,
  payments_confirmed bigint not null default 0,
  cancellations bigint not null default 0,
  bags_collected bigint not null default 0,
  bags_collected_on_time bigint not null default 0,
  handoff_ready bigint not null default 0,
  handoff_ready_on_time bigint not null default 0,
  bags_delivered bigint not null default 0,
  bags_delivered_on_time bigint not null default 0,
  support_created bigint not null default 0,
  refreshed_at timestamptz not null default now(),
  primary key (service_day, dimension, dimension_value)
);
create index analytics_daily_summary_lookup on public.analytics_daily_summary(dimension, service_day);
alter table public.analytics_daily_summary enable row level security;
revoke all on public.analytics_daily_summary from anon, authenticated;
grant select, insert, update, delete on public.analytics_daily_summary to service_role;

create or replace function public.refresh_analytics_daily_summary(p_from date, p_to date)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_count integer;
begin
  if current_setting('role', true) <> 'service_role' then perform public.luggage_error('FORBIDDEN'); end if;
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 366 then
    perform public.luggage_error('VALIDATION_FAILED');
  end if;
  delete from public.analytics_daily_summary where service_day between p_from and p_to;
  insert into public.analytics_daily_summary (
    service_day, dimension, dimension_value, landing_views, quotes, orders_held, payments_confirmed,
    cancellations, bags_collected, bags_collected_on_time, handoff_ready, handoff_ready_on_time,
    bags_delivered, bags_delivered_on_time, support_created
  )
  select e.service_day, d.dimension, d.dimension_value,
    count(*) filter (where e.event_type = 'landing_viewed'), count(*) filter (where e.event_type = 'quote_created'),
    count(*) filter (where e.event_type = 'order_held'), count(*) filter (where e.event_type = 'payment_confirmed'),
    count(*) filter (where e.event_type = 'order_cancelled'), count(*) filter (where e.event_type = 'bag_collected'),
    count(*) filter (where e.event_type = 'bag_collected' and e.on_time),
    count(*) filter (where e.event_type = 'handoff_ready'), count(*) filter (where e.event_type = 'handoff_ready' and e.on_time),
    count(*) filter (where e.event_type = 'bag_delivered'), count(*) filter (where e.event_type = 'bag_delivered' and e.on_time),
    count(*) filter (where e.event_type = 'support_created')
  from public.analytics_events e
  cross join lateral (values
    ('overall', 'all'), ('locale', coalesce(e.locale, 'unknown')),
    ('route_type', coalesce(e.route_type::text, 'unknown')),
    ('hotel', coalesce((select h.name_ko from public.hotels h where h.id = e.hotel_id), 'unknown')),
    ('channel', coalesce(e.channel::text, 'unknown')),
    ('campaign', coalesce(e.campaign_code, 'unknown'))
  ) d(dimension, dimension_value)
  where e.service_day between p_from and p_to
  group by e.service_day, d.dimension, d.dimension_value;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke all on function public.refresh_analytics_daily_summary(date,date) from public, anon, authenticated;
grant execute on function public.refresh_analytics_daily_summary(date,date) to service_role;

-- 집계된 날짜는 일별 표를 읽고, 아직 집계되지 않은 날짜는 원본을 읽는다.
create or replace function public.ops_metrics(p_from date, p_to date, p_dimension text default 'overall')
returns table (
  dimension_value text, landing_views bigint, quotes bigint, orders_held bigint, payments_confirmed bigint,
  cancellations bigint, bags_collected bigint, bags_collected_on_time bigint, handoff_ready bigint,
  handoff_ready_on_time bigint, bags_delivered bigint, bags_delivered_on_time bigint, support_created bigint
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not ((select public.is_operations_staff()) or (select public.is_finance_staff())) then perform public.luggage_error('FORBIDDEN'); end if;
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 366
     or p_dimension not in ('overall','locale','route_type','hotel','channel','campaign') then perform public.luggage_error('VALIDATION_FAILED'); end if;
  return query
  with source as (
    select s.dimension_value, s.landing_views, s.quotes, s.orders_held, s.payments_confirmed, s.cancellations,
      s.bags_collected, s.bags_collected_on_time, s.handoff_ready, s.handoff_ready_on_time,
      s.bags_delivered, s.bags_delivered_on_time, s.support_created
    from public.analytics_daily_summary s where s.dimension = p_dimension and s.service_day between p_from and p_to
    union all
    select case p_dimension when 'overall' then 'all' when 'locale' then coalesce(e.locale,'unknown')
      when 'route_type' then coalesce(e.route_type::text,'unknown')
      when 'hotel' then coalesce((select h.name_ko from public.hotels h where h.id=e.hotel_id),'unknown')
      when 'channel' then coalesce(e.channel::text,'unknown') else coalesce(e.campaign_code,'unknown') end,
      count(*) filter (where e.event_type='landing_viewed'), count(*) filter (where e.event_type='quote_created'),
      count(*) filter (where e.event_type='order_held'), count(*) filter (where e.event_type='payment_confirmed'),
      count(*) filter (where e.event_type='order_cancelled'), count(*) filter (where e.event_type='bag_collected'),
      count(*) filter (where e.event_type='bag_collected' and e.on_time), count(*) filter (where e.event_type='handoff_ready'),
      count(*) filter (where e.event_type='handoff_ready' and e.on_time), count(*) filter (where e.event_type='bag_delivered'),
      count(*) filter (where e.event_type='bag_delivered' and e.on_time), count(*) filter (where e.event_type='support_created')
    from public.analytics_events e
    where e.service_day between p_from and p_to and not exists (
      select 1 from public.analytics_daily_summary s where s.service_day=e.service_day and s.dimension=p_dimension)
    group by 1
  )
  select s.dimension_value, sum(s.landing_views)::bigint, sum(s.quotes)::bigint, sum(s.orders_held)::bigint,
    sum(s.payments_confirmed)::bigint, sum(s.cancellations)::bigint, sum(s.bags_collected)::bigint,
    sum(s.bags_collected_on_time)::bigint, sum(s.handoff_ready)::bigint, sum(s.handoff_ready_on_time)::bigint,
    sum(s.bags_delivered)::bigint, sum(s.bags_delivered_on_time)::bigint, sum(s.support_created)::bigint
  from source s group by s.dimension_value order by 5 desc, 1;
end;
$$;
revoke all on function public.ops_metrics(date,date,text) from public, anon;
grant execute on function public.ops_metrics(date,date,text) to authenticated, service_role;

create or replace function public.ops_field_quality(p_from date, p_to date)
returns table (dimension text, subject text, total_bags bigint, missing_after_cutoff bigint, collected_with_evidence bigint, collected_total bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not ((select public.is_operations_staff()) or (select public.is_finance_staff())) then perform public.luggage_error('FORBIDDEN'); end if;
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 93 then perform public.luggage_error('VALIDATION_FAILED'); end if;
  return query
  with jobs as (
    select j.id job_id, j.order_id, j.origin_hotel_id, s.pickup_ends_at,
      a.driver_id, b.id bag_id, b.bag_status,
      exists(select 1 from public.bag_events e where e.bag_id=b.id and e.event_type='collected') collected,
      exists(select 1 from public.bag_events e where e.bag_id=b.id and e.event_type='collected' and cardinality(e.evidence_ids)>0) evidenced
    from public.delivery_jobs j join public.service_slots s on s.id=j.slot_id
    join public.bags b on b.order_id=j.order_id
    left join public.job_assignments a on a.job_id=j.id and a.released_at is null
    where s.service_date between p_from and p_to and b.bag_status <> 'cancelled_before_pickup'
  )
  select d.dimension, d.subject, count(*)::bigint,
    count(*) filter (where not j.collected and j.pickup_ends_at < now())::bigint,
    count(*) filter (where j.evidenced)::bigint, count(*) filter (where j.collected)::bigint
  from jobs j cross join lateral (values
    ('hotel', coalesce((select h.name_ko from public.hotels h where h.id=j.origin_hotel_id),'공항 출발')),
    ('driver', coalesce((select p.display_name from public.profiles p where p.user_id=j.driver_id),j.driver_id::text,'미배정'))
  ) d(dimension,subject)
  group by d.dimension,d.subject order by d.dimension,d.subject;
end;
$$;
revoke all on function public.ops_field_quality(date,date) from public, anon;
grant execute on function public.ops_field_quality(date,date) to authenticated, service_role;

create or replace function public.ops_notification_failures(p_from date, p_to date)
returns table (dead_events bigint, pending_over_hour bigint, push_subscriptions_failing bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not ((select public.is_operations_staff()) or (select public.is_finance_staff())) then perform public.luggage_error('FORBIDDEN'); end if;
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 93 then perform public.luggage_error('VALIDATION_FAILED'); end if;
  return query select
    (select count(*) from public.outbox_events e where (e.created_at at time zone 'Asia/Seoul')::date between p_from and p_to and e.status='dead'),
    (select count(*) from public.outbox_events e where (e.created_at at time zone 'Asia/Seoul')::date between p_from and p_to and e.status='pending' and e.created_at < now()-interval '1 hour'),
    (select count(*) from public.push_subscriptions p where p.failure_count > 0);
end;
$$;
revoke all on function public.ops_notification_failures(date,date) from public, anon;
grant execute on function public.ops_notification_failures(date,date) to authenticated, service_role;
