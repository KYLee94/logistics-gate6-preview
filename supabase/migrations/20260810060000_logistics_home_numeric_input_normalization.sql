-- LOGISTICS_HOME_NUMERIC_INPUT_NORMALIZATION_V1
--
-- SDD contract
-- * Browser number inputs arrive as strings.  Valid numeric strings and JSON
--   numbers are stored as JSON numbers; null/blank optional inputs are removed.
-- * Invalid numeric strings, non-integer parking values and invalid ISO dates
--   remain PT422 business-rule violations.
-- * A full home document may carry unchanged blank investment/loan cells while
--   an asset field is edited; those blanks must not mutate or invalidate rows.
-- * This migration changes functions only.  The four-table schema is unchanged.

begin;

set local lock_timeout = '10s';
set local statement_timeout = '120s';

select pg_advisory_xact_lock(hashtextextended('LOGISTICS_HOME_NUMERIC_INPUT_NORMALIZATION_V1', 0));

do $preflight$
begin
  if to_regclass('logistics_core.assets') is null
     or to_regclass('logistics_core.funds') is null
     or to_regprocedure('logistics_core.home_batch_save_entry(uuid,text,jsonb,jsonb)') is null
     or to_regprocedure('logistics_core.is_valid_iso_date(text)') is null then
    raise exception using errcode = 'PT500', message = 'HOME_NORMALIZATION_PREREQUISITE_MISSING';
  end if;
end;
$preflight$;

create or replace function logistics_core.normalize_home_optional_number(p_value jsonb)
returns jsonb
language plpgsql
immutable
set search_path = pg_catalog
as $body$
declare
  v_text text;
  v_numeric numeric;
