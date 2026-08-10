-- LOGISTICS_OCCUPANCY_EXPIRED_RENT_GUARD_V1
--
-- SDD contract
-- * Numerator: leased_area_sqm from rows marked occupied whose optional
--   commencement/expiry bounds contain current_date.
-- * Denominator: positive assets.leasable_area_sqm; only when that value is
--   absent, positive assets.gross_area_sqm.
-- * A missing/invalid denominator or a rent-roll total above the denominator
--   is a visible data mismatch.  Rate and vacancy are withheld, never capped.
-- * rent_roll_read_entry returns every stored row, including expired rows.
-- * A whole-document save cannot omit an already stored expired row.  Because
--   rows intentionally have no hidden identifier, the guard preserves the
--   cardinality of each visible natural key (tenant, floor, zone and dates).
--   Non-key terms on an expired row remain correctable through the normal save.

begin;

set local lock_timeout = '10s';
set local statement_timeout = '120s';

select pg_advisory_xact_lock(hashtextextended('LOGISTICS_OCCUPANCY_EXPIRED_RENT_GUARD_V1', 0));

do $preflight$
begin
  if to_regclass('logistics_core.assets') is null
     or to_regclass('logistics_core.rent_roll') is null
     or to_regprocedure('logistics_core.home_read_entry(uuid,text,jsonb,jsonb)') is null
     or to_regprocedure('logistics_core.rent_roll_read_entry(uuid,text,jsonb,jsonb)') is null
     or to_regprocedure('logistics_core.rent_roll_batch_save_entry(uuid,text,jsonb,jsonb)') is null then
    raise exception using errcode = 'PT500', message = 'OCCUPANCY_RENT_GUARD_PREREQUISITE_MISSING';
  end if;
end;
$preflight$;

-- GYEONGSAN_FULL_LEASE_AREA_CORRECTION_V1
-- The user confirmed that Coupang leases the full leasable area of asset
-- A120085001.  Use the already stored rent-roll area only after every observed
-- source value matches the reviewed 2026-08-10 snapshot; otherwise fail the
-- whole migration instead of guessing or applying a partial correction.
do $gyeongsan_full_lease_area$
declare
  v_as_of constant date := date '2026-08-10';
  v_existing_leasable_area numeric;
  v_gross_area numeric;
  v_current_occupied_area numeric;
  v_current_rent_area numeric;
  v_current_tenant_count bigint;
  v_current_nonoccupied_count bigint;
begin
  select asset.leasable_area_sqm, asset.gross_area_sqm
  into strict v_existing_leasable_area, v_gross_area
  from logistics_core.assets asset
  where asset.asset_code = 'A120085001'
  for update;

  select
    coalesce(sum(nullif(item.value->>'leased_area_sqm', '')::numeric)
      filter (where item.value->>'occupancy_status' = 'occupied'), 0),
    coalesce(sum(nullif(item.value->>'leased_area_sqm', '')::numeric), 0),
    count(distinct nullif(item.value->>'tenant_name', ''))
      filter (where item.value->>'occupancy_status' = 'occupied'),
    count(*) filter (where coalesce(item.value->>'occupancy_status', '') <> 'occupied')
  into
    v_current_occupied_area,
    v_current_rent_area,
    v_current_tenant_count,
    v_current_nonoccupied_count
  from logistics_core.rent_roll document
  cross join lateral jsonb_array_elements(document.rows) item(value)
  where document.asset_code = 'A120085001'
    and (
      nullif(item.value->>'commencement_date', '') is null
      or (item.value->>'commencement_date')::date <= v_as_of
    )
    and (
      nullif(item.value->>'expiry_date', '') is null
      or (item.value->>'expiry_date')::date >= v_as_of
    );

  if v_gross_area is distinct from 98673.64
     or v_current_occupied_area is distinct from 73821.68
     or v_current_rent_area is distinct from v_current_occupied_area
     or v_current_tenant_count <> 1
     or v_current_nonoccupied_count <> 0 then
    raise exception using
      errcode = 'PT500',
      message = 'GYEONGSAN_FULL_LEASE_AREA_PREFLIGHT_MISMATCH',
      detail = 'The reviewed asset or rent-roll values changed; no area correction was applied.';
  end if;

  if v_existing_leasable_area is null then
    update logistics_core.assets
    set leasable_area_sqm = 73821.68
    where asset_code = 'A120085001';
  elsif v_existing_leasable_area is distinct from 73821.68 then
    raise exception using
      errcode = 'PT500',
      message = 'GYEONGSAN_LEASABLE_AREA_ALREADY_CONFLICTS';
  end if;
