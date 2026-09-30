-- 홈 히어로 문구/버튼 버전을 세션 쿠키에서 주문 귀속과 함께 고정한다.
-- 쿠키는 서버가 생성하지만 고객이 수정할 수 있으므로 값은 허용 목록으로만 채택한다.
alter table public.order_attributions
  add column experiment_key text,
  add column experiment_variant text,
  add column experiment_session_id uuid,
  add constraint order_attributions_experiment_shape check (
    (experiment_key is null and experiment_variant is null and experiment_session_id is null)
    or (experiment_key = 'home_hero_v1' and experiment_variant in ('A', 'B') and experiment_session_id is not null)
  );

create index order_attributions_experiment_idx on public.order_attributions (experiment_key, experiment_variant)
  where experiment_key is not null;

create or replace function public.create_order_with_attribution(
  p_quote_id uuid,
  p_idempotency_key text,
  p_contact jsonb,
  p_locale text,
  p_accepted_policies text[],
  p_attribution jsonb
)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_code public.partner_codes;
  v_channel public.attribution_channel := 'unknown';
  v_campaign text := nullif(btrim(coalesce(p_attribution ->> 'campaign', '')), '');
  v_landing text := left(nullif(btrim(coalesce(p_attribution ->> 'landing', '')), ''), 200);
  v_variant text := p_attribution ->> 'heroVariant';
  v_session_id uuid;
begin
  v_order := public.create_order(p_quote_id, p_idempotency_key, p_contact, p_locale, p_accepted_policies);
  if coalesce(p_attribution ->> 'channel', '') in ('hotel_qr', 'search', 'xiaohongshu', 'share', 'direct') then
    v_channel := (p_attribution ->> 'channel')::public.attribution_channel;
  end if;
  if v_campaign is not null and v_campaign !~ '^[A-Za-z0-9_-]{1,40}$' then v_campaign := null; end if;
  if v_variant in ('A', 'B') and (p_attribution ->> 'experimentSessionId') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    v_session_id := (p_attribution ->> 'experimentSessionId')::uuid;
  else
    v_variant := null;
  end if;
  select pc.* into v_code
    from public.partner_codes pc
   where pc.code = upper(btrim(coalesce(p_attribution ->> 'partnerCode', '')))
     and pc.status = 'active'
     and current_date >= pc.valid_from
     and (pc.valid_until is null or current_date <= pc.valid_until)
     and v_order.route_type = any (pc.applicable_routes);
  insert into public.order_attributions (
    order_id, channel, partner_code_id, partner_id, hotel_id, campaign_code, landing_path,
    experiment_key, experiment_variant, experiment_session_id
  ) values (
    v_order.id,
    case when v_code.id is not null and v_channel = 'unknown' then 'hotel_qr'::public.attribution_channel else v_channel end,
    v_code.id, v_code.partner_id, v_code.hotel_id, v_campaign, v_landing,
    case when v_variant is not null then 'home_hero_v1' end, v_variant, v_session_id
  ) on conflict (order_id) do nothing;
  return v_order;
end;
$$;
revoke all on function public.create_order_with_attribution(uuid, text, jsonb, text, text[], jsonb) from public;
grant execute on function public.create_order_with_attribution(uuid, text, jsonb, text, text[], jsonb) to authenticated, service_role;
