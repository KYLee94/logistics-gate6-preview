-- LOGISTICS_RENT_ROLL_TAXONOMY_CONTRACT_V1
-- Confirmed source contract (★ 260414_물류센터 임대차계약 DB_취합본.xlsx):
-- `저온 창고 여부` stores Y(저온) / N(상온).  No inference is used here.
-- The separately reviewed Bundang Yatap blank stays unchanged in this stage.
-- logistics_core remains the existing four-table JSON document model.

begin;

create or replace function logistics_core.normalize_temperature_type(p_value jsonb)
returns jsonb
language plpgsql
immutable
set search_path = pg_catalog, logistics_core
as $body$
declare
  v_text text;
begin
  if p_value is null or jsonb_typeof(p_value) = 'null' then
    return null;
  end if;
  if jsonb_typeof(p_value) <> 'string' then
    raise exception using errcode = 'PT422', message = 'RENT_ROLL_TEMPERATURE_TYPE_INVALID';
  end if;

  v_text := btrim(p_value #>> '{}');
  if v_text = '' then
    return to_jsonb(''::text);
  elsif v_text = 'Y' then
    return to_jsonb('저온'::text);
  elsif v_text = 'N' then
    return to_jsonb('상온'::text);
  elsif v_text in ('상온', '저온', '복합', '사무실') then
    return to_jsonb(v_text);
  end if;

  raise exception using errcode = 'PT422', message = 'RENT_ROLL_TEMPERATURE_TYPE_INVALID';
end;
$body$;

create or replace function logistics_core.normalize_goods_type(p_value jsonb)
returns jsonb
language plpgsql
immutable
set search_path = pg_catalog, logistics_core
as $body$
declare
  v_result jsonb := '[]'::jsonb;
  v_seen text[] := array[]::text[];
  v_item jsonb;
  v_text text;
begin
  if p_value is null or jsonb_typeof(p_value) = 'null' then
    return v_result;
  end if;

  if jsonb_typeof(p_value) = 'string' then
    for v_text in
      select btrim(part.value)
      from regexp_split_to_table(p_value #>> '{}', '[,;\n\r]+')
        with ordinality part(value, ordinality)
      order by part.ordinality
    loop
      if v_text <> '' and not (v_text = any(v_seen)) then
        v_seen := array_append(v_seen, v_text);
        v_result := v_result || jsonb_build_array(v_text);
      end if;
    end loop;
    return v_result;
  end if;

  if jsonb_typeof(p_value) = 'array' then
    for v_item in
      select item.value
      from jsonb_array_elements(p_value) with ordinality item(value, ordinality)
      order by item.ordinality
    loop
      if jsonb_typeof(v_item) <> 'string' then
        raise exception using errcode = 'PT422', message = 'GOODS_TYPE_STRING_ARRAY_REQUIRED';
      end if;
      v_text := btrim(v_item #>> '{}');
      if v_text <> '' and not (v_text = any(v_seen)) then
        v_seen := array_append(v_seen, v_text);
        v_result := v_result || jsonb_build_array(v_text);
      end if;
    end loop;
    return v_result;
  end if;

  raise exception using errcode = 'PT422', message = 'GOODS_TYPE_STRING_ARRAY_REQUIRED';
end;
$body$;

create or replace function logistics_core.deposit_escalation_value_present(p_value jsonb)
returns boolean
language plpgsql
immutable
set search_path = pg_catalog
as $body$
declare
  v_text text;
  v_numeric_text text;
begin
  if p_value is null or jsonb_typeof(p_value) = 'null' then
    return false;
  elsif jsonb_typeof(p_value) = 'number' then
    return (p_value #>> '{}')::numeric <> 0;
  elsif jsonb_typeof(p_value) <> 'string' then
    raise exception using errcode = 'PT422', message = 'DEPOSIT_ESCALATION_DETAIL_INVALID';
  end if;

  v_text := btrim(p_value #>> '{}');
  if v_text = '' then
    return false;
  end if;
  v_numeric_text := regexp_replace(v_text, '[,%[:space:]]', '', 'g');
  if v_numeric_text ~ '^[+-]?(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)$' then
    return v_numeric_text::numeric <> 0;
  end if;
  return true;
end;
$body$;

create or replace function logistics_core.deposit_escalation_detail_present(p_row jsonb)
returns boolean
language sql
immutable
set search_path = pg_catalog, logistics_core
as $body$
  select logistics_core.deposit_escalation_value_present(
      p_row->'deposit_escalation_first_date'
    )
    or logistics_core.deposit_escalation_value_present(
      p_row->'deposit_escalation_interval_months'
    )
    or logistics_core.deposit_escalation_value_present(
      p_row->'deposit_escalation_rate'
    );
$body$;

create or replace function logistics_core.assert_rent_rows_document_valid(p_rows jsonb)
returns void
language plpgsql
immutable
set search_path = pg_catalog, logistics_core
as $body$
declare
  v_row jsonb;
  v_item jsonb;
  v_compat_rows jsonb;
begin
  if jsonb_typeof(p_rows) <> 'array' then
    perform logistics_core.assert_rent_rows_valid(p_rows);
    return;
  end if;

  for v_row in select value from jsonb_array_elements(p_rows) loop
    if jsonb_typeof(v_row) <> 'object' then
      raise exception using errcode = 'PT422', message = 'RENT_ROLL_ROW_OBJECT_REQUIRED';
    end if;

    if v_row ? 'temperature_type' and (
      jsonb_typeof(v_row->'temperature_type') <> 'string'
      or btrim(v_row->>'temperature_type') not in ('', '상온', '저온', '복합', '사무실')
    ) then
      raise exception using errcode = 'PT422', message = 'RENT_ROLL_TEMPERATURE_TYPE_INVALID';
    end if;

    if not (v_row ? 'goods_type')
       or jsonb_typeof(v_row->'goods_type') <> 'array' then
      raise exception using errcode = 'PT422', message = 'GOODS_TYPE_STRING_ARRAY_REQUIRED';
    end if;
    for v_item in select value from jsonb_array_elements(v_row->'goods_type') loop
      if jsonb_typeof(v_item) <> 'string' or btrim(v_item #>> '{}') = '' then
        raise exception using errcode = 'PT422', message = 'GOODS_TYPE_ITEM_INVALID';
      end if;
    end loop;

    if not (v_row ? 'deposit_escalation_enabled')
       or jsonb_typeof(v_row->'deposit_escalation_enabled') <> 'boolean' then
      raise exception using errcode = 'PT422', message = 'DEPOSIT_ESCALATION_ENABLED_BOOLEAN_REQUIRED';
    end if;
  end loop;

  -- Reuse all existing numeric/date/rate/cost validation.  This compatibility
  -- value exists only inside the function and is never persisted.
  select coalesce(jsonb_agg(
    (item.value - 'deposit_escalation_enabled' - 'goods_type')
      || jsonb_build_object(
        'goods_type', coalesce((
          select string_agg(goods.value #>> '{}', ', ' order by goods.ordinality)
          from jsonb_array_elements(item.value->'goods_type')
            with ordinality goods(value, ordinality)
        ), '')
      )
    order by item.ordinality
  ), '[]'::jsonb)
  into v_compat_rows
  from jsonb_array_elements(p_rows) with ordinality item(value, ordinality);

  perform logistics_core.assert_rent_rows_valid(v_compat_rows);
end;
$body$;

create or replace function logistics_core.sanitize_rent_rows(p_rows jsonb)
returns jsonb
language sql
stable
set search_path = pg_catalog, logistics_core
as $body$
  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
    'occupancy_status', item.value->'occupancy_status',
    'tenant_name', item.value->'tenant_name',
    'business_registration_number', item.value->'business_registration_number',
    'temperature_type', logistics_core.normalize_temperature_type(item.value->'temperature_type'),
    'goods_type', logistics_core.normalize_goods_type(item.value->'goods_type'),
    'floor_label', item.value->'floor_label',
    'zone_label', item.value->'zone_label',
    'subtenant_name', item.value->'subtenant_name',
    'free_area_type', item.value->'free_area_type',
    'exclusive_area_sqm', item.value->'exclusive_area_sqm',
    'common_area_sqm', item.value->'common_area_sqm',
    'leased_area_sqm', item.value->'leased_area_sqm',
    'signed_date', item.value->'signed_date',
    'commencement_date', item.value->'commencement_date',
    'expiry_date', item.value->'expiry_date',
    'operation_start_date', item.value->'operation_start_date',
    'deposit_total_krw', item.value->'deposit_total_krw',
    'security_type', item.value->'security_type',
    'security_ratio', item.value->'security_ratio',
    'monthly_rent_total_krw', item.value->'monthly_rent_total_krw',
    'monthly_cam_total_krw', item.value->'monthly_cam_total_krw',
    'pallet_rack_fee', item.value->'pallet_rack_fee',
    'rent_free_periods', logistics_core.sanitize_rent_free_periods(item.value->'rent_free_periods'),
    'fit_out_start_date', item.value->'fit_out_start_date',
    'fit_out_end_date', item.value->'fit_out_end_date',
    'fit_out_months', item.value->'fit_out_months',
    'fit_out_amount', item.value->'fit_out_amount',
    'tenant_improvement_amount', item.value->'tenant_improvement_amount',
    'deposit_escalation_enabled', case
      when jsonb_typeof(item.value->'deposit_escalation_enabled') = 'boolean'
        then item.value->'deposit_escalation_enabled'
      else to_jsonb(logistics_core.deposit_escalation_detail_present(item.value))
    end,
    'deposit_escalation_first_date', item.value->'deposit_escalation_first_date',
    'deposit_escalation_interval_months', item.value->'deposit_escalation_interval_months',
    'deposit_escalation_rate', item.value->'deposit_escalation_rate',
    'rent_escalation_first_date', item.value->'rent_escalation_first_date',
    'rent_escalation_interval_months', item.value->'rent_escalation_interval_months',
    'rent_escalation_rate', item.value->'rent_escalation_rate',
    'cam_escalation_first_date', item.value->'cam_escalation_first_date',
    'cam_escalation_interval_months', item.value->'cam_escalation_interval_months',
    'cam_escalation_rate', item.value->'cam_escalation_rate',
    'tenant_cost_terms', logistics_core.sanitize_cost_terms(item.value->'tenant_cost_terms'),
    'landlord_cost_terms', logistics_core.sanitize_cost_terms(item.value->'landlord_cost_terms'),
    'renewal_terms', logistics_core.sanitize_option_term(item.value->'renewal_terms'),
    'termination_terms', logistics_core.sanitize_option_term(item.value->'termination_terms'),
    'restoration_terms', logistics_core.sanitize_option_term(item.value->'restoration_terms'),
    'notes', item.value->'notes'
  )) order by item.ordinality), '[]'::jsonb)
  from jsonb_array_elements(
    case when jsonb_typeof(p_rows) = 'array' then p_rows else '[]'::jsonb end
  ) with ordinality item(value, ordinality);
$body$;

-- Transaction-local snapshot: exact row order and every unrelated field are
-- compared after the rewrite.  No persistent id/source/revision is added.
create temporary table rent_roll_taxonomy_before on commit drop as
select asset_code, rows
from logistics_core.rent_roll;

do $backfill$
declare
  v_document_count integer;
  v_before_total integer;
  v_before_blank integer;
  v_after_total integer;
  v_after_blank integer;
  v_after_invalid integer;
begin
  select
    count(*),
    coalesce(sum(jsonb_array_length(rows)), 0),
    coalesce(sum((
      select count(*)
      from jsonb_array_elements(snapshot.rows) item(value)
      where nullif(btrim(item.value->>'temperature_type'), '') is null
    )), 0)
  into v_document_count, v_before_total, v_before_blank
  from pg_temp.rent_roll_taxonomy_before snapshot;

  if v_document_count <> 19 or v_before_total <> 81 then
    raise exception using errcode = 'PT422', message = 'RENT_ROLL_TEMPERATURE_TOTAL_COUNT_MISMATCH';
  end if;
  if v_before_blank <> 1 then
    raise exception using errcode = 'PT422', message = 'RENT_ROLL_TEMPERATURE_BLANK_COUNT_CHANGED';
  end if;

  if exists (
    select 1
    from pg_temp.rent_roll_taxonomy_before snapshot
    cross join lateral jsonb_array_elements(snapshot.rows) item(value)
    where nullif(btrim(item.value->>'temperature_type'), '') is not null
      and btrim(item.value->>'temperature_type') not in (
        'Y', 'N', '상온', '저온', '복합', '사무실'
      )
  ) then
    raise exception using errcode = 'PT422', message = 'RENT_ROLL_TEMPERATURE_TYPE_INVALID';
  end if;

  if exists (
    select 1
    from pg_temp.rent_roll_taxonomy_before snapshot
    cross join lateral jsonb_array_elements(snapshot.rows) item(value)
    where item.value ? 'goods_type'
      and jsonb_typeof(item.value->'goods_type') not in ('null', 'string', 'array')
  ) or exists (
    select 1
    from pg_temp.rent_roll_taxonomy_before snapshot
    cross join lateral jsonb_array_elements(snapshot.rows) item(value)
    cross join lateral jsonb_array_elements(
      case when jsonb_typeof(item.value->'goods_type') = 'array'
        then item.value->'goods_type' else '[]'::jsonb end
    ) goods(value)
    where jsonb_typeof(goods.value) <> 'string'
  ) then
    raise exception using errcode = 'PT422', message = 'GOODS_TYPE_STRING_ARRAY_REQUIRED';
  end if;

  update logistics_core.rent_roll document
  set rows = logistics_core.sanitize_rent_rows(document.rows);

  select
    coalesce(sum(jsonb_array_length(rows)), 0),
    coalesce(sum((
      select count(*)
      from jsonb_array_elements(document.rows) item(value)
      where nullif(btrim(item.value->>'temperature_type'), '') is null
    )), 0),
    coalesce(sum((
      select count(*)
      from jsonb_array_elements(document.rows) item(value)
      where nullif(btrim(item.value->>'temperature_type'), '') is not null
        and btrim(item.value->>'temperature_type') not in (
          '상온', '저온', '복합', '사무실'
        )
    )), 0)
  into v_after_total, v_after_blank, v_after_invalid
  from logistics_core.rent_roll document;

  if v_after_total <> v_before_total or v_after_total <> 81 then
    raise exception using errcode = 'PT500', message = 'RENT_ROLL_TEMPERATURE_TOTAL_COUNT_MISMATCH';
  end if;
  if v_after_blank <> v_before_blank or v_after_blank <> 1 then
    raise exception using errcode = 'PT500', message = 'RENT_ROLL_TEMPERATURE_BLANK_COUNT_CHANGED';
  end if;
  if v_after_invalid <> 0 then
    raise exception using errcode = 'PT500', message = 'RENT_ROLL_TEMPERATURE_INVALID_REMAINS';
  end if;
end;
$backfill$;

do $readback$
begin
  if exists (
    select 1
    from pg_temp.rent_roll_taxonomy_before before_document
    join logistics_core.rent_roll after_document using (asset_code)
    where jsonb_array_length(before_document.rows)
      <> jsonb_array_length(after_document.rows)
  ) then
    raise exception using errcode = 'PT500', message = 'RENT_ROLL_ROW_COUNT_MISMATCH';
  end if;

  if exists (
    select 1
    from pg_temp.rent_roll_taxonomy_before before_document
    join logistics_core.rent_roll after_document using (asset_code)
    cross join lateral jsonb_array_elements(before_document.rows)
      with ordinality before_item(value, ordinality)
    cross join lateral jsonb_array_elements(after_document.rows)
      with ordinality after_item(value, ordinality)
    where before_item.ordinality = after_item.ordinality
      and (
        after_item.value
          - 'temperature_type' - 'goods_type' - 'deposit_escalation_enabled'
      ) is distinct from (
        before_item.value
          - 'temperature_type' - 'goods_type' - 'deposit_escalation_enabled'
      )
  ) then
    raise exception using errcode = 'PT500', message = 'RENT_ROLL_NON_TAXONOMY_DATA_CHANGED';
  end if;

  if exists (
    select 1
    from pg_temp.rent_roll_taxonomy_before before_document
    join logistics_core.rent_roll after_document using (asset_code)
    cross join lateral jsonb_array_elements(before_document.rows)
      with ordinality before_item(value, ordinality)
    cross join lateral jsonb_array_elements(after_document.rows)
      with ordinality after_item(value, ordinality)
    where before_item.ordinality = after_item.ordinality
      and after_item.value->'temperature_type' is distinct from
        logistics_core.normalize_temperature_type(before_item.value->'temperature_type')
  ) then
    raise exception using errcode = 'PT500', message = 'RENT_ROLL_TEMPERATURE_MAPPING_MISMATCH';
  end if;

  if exists (
    select 1
    from pg_temp.rent_roll_taxonomy_before before_document
    join logistics_core.rent_roll after_document using (asset_code)
    cross join lateral jsonb_array_elements(before_document.rows)
      with ordinality before_item(value, ordinality)
    cross join lateral jsonb_array_elements(after_document.rows)
      with ordinality after_item(value, ordinality)
    where before_item.ordinality = after_item.ordinality
      and after_item.value->'goods_type' is distinct from
        logistics_core.normalize_goods_type(before_item.value->'goods_type')
  ) then
    raise exception using errcode = 'PT500', message = 'RENT_ROLL_GOODS_TYPE_READBACK_MISMATCH';
  end if;

  if exists (
    select 1
    from pg_temp.rent_roll_taxonomy_before before_document
    join logistics_core.rent_roll after_document using (asset_code)
    cross join lateral jsonb_array_elements(before_document.rows)
      with ordinality before_item(value, ordinality)
    cross join lateral jsonb_array_elements(after_document.rows)
      with ordinality after_item(value, ordinality)
    where before_item.ordinality = after_item.ordinality
      and after_item.value->'deposit_escalation_enabled' is distinct from
        case
          when jsonb_typeof(before_item.value->'deposit_escalation_enabled') = 'boolean'
            then before_item.value->'deposit_escalation_enabled'
          else to_jsonb(
            logistics_core.deposit_escalation_detail_present(before_item.value)
          )
        end
  ) then
    raise exception using errcode = 'PT500', message = 'RENT_ROLL_DEPOSIT_TOGGLE_READBACK_MISMATCH';
  end if;

  if (
    select count(*)
    from pg_catalog.pg_class class
    join pg_catalog.pg_namespace namespace on namespace.oid = class.relnamespace
    where namespace.nspname = 'logistics_core'
      and class.relkind in ('r', 'p')
  ) <> 4 then
    raise exception using errcode = 'PT500', message = 'RENT_ROLL_TAXONOMY_TABLE_COUNT_MISMATCH';
  end if;
end;
$readback$;

-- Reinstall the latest full-document CAS writer with the new validator.  The
-- expired-row guard, cardinality permissions, xmin CAS, and readback remain.
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
  perform logistics_core.assert_rent_rows_document_valid(p_payload->'rows');

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

revoke all on function logistics_core.normalize_temperature_type(jsonb)
  from public, anon, authenticated;
revoke all on function logistics_core.normalize_goods_type(jsonb)
  from public, anon, authenticated;
revoke all on function logistics_core.deposit_escalation_value_present(jsonb)
  from public, anon, authenticated;
revoke all on function logistics_core.deposit_escalation_detail_present(jsonb)
  from public, anon, authenticated;
revoke all on function logistics_core.assert_rent_rows_document_valid(jsonb)
  from public, anon, authenticated;

do $validate_contract$
begin
  if to_regprocedure('logistics_core.normalize_temperature_type(jsonb)') is null
     or to_regprocedure('logistics_core.normalize_goods_type(jsonb)') is null
     or to_regprocedure('logistics_core.deposit_escalation_detail_present(jsonb)') is null
     or to_regprocedure('logistics_core.assert_rent_rows_document_valid(jsonb)') is null then
    raise exception using errcode = 'PT500', message = 'RENT_ROLL_TAXONOMY_FUNCTION_MISSING';
  end if;

  perform logistics_core.assert_rent_rows_document_valid(document.rows)
  from logistics_core.rent_roll document;
end;
$validate_contract$;

notify pgrst, 'reload schema';

commit;