begin
  if p_value is null or jsonb_typeof(p_value) = 'null' then
    return 'null'::jsonb;
  end if;

  if jsonb_typeof(p_value) = 'number' then
    v_text := p_value #>> '{}';
  elsif jsonb_typeof(p_value) = 'string' then
    v_text := btrim(p_value #>> '{}');
    if btrim(p_value #>> '{}') = '' then return 'null'::jsonb; end if;
    if v_text !~ '^[-+]?(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)(?:[eE][-+]?[0-9]+)?$' then
      raise exception using errcode = 'PT422', message = 'HOME_NUMBER_INVALID';
    end if;
  else
    raise exception using errcode = 'PT422', message = 'HOME_NUMBER_INVALID';
  end if;

  begin
    v_numeric := v_text::numeric;
  exception when others then
    raise exception using errcode = 'PT422', message = 'HOME_NUMBER_INVALID';
  end;
  if v_numeric in ('NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric) then
    raise exception using errcode = 'PT422', message = 'HOME_NUMBER_INVALID';
  end if;
  return to_jsonb(v_numeric);
end;
$body$;

create or replace function logistics_core.normalize_home_optional_integer(p_value jsonb)
returns jsonb
language plpgsql
immutable
set search_path = pg_catalog, logistics_core
as $body$
declare
  v_normalized jsonb;
  v_numeric numeric;
begin
  v_normalized := logistics_core.normalize_home_optional_number(p_value);
  if jsonb_typeof(v_normalized) = 'null' then return v_normalized; end if;
  v_numeric := (v_normalized #>> '{}')::numeric;
  if trunc(v_numeric) <> v_numeric
     or v_numeric < -2147483648
     or v_numeric > 2147483647 then
    raise exception using errcode = 'PT422', message = 'HOME_INTEGER_INVALID';
  end if;
  return to_jsonb(v_numeric);
end;
$body$;

create or replace function logistics_core.normalize_home_optional_date(p_value jsonb)
returns jsonb
language plpgsql
immutable
set search_path = pg_catalog, logistics_core
as $body$
declare
  v_text text;
begin
  if p_value is null or jsonb_typeof(p_value) = 'null' then
    return 'null'::jsonb;
  end if;
  if jsonb_typeof(p_value) <> 'string' then
    raise exception using errcode = 'PT422', message = 'HOME_DATE_INVALID';
  end if;
  v_text := btrim(p_value #>> '{}');
  if v_text = '' then return 'null'::jsonb; end if;
  if not logistics_core.is_valid_iso_date(v_text) then
    raise exception using errcode = 'PT422', message = 'HOME_DATE_INVALID';
  end if;
  return to_jsonb(v_text);
end;
$body$;

revoke all on function logistics_core.normalize_home_optional_number(jsonb)
from public, anon, authenticated;
revoke all on function logistics_core.normalize_home_optional_integer(jsonb)
from public, anon, authenticated;
revoke all on function logistics_core.normalize_home_optional_date(jsonb)
from public, anon, authenticated;

create or replace function logistics_core.assert_home_asset_document_valid(p_document jsonb)
returns void
language plpgsql
immutable
set search_path = pg_catalog, logistics_core
as $body$
declare
  v_field text;
begin
  if jsonb_typeof(p_document) <> 'object' then
    raise exception using errcode = 'PT422', message = 'HOME_ASSET_DOCUMENT_INVALID';
  end if;
  foreach v_field in array array[
    'name', 'address', 'zoning_text', 'primary_use', 'floor_count', 'structure_text'
  ] loop
    if p_document ? v_field and jsonb_typeof(p_document->v_field) not in ('string', 'null') then
      raise exception using errcode = 'PT422', message = 'HOME_ASSET_TEXT_INVALID';
    end if;
  end loop;
  foreach v_field in array array[
    'land_area_sqm', 'building_area_sqm', 'gross_area_sqm', 'leasable_area_sqm',
    'building_coverage_ratio', 'floor_area_ratio'
  ] loop
    if p_document ? v_field then
      begin
        perform logistics_core.normalize_home_optional_number(p_document->v_field);
      exception when sqlstate 'PT422' then
        raise exception using errcode = 'PT422', message = 'HOME_ASSET_NUMBER_INVALID';
      end;
    end if;
  end loop;
  if p_document ? 'parking_count' then
    begin
      perform logistics_core.normalize_home_optional_integer(p_document->'parking_count');
    exception when sqlstate 'PT422' then
      raise exception using errcode = 'PT422', message = 'HOME_ASSET_INTEGER_INVALID';
    end;
  end if;
  if p_document ? 'completion_date' then
    begin
      perform logistics_core.normalize_home_optional_date(p_document->'completion_date');
    exception when sqlstate 'PT422' then
      raise exception using errcode = 'PT422', message = 'HOME_ASSET_DATE_INVALID';
    end;
  end if;
end;
$body$;

create or replace function logistics_core.assert_home_fund_document_valid(p_document jsonb)
returns void
language plpgsql
immutable
set search_path = pg_catalog, logistics_core
as $body$
declare
  v_field text;
begin
  if jsonb_typeof(p_document) <> 'object' then
    raise exception using errcode = 'PT422', message = 'HOME_FUND_DOCUMENT_INVALID';
  end if;
  foreach v_field in array array['name', 'fund_type', 'investment_strategy'] loop
    if p_document ? v_field and jsonb_typeof(p_document->v_field) not in ('string', 'null') then
      raise exception using errcode = 'PT422', message = 'HOME_FUND_TEXT_INVALID';
    end if;
  end loop;
  if p_document ? 'ownership_ratio' then
    begin
      perform logistics_core.normalize_home_optional_number(p_document->'ownership_ratio');
    exception when sqlstate 'PT422' then
      raise exception using errcode = 'PT422', message = 'HOME_FUND_NUMBER_INVALID';
    end;
  end if;
  foreach v_field in array array['inception_date', 'maturity_date'] loop
    if p_document ? v_field then
      begin
        perform logistics_core.normalize_home_optional_date(p_document->v_field);
      exception when sqlstate 'PT422' then
        raise exception using errcode = 'PT422', message = 'HOME_FUND_DATE_INVALID';
      end;
    end if;
  end loop;
end;
$body$;

revoke all on function logistics_core.assert_home_asset_document_valid(jsonb)
from public, anon, authenticated;
revoke all on function logistics_core.assert_home_fund_document_valid(jsonb)
from public, anon, authenticated;

create or replace function logistics_core.assert_investments_valid(p_rows jsonb)
returns void
language plpgsql
immutable
set search_path = pg_catalog, logistics_core
as $body$
declare
  v_row jsonb;
  v_field text;
  v_normalized jsonb;
begin
  if jsonb_typeof(p_rows) <> 'array' then
    raise exception using errcode = 'PT422', message = 'INVESTMENTS_ARRAY_REQUIRED';
  end if;
  for v_row in select value from jsonb_array_elements(p_rows) loop
    if jsonb_typeof(v_row) <> 'object' then
      raise exception using errcode = 'PT422', message = 'INVESTMENT_ROW_OBJECT_REQUIRED';
    end if;
    foreach v_field in array array['tranche', 'beneficiary_name'] loop
      if v_row ? v_field and jsonb_typeof(v_row->v_field) not in ('string', 'null') then
        raise exception using errcode = 'PT422', message = 'INVESTMENT_TEXT_INVALID';
      end if;
    end loop;
    foreach v_field in array array['agreed_amount_krw', 'contributed_amount_krw'] loop
      if v_row ? v_field then
        begin
          v_normalized := logistics_core.normalize_home_optional_number(v_row->v_field);
        exception when sqlstate 'PT422' then
          raise exception using errcode = 'PT422', message = 'INVESTMENT_AMOUNT_INVALID';
        end;
        if jsonb_typeof(v_normalized) <> 'null'
           and (v_normalized #>> '{}')::numeric < 0 then
          raise exception using errcode = 'PT422', message = 'INVESTMENT_AMOUNT_INVALID';
        end if;
      end if;
    end loop;
  end loop;
end;
$body$;

create or replace function logistics_core.assert_loans_valid(p_rows jsonb)
returns void
language plpgsql
immutable
set search_path = pg_catalog, logistics_core
as $body$
declare
  v_row jsonb;
  v_field text;
  v_normalized jsonb;
  v_numeric numeric;
  v_drawdown_date text;
  v_maturity_date text;
begin
  if jsonb_typeof(p_rows) <> 'array' then
    raise exception using errcode = 'PT422', message = 'LOANS_ARRAY_REQUIRED';
  end if;
  for v_row in select value from jsonb_array_elements(p_rows) loop
    if jsonb_typeof(v_row) <> 'object' then
      raise exception using errcode = 'PT422', message = 'LOAN_ROW_OBJECT_REQUIRED';
    end if;
    foreach v_field in array array['tranche', 'lender_name', 'loan_type', 'interest_type'] loop
      if v_row ? v_field and jsonb_typeof(v_row->v_field) not in ('string', 'null') then
        raise exception using errcode = 'PT422', message = 'LOAN_TEXT_INVALID';
      end if;
    end loop;
    foreach v_field in array array['committed_amount_krw', 'coupon_rate', 'all_in_rate', 'fee_rate'] loop
      if v_row ? v_field then
        begin
          v_normalized := logistics_core.normalize_home_optional_number(v_row->v_field);
        exception when sqlstate 'PT422' then
          raise exception using errcode = 'PT422', message = 'LOAN_NUMBER_INVALID';
        end;
        if jsonb_typeof(v_normalized) <> 'null' then
          v_numeric := (v_normalized #>> '{}')::numeric;
          if v_numeric < 0
             or (v_field <> 'committed_amount_krw' and v_numeric > 100) then
            raise exception using errcode = 'PT422', message = 'LOAN_NUMBER_OUT_OF_RANGE';
          end if;
        end if;
      end if;
    end loop;
    foreach v_field in array array['drawdown_date', 'maturity_date'] loop
      if v_row ? v_field then
        begin
          perform logistics_core.normalize_home_optional_date(v_row->v_field);
        exception when sqlstate 'PT422' then
          raise exception using errcode = 'PT422', message = 'LOAN_DATE_INVALID';
        end;
      end if;
    end loop;
    v_drawdown_date := logistics_core.normalize_home_optional_date(v_row->'drawdown_date') #>> '{}';
    v_maturity_date := logistics_core.normalize_home_optional_date(v_row->'maturity_date') #>> '{}';
    if v_drawdown_date is not null and v_maturity_date is not null
       and v_maturity_date::date < v_drawdown_date::date then
      raise exception using errcode = 'PT422', message = 'LOAN_DATE_RANGE_INVALID';
    end if;
  end loop;
end;
$body$;

create or replace function logistics_core.sanitize_investments(p_rows jsonb)
returns jsonb
language sql
immutable
set search_path = pg_catalog, logistics_core
as $function$
  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
    'tranche', item.value->'tranche',
    'beneficiary_name', item.value->'beneficiary_name',
    'agreed_amount_krw', logistics_core.normalize_home_optional_number(item.value->'agreed_amount_krw'),
    'contributed_amount_krw', logistics_core.normalize_home_optional_number(item.value->'contributed_amount_krw')
  )) order by item.ordinality), '[]'::jsonb)
  from jsonb_array_elements(case when jsonb_typeof(p_rows) = 'array' then p_rows else '[]'::jsonb end)
    with ordinality item(value, ordinality);
$function$;

create or replace function logistics_core.sanitize_loans(p_rows jsonb)
returns jsonb
language sql
immutable
set search_path = pg_catalog, logistics_core
as $function$
  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
    'tranche', item.value->'tranche',
    'lender_name', item.value->'lender_name',
    'committed_amount_krw', logistics_core.normalize_home_optional_number(item.value->'committed_amount_krw'),
    'drawdown_date', logistics_core.normalize_home_optional_date(item.value->'drawdown_date'),
    'maturity_date', logistics_core.normalize_home_optional_date(item.value->'maturity_date'),
    'loan_type', item.value->'loan_type',
    'interest_type', item.value->'interest_type',
    'coupon_rate', logistics_core.normalize_home_optional_number(item.value->'coupon_rate'),
    'all_in_rate', logistics_core.normalize_home_optional_number(item.value->'all_in_rate'),
    'fee_rate', logistics_core.normalize_home_optional_number(item.value->'fee_rate')
  )) order by item.ordinality), '[]'::jsonb)
  from jsonb_array_elements(case when jsonb_typeof(p_rows) = 'array' then p_rows else '[]'::jsonb end)
    with ordinality item(value, ordinality);
