-- LOGISTICS_OCCUPANCY_RENT_ROLL_BASIS_V2
--
-- SDD contract
-- * Numerator: leased_area_sqm of currently effective occupied rent-roll rows.
-- * Denominator: leased_area_sqm of every currently effective rent-roll row,
--   regardless of occupied, vacant, planned, or another visible status.
-- * Descriptive asset-registry areas never replace or cap the denominator.
-- * Rows without a positive leased area are excluded from both sums.  Their
--   presence is exposed as data quality, but does not hide a valid rate.
-- * A missing, non-positive, or internally inconsistent current rent-roll
--   denominator is explicit.  Rate and vacancy remain null.
-- * Existing occupancy_summary keys remain stable; explainability counts are
--   additive and do not create a table or stored column.

begin;

set local lock_timeout = '10s';
set local statement_timeout = '120s';

select pg_advisory_xact_lock(
  hashtextextended('LOGISTICS_OCCUPANCY_RENT_ROLL_BASIS_V2', 0)
);

do $preflight$
begin
  if to_regclass('logistics_core.assets') is null
     or to_regclass('logistics_core.funds') is null
     or to_regclass('logistics_core.rent_roll') is null
     or to_regprocedure('logistics_core.home_read_entry(uuid,text,jsonb,jsonb)') is null
     or to_regprocedure('logistics_core.request_actor()') is null
     or to_regprocedure('logistics_core.has_asset_permission(uuid,text,text)') is null then
    raise exception using
      errcode = 'PT500',
      message = 'OCCUPANCY_RENT_ROLL_BASIS_PREREQUISITE_MISSING';
  end if;
end;
$preflight$;

