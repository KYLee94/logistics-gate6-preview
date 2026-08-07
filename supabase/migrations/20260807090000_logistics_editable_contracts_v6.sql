begin;

set local lock_timeout = '5s';
set local statement_timeout = '120s';

-- GATE6_EDITABLE_CONTRACTS_V6
-- 1. Repair the deployed full-row rent-roll writer.
-- 2. Project verified building-register cache and occupancy facts into home/read.
-- 3. Persist asset-scoped custom finance accounts and account selections.

do $repair_rent_roll_v1_row_space_key$
declare
  v_target regprocedure := to_regprocedure(
    'logistics_core.rent_roll_batch_save_entry_v1(uuid,text,jsonb,jsonb)'
  );
  v_definition text;
  v_erroneous text := 'existing.space_key = (operation->>''space_key'')';
  v_repaired text := 'existing.space_key = coalesce(nullif(row_record->>''space_key'', ''''), row_record->>''row_key'')';
  v_ti_columns_before text := 'pallet_rack_fee, notes, created_by, updated_by';
  v_ti_columns_after text := 'tenant_improvement_amount, pallet_rack_fee, notes, created_by, updated_by';
  v_ti_values_before text := 'nullif(row_record->>''pallet_rack_fee'', '''')::numeric,';
  v_ti_values_after text := 'nullif(row_record->>''tenant_improvement_amount'', '''')::numeric,
          nullif(row_record->>''pallet_rack_fee'', '''')::numeric,';
  v_ti_update_before text := 'pallet_rack_fee = excluded.pallet_rack_fee,';
  v_ti_update_after text := 'tenant_improvement_amount = excluded.tenant_improvement_amount,
          pallet_rack_fee = excluded.pallet_rack_fee,';
begin
  if v_target is null then
    raise exception using errcode = 'PT500', message = 'RENT_ROLL_V1_WRITER_MISSING';
  end if;
  select pg_get_functiondef(v_target::oid) into v_definition;
  if position(v_erroneous in v_definition) > 0 then
    v_definition := replace(v_definition, v_erroneous, v_repaired);
  elsif position(v_repaired in v_definition) = 0 then
    raise exception using errcode = 'PT500', message = 'RENT_ROLL_V1_ROW_KEY_REPAIR_TARGET_MISSING';
  end if;
  if position('tenant_improvement_amount = excluded.tenant_improvement_amount' in v_definition) = 0 then
    if position(v_ti_columns_before in v_definition) = 0
       or position(v_ti_values_before in v_definition) = 0
       or position(v_ti_update_before in v_definition) = 0 then
      raise exception using errcode = 'PT500', message = 'RENT_ROLL_V1_TI_REPAIR_TARGET_MISSING';
    end if;
    v_definition := replace(v_definition, v_ti_columns_before, v_ti_columns_after);
    v_definition := replace(v_definition, v_ti_values_before, v_ti_values_after);
    v_definition := replace(v_definition, v_ti_update_before, v_ti_update_after);
  end if;
  execute v_definition;
end;
$repair_rent_roll_v1_row_space_key$;

create or replace function logistics_core.normalize_option_term(raw_value text)
returns text
language sql
immutable
security invoker
set search_path = pg_catalog
as $function$
  select case
    when nullif(btrim(raw_value), '') is null then null
    when regexp_replace(lower(btrim(raw_value)), '[[:space:]]+', '', 'g') in (
      'n', 'no', '없음', '중도해지불가', '기타(없음)', '기타(n)', '기타(no)'
    ) then '없음'
    when regexp_replace(lower(btrim(raw_value)), '[[:space:]]+', '', 'g') in ('y', 'yes', '있음') then '있음'
    else btrim(raw_value)
  end;
$function$;

update logistics_core.lease_contracts contract
set renewal_terms = logistics_core.normalize_option_term(contract.renewal_terms),
    termination_terms = logistics_core.normalize_option_term(contract.termination_terms)
where contract.deleted_at is null
  and (
    contract.renewal_terms is distinct from logistics_core.normalize_option_term(contract.renewal_terms)
    or contract.termination_terms is distinct from logistics_core.normalize_option_term(contract.termination_terms)
  );

