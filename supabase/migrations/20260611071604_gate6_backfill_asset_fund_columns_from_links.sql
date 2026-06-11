-- Backfill denormalized asset fund labels from the canonical fund link tables.
-- This keeps Work Platform permission popups aligned with the Asset tab fund overview.

with primary_asset_funds as (
  select distinct on (l.asset_id)
    l.asset_id,
    f.fund_code,
    f.fund_name
  from public.ll_fund_asset_links l
  join public.ll_funds f on f.fund_id = l.fund_id
  where nullif(l.asset_id, '') is not null
    and (nullif(f.fund_code, '') is not null or nullif(f.fund_name, '') is not null)
  order by
    l.asset_id,
    case when l.link_type = 'primary' then 0 else 1 end,
    l.updated_at desc nulls last,
    f.updated_at desc nulls last
),
target_assets as (
  select
    a.asset_id,
    a.asset_code,
    a.asset_name,
    a.fund_code as before_fund_code,
    a.fund_name as before_fund_name,
    p.fund_code as after_fund_code,
    p.fund_name as after_fund_name
  from public.ll_assets a
  join primary_asset_funds p on p.asset_id = a.asset_id
  where nullif(a.fund_code, '') is null
     or nullif(a.fund_name, '') is null
),
updated_assets as (
  update public.ll_assets a
  set
    fund_code = coalesce(nullif(a.fund_code, ''), t.after_fund_code),
    fund_name = coalesce(nullif(a.fund_name, ''), t.after_fund_name),
    updated_at = now()
  from target_assets t
  where a.asset_id = t.asset_id
  returning
    a.asset_id,
    a.asset_code,
    a.asset_name,
    t.before_fund_code,
    t.before_fund_name,
    a.fund_code as after_fund_code,
    a.fund_name as after_fund_name
)
insert into public.ll_audit_events (
  event_type,
  action,
  target_table,
  target_row_id,
  field_name,
  before_value,
  after_value,
  event_status,
  event_payload,
  metadata,
  created_at
)
select
  'data_change',
  'backfill_asset_fund_columns_from_links',
  'public.ll_assets',
  asset_id,
  'fund_code,fund_name',
  jsonb_build_object('fund_code', before_fund_code, 'fund_name', before_fund_name)::text,
  jsonb_build_object('fund_code', after_fund_code, 'fund_name', after_fund_name)::text,
  'applied',
  jsonb_build_object('asset_code', asset_code, 'asset_name', asset_name),
  jsonb_build_object('source', '20260611071604_gate6_backfill_asset_fund_columns_from_links'),
  now()
from updated_assets;