create or replace function logistics_core.occupancy_summary_from_rent_rows(
  p_rows jsonb,
  p_as_of date
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = pg_catalog
as $body$
declare
  v_rows jsonb := coalesce(p_rows, '[]'::jsonb);
  v_occupied_area numeric := 0;
  v_current_rent_area numeric := 0;
  v_stored_rent_area numeric := 0;
  v_denominator numeric;
  v_current_row_count bigint := 0;
  v_current_positive_area_row_count bigint := 0;
  v_tenant_count bigint := 0;
  v_occupied_space_count bigint := 0;
  v_vacant_space_count bigint := 0;
  v_expired_row_count bigint := 0;
  v_data_mismatch boolean := false;
  v_data_mismatch_reason text;
begin
  if jsonb_typeof(v_rows) <> 'array' then
    raise exception using errcode = 'PT422', message = 'RENT_ROLL_ROWS_ARRAY_REQUIRED';
  end if;
  if p_as_of is null then
    raise exception using errcode = 'PT422', message = 'OCCUPANCY_AS_OF_DATE_REQUIRED';
  end if;

  select
    coalesce(sum(row_item.leased_area_sqm)
      filter (
        where row_item.occupancy_status = 'occupied'
          and row_item.is_current
          and row_item.leased_area_sqm > 0
      ), 0),
    coalesce(sum(row_item.leased_area_sqm)
      filter (
        where row_item.is_current
          and row_item.leased_area_sqm > 0
      ), 0),
    coalesce(sum(row_item.leased_area_sqm)
      filter (where row_item.leased_area_sqm > 0), 0),
    count(*) filter (where row_item.is_current),
    count(*) filter (
      where row_item.is_current
        and row_item.leased_area_sqm > 0
    ),
    count(distinct nullif(row_item.tenant_name, ''))
      filter (
        where row_item.occupancy_status = 'occupied'
          and row_item.is_current
      ),
    count(*) filter (
      where row_item.occupancy_status = 'occupied'
        and row_item.is_current
    ),
    count(*) filter (
      where row_item.occupancy_status = 'vacant'
        and row_item.is_current
    ),
    count(*) filter (where row_item.is_expired)
  into
    v_occupied_area,
    v_current_rent_area,
    v_stored_rent_area,
    v_current_row_count,
    v_current_positive_area_row_count,
    v_tenant_count,
    v_occupied_space_count,
    v_vacant_space_count,
    v_expired_row_count
  from (
    select
      source.value->>'tenant_name' as tenant_name,
      source.value->>'occupancy_status' as occupancy_status,
      case
        when jsonb_typeof(source.value->'leased_area_sqm') = 'number'
          then (source.value->>'leased_area_sqm')::numeric
        else null
      end as leased_area_sqm,
      (
        (
          nullif(source.value->>'commencement_date', '') is null
          or (source.value->>'commencement_date')::date <= p_as_of
        )
        and (
          nullif(source.value->>'expiry_date', '') is null
          or (source.value->>'expiry_date')::date >= p_as_of
        )
      ) as is_current,
      (
        nullif(source.value->>'expiry_date', '') is not null
        and (source.value->>'expiry_date')::date < p_as_of
      ) as is_expired
    from jsonb_array_elements(v_rows) source(value)
  ) row_item;

  v_denominator := nullif(v_current_rent_area, 0);

  if v_current_row_count = 0 then
    v_denominator := null;
    v_data_mismatch := true;
    v_data_mismatch_reason := 'no_current_rent_roll_rows';
  elsif v_current_rent_area <= 0 then
    v_denominator := null;
    v_data_mismatch := true;
    v_data_mismatch_reason := 'no_positive_current_rent_roll_area';
  elsif v_occupied_area > v_current_rent_area then
    v_data_mismatch := true;
    v_data_mismatch_reason := 'occupied_area_exceeds_current_rent_roll_area';
  end if;

  return jsonb_build_object(
    'as_of_date', p_as_of,
    'tenant_count', v_tenant_count,
    'active_tenant_count', v_tenant_count,
    'occupied_space_count', v_occupied_space_count,
    'vacant_space_count', v_vacant_space_count,
    'occupied_area_sqm', v_occupied_area,
    'rent_roll_total_area_sqm', v_current_rent_area,
    'current_rent_roll_area_sqm', v_current_rent_area,
    'stored_rent_roll_area_sqm', v_stored_rent_area,
    'current_row_count', v_current_row_count,
    'current_positive_area_row_count', v_current_positive_area_row_count,
    'area_data_incomplete', v_current_positive_area_row_count < v_current_row_count,
    'area_data_quality_reason', case
      when v_current_positive_area_row_count < v_current_row_count
        then 'current_rows_without_positive_leased_area'
      else null
    end,
    'expired_row_count', v_expired_row_count,
    'denominator_area_sqm', v_denominator,
    'denominator_source', 'current_rent_roll_area_sqm',
    'data_basis', 'current_rent_roll_total_area_sqm',
    'data_mismatch', v_data_mismatch,
    'data_mismatch_reason', v_data_mismatch_reason,
    'vacant_area_sqm', case
      when v_data_mismatch or v_denominator is null then null
      else greatest(v_denominator - v_occupied_area, 0)
    end,
    'occupancy_rate', case
      when v_data_mismatch or v_denominator is null then null
      else round(v_occupied_area / v_denominator * 100, 2)
    end
  );
end;
$body$;

revoke all on function logistics_core.occupancy_summary_from_rent_rows(jsonb, date)
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
  v_occupancy jsonb;
begin
  if nullif(btrim(p_asset_key), '') is null then
    select
      coalesce(jsonb_agg(jsonb_build_object(
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
      p_request_id,
      v_version,
      jsonb_build_object('assets', v_assets)
    );
  end if;

  v_asset_code := logistics_core.resolve_asset_code(p_asset_key);
  perform logistics_core.assert_asset_permission(v_actor, v_asset_code, 'read');

  select
    to_jsonb(asset) || jsonb_build_object('revision', asset.xmin::text),
    asset.xmin::text
  into strict v_asset, v_version
  from logistics_core.assets asset
  where asset.asset_code = v_asset_code;

  select
    to_jsonb(fund) || jsonb_build_object('revision', fund.xmin::text),
    fund.investments,
    fund.loans
  into strict v_fund, v_investments, v_loans
  from logistics_core.funds fund
  where fund.fund_code = v_asset->>'fund_code';

  select document.rows
  into v_rent_rows
  from logistics_core.rent_roll document
  where document.asset_code = v_asset_code;

  v_occupancy := logistics_core.occupancy_summary_from_rent_rows(
    v_rent_rows,
    (statement_timestamp() at time zone 'Asia/Seoul')::date
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
      'write_enabled', logistics_core.has_asset_permission(
        v_actor,
        v_asset_code,
        'update'
      )
    )
  );
end;
$body$;

revoke all on function logistics_core.home_read_entry(uuid, text, jsonb, jsonb)
from public, anon;
grant execute on function logistics_core.home_read_entry(uuid, text, jsonb, jsonb)
to authenticated;

do $validate_contract$
declare
  v_summary jsonb;
begin
  v_summary := logistics_core.occupancy_summary_from_rent_rows(
    jsonb_build_array(
      jsonb_build_object(
        'tenant_name', 'occupied-current',
        'occupancy_status', 'occupied',
        'leased_area_sqm', 60,
        'commencement_date', '2026-01-01',
        'expiry_date', '2026-12-31'
      ),
      jsonb_build_object(
        'tenant_name', 'vacant-current',
        'occupancy_status', 'vacant',
        'leased_area_sqm', 40,
        'commencement_date', '2026-01-01',
        'expiry_date', '2026-12-31'
      ),
      jsonb_build_object(
        'tenant_name', 'current-without-area',
        'occupancy_status', 'planned',
        'leased_area_sqm', null,
        'commencement_date', '2026-01-01',
        'expiry_date', '2026-12-31'
      ),
      jsonb_build_object(
        'tenant_name', 'expired',
        'occupancy_status', 'occupied',
        'leased_area_sqm', 900,
        'commencement_date', '2025-01-01',
        'expiry_date', '2025-12-31'
      )
    ),
    date '2026-08-10'
  );

  if (v_summary->>'occupied_area_sqm')::numeric is distinct from 60::numeric
     or (v_summary->>'denominator_area_sqm')::numeric is distinct from 100::numeric
     or (v_summary->>'current_rent_roll_area_sqm')::numeric is distinct from 100::numeric
     or (v_summary->>'stored_rent_roll_area_sqm')::numeric is distinct from 1000::numeric
     or (v_summary->>'occupancy_rate')::numeric is distinct from 60::numeric
     or not (v_summary->>'area_data_incomplete')::boolean
     or v_summary->>'area_data_quality_reason'
       is distinct from 'current_rows_without_positive_leased_area'
     or (v_summary->>'data_mismatch')::boolean then
    raise exception using
      errcode = 'PT500',
      message = 'OCCUPANCY_RENT_ROLL_BASIS_FIXTURE_MISMATCH';
  end if;

  v_summary := logistics_core.occupancy_summary_from_rent_rows(
    '[]'::jsonb,
    date '2026-08-10'
  );
  if v_summary->>'occupancy_rate' is not null
     or v_summary->>'data_mismatch_reason' is distinct from 'no_current_rent_roll_rows'
     or not (v_summary->>'data_mismatch')::boolean then
    raise exception using
      errcode = 'PT500',
      message = 'OCCUPANCY_EMPTY_RENT_ROLL_FIXTURE_MISMATCH';
  end if;

  if (
    select count(*)
    from pg_catalog.pg_class class
    join pg_catalog.pg_namespace namespace
      on namespace.oid = class.relnamespace
    where namespace.nspname = 'logistics_core'
      and class.relkind in ('r', 'p')
  ) <> 4 then
    raise exception using
      errcode = 'PT500',
      message = 'OCCUPANCY_RENT_ROLL_BASIS_TABLE_COUNT_MISMATCH';
  end if;
end;
$validate_contract$;

notify pgrst, 'reload schema';

commit;