-- Preserve every previously-written override. The v4 helper used top-level
-- json concatenation and therefore replaced the whole data_platform_overrides
-- object whenever one legacy field was saved.
create or replace function logistics_core.set_legacy_field(
  p_table regclass,
  p_pk_column text,
  p_pk_value text,
  p_column text,
  p_value text,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $body$
declare
  v_target_type text;
  v_has_source_payload boolean;
  v_has_updated_at boolean;
begin
  select pg_catalog.format_type(attribute.atttypid, attribute.atttypmod)
  into v_target_type
  from pg_catalog.pg_attribute attribute
  where attribute.attrelid = p_table
    and attribute.attname = p_column
    and attribute.attnum > 0
    and not attribute.attisdropped;

  select exists (
    select 1 from pg_catalog.pg_attribute attribute
    where attribute.attrelid = p_table and attribute.attname = 'source_payload'
      and attribute.attnum > 0 and not attribute.attisdropped
  ), exists (
    select 1 from pg_catalog.pg_attribute attribute
    where attribute.attrelid = p_table and attribute.attname = 'updated_at'
      and attribute.attnum > 0 and not attribute.attisdropped
  ) into v_has_source_payload, v_has_updated_at;

  if v_target_type is not null then
    execute pg_catalog.format(
      'update %s set %I = nullif($1, '''')::%s%s where %I::text = $2',
      p_table, p_column, v_target_type,
      case when v_has_updated_at then ', updated_at = now()' else '' end,
      p_pk_column
    ) using p_value, p_pk_value;
  end if;

  if v_has_source_payload then
    execute pg_catalog.format(
      'update %s set source_payload = '
        || 'jsonb_set(jsonb_set(coalesce(source_payload, ''{}''::jsonb), '
        || '''{data_platform_overrides}'', '
        || 'coalesce(source_payload->''data_platform_overrides'', ''{}''::jsonb) '
        || '|| jsonb_build_object($1, $2), true), '
        || '''{data_platform_metadata}'', '
        || 'coalesce(source_payload->''data_platform_metadata'', ''{}''::jsonb) || $3, true)%s '
        || 'where %I::text = $4',
      p_table,
      case when v_has_updated_at then ', updated_at = now()' else '' end,
      p_pk_column
    ) using p_column, p_value, coalesce(p_metadata, '{}'::jsonb), p_pk_value;
  end if;
end;
$body$;

revoke all on function logistics_core.set_legacy_field(regclass, text, text, text, text, jsonb)
  from public, anon, authenticated;

do $home_read_rename$
begin
  if to_regprocedure('logistics_core.home_read_entry_v6(uuid,text,jsonb,jsonb)') is null then
    execute 'alter function logistics_core.home_read_entry(uuid, text, jsonb, jsonb) rename to home_read_entry_v6';
  end if;
end;
$home_read_rename$;

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
set search_path = pg_catalog, logistics_core, public
as $body$
declare
  v_base_response jsonb;
  v_asset_id uuid;
  v_asset logistics_core.assets%rowtype;
  v_legacy public.ll_assets%rowtype;
  v_register jsonb := '{}'::jsonb;
  v_register_fetched_at timestamptz;
  v_legacy_register jsonb := '{}'::jsonb;
  v_overrides jsonb := '{}'::jsonb;
  v_explicit_leasable numeric;
  v_gross_area numeric;
  v_space_area_sum numeric;
  v_space_denominator numeric;
  v_occupied_area numeric;
  v_vacant_area numeric;
  v_tenant_count bigint;
  v_space_count bigint;
  v_occupied_space_count bigint;
  v_vacant_space_count bigint;
  v_planned_space_count bigint;
  v_asset_payload jsonb;
  v_provenance jsonb;
  v_occupancy_summary jsonb;
  v_fund_rows jsonb;
  v_loan_rows jsonb;
begin
  v_base_response := logistics_core.home_read_entry_v6(
    p_request_id, p_asset_key, p_payload, p_expected_revisions
  );
  if nullif(btrim(p_asset_key), '') is null then return v_base_response; end if;
  v_asset_id := logistics_core.resolve_asset_id(p_asset_key);

  select asset.* into strict v_asset
  from logistics_core.assets asset
  where asset.id = v_asset_id and asset.deleted_at is null;

  select legacy.* into v_legacy
  from public.ll_assets legacy
  where legacy.asset_id = v_asset.public_key;

  v_overrides := coalesce(v_legacy.source_payload->'data_platform_overrides', '{}'::jsonb);
  v_legacy_register := coalesce(v_legacy.source_payload->'buildingRegister', '{}'::jsonb);

  -- Cache rows do not carry asset_id. Link only when the independent legacy
  -- land area, gross area and approval date all match. This excludes cached
  -- guard houses and other accessory buildings that share only an address.
  select cache.payload, cache.fetched_at
  into v_register, v_register_fetched_at
  from public.ll_cache_entries cache
  where cache.provider = 'building-register/summary'
    and cache.provider_status = 200
    and v_legacy.asset_id is not null
    and v_legacy.land_area_sqm is not null
    and v_legacy.gross_floor_area_sqm is not null
    and nullif(cache.payload->>'plat_area', '')::numeric is not distinct from v_legacy.land_area_sqm
    and nullif(cache.payload->>'tot_area', '')::numeric is not distinct from v_legacy.gross_floor_area_sqm
    and (
      v_legacy.approval_date is null
      or nullif(cache.payload->>'use_apr_day', '') = to_char(v_legacy.approval_date, 'YYYYMMDD')
    )
  order by cache.fetched_at desc
  limit 1;
  v_register := coalesce(v_register, '{}'::jsonb);

  with current_space as (
    select
      space.id,
      space.occupancy_status,
      coalesce(space.leasable_area_sqm, space.leased_area_sqm) as denominator_area,
      current_contract.tenant_id,
      current_contract.occupied_area
    from logistics_core.spaces space
    left join lateral (
      select
        contract.tenant_id,
        coalesce(allocation.allocated_leasable_area_sqm, space.leasable_area_sqm, space.leased_area_sqm) as occupied_area
      from logistics_core.contract_spaces allocation
      join logistics_core.lease_contracts contract
        on contract.id = allocation.contract_id
       and contract.deleted_at is null
       and contract.status not in ('ended', 'terminated')
       and contract.commencement_date <= current_date
       and (contract.expiry_date is null or contract.expiry_date >= current_date)
      where allocation.space_id = space.id
        and allocation.deleted_at is null
        and (allocation.effective_from is null or allocation.effective_from <= current_date)
        and (allocation.effective_to is null or allocation.effective_to >= current_date)
      order by allocation.effective_from desc nulls last, allocation.revision desc
      limit 1
    ) current_contract on true
    where space.asset_id = v_asset_id and space.deleted_at is null
  )
  select
    count(*),
    count(*) filter (where tenant_id is not null),
    count(*) filter (where tenant_id is null and occupancy_status <> 'planned'),
    count(*) filter (where tenant_id is null and occupancy_status = 'planned'),
    count(distinct tenant_id) filter (where tenant_id is not null),
    sum(denominator_area),
    sum(occupied_area) filter (where tenant_id is not null)
  into
    v_space_count,
    v_occupied_space_count,
    v_vacant_space_count,
    v_planned_space_count,
    v_tenant_count,
    v_space_area_sum,
    v_occupied_area
  from current_space;

  v_explicit_leasable := coalesce(
    v_asset.leasable_area_sqm,
    nullif(v_overrides->>'leasable_area_sqm', '')::numeric
  );
  v_gross_area := coalesce(
    v_asset.gross_area_sqm,
    nullif(v_overrides->>'gross_area_sqm', '')::numeric,
    nullif(v_register->>'tot_area', '')::numeric,
    nullif(v_legacy_register->>'grossFloorAreaSqm', '')::numeric,
    v_legacy.gross_floor_area_sqm
  );
  v_space_denominator := coalesce(v_explicit_leasable, v_gross_area, v_space_area_sum);
  v_occupied_area := coalesce(v_occupied_area, 0);
  v_vacant_area := case
    when v_space_denominator is null then null
    else greatest(v_space_denominator - v_occupied_area, 0)
  end;

  v_asset_payload := coalesce(v_base_response #> '{data,asset}', '{}'::jsonb)
    || jsonb_build_object(
      'zoning_text', coalesce(v_asset.zoning_text, nullif(v_overrides->>'zoning_text', '')),
      'land_area_sqm', coalesce(
        v_asset.land_area_sqm,
        nullif(v_overrides->>'land_area_sqm', '')::numeric,
        nullif(v_register->>'plat_area', '')::numeric,
        nullif(v_legacy_register->>'landAreaSqm', '')::numeric,
        v_legacy.land_area_sqm
      ),
      'building_area_sqm', coalesce(
        v_asset.building_area_sqm,
        nullif(v_overrides->>'building_area_sqm', '')::numeric,
        nullif(v_register->>'arch_area', '')::numeric,
        nullif(v_legacy_register->>'buildingAreaSqm', '')::numeric
      ),
      'gross_area_sqm', v_gross_area,
      'leasable_area_sqm', v_explicit_leasable,
      'primary_use', coalesce(
        v_asset.primary_use,
        nullif(v_overrides->>'primary_use', ''),
        nullif(v_register->>'main_purps_cd_nm', ''),
        nullif(v_register->>'etc_purps', ''),
        nullif(v_legacy_register->>'mainPurposeName', ''),
        nullif(v_legacy_register->>'etcPurpose', '')
      ),
      'building_coverage_ratio', coalesce(
        v_asset.building_coverage_ratio,
        nullif(v_overrides->>'building_coverage_ratio', '')::numeric,
        nullif(v_register->>'bc_rat', '')::numeric,
        nullif(v_legacy_register->>'buildingCoverageRatioPct', '')::numeric
      ),
      'floor_area_ratio', coalesce(
        v_asset.floor_area_ratio,
        nullif(v_overrides->>'floor_area_ratio', '')::numeric,
        nullif(v_register->>'vl_rat', '')::numeric,
        nullif(v_legacy_register->>'floorAreaRatioPct', '')::numeric
      ),
      'floor_count', coalesce(
        nullif(v_asset.floor_count, ''),
        nullif(v_legacy_register->>'floorCount', ''),
        case when v_register ? 'grnd_flr_cnt' then
          (v_register->>'grnd_flr_cnt') || 'F / B' || coalesce(v_register->>'ugrnd_flr_cnt', '0')
        end,
        v_legacy.floor_count
      ),
      'structure_text', coalesce(
        v_asset.structure_text,
        nullif(v_overrides->>'structure_text', ''),
        nullif(v_register->>'strct_cd_nm', ''),
        nullif(v_legacy_register->>'structureName', '')
      ),
      'parking_count', coalesce(
        v_asset.parking_count,
        nullif(v_overrides->>'parking_count', '')::integer,
        nullif(v_register->>'tot_pkng_cnt', '')::integer,
        case when v_register ?| array[
          'indr_auto_utcnt','oudr_auto_utcnt','indr_mech_utcnt','oudr_mech_utcnt'
        ] then
          coalesce(nullif(v_register->>'indr_auto_utcnt', '')::integer, 0)
            + coalesce(nullif(v_register->>'oudr_auto_utcnt', '')::integer, 0)
            + coalesce(nullif(v_register->>'indr_mech_utcnt', '')::integer, 0)
            + coalesce(nullif(v_register->>'oudr_mech_utcnt', '')::integer, 0)
        end,
        nullif(v_legacy_register->>'totalParkingCount', '')::integer
      ),
      'completion_date', coalesce(
        v_asset.completion_date,
        nullif(v_overrides->>'completion_date', '')::date,
        to_date(nullif(v_register->>'use_apr_day', ''), 'YYYYMMDD'),
        nullif(v_legacy_register->>'approvalDate', '')::date,
        v_legacy.approval_date
      )
    );

  v_provenance := jsonb_build_object(
    'building_register_match', case when v_register <> '{}'::jsonb then 'legacy_land_gross_approval_exact' else null end,
    'building_register_provider', case when v_register <> '{}'::jsonb then 'll_cache_entries:building-register/summary' else null end,
    'building_register_fetched_at', v_register_fetched_at,
    'land_area_sqm', case when v_asset.land_area_sqm is not null then 'logistics_core.assets' when v_register ? 'plat_area' then 'building_register_cache' else 'public.ll_assets' end,
    'building_area_sqm', case when v_asset.building_area_sqm is not null then 'logistics_core.assets' when v_register ? 'arch_area' then 'building_register_cache' when v_legacy_register ? 'buildingAreaSqm' then 'll_assets.source_payload.buildingRegister' end,
    'gross_area_sqm', case when v_asset.gross_area_sqm is not null then 'logistics_core.assets' when v_overrides ? 'gross_area_sqm' then 'll_assets.data_platform_overrides' when v_register ? 'tot_area' then 'building_register_cache' else 'public.ll_assets' end,
    'leasable_area_sqm', case when v_asset.leasable_area_sqm is not null then 'logistics_core.assets' when v_overrides ? 'leasable_area_sqm' then 'll_assets.data_platform_overrides' end,
    'primary_use', case when v_asset.primary_use is not null then 'logistics_core.assets' when v_register ? 'main_purps_cd_nm' then 'building_register_cache' when v_legacy_register <> '{}'::jsonb then 'll_assets.source_payload.buildingRegister' end,
    'occupancy_summary', 'logistics_core.current_contract_spaces'
  );

  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
    'fund_key', fund.fund_key, 'fund_code', fund.fund_code, 'name', fund.name_ko,
    'status', fund.status, 'fund_type', fund.fund_type, 'legal_form', fund.legal_form,
    'investment_strategy', fund.investment_strategy, 'inception_date', fund.inception_date,
    'maturity_date', fund.maturity_date, 'effective_from', link.effective_from,
    'effective_to', link.effective_to, 'ownership_ratio', link.ownership_ratio,
    'revision', greatest(fund.revision, link.revision),
    'fund_revision', fund.revision, 'link_revision', link.revision
  )) order by fund.name_ko), '[]'::jsonb)
  into v_fund_rows
  from logistics_core.fund_asset_links link
  join logistics_core.funds fund on fund.id = link.fund_id and fund.deleted_at is null
  where link.asset_id = v_asset_id and link.deleted_at is null;

  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
    'loan_key', loan.loan_key, 'tranche', loan.tranche_name, 'lender_name', lender.name_ko,
    'committed_amount_krw', loan.commitment_amount, 'drawdown_date', loan.drawdown_date,
    'maturity_date', loan.maturity_date, 'loan_type', loan.loan_type,
    'interest_type', loan.interest_type, 'coupon_rate', loan.coupon_rate,
    'all_in_rate', loan.all_in_rate, 'fee_rate', loan.fee_rate,
    'revision', greatest(loan.revision, coalesce(lender.revision, 0)),
    'loan_revision', loan.revision, 'lender_revision', lender.revision
  )) order by loan.tranche_name, lender.name_ko), '[]'::jsonb)
  into v_loan_rows
  from logistics_core.loans loan
  left join logistics_core.loan_lenders loan_lender
    on loan_lender.loan_id = loan.id and loan_lender.deleted_at is null
  left join logistics_core.lenders lender
    on lender.id = loan_lender.lender_id and lender.deleted_at is null
  where loan.deleted_at is null and (
    loan.asset_id = v_asset_id or exists (
      select 1 from logistics_core.fund_asset_links link
      where link.asset_id = v_asset_id and link.fund_id = loan.fund_id and link.deleted_at is null
    )
  );

  v_occupancy_summary := jsonb_build_object(
    'space_count', coalesce(v_space_count, 0),
    'occupied_space_count', coalesce(v_occupied_space_count, 0),
    'vacant_space_count', coalesce(v_vacant_space_count, 0),
    'planned_space_count', coalesce(v_planned_space_count, 0),
    'tenant_count', coalesce(v_tenant_count, 0),
    'active_tenant_count', coalesce(v_tenant_count, 0),
    'occupied_area_sqm', v_occupied_area,
    'vacant_area_sqm', v_vacant_area,
    'denominator_area_sqm', v_space_denominator,
    'denominator_source', case
      when v_explicit_leasable is not null then 'asset_leasable_area'
      when v_gross_area is not null then 'asset_gross_area'
      when v_space_area_sum is not null then 'active_space_area_sum'
    end,
    'occupancy_rate', case when v_space_denominator > 0 then round(v_occupied_area / v_space_denominator * 100, 2) end
  );

  v_base_response := jsonb_set(v_base_response, '{data,asset}', v_asset_payload, true);
  v_base_response := jsonb_set(v_base_response, '{data,funds}', v_fund_rows, true);
  v_base_response := jsonb_set(v_base_response, '{data,loans}', v_loan_rows, true);
  v_base_response := jsonb_set(v_base_response, '{data,asset_source_provenance}', v_provenance, true);
  v_base_response := jsonb_set(v_base_response, '{data,occupancy_summary}', v_occupancy_summary, true);
  v_base_response := jsonb_set(v_base_response, '{data,tenant_summary}', v_occupancy_summary, true);

  if (v_base_response #> '{data,asset}') is null
     or (v_base_response #> '{data,funds}') is null
     or (v_base_response #> '{data,loans}') is null then
    raise exception using errcode = 'PT500', message = 'HOME_READBACK_MISMATCH';
  end if;
  return v_base_response;
end;
$body$;

revoke all on function logistics_core.home_read_entry_v6(uuid, text, jsonb, jsonb)
  from public, anon, authenticated;
revoke all on function logistics_core.home_read_entry(uuid, text, jsonb, jsonb)
  from public, anon, authenticated;

-- The deployed home writer already owns ownership_ratio, exact component
-- revisions, audit and idempotency. Refuse this migration if that contract was
-- lost in an unexpected migration chain.
do $home_save_contract_preflight$
declare
  v_definition text;
begin
  select pg_get_functiondef(
    'logistics_core.home_batch_save_entry_v5(uuid,text,jsonb,jsonb)'::regprocedure::oid
  ) into v_definition;
  if position('field_name = ''ownership_ratio''' in v_definition) = 0
     or position('complete_idempotency' in v_definition) = 0
     or position('logistics_core.fund_asset_links' in v_definition) = 0 then
    raise exception using errcode = 'PT500', message = 'HOME_SAVE_CONTRACT_MISSING';
  end if;
end;
$home_save_contract_preflight$;

-- The active v5 home writer already routes these eight overview fields to the
-- real core columns and writes an audit row. Keep that allowlist as a hard
-- deployment precondition instead of silently dropping a field on drift.
do $home_overview_writer_preflight$
declare
  v_definition text;
  v_field text;
begin
  select pg_get_functiondef(
    'logistics_core.home_batch_save_entry(uuid,text,jsonb,jsonb)'::regprocedure::oid
  ) into v_definition;
  foreach v_field in array array[
    'zoning_text','building_area_sqm','primary_use','building_coverage_ratio',
    'floor_area_ratio','structure_text','parking_count','completion_date'
  ] loop
    if position(quote_literal(v_field) in v_definition) = 0 then
      raise exception using errcode = 'PT500', message = 'HOME_OVERVIEW_WRITER_ALLOWLIST_MISSING:' || v_field;
    end if;
  end loop;
  if position('logistics_core.set_core_field' in v_definition) = 0
     or position('insert into logistics_core.audit_events' in v_definition) = 0 then
    raise exception using errcode = 'PT500', message = 'HOME_OVERVIEW_WRITER_CONTRACT_MISSING';
  end if;
end;
$home_overview_writer_preflight$;

-- Archive the deployed read/save pair once. The new read wrapper removes a
-- legacy compound date from the editable date column. The save wrapper merges
-- a sparse dirty-cell row with the canonical row before delegating so omitted
-- fields are preserved rather than overwritten with null.
do $rent_roll_v6_rename$
begin
  if to_regprocedure('logistics_core.rent_roll_read_entry_v6(uuid,text,jsonb,jsonb)') is null then
    execute 'alter function logistics_core.rent_roll_read_entry(uuid, text, jsonb, jsonb) rename to rent_roll_read_entry_v6';
  end if;
  if to_regprocedure('logistics_core.rent_roll_batch_save_entry_v6(uuid,text,jsonb,jsonb)') is null then
    execute 'alter function logistics_core.rent_roll_batch_save_entry(uuid, text, jsonb, jsonb) rename to rent_roll_batch_save_entry_v6';
  end if;
end;
$rent_roll_v6_rename$;

-- Deposit escalation existed before the v5 rent/cam canonicalization pass.
-- Keep its established text contract aligned with the other escalation fields:
-- 0.03, 3, and 3% all mean the canonical value 3%.
create or replace function logistics_core.normalize_deposit_escalation_row(p_row jsonb)
returns jsonb
language sql
immutable
security invoker
set search_path = pg_catalog, logistics_core
as $function$
  select case
    when p_row ? 'deposit_escalation_rate' then
      jsonb_set(
        p_row,
        '{deposit_escalation_rate}',
        coalesce(
          to_jsonb(logistics_core.normalize_escalation_rate_percent(p_row->>'deposit_escalation_rate')),
          'null'::jsonb
        ),
        true
      )
    else p_row
  end;
$function$;

revoke all on function logistics_core.normalize_deposit_escalation_row(jsonb)
  from public, anon, authenticated;

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
  v_response jsonb;
  v_rows jsonb;
begin
  v_response := logistics_core.rent_roll_read_entry_v6(
    p_request_id, p_asset_key, p_payload, p_expected_revisions
  );

  select coalesce(jsonb_agg(
    logistics_core.normalize_deposit_escalation_row(
      case
        when nullif(row_item.value->>'expiry_date', '') is not null
         and not (row_item.value->>'expiry_date' ~ '^\d{4}-\d{2}-\d{2}$') then
          jsonb_set(
            row_item.value,
            '{expiry_date}',
            coalesce(to_jsonb(contract.expiry_date), 'null'::jsonb),
            true
          ) || jsonb_build_object(
            'migration_exceptions',
            coalesce(row_item.value->'migration_exceptions', '[]'::jsonb)
              || jsonb_build_array(jsonb_build_object(
                'field', 'expiry_date',
                'code', case when contract.expiry_date is null
                  then 'LEGACY_MULTIPLE_DATE_CONFLICT'
                  else 'LEGACY_DATE_NORMALIZED_TO_CORE'
                end,
                'source_value', row_item.value->>'expiry_date',
                'status', case when contract.expiry_date is null then 'blocked' else 'normalized' end
              ))
          )
        else row_item.value
      end
    )
    order by row_item.ordinality
  ), '[]'::jsonb)
  into v_rows
  from jsonb_array_elements(coalesce(v_response #> '{data,rows}', '[]'::jsonb))
    with ordinality row_item(value, ordinality)
  left join logistics_core.lease_contracts contract
    on contract.contract_key = row_item.value->>'contract_key'
   and contract.deleted_at is null;

  return jsonb_set(v_response, '{data,rows}', v_rows, true);
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
  v_actor_id uuid := logistics_core.request_actor();
  v_outer_action constant text := 'v2/rent-roll/batch-save-sparse-v6';
  v_digest text := logistics_core.request_hash(v_outer_action, p_asset_key, p_payload, p_expected_revisions);
  v_cached jsonb;
  v_transformed jsonb := p_payload;
  v_read_response jsonb;
  v_readback_response jsonb;
  v_input_row jsonb;
  v_current_row jsonb;
  v_legacy_snapshots jsonb := '[]'::jsonb;
  v_snapshot jsonb;
  v_after_snapshot jsonb;
  v_key_mappings jsonb := '[]'::jsonb;
  v_operation text;
  v_space_key text;
  v_row_index integer := 0;
  v_response jsonb;
begin
  v_cached := logistics_core.claim_idempotency(v_actor_id, v_outer_action, p_request_id, v_digest);
  if v_cached is not null then return v_cached; end if;

  if jsonb_typeof(coalesce(p_payload->'rows', '[]'::jsonb)) <> 'array' then
    raise exception using errcode = 'PT422', message = 'RENT_ROLL_ROWS_ARRAY_REQUIRED';
  end if;
  v_read_response := logistics_core.rent_roll_read_entry(
    gen_random_uuid(), p_asset_key, '{}'::jsonb, '{}'::jsonb
  );

  for v_input_row in select value from jsonb_array_elements(coalesce(p_payload->'rows', '[]'::jsonb)) loop
    v_input_row := logistics_core.normalize_deposit_escalation_row(v_input_row);
    v_operation := coalesce(nullif(v_input_row->>'operation', ''), 'update');
    v_space_key := coalesce(nullif(v_input_row->>'space_key', ''), nullif(v_input_row->>'row_key', ''));
    if v_operation = 'update' then
      select row_item.value
      into v_current_row
      from jsonb_array_elements(coalesce(v_read_response #> '{data,rows}', '[]'::jsonb)) row_item(value)
      where coalesce(nullif(row_item.value->>'space_key', ''), row_item.value->>'row_key') = v_space_key
      limit 1;
      if v_current_row is null then
        raise exception using errcode = 'PT404', message = 'RENT_ROLL_ROW_NOT_FOUND';
      end if;
      if not (v_input_row ? 'expiry_date') and exists (
        select 1
        from jsonb_array_elements(coalesce(v_current_row->'migration_exceptions', '[]'::jsonb)) exception(value)
        where exception.value->>'code' = 'LEGACY_MULTIPLE_DATE_CONFLICT'
      ) then
        select jsonb_strip_nulls(jsonb_build_object(
          'lease_id', legacy_lease.lease_id,
          'lease_source_sheet_row_id', legacy_lease.source_sheet_row_id,
          'lease_source', legacy_lease.source_payload->'source',
          'lease_source_row_hash', legacy_lease.source_payload->>'source_row_hash',
          'lease_source_row_number', legacy_lease.source_payload->>'source_row_number',
          'space_id', legacy_space.lease_space_id,
          'space_source_sheet_row_id', legacy_space.source_sheet_row_id,
          'space_source', legacy_space.source_payload->'source',
          'space_source_row_hash', legacy_space.source_payload->>'source_row_hash',
          'space_source_row_number', legacy_space.source_payload->>'source_row_number'
        ))
        into v_snapshot
        from public.ll_lease_spaces legacy_space
        left join public.ll_leases legacy_lease on legacy_lease.lease_id = legacy_space.lease_id
        where legacy_space.lease_space_id = v_space_key;
        if v_snapshot is not null then
          v_legacy_snapshots := v_legacy_snapshots || jsonb_build_array(jsonb_build_object(
            'space_key', v_space_key,
            'fingerprint', v_snapshot
          ));
        end if;
      end if;
      v_input_row := (v_current_row - 'migration_exceptions') || v_input_row;
      v_transformed := jsonb_set(
        v_transformed, array['rows', v_row_index::text], v_input_row, true
      );
    end if;
    v_row_index := v_row_index + 1;
  end loop;

  v_response := logistics_core.rent_roll_batch_save_entry_v6(
    p_request_id, p_asset_key, v_transformed, p_expected_revisions
  );

  -- An unrelated sparse edit may legitimately keep core expiry_date null, but
  -- it must never erase the compound official source text embedded in legacy
  -- keys/source lineage. Compare only immutable source identity because the
  -- projection is allowed to append v2 metadata to source_payload.
  for v_snapshot in select value from jsonb_array_elements(v_legacy_snapshots) loop
    select jsonb_strip_nulls(jsonb_build_object(
      'lease_id', legacy_lease.lease_id,
      'lease_source_sheet_row_id', legacy_lease.source_sheet_row_id,
      'lease_source', legacy_lease.source_payload->'source',
      'lease_source_row_hash', legacy_lease.source_payload->>'source_row_hash',
      'lease_source_row_number', legacy_lease.source_payload->>'source_row_number',
      'space_id', legacy_space.lease_space_id,
      'space_source_sheet_row_id', legacy_space.source_sheet_row_id,
      'space_source', legacy_space.source_payload->'source',
      'space_source_row_hash', legacy_space.source_payload->>'source_row_hash',
      'space_source_row_number', legacy_space.source_payload->>'source_row_number'
    ))
    into v_after_snapshot
    from public.ll_lease_spaces legacy_space
    left join public.ll_leases legacy_lease on legacy_lease.lease_id = legacy_space.lease_id
    where legacy_space.lease_space_id = v_snapshot->>'space_key';
    if v_after_snapshot is distinct from v_snapshot->'fingerprint' then
      raise exception using errcode = 'PT500', message = 'LEGACY_COMPOUND_DATE_SOURCE_LOST';
    end if;
  end loop;

  -- Commit-time readback: every created/updated space must be visible and every
  -- deleted space must be absent before the transaction can report success.
  -- For create, contract-space and rent-term keys are stable correlation keys
  -- even if a future writer replaces the client's temporary space key.
  v_readback_response := logistics_core.rent_roll_read_entry(
    gen_random_uuid(), p_asset_key, '{}'::jsonb, '{}'::jsonb
  );
  for v_input_row in select value from jsonb_array_elements(coalesce(p_payload->'rows', '[]'::jsonb)) loop
    v_operation := coalesce(nullif(v_input_row->>'operation', ''), 'update');
    v_space_key := coalesce(nullif(v_input_row->>'space_key', ''), nullif(v_input_row->>'row_key', ''));
    select row_item.value
    into v_current_row
    from jsonb_array_elements(coalesce(v_readback_response #> '{data,rows}', '[]'::jsonb)) row_item(value)
    where coalesce(nullif(row_item.value->>'space_key', ''), row_item.value->>'row_key') = v_space_key
       or (
         nullif(v_input_row->>'contract_space_key', '') is not null
         and row_item.value->>'contract_space_key' = v_input_row->>'contract_space_key'
       )
       or (
         nullif(v_input_row->>'rent_term_key', '') is not null
         and row_item.value->>'rent_term_key' = v_input_row->>'rent_term_key'
       )
    limit 1;
    if v_operation = 'delete' and v_current_row is not null then
      raise exception using errcode = 'PT500', message = 'RENT_ROLL_DELETE_READBACK_MISMATCH';
    elsif v_operation <> 'delete' and v_current_row is null then
      raise exception using errcode = 'PT500', message = 'RENT_ROLL_SAVE_READBACK_MISMATCH';
    end if;
    if v_operation = 'create'
       and v_current_row is not null
       and coalesce(nullif(v_current_row->>'space_key', ''), v_current_row->>'row_key') is distinct from v_space_key then
      v_key_mappings := v_key_mappings || jsonb_build_array(jsonb_build_object(
        'client_space_key', v_space_key,
        'server_space_key', coalesce(nullif(v_current_row->>'space_key', ''), v_current_row->>'row_key')
      ));
    end if;
  end loop;
  v_response := jsonb_set(v_response, '{data,rows_readback}', '"verified"'::jsonb, true);
  v_response := jsonb_set(v_response, '{data,legacy_source_readback}', '"verified"'::jsonb, true);
  v_response := jsonb_set(v_response, '{data,key_mappings}', v_key_mappings, true);
  perform logistics_core.complete_idempotency(v_actor_id, v_outer_action, p_request_id, v_response);
  return v_response;
end;
$body$;

revoke all on function logistics_core.rent_roll_read_entry_v6(uuid, text, jsonb, jsonb)
  from public, anon, authenticated;
revoke all on function logistics_core.rent_roll_batch_save_entry_v6(uuid, text, jsonb, jsonb)
  from public, anon, authenticated;
revoke all on function logistics_core.rent_roll_read_entry(uuid, text, jsonb, jsonb)
  from public, anon, authenticated;
revoke all on function logistics_core.rent_roll_batch_save_entry(uuid, text, jsonb, jsonb)
  from public, anon, authenticated;

alter table logistics_core.cashflow_accounts
  add column if not exists asset_id uuid references logistics_core.assets(id) on delete restrict,
  add column if not exists is_custom boolean not null default false;

alter table logistics_core.cashflow_accounts
  drop constraint if exists cashflow_accounts_custom_scope_check;
alter table logistics_core.cashflow_accounts
  add constraint cashflow_accounts_custom_scope_check check (
    (is_custom and asset_id is not null) or (not is_custom and asset_id is null)
  );

create index if not exists cashflow_accounts_asset_custom_idx
  on logistics_core.cashflow_accounts(asset_id, statement_section, display_order)
  where deleted_at is null;

create table if not exists logistics_core.finance_account_selections (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references logistics_core.assets(id) on delete restrict,
  account_id uuid not null references logistics_core.cashflow_accounts(id) on delete restrict,
  selected boolean not null,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  revision bigint not null default 1 check (revision > 0),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete set null
);

-- Keep a rerun safe even if a previous interrupted deployment created only a
-- partial table. Required business keys deliberately remain NOT NULL so an
-- ambiguous partial row blocks the migration instead of being guessed.
alter table logistics_core.finance_account_selections
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists asset_id uuid references logistics_core.assets(id) on delete restrict,
  add column if not exists account_id uuid references logistics_core.cashflow_accounts(id) on delete restrict,
  add column if not exists selected boolean,
  add column if not exists created_at timestamptz default now(),
  add column if not exists created_by uuid references auth.users(id) on delete set null,
  add column if not exists updated_at timestamptz default now(),
  add column if not exists updated_by uuid references auth.users(id) on delete set null,
  add column if not exists revision bigint default 1,
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references auth.users(id) on delete set null;

do $finance_selection_constraints$
begin
  if exists (
    select 1 from logistics_core.finance_account_selections
    where id is null or asset_id is null or account_id is null or selected is null
       or created_at is null or updated_at is null or revision is null or revision <= 0
  ) then
    raise exception using errcode = 'PT500', message = 'FINANCE_SELECTION_PARTIAL_SCHEMA_INVALID';
  end if;
  alter table logistics_core.finance_account_selections
    alter column id set not null,
    alter column id set default gen_random_uuid(),
    alter column asset_id set not null,
    alter column account_id set not null,
    alter column selected set not null,
    alter column created_at set not null,
    alter column created_at set default now(),
    alter column updated_at set not null,
    alter column updated_at set default now(),
    alter column revision set not null,
    alter column revision set default 1;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'logistics_core.finance_account_selections'::regclass
      and contype = 'p'
  ) then
    alter table logistics_core.finance_account_selections
      add constraint finance_account_selections_pkey primary key (id);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'logistics_core.finance_account_selections'::regclass
      and conname = 'finance_account_selections_revision_check'
  ) then
    alter table logistics_core.finance_account_selections
      add constraint finance_account_selections_revision_check check (revision > 0);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'logistics_core.finance_account_selections'::regclass
      and conname = 'finance_account_selections_asset_id_fkey'
  ) then
    alter table logistics_core.finance_account_selections
      add constraint finance_account_selections_asset_id_fkey
      foreign key (asset_id) references logistics_core.assets(id) on delete restrict;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'logistics_core.finance_account_selections'::regclass
      and conname = 'finance_account_selections_account_id_fkey'
  ) then
    alter table logistics_core.finance_account_selections
      add constraint finance_account_selections_account_id_fkey
      foreign key (account_id) references logistics_core.cashflow_accounts(id) on delete restrict;
  end if;
end;
$finance_selection_constraints$;

create unique index if not exists finance_account_selections_asset_account_uidx
  on logistics_core.finance_account_selections(asset_id, account_id);

drop trigger if exists finance_account_selections_set_updated_revision
  on logistics_core.finance_account_selections;
create trigger finance_account_selections_set_updated_revision
before update on logistics_core.finance_account_selections
for each row execute function logistics_core.set_updated_revision();

alter table logistics_core.finance_account_selections enable row level security;
revoke all on table logistics_core.cashflow_accounts from public, anon, authenticated;
revoke all on table logistics_core.finance_account_selections from public, anon, authenticated;

do $finance_read_rename$
begin
  if to_regprocedure('logistics_core.finance_read_entry_v6(uuid,text,jsonb,jsonb)') is null then
    execute 'alter function logistics_core.finance_read_entry(uuid, text, jsonb, jsonb) rename to finance_read_entry_v6';
  end if;
end;
$finance_read_rename$;

create or replace function logistics_core.finance_read_entry(
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
  v_base_response jsonb;
  v_asset_id uuid := logistics_core.resolve_asset_id(p_asset_key);
  v_accounts jsonb;
  v_waterfall jsonb;
begin
  v_base_response := logistics_core.finance_read_entry_v6(
    p_request_id, p_asset_key, p_payload, p_expected_revisions
  );

  select coalesce(jsonb_agg(jsonb_build_object(
    'account_code', account.account_code,
    'name', account.name_ko,
    'name_ko', account.name_ko,
    'account_kind', account.account_kind,
    'statement_section', account.statement_section,
    'normal_sign', account.normal_sign,
    'display_order', account.display_order,
    'parent_account_code', parent.account_code,
    'is_custom', account.is_custom,
    'asset_key', case when account.is_custom then p_asset_key end,
    'manual_entry_allowed', account.account_kind = 'atomic',
    'selected', coalesce(selection.selected, account.account_code = any(array[
      'POTENTIAL_BASE_RENT','POTENTIAL_CAM_INCOME','EXPENSE_REIMBURSEMENT_INCOME',
      'PARKING_YARD_INCOME','ROOF_SOLAR_ANTENNA_INCOME','OTHER_PROPERTY_INCOME',
      'VACANCY_LOSS','RENT_FREE_CONCESSION_LOSS','PM_FEE','FM_FEE',
      'REPAIRS_MAINTENANCE','UTILITIES','PROPERTY_TAX_PUBLIC_DUES',
      'PROPERTY_INSURANCE','GENERAL_PROPERTY_ADMIN','OTHER_PROPERTY_OPEX',
      'CLEANING','SECURITY','LANDSCAPING_SNOW','CAPEX','LEASING_COMMISSION',
      'TENANT_IMPROVEMENT','AMC_FEE','CUSTODY_FEE','GENERAL_ADMIN_TRUSTEE_FEE',
      'INTEREST_PAID'
    ])),
    'revision', account.revision,
    'selection_revision', selection.revision
  ) order by account.statement_section, account.display_order, account.account_code), '[]'::jsonb)
  into v_accounts
  from logistics_core.cashflow_accounts account
  left join logistics_core.cashflow_accounts parent
    on parent.id = account.parent_account_id and parent.deleted_at is null
  left join logistics_core.finance_account_selections selection
    on selection.asset_id = v_asset_id
   and selection.account_id = account.id
   and selection.deleted_at is null
  where account.deleted_at is null
    and (not account.is_custom or account.asset_id = v_asset_id);

  select coalesce(jsonb_agg(jsonb_build_object(
    'statement_section', totals.statement_section,
    'amount', totals.amount
  ) order by totals.statement_section), '[]'::jsonb)
  into v_waterfall
  from (
    select account.statement_section, sum(entry.amount * account.normal_sign) as amount
    from logistics_core.monthly_ledger_entries entry
    join logistics_core.cashflow_accounts account on account.id = entry.account_id
    left join logistics_core.finance_account_selections selection
      on selection.asset_id = v_asset_id
     and selection.account_id = account.id
     and selection.deleted_at is null
    where entry.asset_id = v_asset_id
      and entry.month between
        coalesce(logistics_core.normalize_month(coalesce(p_payload->>'from_month', p_payload->>'start_month')), date_trunc('year', current_date)::date)
        and coalesce(logistics_core.normalize_month(coalesce(p_payload->>'to_month', p_payload->>'end_month')), date_trunc('month', current_date)::date)
      and entry.scenario = coalesce(nullif(p_payload->>'scenario', ''), 'actual')
      and entry.accounting_basis = coalesce(nullif(p_payload->>'accounting_basis', ''), 'accrual')
      and entry.deleted_at is null
      and account.deleted_at is null
      and coalesce(selection.selected, account.account_code = any(array[
        'POTENTIAL_BASE_RENT','POTENTIAL_CAM_INCOME','EXPENSE_REIMBURSEMENT_INCOME',
        'PARKING_YARD_INCOME','ROOF_SOLAR_ANTENNA_INCOME','OTHER_PROPERTY_INCOME',
        'VACANCY_LOSS','RENT_FREE_CONCESSION_LOSS','PM_FEE','FM_FEE',
        'REPAIRS_MAINTENANCE','UTILITIES','PROPERTY_TAX_PUBLIC_DUES',
        'PROPERTY_INSURANCE','GENERAL_PROPERTY_ADMIN','OTHER_PROPERTY_OPEX',
        'CLEANING','SECURITY','LANDSCAPING_SNOW','CAPEX','LEASING_COMMISSION',
        'TENANT_IMPROVEMENT','AMC_FEE','CUSTODY_FEE','GENERAL_ADMIN_TRUSTEE_FEE',
        'INTEREST_PAID'
      ]))
    group by account.statement_section
  ) totals;

  v_base_response := jsonb_set(v_base_response, '{data,accounts}', v_accounts, true);
  v_base_response := jsonb_set(v_base_response, '{data,waterfall}', v_waterfall, true);
  return v_base_response;
end;
$body$;

create or replace function logistics_core.finance_batch_save_entry(
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
  v_actor_id uuid := logistics_core.request_actor();
  v_asset_id uuid := logistics_core.resolve_asset_id(p_asset_key);
  v_request_digest text := logistics_core.request_hash('v2/finance/batch-save', p_asset_key, p_payload, p_expected_revisions);
  v_cached_response jsonb;
  v_operation jsonb;
  v_record jsonb;
  v_operation_name text;
  v_account_code text;
  v_account_name text;
  v_statement_section text;
  v_account_id uuid;
  v_parent_id uuid;
  v_entry_key text;
  v_entry_id uuid;
  v_selection_id uuid;
  v_expected_revision bigint;
  v_current_revision bigint;
  v_before_row jsonb;
  v_after_row jsonb;
  v_changed_count integer := 0;
  v_final_revision bigint := 0;
  v_accounts_readback jsonb;
  v_response jsonb;
begin
  perform logistics_core.assert_v2_writer_route(v_asset_id);
  v_cached_response := logistics_core.claim_idempotency(
    v_actor_id, 'v2/finance/batch-save', p_request_id, v_request_digest
  );
  if v_cached_response is not null then return v_cached_response; end if;

  if jsonb_typeof(coalesce(p_payload->'operations', '[]'::jsonb)) <> 'array'
     or jsonb_typeof(coalesce(p_payload->'account_operations', '[]'::jsonb)) <> 'array'
     or jsonb_typeof(coalesce(p_payload->'selection_operations', '[]'::jsonb)) <> 'array' then
    raise exception using errcode = 'PT422', message = 'FINANCE_MUTATION_ARRAY_REQUIRED';
  end if;
  if coalesce(jsonb_array_length(p_payload->'operations'), 0)
     + coalesce(jsonb_array_length(p_payload->'account_operations'), 0)
     + coalesce(jsonb_array_length(p_payload->'selection_operations'), 0) > 1000 then
    raise exception using errcode = 'PT422', message = 'BATCH_LIMIT_EXCEEDED';
  end if;

  -- Account mutations are first so selection and ledger mutations in the same
  -- transaction can refer to the newly-created CUSTOM:<uuid> account_code.
  for v_operation in
    select value from jsonb_array_elements(coalesce(p_payload->'account_operations', '[]'::jsonb))
  loop
    v_operation_name := nullif(v_operation->>'operation', '');
    v_account_code := coalesce(
      nullif(btrim(v_operation->>'account_code'), ''),
      case when nullif(btrim(v_operation->>'client_account_key'), '') is not null
        then 'CUSTOM:' || btrim(v_operation->>'client_account_key') end
    );
    if v_operation_name not in ('create', 'update', 'delete')
       or v_account_code !~* '^CUSTOM:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
      raise exception using errcode = 'PT422', message = 'INVALID_FINANCE_ACCOUNT_OPERATION';
    end if;
    perform logistics_core.assert_asset_permission(v_actor_id, v_asset_id, v_operation_name);
    v_record := coalesce(v_operation->'record', '{}'::jsonb);
    v_before_row := null;

    if v_operation_name = 'create' then
      v_account_name := nullif(btrim(coalesce(v_record->>'name_ko', v_operation->>'name_ko')), '');
      v_statement_section := nullif(btrim(coalesce(v_record->>'statement_section', v_operation->>'statement_section')), '');
      if v_account_name is null or char_length(v_account_name) > 60 then
        raise exception using errcode = 'PT422', message = 'FINANCE_ACCOUNT_NAME_INVALID';
      end if;
      if v_statement_section not in ('potential_income','income_loss','operating_expense','below_noi','debt_service') then
        raise exception using errcode = 'PT422', message = 'FINANCE_ACCOUNT_SECTION_INVALID';
      end if;
      v_parent_id := null;
      if nullif(v_record->>'parent_account_code', '') is not null then
        select parent.id into v_parent_id
        from logistics_core.cashflow_accounts parent
        where parent.account_code = v_record->>'parent_account_code'
          and parent.is_custom and parent.asset_id = v_asset_id and parent.deleted_at is null;
        if v_parent_id is null then
          raise exception using errcode = 'PT422', message = 'FINANCE_PARENT_ACCOUNT_NOT_FOUND';
        end if;
      end if;
      insert into logistics_core.cashflow_accounts (
        account_code, name_ko, parent_account_id, account_kind, statement_section,
        normal_sign, display_order, asset_id, is_custom, created_by, updated_by
      ) values (
        v_account_code, v_account_name, v_parent_id, 'atomic', v_statement_section,
        case when v_statement_section = 'potential_income' then 1 else -1 end,
        coalesce(nullif(v_record->>'display_order', '')::integer, 900),
        v_asset_id, true, v_actor_id, v_actor_id
      ) returning id, revision into v_account_id, v_current_revision;
    else
      select account.id, account.revision, to_jsonb(account)
      into v_account_id, v_current_revision, v_before_row
      from logistics_core.cashflow_accounts account
      where account.account_code = v_account_code
        and account.is_custom and account.asset_id = v_asset_id
      for update;
      if v_account_id is null then raise exception using errcode = 'PT404', message = 'FINANCE_ACCOUNT_NOT_FOUND'; end if;
      v_expected_revision := coalesce(
        nullif(v_operation->>'expected_revision', '')::bigint,
        nullif(p_expected_revisions->>v_account_code, '')::bigint
      );
      if v_expected_revision is null or v_expected_revision <> v_current_revision then
        raise exception using errcode = 'PT409', message = 'REVISION_CONFLICT';
      end if;
      if v_operation_name = 'delete' then
        if exists (
          select 1 from logistics_core.monthly_ledger_entries entry
          where entry.account_id = v_account_id and entry.deleted_at is null
        ) then
          raise exception using errcode = 'PT422', message = 'FINANCE_ACCOUNT_HAS_LEDGER_ENTRIES';
        end if;
        update logistics_core.cashflow_accounts
        set deleted_at = now(), deleted_by = v_actor_id, updated_by = v_actor_id
        where id = v_account_id returning revision into v_current_revision;
        update logistics_core.finance_account_selections
        set deleted_at = now(), deleted_by = v_actor_id, updated_by = v_actor_id
        where asset_id = v_asset_id and account_id = v_account_id and deleted_at is null;
      else
        v_account_name := nullif(btrim(coalesce(v_record->>'name_ko', v_operation->>'name_ko')), '');
        v_statement_section := nullif(btrim(coalesce(v_record->>'statement_section', v_operation->>'statement_section')), '');
        if v_account_name is null or char_length(v_account_name) > 60 then
          raise exception using errcode = 'PT422', message = 'FINANCE_ACCOUNT_NAME_INVALID';
        end if;
        if v_statement_section not in ('potential_income','income_loss','operating_expense','below_noi','debt_service') then
          raise exception using errcode = 'PT422', message = 'FINANCE_ACCOUNT_SECTION_INVALID';
        end if;
        update logistics_core.cashflow_accounts
        set name_ko = v_account_name,
            statement_section = v_statement_section,
            normal_sign = case when v_statement_section = 'potential_income' then 1 else -1 end,
            display_order = coalesce(nullif(v_record->>'display_order', '')::integer, display_order),
            updated_by = v_actor_id
        where id = v_account_id returning revision into v_current_revision;
      end if;
    end if;

    select to_jsonb(account) into v_after_row
    from logistics_core.cashflow_accounts account where account.id = v_account_id;
    insert into logistics_core.audit_events (
      actor_user_id, action, entity_type, entity_id, asset_id, entity_revision,
      before_hash, after_hash, change_payload, reason, client_request_id,
      mapping_version, correlation_id
    ) values (
      v_actor_id, v_operation_name, 'cashflow_account', v_account_id, v_asset_id, v_current_revision,
      case when v_before_row is null then null else logistics_core.json_sha256(v_before_row) end,
      logistics_core.json_sha256(v_after_row),
      jsonb_build_object('account_code', v_account_code, 'statement_section', v_statement_section),
      coalesce(nullif(v_operation->>'reason', ''), '수익비용 사용자 정의 계정 수정'),
      p_request_id, 'gate6-data-platform-6', p_request_id
    );
    v_changed_count := v_changed_count + 1;
    v_final_revision := greatest(v_final_revision, v_current_revision);
  end loop;

  for v_operation in
    select value from jsonb_array_elements(coalesce(p_payload->'selection_operations', '[]'::jsonb))
  loop
    v_account_code := coalesce(
      nullif(btrim(v_operation->>'account_code'), ''),
      case when nullif(btrim(v_operation->>'client_account_key'), '') is not null
        then 'CUSTOM:' || btrim(v_operation->>'client_account_key') end
    );
    if v_operation->>'operation' <> 'upsert'
       or v_account_code is null
       or jsonb_typeof(v_operation->'selected') <> 'boolean' then
      raise exception using errcode = 'PT422', message = 'INVALID_FINANCE_SELECTION_OPERATION';
    end if;
    perform logistics_core.assert_asset_permission(v_actor_id, v_asset_id, 'update');
    select account.id into v_account_id
    from logistics_core.cashflow_accounts account
    where account.account_code = v_account_code
      and account.deleted_at is null
      and (not account.is_custom or account.asset_id = v_asset_id);
    if v_account_id is null then raise exception using errcode = 'PT404', message = 'FINANCE_ACCOUNT_NOT_FOUND'; end if;

    select selection.id, selection.revision, to_jsonb(selection)
    into v_selection_id, v_current_revision, v_before_row
    from logistics_core.finance_account_selections selection
    where selection.asset_id = v_asset_id and selection.account_id = v_account_id
    for update;
    if v_selection_id is null then
      insert into logistics_core.finance_account_selections (
        asset_id, account_id, selected, created_by, updated_by
      ) values (
        v_asset_id, v_account_id, (v_operation->>'selected')::boolean, v_actor_id, v_actor_id
      ) returning id, revision into v_selection_id, v_current_revision;
    else
      v_expected_revision := coalesce(
        nullif(v_operation->>'expected_revision', '')::bigint,
        nullif(p_expected_revisions->>('selection:' || v_account_code), '')::bigint
      );
      if v_expected_revision is null or v_expected_revision <> v_current_revision then
        raise exception using errcode = 'PT409', message = 'REVISION_CONFLICT';
      end if;
      update logistics_core.finance_account_selections
      set selected = (v_operation->>'selected')::boolean,
          deleted_at = null,
          deleted_by = null,
          updated_by = v_actor_id
      where id = v_selection_id returning revision into v_current_revision;
    end if;
    select to_jsonb(selection) into v_after_row
    from logistics_core.finance_account_selections selection where selection.id = v_selection_id;
    insert into logistics_core.audit_events (
      actor_user_id, action, entity_type, entity_id, asset_id, entity_revision,
      before_hash, after_hash, change_payload, reason, client_request_id,
      mapping_version, correlation_id
    ) values (
      v_actor_id, 'upsert', 'finance_account_selection', v_selection_id, v_asset_id, v_current_revision,
      case when v_before_row is null then null else logistics_core.json_sha256(v_before_row) end,
      logistics_core.json_sha256(v_after_row),
      jsonb_build_object('account_code', v_account_code, 'selected', (v_operation->>'selected')::boolean),
      coalesce(nullif(v_operation->>'reason', ''), '수익비용 계정 선택 수정'),
      p_request_id, 'gate6-data-platform-6', p_request_id
    );
    v_changed_count := v_changed_count + 1;
    v_final_revision := greatest(v_final_revision, v_current_revision);
  end loop;

  for v_operation in
    select value from jsonb_array_elements(coalesce(p_payload->'operations', '[]'::jsonb))
  loop
    v_operation_name := nullif(v_operation->>'operation', '');
    v_entry_key := nullif(v_operation->>'entry_key', '');
    if v_operation_name not in ('create', 'update', 'delete') or v_entry_key is null then
      raise exception using errcode = 'PT422', message = 'INVALID_FINANCE_OPERATION';
    end if;
    perform logistics_core.assert_asset_permission(v_actor_id, v_asset_id, v_operation_name);
    v_before_row := null;

    if v_operation_name in ('create', 'update') then
      v_account_code := nullif(v_operation->'record'->>'account_code', '');
      select account.id into v_account_id
      from logistics_core.cashflow_accounts account
      where account.account_code = v_account_code
        and account.account_kind = 'atomic'
        and account.deleted_at is null
        and (not account.is_custom or account.asset_id = v_asset_id);
      if v_account_id is null then raise exception using errcode = 'PT422', message = 'FINANCE_ACCOUNT_NOT_FOUND'; end if;
      if nullif(v_operation->'record'->>'scenario', '') not in ('actual','budget','forecast') then
        raise exception using errcode = 'PT422', message = 'INVALID_FINANCE_SCENARIO';
      end if;
      if nullif(v_operation->'record'->>'accounting_basis', '') not in ('accrual','cash') then
        raise exception using errcode = 'PT422', message = 'INVALID_ACCOUNTING_BASIS';
      end if;
      if nullif(v_operation->'record'->>'amount', '') is null
         or v_operation->'record'->>'amount' !~ '^[+-]?([0-9]+([.][0-9]*)?|[.][0-9]+)$' then
        raise exception using errcode = 'PT422', message = 'FINITE_NUMERIC_AMOUNT_REQUIRED';
      end if;
    end if;

    if v_operation_name = 'create' then
      insert into logistics_core.monthly_ledger_entries (
        entry_key, asset_id, month, account_id, scenario, accounting_basis, amount,
        currency_code, source_kind, source_ref, source_line_key, data_status, created_by, updated_by
      ) values (
        v_entry_key, v_asset_id, logistics_core.normalize_month(v_operation->'record'->>'month'),
        v_account_id, v_operation->'record'->>'scenario', v_operation->'record'->>'accounting_basis',
        (v_operation->'record'->>'amount')::numeric,
        coalesce(nullif(v_operation->'record'->>'currency_code', ''), 'KRW'),
        'manual_input', 'v2/finance/batch-save:' || p_request_id::text,
        v_entry_key, 'provided', v_actor_id, v_actor_id
      ) returning id, revision into v_entry_id, v_current_revision;
    else
      select entry.id, entry.revision, to_jsonb(entry)
      into v_entry_id, v_current_revision, v_before_row
      from logistics_core.monthly_ledger_entries entry
      where entry.entry_key = v_entry_key and entry.asset_id = v_asset_id
      for update;
      if v_entry_id is null then raise exception using errcode = 'PT404', message = 'NOT_FOUND'; end if;
      v_expected_revision := coalesce(
        nullif(v_operation->>'expected_revision', '')::bigint,
        nullif(p_expected_revisions->>v_entry_key, '')::bigint
      );
      if v_expected_revision is null or v_expected_revision <> v_current_revision then
        raise exception using errcode = 'PT409', message = 'REVISION_CONFLICT';
      end if;
      if v_before_row->>'source_kind' <> 'manual_input' then
        raise exception using errcode = 'PT422', message = 'FINANCE_DERIVED_ACCOUNT_FORBIDDEN';
      end if;
      if v_operation_name = 'delete' then
        update logistics_core.monthly_ledger_entries
        set deleted_at = now(), deleted_by = v_actor_id, updated_by = v_actor_id
        where id = v_entry_id returning revision into v_current_revision;
      else
        update logistics_core.monthly_ledger_entries
        set month = logistics_core.normalize_month(v_operation->'record'->>'month'),
            account_id = v_account_id,
            scenario = v_operation->'record'->>'scenario',
            accounting_basis = v_operation->'record'->>'accounting_basis',
            amount = (v_operation->'record'->>'amount')::numeric,
            source_ref = 'v2/finance/batch-save:' || p_request_id::text,
            deleted_at = null, deleted_by = null, updated_by = v_actor_id
        where id = v_entry_id returning revision into v_current_revision;
      end if;
    end if;
    select to_jsonb(entry) into v_after_row
    from logistics_core.monthly_ledger_entries entry where entry.id = v_entry_id;
    if v_after_row is null then raise exception using errcode = 'PT500', message = 'READBACK_MISMATCH'; end if;
    insert into logistics_core.audit_events (
      actor_user_id, action, entity_type, entity_id, asset_id, entity_revision,
      before_hash, after_hash, change_payload, reason, client_request_id,
      mapping_version, correlation_id
    ) values (
      v_actor_id, v_operation_name, 'monthly_ledger_entry', v_entry_id, v_asset_id, v_current_revision,
      case when v_before_row is null then null else logistics_core.json_sha256(v_before_row) end,
      logistics_core.json_sha256(v_after_row),
      jsonb_build_object('entry_key', v_entry_key, 'account_code', v_account_code),
      coalesce(nullif(v_operation->>'reason', ''), 'NOI 손익 직접 수정'),
      p_request_id, 'gate6-data-platform-6', p_request_id
    );
    v_changed_count := v_changed_count + 1;
    v_final_revision := greatest(v_final_revision, v_current_revision);
  end loop;

  select coalesce(jsonb_agg(jsonb_build_object(
    'account_code', account.account_code,
    'name', account.name_ko,
    'statement_section', account.statement_section,
    'is_custom', account.is_custom,
    'selected', coalesce(selection.selected, false),
    'revision', account.revision,
    'selection_revision', selection.revision
  ) order by account.statement_section, account.display_order, account.account_code), '[]'::jsonb)
  into v_accounts_readback
  from logistics_core.cashflow_accounts account
  left join logistics_core.finance_account_selections selection
    on selection.asset_id = v_asset_id and selection.account_id = account.id and selection.deleted_at is null
  where account.deleted_at is null and (not account.is_custom or account.asset_id = v_asset_id);

  v_response := logistics_core.primary_response(
    p_request_id,
    v_final_revision,
    jsonb_build_object(
      'changed_count', v_changed_count,
      'readback', 'verified',
      'accounts_readback', v_accounts_readback,
      'selection_readback', 'verified',
      'derived_subtotals_stored', false
    )
  );
  perform logistics_core.complete_idempotency(
    v_actor_id, 'v2/finance/batch-save', p_request_id, v_response
  );
  return v_response;
end;
$body$;

revoke all on function logistics_core.finance_read_entry_v6(uuid, text, jsonb, jsonb)
  from public, anon, authenticated;
revoke all on function logistics_core.finance_read_entry(uuid, text, jsonb, jsonb)
  from public, anon, authenticated;
revoke all on function logistics_core.finance_batch_save_entry(uuid, text, jsonb, jsonb)
  from public, anon, authenticated;

notify pgrst, 'reload schema';

commit;