$function$;

create or replace function logistics_core.home_batch_save_entry(
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
  v_asset_document jsonb := p_payload->'asset';
  v_fund_document jsonb;
  v_fund_code text;
  v_actual text;
  v_expected text;
  v_version text;
  v_fund_version text;
  v_old_investments jsonb;
  v_old_loans jsonb;
  v_new_investments jsonb;
  v_new_loans jsonb;
  v_readback jsonb;
  v_changed integer := 0;
begin
  perform logistics_core.assert_asset_permission(v_actor, v_asset_code, 'update');
  select asset.fund_code into strict v_fund_code
  from logistics_core.assets asset where asset.asset_code = v_asset_code;
  select item.value into v_fund_document
  from jsonb_array_elements(case when jsonb_typeof(p_payload->'funds') = 'array'
    then p_payload->'funds' else '[]'::jsonb end) item(value)
  where item.value->>'fund_code' = v_fund_code
  limit 1;

  if jsonb_typeof(v_asset_document) = 'object' then
    perform logistics_core.assert_home_asset_document_valid(v_asset_document);
    select asset.xmin::text into v_actual
    from logistics_core.assets asset where asset.asset_code = v_asset_code for update;
    v_expected := logistics_core.expected_xmin(p_payload, p_expected_revisions, 'asset');
    perform logistics_core.assert_expected_xmin(v_actual, v_expected);
    update logistics_core.assets asset set
      name = case when v_asset_document ? 'name' then nullif(v_asset_document->>'name', '') else asset.name end,
      address = case when v_asset_document ? 'address' then nullif(v_asset_document->>'address', '') else asset.address end,
      zoning_text = case when v_asset_document ? 'zoning_text' then nullif(v_asset_document->>'zoning_text', '') else asset.zoning_text end,
      land_area_sqm = case when v_asset_document ? 'land_area_sqm' then (logistics_core.normalize_home_optional_number(v_asset_document->'land_area_sqm') #>> '{}')::numeric else asset.land_area_sqm end,
      building_area_sqm = case when v_asset_document ? 'building_area_sqm' then (logistics_core.normalize_home_optional_number(v_asset_document->'building_area_sqm') #>> '{}')::numeric else asset.building_area_sqm end,
      gross_area_sqm = case when v_asset_document ? 'gross_area_sqm' then (logistics_core.normalize_home_optional_number(v_asset_document->'gross_area_sqm') #>> '{}')::numeric else asset.gross_area_sqm end,
      leasable_area_sqm = case when v_asset_document ? 'leasable_area_sqm' then (logistics_core.normalize_home_optional_number(v_asset_document->'leasable_area_sqm') #>> '{}')::numeric else asset.leasable_area_sqm end,
      primary_use = case when v_asset_document ? 'primary_use' then nullif(v_asset_document->>'primary_use', '') else asset.primary_use end,
      building_coverage_ratio = case when v_asset_document ? 'building_coverage_ratio' then (logistics_core.normalize_home_optional_number(v_asset_document->'building_coverage_ratio') #>> '{}')::numeric else asset.building_coverage_ratio end,
      floor_area_ratio = case when v_asset_document ? 'floor_area_ratio' then (logistics_core.normalize_home_optional_number(v_asset_document->'floor_area_ratio') #>> '{}')::numeric else asset.floor_area_ratio end,
      floor_count = case when v_asset_document ? 'floor_count' then nullif(v_asset_document->>'floor_count', '') else asset.floor_count end,
      structure_text = case when v_asset_document ? 'structure_text' then nullif(v_asset_document->>'structure_text', '') else asset.structure_text end,
      parking_count = case when v_asset_document ? 'parking_count' then (logistics_core.normalize_home_optional_integer(v_asset_document->'parking_count') #>> '{}')::integer else asset.parking_count end,
      completion_date = case when v_asset_document ? 'completion_date' then (logistics_core.normalize_home_optional_date(v_asset_document->'completion_date') #>> '{}')::date else asset.completion_date end
    where asset.asset_code = v_asset_code;
    v_changed := v_changed + 1;
  end if;

  if jsonb_typeof(v_fund_document) = 'object' then
    perform logistics_core.assert_home_fund_document_valid(v_fund_document);
    perform logistics_core.assert_fund_permission(v_actor, v_fund_code, 'update');
    select fund.xmin::text, fund.investments, fund.loans
    into v_actual, v_old_investments, v_old_loans
    from logistics_core.funds fund where fund.fund_code = v_fund_code for update;
    v_expected := logistics_core.expected_xmin(p_payload, p_expected_revisions, 'fund');
    perform logistics_core.assert_expected_xmin(v_actual, v_expected);
    if v_fund_document ? 'investments' then
      perform logistics_core.assert_investments_valid(v_fund_document->'investments');
      v_new_investments := logistics_core.sanitize_investments(v_fund_document->'investments');
      perform logistics_core.assert_fund_array_permissions(
        v_actor, v_fund_code, v_old_investments, v_new_investments
      );
    else
      v_new_investments := v_old_investments;
    end if;
    if v_fund_document ? 'loans' then
      perform logistics_core.assert_loans_valid(v_fund_document->'loans');
      v_new_loans := logistics_core.sanitize_loans(v_fund_document->'loans');
      perform logistics_core.assert_fund_array_permissions(
        v_actor, v_fund_code, v_old_loans, v_new_loans
      );
    else
      v_new_loans := v_old_loans;
    end if;
    update logistics_core.funds fund set
      name = case when v_fund_document ? 'name' then nullif(v_fund_document->>'name', '') else fund.name end,
      fund_type = case when v_fund_document ? 'fund_type' then nullif(v_fund_document->>'fund_type', '') else fund.fund_type end,
      investment_strategy = case when v_fund_document ? 'investment_strategy' then nullif(v_fund_document->>'investment_strategy', '') else fund.investment_strategy end,
      inception_date = case when v_fund_document ? 'inception_date' then (logistics_core.normalize_home_optional_date(v_fund_document->'inception_date') #>> '{}')::date else fund.inception_date end,
      maturity_date = case when v_fund_document ? 'maturity_date' then (logistics_core.normalize_home_optional_date(v_fund_document->'maturity_date') #>> '{}')::date else fund.maturity_date end,
      ownership_ratio = case when v_fund_document ? 'ownership_ratio' then (logistics_core.normalize_home_optional_number(v_fund_document->'ownership_ratio') #>> '{}')::numeric else fund.ownership_ratio end,
      investments = v_new_investments,
      loans = v_new_loans
    where fund.fund_code = v_fund_code;
    v_changed := v_changed + 1;
  end if;

  if v_changed = 0 then
    raise exception using errcode = 'PT422', message = 'HOME_DOCUMENT_REQUIRED';
  end if;
  select asset.xmin::text, fund.xmin::text
  into strict v_version, v_fund_version
  from logistics_core.assets asset
  join logistics_core.funds fund on fund.fund_code = asset.fund_code
  where asset.asset_code = v_asset_code;
  v_readback := logistics_core.home_read_entry(
    p_request_id, v_asset_code, '{}'::jsonb, '{}'::jsonb
  );
  return logistics_core.primary_response(
    p_request_id, v_version,
    coalesce(v_readback->'data', '{}'::jsonb) || jsonb_build_object(
      'changed_count', v_changed,
      'readback', 'verified',
      'xmins', jsonb_build_object('asset', v_version, 'fund', v_fund_version)
    )
  );
end;
$body$;

do $validate_contract$
begin
  if to_regprocedure('logistics_core.normalize_home_optional_number(jsonb)') is null
     or to_regprocedure('logistics_core.normalize_home_optional_integer(jsonb)') is null
     or to_regprocedure('logistics_core.normalize_home_optional_date(jsonb)') is null
     or to_regprocedure('logistics_core.assert_home_asset_document_valid(jsonb)') is null
     or to_regprocedure('logistics_core.assert_home_fund_document_valid(jsonb)') is null then
    raise exception using errcode = 'PT500', message = 'HOME_NORMALIZATION_FUNCTION_MISSING';
  end if;
  if (
    select count(*)
    from pg_catalog.pg_class class
    join pg_catalog.pg_namespace namespace on namespace.oid = class.relnamespace
    where namespace.nspname = 'logistics_core'
      and class.relkind in ('r', 'p')
  ) <> 4 then
    raise exception using errcode = 'PT500', message = 'HOME_NORMALIZATION_TABLE_COUNT_MISMATCH';
  end if;
end;
$validate_contract$;

notify pgrst, 'reload schema';

commit;