end;
$gyeongsan_full_lease_area$;

create or replace function logistics_core.assert_expired_rent_rows_preserved(
  p_old_rows jsonb,
  p_new_rows jsonb,
  p_as_of date
)
returns void
language plpgsql
immutable
security definer
set search_path = pg_catalog
as $body$
declare
  v_old_row record;
  v_old_count bigint;
  v_new_count bigint;
begin
  if jsonb_typeof(p_old_rows) <> 'array' or jsonb_typeof(p_new_rows) <> 'array' then
    raise exception using errcode = 'PT422', message = 'RENT_ROLL_ROWS_ARRAY_REQUIRED';
  end if;
  if p_as_of is null then
    raise exception using errcode = 'PT422', message = 'RENT_ROLL_AS_OF_DATE_REQUIRED';
  end if;

  for v_old_row in
    select
      jsonb_build_array(
        item.value->>'tenant_name',
        item.value->>'floor_label',
        item.value->>'zone_label',
        item.value->>'commencement_date',
        item.value->>'expiry_date'
      ) as row_identity,
      count(*) as old_count
    from jsonb_array_elements(p_old_rows) item(value)
    where nullif(item.value->>'expiry_date', '') is not null
      and (item.value->>'expiry_date')::date < p_as_of
    group by jsonb_build_array(
      item.value->>'tenant_name',
      item.value->>'floor_label',
      item.value->>'zone_label',
      item.value->>'commencement_date',
      item.value->>'expiry_date'
    )
  loop
    v_old_count := v_old_row.old_count;
    select count(*) into v_new_count
    from jsonb_array_elements(p_new_rows) item(value)
    where jsonb_build_array(
      item.value->>'tenant_name',
      item.value->>'floor_label',
      item.value->>'zone_label',
      item.value->>'commencement_date',
      item.value->>'expiry_date'
    ) = v_old_row.row_identity;

    if v_new_count < v_old_count then
      raise exception using
        errcode = 'PT422',
        message = 'EXPIRED_RENT_ROWS_MUST_BE_PRESERVED',
        detail = 'Refresh the complete rent-roll document and retain every expired row.';
    end if;
  end loop;
end;
$body$;

revoke all on function logistics_core.assert_expired_rent_rows_preserved(jsonb, jsonb, date)
from public, anon, authenticated;

