-- LOGISTICS_RENT_ROLL_KST_BOUNDARY_V1
--
-- SDD contract
-- * All rent-roll date-bound projections, expired-row metadata, and the
--   full-document omission guard use the same Asia/Seoul business date.
-- * The four-table storage contract, stored rows, row order, xmin CAS,
--   permissions, and verified readback remain unchanged.

begin;

create or replace function logistics_core.project_rent_rows(p_rows jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, logistics_core
as $body$
declare
  v_as_of date := (statement_timestamp() at time zone 'Asia/Seoul')::date;
  v_result jsonb := '[]'::jsonb;
  v_row jsonb;
  v_exclusive numeric;
  v_common numeric;
  v_leased numeric;
  v_area_py numeric;
  v_deposit numeric;
  v_rent numeric;
  v_cam numeric;
  v_pallet numeric;
  v_free_months numeric;
  v_free_start date;
  v_free_end date;
  v_fit_start date;
  v_fit_end date;
  v_commencement date;
  v_expiry date;
  v_contract_months numeric;
begin
  for v_row in
    select item.value
    from jsonb_array_elements(logistics_core.sanitize_rent_rows(p_rows))
      with ordinality item(value, ordinality)
    order by item.ordinality
  loop
    v_exclusive := nullif(v_row->>'exclusive_area_sqm', '')::numeric;
    v_common := nullif(v_row->>'common_area_sqm', '')::numeric;
    v_leased := nullif(v_row->>'leased_area_sqm', '')::numeric;
    v_area_py := case when v_leased is null then null else v_leased * 0.3025 end;
    v_deposit := nullif(v_row->>'deposit_total_krw', '')::numeric;
    v_rent := nullif(v_row->>'monthly_rent_total_krw', '')::numeric;
    v_cam := nullif(v_row->>'monthly_cam_total_krw', '')::numeric;
    v_pallet := nullif(v_row->>'pallet_rack_fee', '')::numeric;
    v_commencement := nullif(v_row->>'commencement_date', '')::date;
    v_expiry := nullif(v_row->>'expiry_date', '')::date;
    v_fit_start := nullif(v_row->>'fit_out_start_date', '')::date;
    v_fit_end := nullif(v_row->>'fit_out_end_date', '')::date;
    select
      min(nullif(period.value->>'start_date', '')::date),
      max(nullif(period.value->>'end_date', '')::date),
      coalesce(sum(case
        when nullif(period.value->>'start_date', '') is not null
         and nullif(period.value->>'end_date', '') is not null
         and (period.value->>'end_date')::date >= (period.value->>'start_date')::date
        then round(
          ((period.value->>'end_date')::date - (period.value->>'start_date')::date)::numeric
            / 30.4375,
          2
        )
        when nullif(period.value->>'months', '') is not null
          then (period.value->>'months')::numeric
        else 0
      end), 0)
    into v_free_start, v_free_end, v_free_months
    from jsonb_array_elements(coalesce(v_row->'rent_free_periods', '[]'::jsonb)) period(value);
    v_contract_months := case
      when v_commencement is not null and v_expiry is not null and v_expiry >= v_commencement
      then greatest(0, round((v_expiry - v_commencement)::numeric / 30.4375))
    end;

    v_row := v_row || jsonb_build_object(
      'exclusive_area_py', case when v_exclusive is null then null else round(v_exclusive * 0.3025, 2) end,
      'common_area_py', case when v_common is null then null else round(v_common * 0.3025, 2) end,
      'leased_area_py', case when v_area_py is null then null else round(v_area_py, 2) end,
      'efficiency_ratio', case when v_leased > 0 and v_exclusive is not null
        then round(v_exclusive / v_leased * 100, 2) end,
      'contract_months', v_contract_months,
      'wale_years', case when v_expiry is not null
        then round(greatest(v_expiry - v_as_of, 0)::numeric / 365.25, 2) end,
      'rent_free_start_date', v_free_start,
      'rent_free_end_date', v_free_end,
      'rent_free_months', v_free_months,
      'fit_out_months', case
        when v_fit_start is not null and v_fit_end is not null and v_fit_end >= v_fit_start
        then round((v_fit_end - v_fit_start)::numeric / 30.4375, 2)
      end,
      'deposit_per_py_krw', case when v_area_py > 0 and v_deposit is not null
        then round(v_deposit / v_area_py, 2) end,
      'rent_per_py_krw', case when v_area_py > 0 and v_rent is not null
        then round(v_rent / v_area_py, 2) end,
      'cam_per_py_krw', case when v_area_py > 0 and v_cam is not null
        then round(v_cam / v_area_py, 2) end,
      'pallet_rack_fee_per_py', case when v_area_py > 0 and v_pallet is not null
        then round(v_pallet / v_area_py, 2) end,
      'current_total_cost_per_py_krw', case
        when v_area_py > 0 and v_rent is not null and v_cam is not null
        then round((v_rent + v_cam) / v_area_py, 2)
      end,
      'effective_rent', case
        when v_rent is not null and v_contract_months > 0 and v_free_months is not null
        then floor(v_rent * greatest(v_contract_months - v_free_months, 0) / v_contract_months)
      end
    );
    v_result := v_result || jsonb_build_array(jsonb_strip_nulls(v_row));
  end loop;
  return v_result;
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
  v_as_of date := (statement_timestamp() at time zone 'Asia/Seoul')::date;
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
        and (item.value->>'expiry_date')::date < v_as_of
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
      'as_of_date', v_as_of,
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
  v_as_of date := (statement_timestamp() at time zone 'Asia/Seoul')::date;
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
    v_old_rows, v_rows, v_as_of
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

revoke all on function logistics_core.project_rent_rows(jsonb)
  from public, anon, authenticated;
revoke all on function logistics_core.rent_roll_read_entry(uuid, text, jsonb, jsonb)
  from public, anon, authenticated;
revoke all on function logistics_core.rent_roll_batch_save_entry(uuid, text, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function logistics_core.rent_roll_read_entry(uuid, text, jsonb, jsonb)
  to authenticated;
grant execute on function logistics_core.rent_roll_batch_save_entry(uuid, text, jsonb, jsonb)
  to authenticated;

do $contract_readback$
begin
  if to_regprocedure('logistics_core.project_rent_rows(jsonb)') is null
     or to_regprocedure('logistics_core.rent_roll_read_entry(uuid,text,jsonb,jsonb)') is null
     or to_regprocedure('logistics_core.rent_roll_batch_save_entry(uuid,text,jsonb,jsonb)') is null then
    raise exception using errcode = 'PT500', message = 'RENT_ROLL_KST_FUNCTION_MISSING';
  end if;
  perform logistics_core.assert_rent_rows_document_valid(document.rows)
  from logistics_core.rent_roll document;
end;
$contract_readback$;

notify pgrst, 'reload schema';

commit;
