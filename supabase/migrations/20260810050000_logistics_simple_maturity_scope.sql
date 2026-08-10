-- LOGISTICS_SIMPLE_MATURITIES_SCOPE_V1
-- Keep maturity notifications inside the selected asset and requested date
-- window while projecting only human-readable document fields.

begin;

set local lock_timeout = '10s';
set local statement_timeout = '60s';

select pg_advisory_xact_lock(hashtextextended('LOGISTICS_SIMPLE_MATURITIES_SCOPE_V1', 0));

do $preflight$
declare
  v_tables text[];
begin
  select array_agg(class.relname order by class.relname)
  into v_tables
  from pg_catalog.pg_class class
  join pg_catalog.pg_namespace namespace on namespace.oid = class.relnamespace
  where namespace.nspname = 'logistics_core'
    and class.relkind in ('r', 'p');

  if v_tables is distinct from array['assets', 'funds', 'income_expense', 'rent_roll']::text[]
     or to_regprocedure('logistics_core.maturities_read_entry(uuid,text,jsonb,jsonb)') is null then
    raise exception using errcode = 'PT500', message = 'SIMPLE_MATURITY_FOUR_DOCUMENT_PREFLIGHT_FAILED';
  end if;
end;
$preflight$;

create or replace function logistics_core.maturities_read_entry(
  p_request_id uuid,
  p_asset_key text,
  p_payload jsonb,
  p_expected_revisions jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, logistics_core
as $body$
declare
  v_actor uuid := logistics_core.request_actor();
  v_asset_code text := logistics_core.resolve_asset_code(p_asset_key);
  v_from_text text := nullif(btrim(coalesce(p_payload->>'from_date', '')), '');
  v_to_text text := nullif(btrim(coalesce(p_payload->>'to_date', '')), '');
  v_from_date date;
  v_to_date date;
  v_version text;
  v_fund logistics_core.funds%rowtype;
  v_rows jsonb := '[]'::jsonb;
  v_lease_rows jsonb := '[]'::jsonb;
  v_loan_rows jsonb := '[]'::jsonb;
begin
  if (v_from_text is not null and v_from_text !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$')
     or (v_to_text is not null and v_to_text !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$') then
    raise exception using errcode = 'PT422', message = 'MATURITY_DATE_RANGE_INVALID';
  end if;

  begin
    v_from_date := coalesce(v_from_text::date, current_date);
    v_to_date := coalesce(v_to_text::date, v_from_date + 365);
  exception when datetime_field_overflow or invalid_datetime_format then
    raise exception using errcode = 'PT422', message = 'MATURITY_DATE_RANGE_INVALID';
  end;

  if v_to_date < v_from_date then
    raise exception using errcode = 'PT422', message = 'MATURITY_DATE_RANGE_INVALID';
  end if;

  perform logistics_core.assert_asset_permission(v_actor, v_asset_code, 'read');

  select fund.* into strict v_fund
  from logistics_core.assets asset
  join logistics_core.funds fund on fund.fund_code = asset.fund_code
  where asset.asset_code = v_asset_code;

  select concat(rent.xmin::text, ':', fund.xmin::text)
  into strict v_version
  from logistics_core.rent_roll rent
  join logistics_core.assets asset on asset.asset_code = rent.asset_code
  join logistics_core.funds fund on fund.fund_code = asset.fund_code
  where rent.asset_code = v_asset_code;

  with normalized as (
    select
      coalesce(
        nullif(btrim(item.value->>'tenant_name'), ''),
        nullif(btrim(item.value->>'subtenant_name'), ''),
        '임차인 정보 확인 필요'
      ) as tenant_name,
      (item.value->>'expiry_date')::date as expiry_date,
      item.value
    from jsonb_array_elements(
      (select document.rows from logistics_core.rent_roll document where document.asset_code = v_asset_code)
    ) with ordinality item(value, ordinality)
    where item.value->>'expiry_date' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
      and (item.value->>'expiry_date')::date between v_from_date and v_to_date
  ), grouped as (
    select
      tenant_name,
      expiry_date,
      min(nullif(value->>'commencement_date', '')) as commencement_date,
      string_agg(distinct nullif(btrim(value->>'floor_label'), ''), ' · ') as floor_labels,
      string_agg(distinct nullif(btrim(value->>'zone_label'), ''), ' · ') as zone_labels,
      sum(case when logistics_core.is_finite_json_number(value->'leased_area_sqm')
        then (value->>'leased_area_sqm')::numeric else 0 end) as leased_area_sqm,
      sum(case when logistics_core.is_finite_json_number(value->'deposit_total_krw')
        then (value->>'deposit_total_krw')::numeric else 0 end) as deposit_amount,
      sum(case when logistics_core.is_finite_json_number(value->'monthly_rent_total_krw')
        then (value->>'monthly_rent_total_krw')::numeric else 0 end) as monthly_rent_total_krw,
      sum(case when logistics_core.is_finite_json_number(value->'monthly_cam_total_krw')
        then (value->>'monthly_cam_total_krw')::numeric else 0 end) as monthly_cam_total_krw,
      min(nullif(value->>'renewal_terms', '')) as renewal_terms,
      min(nullif(value->>'termination_terms', '')) as termination_terms,
      min(nullif(value->>'restoration_terms', '')) as restoration_terms
    from normalized
    group by tenant_name, expiry_date
  )
  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
    'maturity_type', 'lease',
    'name', tenant_name,
    'tenant_name', tenant_name,
    'maturity_date', expiry_date,
    'official_date', expiry_date,
    'commencement_date', commencement_date,
    'floor_labels', floor_labels,
    'zone_labels', zone_labels,
    'leased_area_sqm', leased_area_sqm,
    'deposit_amount', deposit_amount,
    'monthly_rent_total_krw', monthly_rent_total_krw,
    'monthly_cam_total_krw', monthly_cam_total_krw,
    'renewal_terms', renewal_terms,
    'termination_terms', termination_terms,
    'restoration_terms', restoration_terms
  )) order by expiry_date, tenant_name), '[]'::jsonb)
  into v_lease_rows
  from grouped;

  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
    'maturity_type', 'loan',
    'name', coalesce(nullif(item.value->>'tranche', ''), nullif(item.value->>'lender_name', ''), '대출 정보 확인 필요'),
    'tranche_name', nullif(item.value->>'tranche', ''),
    'lender_names', case when nullif(item.value->>'lender_name', '') is null
      then '[]'::jsonb else jsonb_build_array(item.value->>'lender_name') end,
    'maturity_date', item.value->>'maturity_date',
    'official_date', item.value->>'maturity_date',
    'drawdown_date', nullif(item.value->>'drawdown_date', ''),
    'commitment_amount', item.value->'committed_amount_krw',
    'loan_type', nullif(item.value->>'loan_type', ''),
    'interest_type', nullif(item.value->>'interest_type', ''),
    'coupon_rate', item.value->'coupon_rate',
    'all_in_rate', item.value->'all_in_rate',
    'fee_rate', item.value->'fee_rate',
    'fund_name', v_fund.name
  )) order by item.value->>'maturity_date', item.value->>'tranche', item.value->>'lender_name'), '[]'::jsonb)
  into v_loan_rows
  from jsonb_array_elements(v_fund.loans) with ordinality item(value, ordinality)
  where item.value->>'maturity_date' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
    and (item.value->>'maturity_date')::date between v_from_date and v_to_date;

  if v_fund.maturity_date between v_from_date and v_to_date then
    v_rows := jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
      'maturity_type', 'fund',
      'name', v_fund.name,
      'fund_name', v_fund.name,
      'maturity_date', v_fund.maturity_date,
      'official_date', v_fund.maturity_date,
      'inception_date', v_fund.inception_date,
      'fund_type', v_fund.fund_type,
      'investment_strategy', v_fund.investment_strategy,
      'ownership_ratio', v_fund.ownership_ratio
    )));
  end if;

  v_rows := v_lease_rows || v_rows || v_loan_rows;
  return logistics_core.primary_response(
    p_request_id,
    v_version,
    jsonb_build_object(
      'from_date', v_from_date,
      'to_date', v_to_date,
      'maturities', v_rows
    )
  );
end;
$body$;

revoke all on function logistics_core.maturities_read_entry(uuid, text, jsonb, jsonb)
from public, anon, authenticated;

commit;