create or replace function logistics_core.home_read_entry(
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
  v_asset_code text;
  v_asset jsonb;
  v_fund jsonb;
  v_investments jsonb;
  v_loans jsonb;
  v_assets jsonb;
  v_version text;
  v_rent_rows jsonb := '[]'::jsonb;
  v_occupied_area numeric := 0;
  v_current_rent_area numeric := 0;
  v_stored_rent_area numeric := 0;
  v_denominator numeric;
  v_denominator_source text;
  v_data_basis text;
  v_leasable_area_sqm numeric;
  v_gross_area_sqm numeric;
  v_tenant_count bigint := 0;
  v_occupied_space_count bigint := 0;
  v_vacant_space_count bigint := 0;
  v_expired_row_count bigint := 0;
  v_data_mismatch boolean := false;
  v_data_mismatch_reason text;
  v_occupancy jsonb;
begin
  if nullif(btrim(p_asset_key), '') is null then
    select coalesce(jsonb_agg(jsonb_build_object(
      'asset_key', asset.asset_code,
      'asset_code', asset.asset_code,
      'name', asset.name,
      'address', asset.address,
      'revision', asset.xmin::text
    ) order by asset.name, asset.asset_code), '[]'::jsonb),
    coalesce(max((asset.xmin::text)::bigint)::text, '0')
    into v_assets, v_version
    from logistics_core.assets asset
    where logistics_core.has_asset_permission(v_actor, asset.asset_code, 'read');
    return logistics_core.primary_response(
      p_request_id, v_version, jsonb_build_object('assets', v_assets)
    );
  end if;

  v_asset_code := logistics_core.resolve_asset_code(p_asset_key);
  perform logistics_core.assert_asset_permission(v_actor, v_asset_code, 'read');

  select to_jsonb(asset) || jsonb_build_object('revision', asset.xmin::text),
         asset.xmin::text,
         asset.leasable_area_sqm,
         asset.gross_area_sqm
  into strict v_asset, v_version, v_leasable_area_sqm, v_gross_area_sqm
  from logistics_core.assets asset
  where asset.asset_code = v_asset_code;

  select to_jsonb(fund) || jsonb_build_object('revision', fund.xmin::text),
         fund.investments,
         fund.loans
  into strict v_fund, v_investments, v_loans
  from logistics_core.funds fund
  where fund.fund_code = v_asset->>'fund_code';

  select document.rows into v_rent_rows
  from logistics_core.rent_roll document
  where document.asset_code = v_asset_code;

  select
    coalesce(sum(nullif(row_item.value->>'leased_area_sqm', '')::numeric)
      filter (where row_item.value->>'occupancy_status' = 'occupied'
        and row_item.is_current), 0),
    coalesce(sum(nullif(row_item.value->>'leased_area_sqm', '')::numeric)
      filter (where row_item.is_current), 0),
    coalesce(sum(nullif(row_item.value->>'leased_area_sqm', '')::numeric), 0),
    count(distinct nullif(row_item.value->>'tenant_name', ''))
      filter (where row_item.value->>'occupancy_status' = 'occupied'
        and row_item.is_current),
    count(*) filter (where row_item.value->>'occupancy_status' = 'occupied'
      and row_item.is_current),
    count(*) filter (where row_item.value->>'occupancy_status' = 'vacant'
      and row_item.is_current),
    count(*) filter (where row_item.is_expired)
  into
    v_occupied_area,
    v_current_rent_area,
    v_stored_rent_area,
    v_tenant_count,
    v_occupied_space_count,
    v_vacant_space_count,
    v_expired_row_count
  from (
    select
      source.value,
      (
        (
          nullif(source.value->>'commencement_date', '') is null
          or (source.value->>'commencement_date')::date <= current_date
        )
        and (
          nullif(source.value->>'expiry_date', '') is null
          or (source.value->>'expiry_date')::date >= current_date
        )
      ) as is_current,
      (
        nullif(source.value->>'expiry_date', '') is not null
        and (source.value->>'expiry_date')::date < current_date
      ) as is_expired
    from jsonb_array_elements(coalesce(v_rent_rows, '[]'::jsonb)) source(value)
  ) row_item;

  if v_leasable_area_sqm > 0 then
    v_denominator := v_leasable_area_sqm;
    v_denominator_source := 'leasable_area_sqm';
    v_data_basis := 'asset_leasable_area_sqm';
  elsif v_leasable_area_sqm is null and v_gross_area_sqm > 0 then
    v_denominator := v_gross_area_sqm;
    v_denominator_source := 'gross_area_sqm';
    v_data_basis := 'asset_gross_area_sqm_fallback';
  elsif v_leasable_area_sqm is not null then
    v_denominator := v_leasable_area_sqm;
    v_denominator_source := 'leasable_area_sqm';
    v_data_basis := 'invalid_asset_leasable_area_sqm';
    v_data_mismatch := true;
    v_data_mismatch_reason := 'invalid_leasable_area';
  else
    v_denominator := v_gross_area_sqm;
    v_denominator_source := 'gross_area_sqm';
    v_data_basis := 'invalid_asset_gross_area_sqm';
    v_data_mismatch := true;
    v_data_mismatch_reason := 'invalid_denominator';
  end if;

  if not v_data_mismatch
     and (v_current_rent_area > v_denominator or v_occupied_area > v_denominator) then
    v_data_mismatch := true;
    v_data_mismatch_reason := 'rent_roll_exceeds_denominator';
  end if;

  v_occupancy := jsonb_build_object(
    'as_of_date', current_date,
    'tenant_count', v_tenant_count,
    'active_tenant_count', v_tenant_count,
    'occupied_space_count', v_occupied_space_count,
    'vacant_space_count', v_vacant_space_count,
    'occupied_area_sqm', v_occupied_area,
    'rent_roll_total_area_sqm', v_current_rent_area,
    'current_rent_roll_area_sqm', v_current_rent_area,
    'stored_rent_roll_area_sqm', v_stored_rent_area,
    'expired_row_count', v_expired_row_count,
    'denominator_area_sqm', v_denominator,
    'denominator_source', v_denominator_source,
    'data_basis', v_data_basis,
    'data_mismatch', v_data_mismatch,
    'data_mismatch_reason', v_data_mismatch_reason,
    'vacant_area_sqm', case
      when v_data_mismatch or v_denominator is null or v_denominator <= 0 then null
      else greatest(v_denominator - v_occupied_area, 0)
    end,
    'occupancy_rate', case
      when v_data_mismatch or v_denominator is null or v_denominator <= 0 then null
      else round(v_occupied_area / v_denominator * 100, 2)
    end
  );

  return logistics_core.primary_response(
    p_request_id,
    v_version,
    jsonb_build_object(
      'asset', v_asset,
      'funds', jsonb_build_array(v_fund - 'investments' - 'loans'),
      'investments', v_investments,
      'loans', v_loans,
      'occupancy_summary', v_occupancy,
      'tenant_summary', v_occupancy,
      'write_enabled', logistics_core.has_asset_permission(v_actor, v_asset_code, 'update')
    )
  );
end;
$body$;

create or replace function logistics_core.rent_roll_read_entry(
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
  v_rows jsonb;
  v_version text;
  v_expired_row_count bigint;
begin
  perform logistics_core.assert_asset_permission(v_actor, v_asset_code, 'read');
  select
    logistics_core.project_rent_rows(document.rows),
    document.xmin::text,
    (
      select count(*)
      from jsonb_array_elements(document.rows) item(value)
      where nullif(item.value->>'expiry_date', '') is not null
        and (item.value->>'expiry_date')::date < current_date
    )
  into strict v_rows, v_version, v_expired_row_count
  from logistics_core.rent_roll document
  where document.asset_code = v_asset_code;

  return logistics_core.primary_response(
    p_request_id,
    v_version,
    jsonb_build_object(
      'rows', v_rows,
      'includes_expired_rows', true,
      'expired_row_count', v_expired_row_count,
      'write_enabled', logistics_core.has_asset_permission(v_actor, v_asset_code, 'update')
    )
  );
end;
$body$;

create or replace function logistics_core.rent_roll_batch_save_entry(
  p_request_id uuid,
  p_asset_key text,
  p_payload jsonb,
  p_expected_revisions jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, logistics_core
as $body$
declare
  v_actor uuid := logistics_core.request_actor();
  v_asset_code text := logistics_core.resolve_asset_code(p_asset_key);
  v_actual text;
  v_expected text;
  v_old_rows jsonb;
  v_rows jsonb;
  v_version text;
  v_readback jsonb;
begin
  perform logistics_core.assert_rent_rows_valid(p_payload->'rows');
  select document.xmin::text, document.rows
  into strict v_actual, v_old_rows
  from logistics_core.rent_roll document
  where document.asset_code = v_asset_code
  for update;

  v_expected := logistics_core.expected_xmin(
    p_payload, p_expected_revisions, 'rent_roll'
  );
  perform logistics_core.assert_expected_xmin(v_actual, v_expected);

  v_rows := logistics_core.sanitize_rent_rows(p_payload->'rows');
  perform logistics_core.assert_expired_rent_rows_preserved(
    v_old_rows, v_rows, current_date
  );
  perform logistics_core.assert_document_array_permissions(
    v_actor, v_asset_code, v_old_rows, v_rows
  );

  update logistics_core.rent_roll document
  set rows = v_rows
  where document.asset_code = v_asset_code;

  select document.rows, document.xmin::text
  into strict v_rows, v_version
  from logistics_core.rent_roll document
  where document.asset_code = v_asset_code;

  if v_rows is distinct from logistics_core.sanitize_rent_rows(p_payload->'rows') then
    raise exception using errcode = 'PT500', message = 'RENT_ROLL_READBACK_MISMATCH';
  end if;

  v_readback := logistics_core.rent_roll_read_entry(
    p_request_id, v_asset_code, '{}'::jsonb, '{}'::jsonb
  );
  return logistics_core.primary_response(
    p_request_id,
    v_version,
    coalesce(v_readback->'data', '{}'::jsonb) || jsonb_build_object(
      'changed_count', jsonb_array_length(v_rows),
      'rows_readback', 'verified',
      'xmins', jsonb_build_object('rent_roll', v_version)
    )
  );
end;
$body$;

do $validate_contract$
begin
  if to_regprocedure('logistics_core.assert_expired_rent_rows_preserved(jsonb,jsonb,date)') is null then
    raise exception using errcode = 'PT500', message = 'EXPIRED_RENT_GUARD_FUNCTION_MISSING';
  end if;
  if (
    select count(*)
    from pg_catalog.pg_class class
    join pg_catalog.pg_namespace namespace on namespace.oid = class.relnamespace
    where namespace.nspname = 'logistics_core'
      and class.relkind in ('r', 'p')
  ) <> 4 then
    raise exception using errcode = 'PT500', message = 'OCCUPANCY_RENT_GUARD_TABLE_COUNT_MISMATCH';
  end if;
end;
$validate_contract$;

notify pgrst, 'reload schema';

commit;
