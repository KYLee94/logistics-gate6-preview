-- LOGISTICS_CORE_SIMPLE_V1
--
-- Replace the normalized data-platform core with four UI-shaped documents.
-- The old schema is first renamed without copying so every in-transaction
-- validation failure restores it automatically.  The 2026-08-10 cutover
-- decision explicitly permits immediate cleanup without a separate backup;
-- every preflight, copy, rebind, and readback therefore remains inside this
-- transaction so any error restores the original schema automatically.
--
-- This migration intentionally stores no technical identifiers, provenance,
-- audit metadata, or application revision columns in the new core.  Document
-- versions are PostgreSQL row xmin values returned by the RPC layer.

begin;

set local lock_timeout = '10s';
set local statement_timeout = '300s';

select pg_advisory_xact_lock(hashtextextended('LOGISTICS_CORE_SIMPLE_V1', 0));

do $preflight$
begin
  if to_regnamespace('logistics_core') is null then
    raise exception using errcode = 'PT500', message = 'SIMPLE_CORE_SOURCE_SCHEMA_MISSING';
  end if;
  if to_regnamespace('logistics_core_rollback_20260807') is not null then
    raise exception using errcode = 'PT409', message = 'SIMPLE_CORE_ROLLBACK_SCHEMA_ALREADY_EXISTS';
  end if;
  if to_regprocedure('logistics_core.home_read_entry(uuid,text,jsonb,jsonb)') is null
     or to_regprocedure('logistics_core.rent_roll_read_entry(uuid,text,jsonb,jsonb)') is null
     or to_regprocedure('logistics_core.finance_read_entry(uuid,text,jsonb,jsonb)') is null then
    raise exception using errcode = 'PT500', message = 'SIMPLE_CORE_SOURCE_READERS_MISSING';
  end if;
end;
$preflight$;

-- Temporary tables contain the only in-flight copy.  They disappear on commit
-- and are never part of the final application schema.
create temporary table simple_core_source_objects (
  relation_name text primary key,
  relation_oid oid not null,
  row_count bigint not null
) on commit drop;

-- Preserve only the three already-approved Auth user IDs while the old core
-- schema is renamed.  The final login gate remains attached to the existing
-- public permission table, so this does not add a fifth application table.
create temporary table simple_core_login_allowlist (
  user_id uuid primary key,
  staff_name text not null
) on commit drop;

insert into pg_temp.simple_core_login_allowlist(user_id, staff_name)
select pilot.user_id, permission.staff_name
from logistics_core.platform_pilot_users pilot
join public.ll_user_permissions permission on permission.user_id = pilot.user_id
where pilot.is_active = true;

do $validate_login_allowlist$
begin
  if (select count(*) from pg_temp.simple_core_login_allowlist) <> 3
     or exists (
       select 1 from pg_temp.simple_core_login_allowlist
       where staff_name not in ('이관용', '전기영', '이시정')
     )
     or exists (
       select approved.staff_name
       from (values ('이관용'), ('전기영'), ('이시정')) approved(staff_name)
       except
       select allowlist.staff_name from pg_temp.simple_core_login_allowlist allowlist
     ) then
    raise exception using errcode = 'PT500', message = 'SIMPLE_CORE_LOGIN_ALLOWLIST_MISMATCH';
  end if;
end;
$validate_login_allowlist$;

do $capture_source_objects$
declare
  v_relation record;
  v_count bigint;
begin
  for v_relation in
    select class.oid, class.relname
    from pg_catalog.pg_class class
    join pg_catalog.pg_namespace namespace on namespace.oid = class.relnamespace
    where namespace.nspname = 'logistics_core'
      and class.relkind in ('r', 'p')
    order by class.relname
  loop
    execute pg_catalog.format('select count(*) from logistics_core.%I', v_relation.relname)
      into v_count;
    insert into pg_temp.simple_core_source_objects(relation_name, relation_oid, row_count)
    values (v_relation.relname, v_relation.oid, v_count);
  end loop;
end;
$capture_source_objects$;

create temporary table simple_core_funds (
  fund_code text primary key,
  name text,
  fund_type text,
  investment_strategy text,
  inception_date date,
  maturity_date date,
  ownership_ratio numeric,
  investments jsonb not null,
  loans jsonb not null
) on commit drop;

create temporary table simple_core_assets (
  asset_code text primary key,
  fund_code text not null,
  name text,
  address text,
  zoning_text text,
  land_area_sqm numeric,
  building_area_sqm numeric,
  gross_area_sqm numeric,
  leasable_area_sqm numeric,
  primary_use text,
  building_coverage_ratio numeric,
  floor_area_ratio numeric,
  floor_count text,
  structure_text text,
  parking_count integer,
  completion_date date
) on commit drop;

create temporary table simple_core_rent_roll (
  asset_code text primary key,
  rows jsonb not null
) on commit drop;

create temporary table simple_core_income_expense (
  asset_code text primary key,
  statement jsonb not null
) on commit drop;

-- The legacy home projection exposes some valid monetary/rate values as JSON
-- strings.  Canonical documents store those unchanged numeric values as JSON
-- numbers so the strict writer/readback contract does not preserve type drift.
create or replace function pg_temp.canonical_json_number(p_value jsonb)
returns jsonb
language plpgsql
immutable
set search_path = pg_catalog
as $function$
declare
  v_text text;
begin
  if p_value is null or jsonb_typeof(p_value) = 'null' then return null; end if;
  if jsonb_typeof(p_value) = 'number' then return p_value; end if;
  if jsonb_typeof(p_value) <> 'string' then return p_value; end if;

  v_text := replace(replace(btrim(p_value #>> '{}'), ',', ''), '%', '');
  if v_text ~ '^[+-]?([0-9]+([.][0-9]*)?|[.][0-9]+)$' then
    return to_jsonb(v_text::numeric);
  end if;
  return p_value;
end;
$function$;

create or replace function pg_temp.sanitize_investments(p_rows jsonb)
returns jsonb
language sql
immutable
set search_path = pg_catalog, pg_temp
as $function$
  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
    'tranche', item.value->'tranche',
    'beneficiary_name', item.value->'beneficiary_name',
    'agreed_amount_krw', pg_temp.canonical_json_number(item.value->'agreed_amount_krw'),
    'contributed_amount_krw', pg_temp.canonical_json_number(item.value->'contributed_amount_krw')
  )) order by item.ordinality), '[]'::jsonb)
  from jsonb_array_elements(case when jsonb_typeof(p_rows) = 'array' then p_rows else '[]'::jsonb end)
    with ordinality item(value, ordinality);
$function$;

create or replace function pg_temp.sanitize_loans(p_rows jsonb)
returns jsonb
language sql
immutable
set search_path = pg_catalog, pg_temp
as $function$
  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
    'tranche', item.value->'tranche',
    'lender_name', item.value->'lender_name',
    'committed_amount_krw', pg_temp.canonical_json_number(item.value->'committed_amount_krw'),
    'drawdown_date', item.value->'drawdown_date',
    'maturity_date', item.value->'maturity_date',
    'loan_type', item.value->'loan_type',
    'interest_type', item.value->'interest_type',
    'coupon_rate', pg_temp.canonical_json_number(item.value->'coupon_rate'),
    'all_in_rate', pg_temp.canonical_json_number(item.value->'all_in_rate'),
    'fee_rate', pg_temp.canonical_json_number(item.value->'fee_rate')
  )) order by item.ordinality), '[]'::jsonb)
  from jsonb_array_elements(case when jsonb_typeof(p_rows) = 'array' then p_rows else '[]'::jsonb end)
    with ordinality item(value, ordinality);
$function$;

create or replace function pg_temp.sanitize_rent_free_periods(p_rows jsonb)
returns jsonb
language sql
immutable
set search_path = pg_catalog
as $function$
  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
    'start_date', item.value->'start_date',
    'end_date', item.value->'end_date',
    'months', item.value->'months',
    'reason', item.value->'reason',
    'notes', item.value->'notes'
  )) order by item.ordinality), '[]'::jsonb)
  from jsonb_array_elements(case when jsonb_typeof(p_rows) = 'array' then p_rows else '[]'::jsonb end)
    with ordinality item(value, ordinality);
$function$;

create or replace function pg_temp.sanitize_cost_terms(p_value jsonb)
returns jsonb
language plpgsql
immutable
set search_path = pg_catalog
as $function$
declare
  v_source jsonb;
  v_items jsonb;
begin
  if p_value is null or jsonb_typeof(p_value) = 'null' then return null; end if;
  v_source := case
    when jsonb_typeof(p_value) = 'array' then p_value
    when jsonb_typeof(p_value) = 'object' and jsonb_typeof(p_value->'items') = 'array'
      then p_value->'items'
    when jsonb_typeof(p_value) = 'object' and jsonb_typeof(p_value->'selected_items') = 'array'
      then p_value->'selected_items'
    when jsonb_typeof(p_value) = 'object' and jsonb_typeof(p_value->'selected') = 'array'
      then p_value->'selected'
    when jsonb_typeof(p_value) = 'object' and jsonb_typeof(p_value->'values') = 'array'
      then p_value->'values'
    when jsonb_typeof(p_value) = 'object' and jsonb_typeof(p_value->'raw_text') = 'string'
      then to_jsonb(regexp_split_to_array(p_value->>'raw_text', E'[\n,]+'))
    when jsonb_typeof(p_value) = 'object' and jsonb_typeof(p_value->'text') = 'string'
      then to_jsonb(regexp_split_to_array(p_value->>'text', E'[\n,]+'))
    when jsonb_typeof(p_value) = 'string'
      then to_jsonb(regexp_split_to_array(p_value #>> '{}', E'[\n,]+'))
    else '[]'::jsonb
  end;
  select coalesce(jsonb_agg(to_jsonb(btrim(item.value #>> '{}')) order by item.ordinality), '[]'::jsonb)
  into v_items
  from jsonb_array_elements(v_source) with ordinality item(value, ordinality)
  where jsonb_typeof(item.value) = 'string' and nullif(btrim(item.value #>> '{}'), '') is not null;
  return jsonb_build_object('items', v_items);
end;
$function$;

create or replace function pg_temp.sanitize_option_term(p_value jsonb)
returns jsonb
language plpgsql
immutable
set search_path = pg_catalog
as $function$
declare
  v_text text;
begin
  if p_value is null or jsonb_typeof(p_value) = 'null' then return null; end if;
  v_text := case
    when jsonb_typeof(p_value) = 'string' then p_value #>> '{}'
    when jsonb_typeof(p_value) = 'object' then coalesce(
      p_value->>'value', p_value->>'text', p_value->>'raw_text',
      p_value->>'label', p_value->>'term'
    )
    when jsonb_typeof(p_value) = 'array' then (
      select string_agg(btrim(item.value #>> '{}'), ', ' order by item.ordinality)
      from jsonb_array_elements(p_value) with ordinality item(value, ordinality)
      where jsonb_typeof(item.value) = 'string'
    )
  end;
  return case when v_text is null then 'null'::jsonb else to_jsonb(btrim(v_text)) end;
end;
$function$;

create or replace function pg_temp.sanitize_rent_rows(p_rows jsonb)
returns jsonb
language sql
stable
set search_path = pg_catalog, pg_temp
as $function$
  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
    'occupancy_status', item.value->'occupancy_status',
    'tenant_name', item.value->'tenant_name',
    'business_registration_number', item.value->'business_registration_number',
    'temperature_type', item.value->'temperature_type',
    'goods_type', item.value->'goods_type',
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
    'rent_free_periods', case
      when jsonb_typeof(item.value->'rent_free_periods') = 'array'
       and jsonb_array_length(item.value->'rent_free_periods') > 0
        then pg_temp.sanitize_rent_free_periods(item.value->'rent_free_periods')
      when coalesce(nullif(item.value->>'rent_free_months', '')::numeric, 0) > 0
        then jsonb_build_array(jsonb_build_object(
          'months', nullif(item.value->>'rent_free_months', '')::numeric
        ))
      else '[]'::jsonb
    end,
    'fit_out_start_date', item.value->'fit_out_start_date',
    'fit_out_end_date', item.value->'fit_out_end_date',
    'fit_out_months', item.value->'fit_out_months',
    'fit_out_amount', item.value->'fit_out_amount',
    'tenant_improvement_amount', item.value->'tenant_improvement_amount',
    'deposit_escalation_first_date', item.value->'deposit_escalation_first_date',
    'deposit_escalation_interval_months', item.value->'deposit_escalation_interval_months',
    'deposit_escalation_rate', item.value->'deposit_escalation_rate',
    'rent_escalation_first_date', item.value->'rent_escalation_first_date',
    'rent_escalation_interval_months', item.value->'rent_escalation_interval_months',
    'rent_escalation_rate', item.value->'rent_escalation_rate',
    'cam_escalation_first_date', item.value->'cam_escalation_first_date',
    'cam_escalation_interval_months', item.value->'cam_escalation_interval_months',
    'cam_escalation_rate', item.value->'cam_escalation_rate',
    'tenant_cost_terms', pg_temp.sanitize_cost_terms(item.value->'tenant_cost_terms'),
    'landlord_cost_terms', pg_temp.sanitize_cost_terms(item.value->'landlord_cost_terms'),
    'renewal_terms', pg_temp.sanitize_option_term(item.value->'renewal_terms'),
    'termination_terms', pg_temp.sanitize_option_term(item.value->'termination_terms'),
    'restoration_terms', pg_temp.sanitize_option_term(item.value->'restoration_terms'),
    'notes', item.value->'notes'
  )) order by item.ordinality), '[]'::jsonb)
  from jsonb_array_elements(case when jsonb_typeof(p_rows) = 'array' then p_rows else '[]'::jsonb end)
    with ordinality item(value, ordinality);
$function$;

create or replace function pg_temp.statement_rows(
  p_accounts jsonb,
  p_entries jsonb,
  p_section text
)
returns jsonb
language sql
stable
set search_path = pg_catalog
as $function$
  select coalesce(jsonb_agg(jsonb_build_object(
    'name', coalesce(account.value->'name', account.value->'name_ko'),
    'selected', coalesce(account.value->'selected', 'false'::jsonb),
    'amounts', coalesce((
      select jsonb_object_agg(entry.value->>'month', entry.value->'amount' order by entry.value->>'month')
      from jsonb_array_elements(case when jsonb_typeof(p_entries) = 'array' then p_entries else '[]'::jsonb end) entry(value)
      where entry.value->>'account_name' = coalesce(account.value->>'name', account.value->>'name_ko')
    ), '{}'::jsonb)
  ) order by account.ordinality), '[]'::jsonb)
  from jsonb_array_elements(case when jsonb_typeof(p_accounts) = 'array' then p_accounts else '[]'::jsonb end)
    with ordinality account(value, ordinality)
  where account.value->>'statement_section' = p_section
    and coalesce(
      nullif(account.value->>'manual_entry_allowed', '')::boolean,
      account.value->>'account_kind' = 'atomic',
      true
    );
$function$;

create or replace function pg_temp.build_statement(p_response jsonb)
returns jsonb
language sql
stable
set search_path = pg_catalog, pg_temp
as $function$
  select jsonb_build_object(
    'periods', coalesce((
      select jsonb_agg(month_value order by month_value)
      from (
        select distinct entry.value->>'month' as month_value
        from jsonb_array_elements(coalesce(p_response #> '{data,entries}', '[]'::jsonb)) entry(value)
        where nullif(entry.value->>'month', '') is not null
      ) periods
    ), '[]'::jsonb),
    'potential_income', pg_temp.statement_rows(
      p_response #> '{data,accounts}', p_response #> '{data,entries}', 'potential_income'
    ),
    'income_loss', pg_temp.statement_rows(
      p_response #> '{data,accounts}', p_response #> '{data,entries}', 'income_loss'
    ),
    'operating_expense', pg_temp.statement_rows(
      p_response #> '{data,accounts}', p_response #> '{data,entries}', 'operating_expense'
    ),
    'below_noi', pg_temp.statement_rows(
      p_response #> '{data,accounts}', p_response #> '{data,entries}', 'below_noi'
    ),
    'debt_service', pg_temp.statement_rows(
      p_response #> '{data,accounts}', p_response #> '{data,entries}', 'debt_service'
    )
  );
$function$;

-- Execute the deployed readers under a current all-assets reader.  This makes
-- their permission checks and all deployed UI projection repairs part of the
-- migration contract instead of reimplementing legacy source precedence here.
do $stage_deployed_screen_contract$
declare
  v_actor uuid;
  v_asset record;
  v_home jsonb;
  v_rent jsonb;
  v_finance jsonb;
  v_asset_document jsonb;
  v_fund_document jsonb;
  v_fund_code text;
  v_investments jsonb;
  v_loans jsonb;
  v_statement jsonb;
  v_source_entry_count bigint;
  v_target_entry_count bigint;
  v_source_period_count bigint;
  v_target_period_count bigint;
  v_source_selected_count bigint;
  v_target_selected_count bigint;
  v_source_amount_sum numeric;
  v_target_amount_sum numeric;
  v_existing_fund pg_temp.simple_core_funds%rowtype;
begin
  select pilot.user_id
  into v_actor
  from logistics_core.platform_pilot_users pilot
  join logistics_core.user_permission_profiles permission
    on permission.user_id = pilot.user_id
   and permission.deleted_at is null
  where pilot.is_active
  order by pilot.user_id
  limit 1;

  if v_actor is null then
    raise exception using errcode = 'PT403', message = 'SIMPLE_CORE_ALL_ASSET_READER_MISSING';
  end if;

  -- The old reader contract enforces its own normalized permission profile.
  -- Grant the selected approved pilot read-only all-asset scope only inside
  -- this transaction so every visible screen document can be staged.  Any
  -- failure restores the original permission row, and the old table is removed
  -- after a successful cutover; public.ll_user_permissions remains authoritative.
  update logistics_core.user_permission_profiles
  set scope_mode = 'all', managed_read = true
  where user_id = v_actor and deleted_at is null;

  perform set_config('request.jwt.claim.sub', v_actor::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_actor, 'role', 'authenticated')::text,
    true
  );

  for v_asset in
    select asset.asset_key, asset.asset_code
    from logistics_core.assets asset
    where asset.deleted_at is null
    order by asset.asset_code
  loop
    v_home := logistics_core.home_read_entry(
      gen_random_uuid(), v_asset.asset_key, '{}'::jsonb, '{}'::jsonb
    );
    v_rent := logistics_core.rent_roll_read_entry(
      gen_random_uuid(), v_asset.asset_key, '{}'::jsonb, '{}'::jsonb
    );
    v_finance := logistics_core.finance_read_entry(
      gen_random_uuid(), v_asset.asset_key,
      jsonb_build_object('from_month', '1900-01', 'to_month', '2100-12'),
      '{}'::jsonb
    );

    if not coalesce((v_home->>'ok')::boolean, false)
       or not coalesce((v_rent->>'ok')::boolean, false)
       or not coalesce((v_finance->>'ok')::boolean, false) then
      raise exception using errcode = 'PT500', message = 'SIMPLE_CORE_DEPLOYED_READER_FAILED';
    end if;
    if jsonb_array_length(coalesce(v_home #> '{data,funds}', '[]'::jsonb)) <> 1 then
      raise exception using errcode = 'PT422', message = 'SIMPLE_CORE_ASSET_FUND_CARDINALITY_UNSUPPORTED';
    end if;

    v_asset_document := coalesce(v_home #> '{data,asset}', '{}'::jsonb);
    v_fund_document := v_home #> '{data,funds,0}';
    v_fund_code := nullif(v_fund_document->>'fund_code', '');
    if nullif(v_asset.asset_code, '') is null or v_fund_code is null then
      raise exception using errcode = 'PT422', message = 'SIMPLE_CORE_VISIBLE_CODE_MISSING';
    end if;

    v_investments := pg_temp.sanitize_investments(v_home #> '{data,investments}');
    v_loans := pg_temp.sanitize_loans(v_home #> '{data,loans}');

    insert into pg_temp.simple_core_funds (
      fund_code, name, fund_type, investment_strategy, inception_date,
      maturity_date, ownership_ratio, investments, loans
    ) values (
      v_fund_code,
      nullif(v_fund_document->>'name', ''),
      nullif(v_fund_document->>'fund_type', ''),
      nullif(v_fund_document->>'investment_strategy', ''),
      nullif(v_fund_document->>'inception_date', '')::date,
      nullif(v_fund_document->>'maturity_date', '')::date,
      nullif(v_fund_document->>'ownership_ratio', '')::numeric,
      v_investments,
      v_loans
    ) on conflict (fund_code) do nothing;

    select staged.* into strict v_existing_fund
    from pg_temp.simple_core_funds staged
    where staged.fund_code = v_fund_code;
    if to_jsonb(v_existing_fund) is distinct from jsonb_build_object(
      'fund_code', v_fund_code,
      'name', nullif(v_fund_document->>'name', ''),
      'fund_type', nullif(v_fund_document->>'fund_type', ''),
      'investment_strategy', nullif(v_fund_document->>'investment_strategy', ''),
      'inception_date', nullif(v_fund_document->>'inception_date', '')::date,
      'maturity_date', nullif(v_fund_document->>'maturity_date', '')::date,
      'ownership_ratio', nullif(v_fund_document->>'ownership_ratio', '')::numeric,
      'investments', v_investments,
      'loans', v_loans
    ) then
      raise exception using errcode = 'PT422', message = 'SIMPLE_CORE_SHARED_FUND_DOCUMENT_CONFLICT';
    end if;

    insert into pg_temp.simple_core_assets (
      asset_code, fund_code, name, address, zoning_text, land_area_sqm,
      building_area_sqm, gross_area_sqm, leasable_area_sqm, primary_use,
      building_coverage_ratio, floor_area_ratio, floor_count, structure_text,
      parking_count, completion_date
    ) values (
      v_asset.asset_code,
      v_fund_code,
      nullif(v_asset_document->>'name', ''),
      nullif(v_asset_document->>'address', ''),
      nullif(v_asset_document->>'zoning_text', ''),
      nullif(v_asset_document->>'land_area_sqm', '')::numeric,
      nullif(v_asset_document->>'building_area_sqm', '')::numeric,
      nullif(v_asset_document->>'gross_area_sqm', '')::numeric,
      nullif(v_asset_document->>'leasable_area_sqm', '')::numeric,
      nullif(v_asset_document->>'primary_use', ''),
      nullif(v_asset_document->>'building_coverage_ratio', '')::numeric,
      nullif(v_asset_document->>'floor_area_ratio', '')::numeric,
      nullif(v_asset_document->>'floor_count', ''),
      nullif(v_asset_document->>'structure_text', ''),
      nullif(v_asset_document->>'parking_count', '')::integer,
      nullif(v_asset_document->>'completion_date', '')::date
    );

    insert into pg_temp.simple_core_rent_roll(asset_code, rows)
    values (
      v_asset.asset_code,
      pg_temp.sanitize_rent_rows(v_rent #> '{data,rows}')
    );

    v_statement := pg_temp.build_statement(v_finance);

    -- Removing internal finance identifiers is safe only when every visible
    -- entry survives the name-based projection exactly once.  Compare source
    -- and staged counts, month coverage, selected-account count, and totals.
    with visible_accounts as (
      select coalesce(account.value->>'name', account.value->>'name_ko') as name
      from jsonb_array_elements(coalesce(v_finance #> '{data,accounts}', '[]'::jsonb)) account(value)
      where coalesce(
        nullif(account.value->>'manual_entry_allowed', '')::boolean,
        account.value->>'account_kind' = 'atomic',
        true
      )
    ), visible_entries as (
      select entry.value
      from jsonb_array_elements(coalesce(v_finance #> '{data,entries}', '[]'::jsonb)) entry(value)
      where exists (
        select 1 from visible_accounts account
        where account.name = entry.value->>'account_name'
      )
    )
    select
      count(*),
      count(distinct value->>'month'),
      coalesce(sum((value->>'amount')::numeric), 0)
    into v_source_entry_count, v_source_period_count, v_source_amount_sum
    from visible_entries;

    select count(*)
    into v_source_selected_count
    from jsonb_array_elements(coalesce(v_finance #> '{data,accounts}', '[]'::jsonb)) account(value)
    where coalesce(
      nullif(account.value->>'manual_entry_allowed', '')::boolean,
      account.value->>'account_kind' = 'atomic',
      true
    );

    with statement_rows_stage as (
      select row.value
      from jsonb_array_elements(
        coalesce(v_statement->'potential_income', '[]'::jsonb)
        || coalesce(v_statement->'income_loss', '[]'::jsonb)
        || coalesce(v_statement->'operating_expense', '[]'::jsonb)
        || coalesce(v_statement->'below_noi', '[]'::jsonb)
        || coalesce(v_statement->'debt_service', '[]'::jsonb)
      ) row(value)
    ), statement_amounts_stage as (
      select amount.key as month, amount.value
      from statement_rows_stage
      cross join lateral jsonb_each(coalesce(statement_rows_stage.value->'amounts', '{}'::jsonb)) amount
    )
    select
      (select count(*) from statement_amounts_stage),
      (select count(distinct month) from statement_amounts_stage),
      coalesce((select sum((value #>> '{}')::numeric) from statement_amounts_stage), 0),
      (select count(*) from statement_rows_stage)
    into v_target_entry_count, v_target_period_count, v_target_amount_sum, v_target_selected_count;

    if v_source_entry_count is distinct from v_target_entry_count
       or v_source_period_count is distinct from v_target_period_count
       or v_source_selected_count is distinct from v_target_selected_count
       or v_source_amount_sum is distinct from v_target_amount_sum then
      raise exception using errcode = 'PT422', message = 'SIMPLE_CORE_FINANCE_METRIC_MISMATCH';
    end if;

    insert into pg_temp.simple_core_income_expense(asset_code, statement)
    values (v_asset.asset_code, v_statement);
  end loop;
end;
$stage_deployed_screen_contract$;

do $validate_stage$
declare
  v_old_assets bigint;
  v_old_funds bigint;
begin
  -- A direct-asset or fundless loan cannot be assigned to a fund document
  -- without inventing ownership.  Any such row blocks the cutover.
  if exists (
    select 1
    from logistics_core.loans loan
    where loan.deleted_at is null
      and (
        loan.asset_id is not null
        or loan.fund_id is null
        or not exists (
          select 1
          from logistics_core.funds fund
          where fund.id = loan.fund_id
            and fund.deleted_at is null
        )
        or not exists (
          select 1
          from logistics_core.fund_asset_links link
          where link.fund_id = loan.fund_id
            and link.deleted_at is null
        )
      )
  ) then
    raise exception using errcode = 'PT422', message = 'SIMPLE_CORE_DIRECT_OR_UNMAPPED_LOAN';
  end if;

  -- Account identifiers are intentionally removed.  Visible normalized names
  -- therefore have to be unique inside each asset and statement section.
  if exists (
    select 1
    from logistics_core.assets asset
    join logistics_core.cashflow_accounts account
      on account.deleted_at is null
     and account.account_kind = 'atomic'
     and (not account.is_custom or account.asset_id = asset.id)
    where asset.deleted_at is null
    group by
      asset.id,
      account.statement_section,
      lower(regexp_replace(btrim(account.name_ko), '[[:space:]]+', '', 'g'))
    having count(*) > 1
  ) then
    raise exception using errcode = 'PT422', message = 'SIMPLE_CORE_FINANCE_VISIBLE_NAME_DUPLICATE';
  end if;

  -- Legacy rent-free records may contain only a month count.  That value is a
  -- visible field in the rent-free detail dialog, so staging preserves it as a
  -- canonical period instead of inventing dates or blocking the cutover.
  -- Legacy Fit-out records may also contain only a month count.  Preserve the
  -- visible value; future date-pair edits recalculate it in the browser.

  select count(*) into v_old_assets
  from logistics_core.assets where deleted_at is null;
  select count(*) into v_old_funds
  from logistics_core.funds where deleted_at is null;

  if (select count(*) from pg_temp.simple_core_assets) <> v_old_assets
     or (select count(*) from pg_temp.simple_core_rent_roll) <> v_old_assets
     or (select count(*) from pg_temp.simple_core_income_expense) <> v_old_assets then
    raise exception using errcode = 'PT500', message = 'SIMPLE_CORE_ASSET_DOCUMENT_COUNT_MISMATCH';
  end if;
  if (select count(*) from pg_temp.simple_core_funds) <> v_old_funds then
    raise exception using errcode = 'PT500', message = 'SIMPLE_CORE_FUND_DOCUMENT_COUNT_MISMATCH';
  end if;
  if exists (
    select 1 from pg_temp.simple_core_funds
    where jsonb_typeof(investments) <> 'array' or jsonb_typeof(loans) <> 'array'
  ) or exists (
    select 1 from pg_temp.simple_core_rent_roll where jsonb_typeof(rows) <> 'array'
  ) or exists (
    select 1 from pg_temp.simple_core_income_expense where jsonb_typeof(statement) <> 'object'
  ) then
    raise exception using errcode = 'PT500', message = 'SIMPLE_CORE_DOCUMENT_TYPE_MISMATCH';
  end if;
end;
$validate_stage$;

-- Only the eight public document wrappers and the already-approved login gate
-- may depend on the old schema from outside it before rebinding.
do $validate_external_dependencies_before_cutover$
declare
  v_unexpected text[];
begin
  select array_agg(dependency.description order by dependency.description)
  into v_unexpected
  from (
    select distinct pg_catalog.pg_describe_object(d.classid, d.objid, d.objsubid) as description
    from pg_catalog.pg_depend d
    where d.refobjid in (
      select class.oid
      from pg_catalog.pg_class class
      join pg_catalog.pg_namespace namespace on namespace.oid = class.relnamespace
      where namespace.nspname = 'logistics_core'
      union all
      select procedure.oid
      from pg_catalog.pg_proc procedure
      join pg_catalog.pg_namespace namespace on namespace.oid = procedure.pronamespace
      where namespace.nspname = 'logistics_core'
    )
      and (
        d.classid = 'pg_proc'::regclass and exists (
          select 1 from pg_catalog.pg_proc dependent
          join pg_catalog.pg_namespace namespace on namespace.oid = dependent.pronamespace
          where dependent.oid = d.objid
            and namespace.nspname <> 'logistics_core'
            and namespace.nspname !~ '^pg_'
            and namespace.nspname <> 'information_schema'
        )
        or d.classid = 'pg_trigger'::regclass and exists (
          select 1 from pg_catalog.pg_trigger trigger
          join pg_catalog.pg_class relation on relation.oid = trigger.tgrelid
          join pg_catalog.pg_namespace namespace on namespace.oid = relation.relnamespace
          where trigger.oid = d.objid
            and namespace.nspname <> 'logistics_core'
            and namespace.nspname !~ '^pg_'
            and namespace.nspname <> 'information_schema'
        )
        or d.classid = 'pg_class'::regclass and exists (
          select 1 from pg_catalog.pg_class dependent
          join pg_catalog.pg_namespace namespace on namespace.oid = dependent.relnamespace
          where dependent.oid = d.objid
            and namespace.nspname <> 'logistics_core'
            and namespace.nspname !~ '^pg_'
            and namespace.nspname <> 'information_schema'
        )
      )
  ) dependency
  where dependency.description !~ '^function logistics_api\.(home_read|home_batch_save|rent_roll_read|rent_roll_batch_save|finance_read|finance_batch_save|maturities_read|calculations_explain)\('
    and dependency.description <> 'trigger ll_user_permissions_temporary_login_gate on table ll_user_permissions';

  if v_unexpected is not null then
    raise exception using errcode = 'PT500', message = 'SIMPLE_CORE_UNEXPECTED_EXTERNAL_DEPENDENCY',
      detail = array_to_string(v_unexpected, E'\n');
  end if;
end;
$validate_external_dependencies_before_cutover$;

-- The rename preserves every old table, row, function, trigger, and object OID
-- while this transaction validates the replacement.  It is removed only after
-- the replacement, public wrappers, and login gate all pass transactional
-- readback.  No separate backup is required by the approved cutover decision.
alter schema logistics_core rename to logistics_core_rollback_20260807;
revoke all on schema logistics_core_rollback_20260807 from public, anon, authenticated;

do $validate_archive$
declare
  v_relation record;
  v_count bigint;
  v_oid oid;
begin
  for v_relation in select * from pg_temp.simple_core_source_objects order by relation_name loop
    select class.oid into v_oid
    from pg_catalog.pg_class class
    join pg_catalog.pg_namespace namespace on namespace.oid = class.relnamespace
    where namespace.nspname = 'logistics_core_rollback_20260807'
      and class.relname = v_relation.relation_name
      and class.relkind in ('r', 'p');
    if v_oid is distinct from v_relation.relation_oid then
      raise exception using errcode = 'PT500', message = 'SIMPLE_CORE_ARCHIVE_OID_MISMATCH';
    end if;
    execute pg_catalog.format(
      'select count(*) from logistics_core_rollback_20260807.%I',
      v_relation.relation_name
    ) into v_count;
    if v_count is distinct from v_relation.row_count then
      raise exception using errcode = 'PT500', message = 'SIMPLE_CORE_ARCHIVE_ROW_COUNT_MISMATCH';
    end if;
  end loop;
end;
$validate_archive$;

create schema logistics_core;
revoke all on schema logistics_core from public, anon, authenticated;

create table logistics_core.funds (
  fund_code text primary key,
  name text,
  fund_type text,
  investment_strategy text,
  inception_date date,
  maturity_date date,
  ownership_ratio numeric,
  investments jsonb not null default '[]'::jsonb,
  loans jsonb not null default '[]'::jsonb,
  constraint funds_investments_array_check check (jsonb_typeof(investments) = 'array'),
  constraint funds_loans_array_check check (jsonb_typeof(loans) = 'array')
);

create table logistics_core.assets (
  asset_code text primary key,
  fund_code text not null references logistics_core.funds(fund_code) on update cascade on delete restrict,
  name text,
  address text,
  zoning_text text,
  land_area_sqm numeric,
  building_area_sqm numeric,
  gross_area_sqm numeric,
  leasable_area_sqm numeric,
  primary_use text,
  building_coverage_ratio numeric,
  floor_area_ratio numeric,
  floor_count text,
  structure_text text,
  parking_count integer,
  completion_date date
);

create table logistics_core.rent_roll (
  asset_code text primary key references logistics_core.assets(asset_code) on update cascade on delete cascade,
  rows jsonb not null default '[]'::jsonb,
  constraint rent_roll_rows_array_check check (jsonb_typeof(rows) = 'array')
);

create table logistics_core.income_expense (
  asset_code text primary key references logistics_core.assets(asset_code) on update cascade on delete cascade,
  statement jsonb not null default '{}'::jsonb,
  constraint income_expense_statement_object_check check (jsonb_typeof(statement) = 'object')
);

insert into logistics_core.funds (
  fund_code, name, fund_type, investment_strategy, inception_date,
  maturity_date, ownership_ratio, investments, loans
)
select fund_code, name, fund_type, investment_strategy, inception_date,
       maturity_date, ownership_ratio, investments, loans
from pg_temp.simple_core_funds
order by fund_code;

insert into logistics_core.assets (
  asset_code, fund_code, name, address, zoning_text, land_area_sqm,
  building_area_sqm, gross_area_sqm, leasable_area_sqm, primary_use,
  building_coverage_ratio, floor_area_ratio, floor_count, structure_text,
  parking_count, completion_date
)
select asset_code, fund_code, name, address, zoning_text, land_area_sqm,
       building_area_sqm, gross_area_sqm, leasable_area_sqm, primary_use,
       building_coverage_ratio, floor_area_ratio, floor_count, structure_text,
       parking_count, completion_date
from pg_temp.simple_core_assets
order by asset_code;

insert into logistics_core.rent_roll(asset_code, rows)
select asset_code, rows from pg_temp.simple_core_rent_roll order by asset_code;

insert into logistics_core.income_expense(asset_code, statement)
select asset_code, statement from pg_temp.simple_core_income_expense order by asset_code;

alter table logistics_core.funds enable row level security;
alter table logistics_core.assets enable row level security;
alter table logistics_core.rent_roll enable row level security;
alter table logistics_core.income_expense enable row level security;
revoke all on all tables in schema logistics_core from public, anon, authenticated;

create or replace function logistics_core.request_actor()
returns uuid
language plpgsql
stable
security definer
set search_path = pg_catalog, auth
as $body$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null then
    raise exception using errcode = 'PT401', message = 'AUTH_REQUIRED';
  end if;
  return v_actor;
end;
$body$;

create or replace function logistics_core.has_asset_permission(
  p_actor uuid,
  p_asset_code text,
  p_operation text
)
returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $body$
declare
  v_permission public.ll_user_permissions%rowtype;
  v_managed boolean;
  v_permissions jsonb;
begin
  if p_operation not in ('read', 'create', 'update', 'delete') then return false; end if;
  select profile.* into v_permission
  from public.ll_user_permissions profile
  where profile.user_id = p_actor
    and coalesce(profile.account_status, 'active') = 'active';
  if v_permission.user_id is null then return false; end if;

  v_managed := p_asset_code = any(coalesce(v_permission.managed_asset_codes, '{}'::text[]))
    or '*' = any(coalesce(v_permission.managed_asset_codes, '{}'::text[]));
  v_permissions := case when v_managed
    then v_permission.managed_asset_permissions
    else v_permission.other_asset_permissions
  end;
  return coalesce((v_permissions->>p_operation)::boolean, false);
end;
$body$;

create or replace function logistics_core.assert_document_array_permissions(
  p_actor uuid,
  p_asset_code text,
  p_old_rows jsonb,
  p_new_rows jsonb
)
returns void
language plpgsql
stable
security definer
set search_path = pg_catalog, logistics_core
as $body$
declare
  v_old_rows jsonb := case when jsonb_typeof(p_old_rows) = 'array' then p_old_rows else '[]'::jsonb end;
  v_new_rows jsonb := case when jsonb_typeof(p_new_rows) = 'array' then p_new_rows else '[]'::jsonb end;
  v_old_count integer;
  v_new_count integer;
begin
  v_old_count := jsonb_array_length(v_old_rows);
  v_new_count := jsonb_array_length(v_new_rows);
  if v_new_count > v_old_count then
    perform logistics_core.assert_asset_permission(p_actor, p_asset_code, 'create');
  end if;
  if v_new_count < v_old_count then
    perform logistics_core.assert_asset_permission(p_actor, p_asset_code, 'delete');
  end if;
  if v_new_rows is distinct from v_old_rows then
    perform logistics_core.assert_asset_permission(p_actor, p_asset_code, 'update');
  end if;
end;
$body$;

create or replace function logistics_core.assert_fund_permission(
  p_actor uuid,
  p_fund_code text,
  p_operation text
)
returns void
language plpgsql
stable
security definer
set search_path = pg_catalog, logistics_core
as $body$
declare
  v_asset_code text;
  v_count integer := 0;
begin
  for v_asset_code in
    select asset.asset_code
    from logistics_core.assets asset
    where asset.fund_code = p_fund_code
    order by asset.asset_code
  loop
    v_count := v_count + 1;
    perform logistics_core.assert_asset_permission(p_actor, v_asset_code, p_operation);
  end loop;
  if v_count = 0 then
    raise exception using errcode = 'PT404', message = 'FUND_ASSET_NOT_FOUND';
  end if;
end;
$body$;

create or replace function logistics_core.assert_fund_array_permissions(
  p_actor uuid,
  p_fund_code text,
  p_old_rows jsonb,
  p_new_rows jsonb
)
returns void
language plpgsql
stable
security definer
set search_path = pg_catalog, logistics_core
as $body$
declare
  v_old_rows jsonb := case when jsonb_typeof(p_old_rows) = 'array' then p_old_rows else '[]'::jsonb end;
  v_new_rows jsonb := case when jsonb_typeof(p_new_rows) = 'array' then p_new_rows else '[]'::jsonb end;
begin
  if jsonb_array_length(v_new_rows) > jsonb_array_length(v_old_rows) then
    perform logistics_core.assert_fund_permission(p_actor, p_fund_code, 'create');
  end if;
  if jsonb_array_length(v_new_rows) < jsonb_array_length(v_old_rows) then
    perform logistics_core.assert_fund_permission(p_actor, p_fund_code, 'delete');
  end if;
  if v_new_rows is distinct from v_old_rows then
    perform logistics_core.assert_fund_permission(p_actor, p_fund_code, 'update');
  end if;
end;
$body$;

create or replace function logistics_core.assert_asset_permission(
  p_actor uuid,
  p_asset_code text,
  p_operation text
)
returns void
language plpgsql
stable
security definer
set search_path = pg_catalog, logistics_core
as $body$
begin
  if not logistics_core.has_asset_permission(p_actor, p_asset_code, p_operation) then
    raise exception using errcode = 'PT403', message = 'PERMISSION_DENIED';
  end if;
end;
$body$;

create or replace function logistics_core.resolve_asset_code(p_asset_key text)
returns text
language plpgsql
stable
security definer
set search_path = pg_catalog, logistics_core
as $body$
declare
  v_asset_code text;
begin
  select asset.asset_code into v_asset_code
  from logistics_core.assets asset
  where asset.asset_code = nullif(btrim(p_asset_key), '');
  if v_asset_code is null then
    raise exception using errcode = 'PT404', message = 'ASSET_NOT_FOUND';
  end if;
  return v_asset_code;
end;
$body$;

create or replace function logistics_core.primary_response(
  p_request_id uuid,
  p_version text,
  p_data jsonb
)
returns jsonb
language sql
immutable
set search_path = pg_catalog
as $function$
  select jsonb_build_object(
    'ok', true,
    'status', 'primary',
    'request_id', p_request_id,
    'revision', p_version,
    'data', coalesce(p_data, '{}'::jsonb)
  );
$function$;

create or replace function logistics_core.expected_xmin(
  p_payload jsonb,
  p_expected_revisions jsonb,
  p_scope text
)
returns text
language sql
immutable
set search_path = pg_catalog
as $function$
  select coalesce(
    nullif(p_payload->>'expected_xmin', ''),
    nullif(p_expected_revisions->>p_scope, ''),
    nullif(p_expected_revisions->>('document:' || p_scope), ''),
    nullif(p_expected_revisions->>'revision', '')
  );
$function$;

create or replace function logistics_core.assert_expected_xmin(
  p_actual_xmin text,
  p_expected_xmin text
)
returns void
language plpgsql
immutable
set search_path = pg_catalog
as $body$
begin
  if nullif(p_expected_xmin, '') is null then
    raise exception using errcode = 'PT422', message = 'EXPECTED_XMIN_REQUIRED';
  end if;
  if p_actual_xmin is distinct from p_expected_xmin then
    raise exception using errcode = 'PT409', message = 'REVISION_CONFLICT';
  end if;
end;
$body$;

create or replace function logistics_core.is_valid_iso_date(p_value text)
returns boolean
language plpgsql
immutable
set search_path = pg_catalog
as $body$
begin
  if p_value is null or p_value !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then return false; end if;
  return to_char(to_date(p_value, 'YYYY-MM-DD'), 'YYYY-MM-DD') = p_value;
exception when others then
  return false;
end;
$body$;

create or replace function logistics_core.is_valid_month(p_value text)
returns boolean
language plpgsql
immutable
set search_path = pg_catalog
as $body$
begin
  if p_value is null or p_value !~ '^[0-9]{4}-[0-9]{2}$' then return false; end if;
  return to_char(to_date(p_value || '-01', 'YYYY-MM-DD'), 'YYYY-MM') = p_value;
exception when others then
  return false;
end;
$body$;

create or replace function logistics_core.is_finite_json_number(p_value jsonb)
returns boolean
language plpgsql
immutable
set search_path = pg_catalog
as $body$
declare
  v_numeric numeric;
begin
  if jsonb_typeof(p_value) <> 'number' then return false; end if;
  v_numeric := (p_value #>> '{}')::numeric;
  return v_numeric not in ('NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric);
exception when others then
  return false;
end;
$body$;

create or replace function logistics_core.is_valid_percentage(p_value jsonb)
returns boolean
language plpgsql
immutable
set search_path = pg_catalog, logistics_core
as $body$
declare
  v_numeric numeric;
  v_text text;
begin
  if jsonb_typeof(p_value) = 'number' then
    if not logistics_core.is_finite_json_number(p_value) then return false; end if;
    v_numeric := (p_value #>> '{}')::numeric;
  elsif jsonb_typeof(p_value) = 'string' then
    v_text := btrim(p_value #>> '{}');
    if v_text !~ '^[-+]?(?:[0-9]+(?:\.[0-9]+)?|\.[0-9]+)[[:space:]]*%$' then return false; end if;
    v_numeric := replace(v_text, '%', '')::numeric;
  else
    return false;
  end if;
  return v_numeric >= 0 and v_numeric <= 100;
exception when others then
  return false;
end;
$body$;

create or replace function logistics_core.assert_investments_valid(p_rows jsonb)
returns void
language plpgsql
immutable
set search_path = pg_catalog, logistics_core
as $body$
declare
  v_row jsonb;
  v_field text;
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
      if v_row ? v_field and jsonb_typeof(v_row->v_field) <> 'null'
         and (not logistics_core.is_finite_json_number(v_row->v_field)
              or (v_row->>v_field)::numeric < 0) then
        raise exception using errcode = 'PT422', message = 'INVESTMENT_AMOUNT_INVALID';
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
      if v_row ? v_field and jsonb_typeof(v_row->v_field) <> 'null'
         and not logistics_core.is_finite_json_number(v_row->v_field) then
        raise exception using errcode = 'PT422', message = 'LOAN_NUMBER_INVALID';
      end if;
      if v_row ? v_field and jsonb_typeof(v_row->v_field) = 'number'
         and ((v_row->>v_field)::numeric < 0
              or (v_field <> 'committed_amount_krw' and (v_row->>v_field)::numeric > 100)) then
        raise exception using errcode = 'PT422', message = 'LOAN_NUMBER_OUT_OF_RANGE';
      end if;
    end loop;
    foreach v_field in array array['drawdown_date', 'maturity_date'] loop
      if v_row ? v_field and jsonb_typeof(v_row->v_field) <> 'null'
         and (jsonb_typeof(v_row->v_field) <> 'string'
              or not logistics_core.is_valid_iso_date(v_row->>v_field)) then
        raise exception using errcode = 'PT422', message = 'LOAN_DATE_INVALID';
      end if;
    end loop;
    if nullif(v_row->>'drawdown_date', '') is not null
       and nullif(v_row->>'maturity_date', '') is not null
       and (v_row->>'maturity_date')::date < (v_row->>'drawdown_date')::date then
      raise exception using errcode = 'PT422', message = 'LOAN_DATE_RANGE_INVALID';
    end if;
  end loop;
end;
$body$;

create or replace function logistics_core.assert_rent_rows_valid(p_rows jsonb)
returns void
language plpgsql
immutable
set search_path = pg_catalog, logistics_core
as $body$
declare
  v_row jsonb;
  v_period jsonb;
  v_field text;
begin
  if jsonb_typeof(p_rows) <> 'array' then
    raise exception using errcode = 'PT422', message = 'RENT_ROLL_ROWS_ARRAY_REQUIRED';
  end if;
  for v_row in select value from jsonb_array_elements(p_rows) loop
    if jsonb_typeof(v_row) <> 'object' then
      raise exception using errcode = 'PT422', message = 'RENT_ROLL_ROW_OBJECT_REQUIRED';
    end if;

    foreach v_field in array array[
      'occupancy_status', 'tenant_name', 'business_registration_number',
      'temperature_type', 'goods_type', 'floor_label', 'zone_label',
      'subtenant_name', 'free_area_type', 'security_type',
      'renewal_terms', 'termination_terms',
      'restoration_terms', 'notes'
    ] loop
      if v_row ? v_field and jsonb_typeof(v_row->v_field) not in ('string', 'null') then
        raise exception using errcode = 'PT422', message = 'RENT_ROLL_TEXT_INVALID';
      end if;
    end loop;

    foreach v_field in array array[
      'exclusive_area_sqm', 'common_area_sqm', 'leased_area_sqm',
      'deposit_total_krw', 'monthly_rent_total_krw', 'monthly_cam_total_krw',
      'pallet_rack_fee', 'fit_out_months', 'fit_out_amount', 'tenant_improvement_amount',
      'deposit_escalation_interval_months', 'rent_escalation_interval_months',
      'cam_escalation_interval_months'
    ] loop
      if v_row ? v_field and jsonb_typeof(v_row->v_field) <> 'null'
         and not logistics_core.is_finite_json_number(v_row->v_field) then
        raise exception using errcode = 'PT422', message = 'RENT_ROLL_NUMBER_INVALID';
      end if;
      if v_row ? v_field and jsonb_typeof(v_row->v_field) = 'number'
         and (v_row->>v_field)::numeric < 0 then
        raise exception using errcode = 'PT422', message = 'RENT_ROLL_NUMBER_OUT_OF_RANGE';
      end if;
    end loop;

    foreach v_field in array array[
      'security_ratio', 'deposit_escalation_rate', 'rent_escalation_rate',
      'cam_escalation_rate'
    ] loop
      if v_row ? v_field and jsonb_typeof(v_row->v_field) <> 'null'
         and not logistics_core.is_valid_percentage(v_row->v_field) then
        raise exception using errcode = 'PT422', message = 'RENT_ROLL_RATE_INVALID';
      end if;
    end loop;

    foreach v_field in array array['tenant_cost_terms', 'landlord_cost_terms'] loop
      if v_row ? v_field and jsonb_typeof(v_row->v_field) <> 'null' and (
        jsonb_typeof(v_row->v_field) <> 'object'
        or jsonb_typeof(v_row->v_field->'items') <> 'array'
        or exists (
          select 1 from jsonb_array_elements(v_row->v_field->'items') item(value)
          where jsonb_typeof(item.value) <> 'string'
        )
      ) then
        raise exception using errcode = 'PT422', message = 'RENT_ROLL_COST_TERMS_INVALID';
      end if;
    end loop;

    foreach v_field in array array[
      'deposit_escalation_interval_months', 'rent_escalation_interval_months',
      'cam_escalation_interval_months'
    ] loop
      if v_row ? v_field and jsonb_typeof(v_row->v_field) = 'number'
         and trunc((v_row->>v_field)::numeric) <> (v_row->>v_field)::numeric then
        raise exception using errcode = 'PT422', message = 'RENT_ROLL_INTERVAL_INTEGER_REQUIRED';
      end if;
    end loop;

    foreach v_field in array array[
      'signed_date', 'commencement_date', 'expiry_date', 'operation_start_date',
      'fit_out_start_date', 'fit_out_end_date',
      'deposit_escalation_first_date', 'rent_escalation_first_date',
      'cam_escalation_first_date'
    ] loop
      if v_row ? v_field and jsonb_typeof(v_row->v_field) <> 'null'
         and (jsonb_typeof(v_row->v_field) <> 'string'
              or not logistics_core.is_valid_iso_date(v_row->>v_field)) then
        raise exception using errcode = 'PT422', message = 'RENT_ROLL_DATE_INVALID';
      end if;
    end loop;

    if nullif(v_row->>'commencement_date', '') is not null
       and nullif(v_row->>'expiry_date', '') is not null
       and (v_row->>'expiry_date')::date < (v_row->>'commencement_date')::date then
      raise exception using errcode = 'PT422', message = 'RENT_ROLL_CONTRACT_DATE_RANGE_INVALID';
    end if;
    if nullif(v_row->>'fit_out_start_date', '') is not null
       and nullif(v_row->>'fit_out_end_date', '') is not null
       and (v_row->>'fit_out_end_date')::date < (v_row->>'fit_out_start_date')::date then
      raise exception using errcode = 'PT422', message = 'RENT_ROLL_FIT_OUT_DATE_RANGE_INVALID';
    end if;

    if v_row ? 'rent_free_periods' and jsonb_typeof(v_row->'rent_free_periods') <> 'array' then
      raise exception using errcode = 'PT422', message = 'RENT_FREE_PERIODS_ARRAY_REQUIRED';
    end if;
    for v_period in
      select value from jsonb_array_elements(coalesce(v_row->'rent_free_periods', '[]'::jsonb))
    loop
      if jsonb_typeof(v_period) <> 'object' then
        raise exception using errcode = 'PT422', message = 'RENT_FREE_PERIOD_OBJECT_REQUIRED';
      end if;
      foreach v_field in array array['reason', 'notes'] loop
        if v_period ? v_field and jsonb_typeof(v_period->v_field) not in ('string', 'null') then
          raise exception using errcode = 'PT422', message = 'RENT_FREE_PERIOD_TEXT_INVALID';
        end if;
      end loop;
      if (v_period ? 'start_date') <> (v_period ? 'end_date')
         or (v_period ? 'start_date' and (
           jsonb_typeof(v_period->'start_date') <> 'string'
           or jsonb_typeof(v_period->'end_date') <> 'string'
           or not logistics_core.is_valid_iso_date(v_period->>'start_date')
           or not logistics_core.is_valid_iso_date(v_period->>'end_date')
         )) then
        raise exception using errcode = 'PT422', message = 'RENT_FREE_PERIOD_DATE_PAIR_INVALID';
      end if;
      if v_period ? 'months' and (
        jsonb_typeof(v_period->'months') <> 'number'
        or (v_period->>'months')::numeric <= 0
      ) then
        raise exception using errcode = 'PT422', message = 'RENT_FREE_PERIOD_MONTHS_INVALID';
      end if;
      if not (v_period ? 'start_date')
         and not (v_period ? 'months')
         and nullif(btrim(coalesce(v_period->>'reason', '')), '') is null
         and nullif(btrim(coalesce(v_period->>'notes', '')), '') is null then
        raise exception using errcode = 'PT422', message = 'RENT_FREE_PERIOD_EMPTY';
      end if;
      if v_period ? 'start_date'
         and (v_period->>'end_date')::date < (v_period->>'start_date')::date then
        raise exception using errcode = 'PT422', message = 'RENT_FREE_PERIOD_DATE_RANGE_INVALID';
      end if;
    end loop;
  end loop;
end;
$body$;

create or replace function logistics_core.assert_statement_valid(p_statement jsonb)
returns void
language plpgsql
immutable
set search_path = pg_catalog, logistics_core
as $body$
declare
  v_period jsonb;
  v_section text;
  v_row jsonb;
  v_amount record;
begin
  if jsonb_typeof(p_statement) <> 'object' then
    raise exception using errcode = 'PT422', message = 'FINANCE_STATEMENT_OBJECT_REQUIRED';
  end if;
  if jsonb_typeof(p_statement->'periods') <> 'array' then
    raise exception using errcode = 'PT422', message = 'FINANCE_PERIODS_ARRAY_REQUIRED';
  end if;
  for v_period in select value from jsonb_array_elements(p_statement->'periods') loop
    if jsonb_typeof(v_period) <> 'string'
       or not logistics_core.is_valid_month(v_period #>> '{}') then
      raise exception using errcode = 'PT422', message = 'FINANCE_PERIOD_INVALID';
    end if;
  end loop;
  if (select count(*) from jsonb_array_elements(p_statement->'periods'))
     <> (select count(distinct value #>> '{}') from jsonb_array_elements(p_statement->'periods')) then
    raise exception using errcode = 'PT422', message = 'FINANCE_PERIOD_DUPLICATE';
  end if;

  foreach v_section in array array[
    'potential_income', 'income_loss', 'operating_expense', 'below_noi', 'debt_service'
  ] loop
    if jsonb_typeof(p_statement->v_section) <> 'array' then
      raise exception using errcode = 'PT422', message = 'FINANCE_SECTION_ARRAY_REQUIRED';
    end if;
    if exists (
      select 1
      from jsonb_array_elements(p_statement->v_section) item(value)
      group by lower(regexp_replace(btrim(item.value->>'name'), '[[:space:]]+', '', 'g'))
      having count(*) > 1
    ) then
      raise exception using errcode = 'PT422', message = 'FINANCE_VISIBLE_NAME_DUPLICATE';
    end if;
    for v_row in select value from jsonb_array_elements(p_statement->v_section) loop
      if jsonb_typeof(v_row) <> 'object'
         or jsonb_typeof(v_row->'name') <> 'string'
         or nullif(btrim(v_row->>'name'), '') is null then
        raise exception using errcode = 'PT422', message = 'FINANCE_ROW_NAME_REQUIRED';
      end if;
      if jsonb_typeof(v_row->'selected') <> 'boolean' then
        raise exception using errcode = 'PT422', message = 'FINANCE_SELECTED_BOOLEAN_REQUIRED';
      end if;
      if jsonb_typeof(v_row->'amounts') <> 'object' then
        raise exception using errcode = 'PT422', message = 'FINANCE_AMOUNTS_OBJECT_REQUIRED';
      end if;
      for v_amount in select key, value from jsonb_each(v_row->'amounts') loop
        if not logistics_core.is_valid_month(v_amount.key)
           or not (p_statement->'periods' ? v_amount.key)
           or (
             jsonb_typeof(v_amount.value) <> 'null'
             and not logistics_core.is_finite_json_number(v_amount.value)
           ) then
          raise exception using errcode = 'PT422', message = 'FINANCE_AMOUNT_INVALID';
        end if;
      end loop;
    end loop;
  end loop;
end;
$body$;

create or replace function logistics_core.sanitize_investments(p_rows jsonb)
returns jsonb
language sql
immutable
set search_path = pg_catalog
as $function$
  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
    'tranche', item.value->'tranche',
    'beneficiary_name', item.value->'beneficiary_name',
    'agreed_amount_krw', item.value->'agreed_amount_krw',
    'contributed_amount_krw', item.value->'contributed_amount_krw'
  )) order by item.ordinality), '[]'::jsonb)
  from jsonb_array_elements(case when jsonb_typeof(p_rows) = 'array' then p_rows else '[]'::jsonb end)
    with ordinality item(value, ordinality);
$function$;

create or replace function logistics_core.sanitize_loans(p_rows jsonb)
returns jsonb
language sql
immutable
set search_path = pg_catalog
as $function$
  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
    'tranche', item.value->'tranche',
    'lender_name', item.value->'lender_name',
    'committed_amount_krw', item.value->'committed_amount_krw',
    'drawdown_date', item.value->'drawdown_date',
    'maturity_date', item.value->'maturity_date',
    'loan_type', item.value->'loan_type',
    'interest_type', item.value->'interest_type',
    'coupon_rate', item.value->'coupon_rate',
    'all_in_rate', item.value->'all_in_rate',
    'fee_rate', item.value->'fee_rate'
  )) order by item.ordinality), '[]'::jsonb)
  from jsonb_array_elements(case when jsonb_typeof(p_rows) = 'array' then p_rows else '[]'::jsonb end)
    with ordinality item(value, ordinality);
$function$;

create or replace function logistics_core.sanitize_rent_free_periods(p_rows jsonb)
returns jsonb
language sql
immutable
set search_path = pg_catalog
as $function$
  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
    'start_date', item.value->'start_date',
    'end_date', item.value->'end_date',
    'months', item.value->'months',
    'reason', item.value->'reason',
    'notes', item.value->'notes'
  )) order by item.ordinality), '[]'::jsonb)
  from jsonb_array_elements(case when jsonb_typeof(p_rows) = 'array' then p_rows else '[]'::jsonb end)
    with ordinality item(value, ordinality);
$function$;

create or replace function logistics_core.sanitize_cost_terms(p_value jsonb)
returns jsonb
language plpgsql
immutable
set search_path = pg_catalog
as $body$
declare
  v_source jsonb;
  v_items jsonb;
begin
  if p_value is null or jsonb_typeof(p_value) = 'null' then return null; end if;
  v_source := case
    when jsonb_typeof(p_value) = 'array' then p_value
    when jsonb_typeof(p_value) = 'object' and jsonb_typeof(p_value->'items') = 'array'
      then p_value->'items'
    when jsonb_typeof(p_value) = 'object' and jsonb_typeof(p_value->'selected_items') = 'array'
      then p_value->'selected_items'
    when jsonb_typeof(p_value) = 'object' and jsonb_typeof(p_value->'selected') = 'array'
      then p_value->'selected'
    when jsonb_typeof(p_value) = 'object' and jsonb_typeof(p_value->'values') = 'array'
      then p_value->'values'
    when jsonb_typeof(p_value) = 'object' and jsonb_typeof(p_value->'raw_text') = 'string'
      then to_jsonb(regexp_split_to_array(p_value->>'raw_text', E'[\n,]+'))
    when jsonb_typeof(p_value) = 'object' and jsonb_typeof(p_value->'text') = 'string'
      then to_jsonb(regexp_split_to_array(p_value->>'text', E'[\n,]+'))
    when jsonb_typeof(p_value) = 'string'
      then to_jsonb(regexp_split_to_array(p_value #>> '{}', E'[\n,]+'))
    else '[]'::jsonb
  end;
  select coalesce(jsonb_agg(to_jsonb(btrim(item.value #>> '{}')) order by item.ordinality), '[]'::jsonb)
  into v_items
  from jsonb_array_elements(v_source) with ordinality item(value, ordinality)
  where jsonb_typeof(item.value) = 'string' and nullif(btrim(item.value #>> '{}'), '') is not null;
  return jsonb_build_object('items', v_items);
end;
$body$;

create or replace function logistics_core.sanitize_option_term(p_value jsonb)
returns jsonb
language plpgsql
immutable
set search_path = pg_catalog
as $body$
declare
  v_text text;
begin
  if p_value is null or jsonb_typeof(p_value) = 'null' then return null; end if;
  v_text := case
    when jsonb_typeof(p_value) = 'string' then p_value #>> '{}'
    when jsonb_typeof(p_value) = 'object' then coalesce(
      p_value->>'value', p_value->>'text', p_value->>'raw_text',
      p_value->>'label', p_value->>'term'
    )
    when jsonb_typeof(p_value) = 'array' then (
      select string_agg(btrim(item.value #>> '{}'), ', ' order by item.ordinality)
      from jsonb_array_elements(p_value) with ordinality item(value, ordinality)
      where jsonb_typeof(item.value) = 'string'
    )
  end;
  return case when v_text is null then 'null'::jsonb else to_jsonb(btrim(v_text)) end;
end;
$body$;

create or replace function logistics_core.sanitize_rent_rows(p_rows jsonb)
returns jsonb
language sql
stable
set search_path = pg_catalog, logistics_core
as $function$
  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
    'occupancy_status', item.value->'occupancy_status',
    'tenant_name', item.value->'tenant_name',
    'business_registration_number', item.value->'business_registration_number',
    'temperature_type', item.value->'temperature_type',
    'goods_type', item.value->'goods_type',
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
  from jsonb_array_elements(case when jsonb_typeof(p_rows) = 'array' then p_rows else '[]'::jsonb end)
    with ordinality item(value, ordinality);
$function$;

create or replace function logistics_core.project_rent_rows(p_rows jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, logistics_core
as $body$
declare
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
        then round(greatest(v_expiry - current_date, 0)::numeric / 365.25, 2) end,
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

create or replace function logistics_core.sanitize_amounts(p_amounts jsonb)
returns jsonb
language sql
immutable
set search_path = pg_catalog, logistics_core
as $function$
  select coalesce(jsonb_object_agg(amount.key, amount.value order by amount.key), '{}'::jsonb)
  from jsonb_each(case when jsonb_typeof(p_amounts) = 'object' then p_amounts else '{}'::jsonb end) amount
  where logistics_core.is_valid_month(amount.key)
    and (
      jsonb_typeof(amount.value) = 'null'
      or logistics_core.is_finite_json_number(amount.value)
    );
$function$;

create or replace function logistics_core.sanitize_statement_rows(p_rows jsonb)
returns jsonb
language sql
immutable
set search_path = pg_catalog
as $function$
  select coalesce(jsonb_agg(jsonb_build_object(
    'name', item.value->'name',
    'selected', coalesce(item.value->'selected', 'false'::jsonb),
    'amounts', logistics_core.sanitize_amounts(item.value->'amounts')
  ) order by item.ordinality), '[]'::jsonb)
  from jsonb_array_elements(case when jsonb_typeof(p_rows) = 'array' then p_rows else '[]'::jsonb end)
    with ordinality item(value, ordinality);
$function$;

create or replace function logistics_core.sanitize_periods(p_periods jsonb)
returns jsonb
language sql
immutable
set search_path = pg_catalog, logistics_core
as $function$
  select coalesce(jsonb_agg(period.value order by period.value), '[]'::jsonb)
  from (
    select distinct item.value #>> '{}' as value
    from jsonb_array_elements(case when jsonb_typeof(p_periods) = 'array'
      then p_periods else '[]'::jsonb end) item(value)
    where jsonb_typeof(item.value) = 'string'
      and logistics_core.is_valid_month(item.value #>> '{}')
  ) period;
$function$;

create or replace function logistics_core.statement_input_rows(
  p_statement jsonb,
  p_section text
)
returns jsonb
language sql
immutable
set search_path = pg_catalog
as $function$
  select case
    when jsonb_typeof(p_statement->p_section) = 'array' then p_statement->p_section
    else coalesce((
      select item.value->'accounts'
      from jsonb_array_elements(case when jsonb_typeof(p_statement->'sections') = 'array'
        then p_statement->'sections' else '[]'::jsonb end) item(value)
      where item.value->>'section' = p_section
      limit 1
    ), '[]'::jsonb)
  end;
$function$;

create or replace function logistics_core.sanitize_statement(p_statement jsonb)
returns jsonb
language sql
stable
set search_path = pg_catalog, logistics_core
as $function$
  select jsonb_build_object(
    'periods', logistics_core.sanitize_periods(case
      when jsonb_typeof(p_statement->'periods') = 'array' then p_statement->'periods'
      when jsonb_typeof(p_statement->'months') = 'array' then p_statement->'months'
      else '[]'::jsonb
    end),
    'potential_income', logistics_core.sanitize_statement_rows(
      logistics_core.statement_input_rows(p_statement, 'potential_income')
    ),
    'income_loss', logistics_core.sanitize_statement_rows(
      logistics_core.statement_input_rows(p_statement, 'income_loss')
    ),
    'operating_expense', logistics_core.sanitize_statement_rows(
      logistics_core.statement_input_rows(p_statement, 'operating_expense')
    ),
    'below_noi', logistics_core.sanitize_statement_rows(
      logistics_core.statement_input_rows(p_statement, 'below_noi')
    ),
    'debt_service', logistics_core.sanitize_statement_rows(
      logistics_core.statement_input_rows(p_statement, 'debt_service')
    )
  );
$function$;

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
  v_total_area numeric := 0;
  v_denominator numeric;
  v_tenant_count bigint := 0;
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

  select to_jsonb(asset) || jsonb_build_object('revision', asset.xmin::text), asset.xmin::text
  into strict v_asset, v_version
  from logistics_core.assets asset where asset.asset_code = v_asset_code;

  select to_jsonb(fund) || jsonb_build_object('revision', fund.xmin::text),
         fund.investments, fund.loans
  into strict v_fund, v_investments, v_loans
  from logistics_core.funds fund
  where fund.fund_code = v_asset->>'fund_code';

  select document.rows into v_rent_rows
  from logistics_core.rent_roll document where document.asset_code = v_asset_code;
  select
    coalesce(sum(nullif(row_item.value->>'leased_area_sqm', '')::numeric)
      filter (where row_item.value->>'occupancy_status' = 'occupied'), 0),
    coalesce(sum(nullif(row_item.value->>'leased_area_sqm', '')::numeric), 0),
    count(distinct nullif(row_item.value->>'tenant_name', ''))
      filter (where row_item.value->>'occupancy_status' = 'occupied')
  into v_occupied_area, v_total_area, v_tenant_count
  from jsonb_array_elements(coalesce(v_rent_rows, '[]'::jsonb)) row_item(value);

  -- Occupancy is a rent-roll operating-space ratio.  Asset registry areas are
  -- descriptive metadata and must never silently replace this denominator.
  v_denominator := nullif(v_total_area, 0);
  v_occupancy := jsonb_build_object(
    'tenant_count', v_tenant_count,
    'occupied_area_sqm', v_occupied_area,
    'denominator_area_sqm', v_denominator,
    'vacant_area_sqm', case when v_denominator is null then null
      else greatest(v_denominator - v_occupied_area, 0) end,
    'occupancy_rate', case when v_denominator > 0
      then least(100::numeric, round(v_occupied_area / v_denominator * 100, 2)) end
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
    select asset.xmin::text into v_actual
    from logistics_core.assets asset where asset.asset_code = v_asset_code for update;
    v_expected := logistics_core.expected_xmin(p_payload, p_expected_revisions, 'asset');
    perform logistics_core.assert_expected_xmin(v_actual, v_expected);
    update logistics_core.assets asset set
      name = case when v_asset_document ? 'name' then nullif(v_asset_document->>'name', '') else asset.name end,
      address = case when v_asset_document ? 'address' then nullif(v_asset_document->>'address', '') else asset.address end,
      zoning_text = case when v_asset_document ? 'zoning_text' then nullif(v_asset_document->>'zoning_text', '') else asset.zoning_text end,
      land_area_sqm = case when v_asset_document ? 'land_area_sqm' then nullif(v_asset_document->>'land_area_sqm', '')::numeric else asset.land_area_sqm end,
      building_area_sqm = case when v_asset_document ? 'building_area_sqm' then nullif(v_asset_document->>'building_area_sqm', '')::numeric else asset.building_area_sqm end,
      gross_area_sqm = case when v_asset_document ? 'gross_area_sqm' then nullif(v_asset_document->>'gross_area_sqm', '')::numeric else asset.gross_area_sqm end,
      leasable_area_sqm = case when v_asset_document ? 'leasable_area_sqm' then nullif(v_asset_document->>'leasable_area_sqm', '')::numeric else asset.leasable_area_sqm end,
      primary_use = case when v_asset_document ? 'primary_use' then nullif(v_asset_document->>'primary_use', '') else asset.primary_use end,
      building_coverage_ratio = case when v_asset_document ? 'building_coverage_ratio' then nullif(v_asset_document->>'building_coverage_ratio', '')::numeric else asset.building_coverage_ratio end,
      floor_area_ratio = case when v_asset_document ? 'floor_area_ratio' then nullif(v_asset_document->>'floor_area_ratio', '')::numeric else asset.floor_area_ratio end,
      floor_count = case when v_asset_document ? 'floor_count' then nullif(v_asset_document->>'floor_count', '') else asset.floor_count end,
      structure_text = case when v_asset_document ? 'structure_text' then nullif(v_asset_document->>'structure_text', '') else asset.structure_text end,
      parking_count = case when v_asset_document ? 'parking_count' then nullif(v_asset_document->>'parking_count', '')::integer else asset.parking_count end,
      completion_date = case when v_asset_document ? 'completion_date' then nullif(v_asset_document->>'completion_date', '')::date else asset.completion_date end
    where asset.asset_code = v_asset_code;
    v_changed := v_changed + 1;
  end if;

  if jsonb_typeof(v_fund_document) = 'object' then
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
      inception_date = case when v_fund_document ? 'inception_date' then nullif(v_fund_document->>'inception_date', '')::date else fund.inception_date end,
      maturity_date = case when v_fund_document ? 'maturity_date' then nullif(v_fund_document->>'maturity_date', '')::date else fund.maturity_date end,
      ownership_ratio = case when v_fund_document ? 'ownership_ratio' then nullif(v_fund_document->>'ownership_ratio', '')::numeric else fund.ownership_ratio end,
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
begin
  perform logistics_core.assert_asset_permission(v_actor, v_asset_code, 'read');
  select logistics_core.project_rent_rows(document.rows), document.xmin::text
  into strict v_rows, v_version
  from logistics_core.rent_roll document where document.asset_code = v_asset_code;
  return logistics_core.primary_response(
    p_request_id, v_version,
    jsonb_build_object(
      'rows', v_rows,
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
  select document.xmin::text, document.rows into strict v_actual, v_old_rows
  from logistics_core.rent_roll document
  where document.asset_code = v_asset_code for update;
  v_expected := logistics_core.expected_xmin(p_payload, p_expected_revisions, 'rent_roll');
  perform logistics_core.assert_expected_xmin(v_actual, v_expected);
  v_rows := logistics_core.sanitize_rent_rows(p_payload->'rows');
  perform logistics_core.assert_document_array_permissions(
    v_actor, v_asset_code, v_old_rows, v_rows
  );
  update logistics_core.rent_roll document
  set rows = v_rows where document.asset_code = v_asset_code;
  select document.rows, document.xmin::text into strict v_rows, v_version
  from logistics_core.rent_roll document where document.asset_code = v_asset_code;
  if v_rows is distinct from logistics_core.sanitize_rent_rows(p_payload->'rows') then
    raise exception using errcode = 'PT500', message = 'RENT_ROLL_READBACK_MISMATCH';
  end if;
  v_readback := logistics_core.rent_roll_read_entry(
    p_request_id, v_asset_code, '{}'::jsonb, '{}'::jsonb
  );
  return logistics_core.primary_response(
    p_request_id, v_version,
    coalesce(v_readback->'data', '{}'::jsonb) || jsonb_build_object(
      'changed_count', jsonb_array_length(v_rows),
      'rows_readback', 'verified',
      'xmins', jsonb_build_object('rent_roll', v_version)
    )
  );
end;
$body$;

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
  v_actor uuid := logistics_core.request_actor();
  v_asset_code text := logistics_core.resolve_asset_code(p_asset_key);
  v_statement jsonb;
  v_version text;
begin
  perform logistics_core.assert_asset_permission(v_actor, v_asset_code, 'read');
  select logistics_core.sanitize_statement(document.statement), document.xmin::text
  into strict v_statement, v_version
  from logistics_core.income_expense document where document.asset_code = v_asset_code;
  return logistics_core.primary_response(
    p_request_id, v_version,
    jsonb_build_object(
      'statement', v_statement,
      'write_enabled', logistics_core.has_asset_permission(v_actor, v_asset_code, 'update'),
      'derived_subtotals_stored', false
    )
  );
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
  v_actor uuid := logistics_core.request_actor();
  v_asset_code text := logistics_core.resolve_asset_code(p_asset_key);
  v_actual text;
  v_expected text;
  v_old_statement jsonb;
  v_old_rows jsonb;
  v_new_rows jsonb;
  v_statement jsonb;
  v_version text;
  v_readback jsonb;
begin
  perform logistics_core.assert_statement_valid(p_payload->'statement');
  select document.xmin::text, document.statement into strict v_actual, v_old_statement
  from logistics_core.income_expense document
  where document.asset_code = v_asset_code for update;
  v_expected := logistics_core.expected_xmin(p_payload, p_expected_revisions, 'income_expense');
  perform logistics_core.assert_expected_xmin(v_actual, v_expected);
  v_statement := logistics_core.sanitize_statement(p_payload->'statement');
  v_old_rows := coalesce(v_old_statement->'potential_income', '[]'::jsonb)
    || coalesce(v_old_statement->'income_loss', '[]'::jsonb)
    || coalesce(v_old_statement->'operating_expense', '[]'::jsonb)
    || coalesce(v_old_statement->'below_noi', '[]'::jsonb)
    || coalesce(v_old_statement->'debt_service', '[]'::jsonb);
  v_new_rows := coalesce(v_statement->'potential_income', '[]'::jsonb)
    || coalesce(v_statement->'income_loss', '[]'::jsonb)
    || coalesce(v_statement->'operating_expense', '[]'::jsonb)
    || coalesce(v_statement->'below_noi', '[]'::jsonb)
    || coalesce(v_statement->'debt_service', '[]'::jsonb);
  perform logistics_core.assert_document_array_permissions(
    v_actor, v_asset_code, v_old_rows, v_new_rows
  );
  update logistics_core.income_expense document
  set statement = v_statement where document.asset_code = v_asset_code;
  select document.statement, document.xmin::text into strict v_statement, v_version
  from logistics_core.income_expense document where document.asset_code = v_asset_code;
  if v_statement is distinct from logistics_core.sanitize_statement(p_payload->'statement') then
    raise exception using errcode = 'PT500', message = 'FINANCE_READBACK_MISMATCH';
  end if;
  v_readback := logistics_core.finance_read_entry(
    p_request_id, v_asset_code, '{}'::jsonb, '{}'::jsonb
  );
  return logistics_core.primary_response(
    p_request_id, v_version,
    coalesce(v_readback->'data', '{}'::jsonb) || jsonb_build_object(
      'changed_count', 1,
      'readback', 'verified',
      'xmins', jsonb_build_object('income_expense', v_version)
    )
  );
end;
$body$;

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
  v_version text;
  v_fund logistics_core.funds%rowtype;
  v_rows jsonb := '[]'::jsonb;
  v_lease_rows jsonb;
  v_loan_rows jsonb;
begin
  perform logistics_core.assert_asset_permission(v_actor, v_asset_code, 'read');
  select fund.* into strict v_fund
  from logistics_core.assets asset
  join logistics_core.funds fund on fund.fund_code = asset.fund_code
  where asset.asset_code = v_asset_code;
  select document.xmin::text into strict v_version
  from logistics_core.rent_roll document where document.asset_code = v_asset_code;

  select coalesce(jsonb_agg(jsonb_build_object(
    'maturity_type', 'lease',
    'name', coalesce(item.value->'tenant_name', item.value->'floor_label'),
    'maturity_date', item.value->'expiry_date'
  ) order by item.value->>'expiry_date', item.ordinality), '[]'::jsonb)
  into v_lease_rows
  from jsonb_array_elements((select rows from logistics_core.rent_roll where asset_code = v_asset_code))
    with ordinality item(value, ordinality)
  where nullif(item.value->>'expiry_date', '') is not null;

  select coalesce(jsonb_agg(jsonb_build_object(
    'maturity_type', 'loan',
    'name', coalesce(item.value->'tranche', item.value->'lender_name'),
    'maturity_date', item.value->'maturity_date'
  ) order by item.value->>'maturity_date', item.ordinality), '[]'::jsonb)
  into v_loan_rows
  from jsonb_array_elements(v_fund.loans) with ordinality item(value, ordinality)
  where nullif(item.value->>'maturity_date', '') is not null;

  if v_fund.maturity_date is not null then
    v_rows := jsonb_build_array(jsonb_build_object(
      'maturity_type', 'fund', 'name', v_fund.name, 'maturity_date', v_fund.maturity_date
    ));
  end if;
  v_rows := v_rows || v_lease_rows || v_loan_rows;
  return logistics_core.primary_response(
    p_request_id, v_version, jsonb_build_object('maturities', v_rows)
  );
end;
$body$;

create or replace function logistics_core.calculations_explain_entry(
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
  v_version text;
begin
  perform logistics_core.assert_asset_permission(v_actor, v_asset_code, 'read');
  select document.xmin::text into strict v_version
  from logistics_core.income_expense document where document.asset_code = v_asset_code;
  return logistics_core.primary_response(
    p_request_id,
    v_version,
    jsonb_build_object(
      'formula_version', 'LOGISTICS_NOI_SIMPLE_V1',
      'formulas', jsonb_build_array(
        jsonb_build_object('name', '유효총수입', 'expression', '잠재총수입 - 수입손실'),
        jsonb_build_object('name', '순영업소득', 'expression', '유효총수입 - 운영비용'),
        jsonb_build_object('name', '자산 순현금흐름', 'expression', '순영업소득 - NOI 하단 조정'),
        jsonb_build_object('name', '부채상환 후 현금흐름', 'expression', '자산 순현금흐름 - 부채상환')
      ),
      'derived_subtotals_stored', false
    )
  );
end;
$body$;

revoke all on all functions in schema logistics_core from public, anon, authenticated;

-- Recreate the exposed wrappers so their dependencies point to the new core
-- function OIDs rather than the rollback schema's preserved functions.
create or replace function logistics_api.home_read(
  p_request_id uuid, p_asset_key text, p_payload jsonb, p_expected_revisions jsonb
)
returns jsonb language sql security definer set search_path = ''
as $function$
  select logistics_core.home_read_entry(p_request_id, p_asset_key, p_payload, p_expected_revisions);
$function$;

create or replace function logistics_api.home_batch_save(
  p_request_id uuid, p_asset_key text, p_payload jsonb, p_expected_revisions jsonb
)
returns jsonb language sql security definer set search_path = ''
as $function$
  select logistics_core.home_batch_save_entry(p_request_id, p_asset_key, p_payload, p_expected_revisions);
$function$;

create or replace function logistics_api.rent_roll_read(
  p_request_id uuid, p_asset_key text, p_payload jsonb, p_expected_revisions jsonb
)
returns jsonb language sql security definer set search_path = ''
as $function$
  select logistics_core.rent_roll_read_entry(p_request_id, p_asset_key, p_payload, p_expected_revisions);
$function$;

create or replace function logistics_api.rent_roll_batch_save(
  p_request_id uuid, p_asset_key text, p_payload jsonb, p_expected_revisions jsonb
)
returns jsonb language sql security definer set search_path = ''
as $function$
  select logistics_core.rent_roll_batch_save_entry(p_request_id, p_asset_key, p_payload, p_expected_revisions);
$function$;

create or replace function logistics_api.finance_read(
  p_request_id uuid, p_asset_key text, p_payload jsonb, p_expected_revisions jsonb
)
returns jsonb language sql security definer set search_path = ''
as $function$
  select logistics_core.finance_read_entry(p_request_id, p_asset_key, p_payload, p_expected_revisions);
$function$;

create or replace function logistics_api.finance_batch_save(
  p_request_id uuid, p_asset_key text, p_payload jsonb, p_expected_revisions jsonb
)
returns jsonb language sql security definer set search_path = ''
as $function$
  select logistics_core.finance_batch_save_entry(p_request_id, p_asset_key, p_payload, p_expected_revisions);
$function$;

create or replace function logistics_api.maturities_read(
  p_request_id uuid, p_asset_key text, p_payload jsonb, p_expected_revisions jsonb
)
returns jsonb language sql security definer set search_path = ''
as $function$
  select logistics_core.maturities_read_entry(p_request_id, p_asset_key, p_payload, p_expected_revisions);
$function$;

create or replace function logistics_api.calculations_explain(
  p_request_id uuid, p_asset_key text, p_payload jsonb, p_expected_revisions jsonb
)
returns jsonb language sql security definer set search_path = ''
as $function$
  select logistics_core.calculations_explain_entry(p_request_id, p_asset_key, p_payload, p_expected_revisions);
$function$;

revoke all on function logistics_api.home_read(uuid, text, jsonb, jsonb) from public, anon;
revoke all on function logistics_api.home_batch_save(uuid, text, jsonb, jsonb) from public, anon;
revoke all on function logistics_api.rent_roll_read(uuid, text, jsonb, jsonb) from public, anon;
revoke all on function logistics_api.rent_roll_batch_save(uuid, text, jsonb, jsonb) from public, anon;
revoke all on function logistics_api.finance_read(uuid, text, jsonb, jsonb) from public, anon;
revoke all on function logistics_api.finance_batch_save(uuid, text, jsonb, jsonb) from public, anon;
revoke all on function logistics_api.maturities_read(uuid, text, jsonb, jsonb) from public, anon;
revoke all on function logistics_api.calculations_explain(uuid, text, jsonb, jsonb) from public, anon;

grant execute on function logistics_api.home_read(uuid, text, jsonb, jsonb) to authenticated;
grant execute on function logistics_api.home_batch_save(uuid, text, jsonb, jsonb) to authenticated;
grant execute on function logistics_api.rent_roll_read(uuid, text, jsonb, jsonb) to authenticated;
grant execute on function logistics_api.rent_roll_batch_save(uuid, text, jsonb, jsonb) to authenticated;
grant execute on function logistics_api.finance_read(uuid, text, jsonb, jsonb) to authenticated;
grant execute on function logistics_api.finance_batch_save(uuid, text, jsonb, jsonb) to authenticated;
grant execute on function logistics_api.maturities_read(uuid, text, jsonb, jsonb) to authenticated;
grant execute on function logistics_api.calculations_explain(uuid, text, jsonb, jsonb) to authenticated;

-- Rebind the approved three-person login restriction before removing the old
-- core schema.  The durable allowlist remains in the existing permission
-- table's profile payload; no additional application table is introduced.
create or replace function logistics_core.enforce_temporary_login_gate()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $body$
begin
  if lower(btrim(coalesce(new.account_status, ''))) = 'active'
     and lower(coalesce(
       new.profile_payload #>> '{temporary_login_gate_20260806,allowed}',
       'false'
     )) <> 'true' then
    new.account_status := 'disabled';
  end if;
  return new;
end;
$body$;

revoke all on function logistics_core.enforce_temporary_login_gate() from public, anon, authenticated;

drop trigger if exists ll_user_permissions_temporary_login_gate
on public.ll_user_permissions;

create trigger ll_user_permissions_temporary_login_gate
before insert or update of user_id, account_status, profile_payload
on public.ll_user_permissions
for each row
execute function logistics_core.enforce_temporary_login_gate();

update public.ll_user_permissions permission
set
  account_status = case
    when exists (
      select 1
      from pg_temp.simple_core_login_allowlist allowlist
      where allowlist.user_id = permission.user_id
    ) then 'active'
    else 'disabled'
  end,
  profile_payload = jsonb_set(
    coalesce(permission.profile_payload, '{}'::jsonb),
    '{temporary_login_gate_20260806}',
    jsonb_build_object(
      'previous_account_status', coalesce(
        permission.profile_payload #>> '{temporary_login_gate_20260806,previous_account_status}',
        permission.account_status
      ),
      'allowed', exists (
        select 1
        from pg_temp.simple_core_login_allowlist allowlist
        where allowlist.user_id = permission.user_id
      ),
      'applied_at', now(),
      'mode', 'temporary_until_platform_owner_release'
    ),
    true
  ),
  updated_at = now();

do $validate_login_gate_rebind$
declare
  v_trigger_function_schema text;
begin
  if (select count(*) from public.ll_user_permissions where account_status = 'active') <> 3
     or exists (
       select 1
       from public.ll_user_permissions permission
       where permission.account_status = 'active'
         and not exists (
           select 1 from pg_temp.simple_core_login_allowlist allowlist
           where allowlist.user_id = permission.user_id
         )
     )
     or exists (
       select 1
       from pg_temp.simple_core_login_allowlist allowlist
       where not exists (
         select 1 from public.ll_user_permissions permission
         where permission.user_id = allowlist.user_id
           and permission.account_status = 'active'
           and lower(coalesce(
             permission.profile_payload #>> '{temporary_login_gate_20260806,allowed}',
             'false'
           )) = 'true'
       )
     )
     or exists (
       select 1 from public.ll_user_permissions permission
       where lower(coalesce(
         permission.profile_payload #>> '{temporary_login_gate_20260806,allowed}',
         'false'
       )) = 'true'
         and not exists (
           select 1 from pg_temp.simple_core_login_allowlist allowlist
           where allowlist.user_id = permission.user_id
         )
     ) then
    raise exception using errcode = 'PT500', message = 'SIMPLE_CORE_LOGIN_GATE_READBACK_MISMATCH';
  end if;

  select function_namespace.nspname
  into v_trigger_function_schema
  from pg_catalog.pg_trigger trigger
  join pg_catalog.pg_proc function on function.oid = trigger.tgfoid
  join pg_catalog.pg_namespace function_namespace on function_namespace.oid = function.pronamespace
  where trigger.tgrelid = 'public.ll_user_permissions'::regclass
    and trigger.tgname = 'll_user_permissions_temporary_login_gate'
    and not trigger.tgisinternal;

  if v_trigger_function_schema is distinct from 'logistics_core' then
    raise exception using errcode = 'PT500', message = 'SIMPLE_CORE_LOGIN_GATE_TRIGGER_NOT_REBOUND';
  end if;
end;
$validate_login_gate_rebind$;

do $validate_final_contract$
declare
  v_table_count integer;
  v_document record;
  v_row jsonb;
  v_period jsonb;
  v_key text;
begin
  select count(*) into v_table_count
  from pg_catalog.pg_class class
  join pg_catalog.pg_namespace namespace on namespace.oid = class.relnamespace
  where namespace.nspname = 'logistics_core' and class.relkind in ('r', 'p');
  if v_table_count <> 4 then
    raise exception using errcode = 'PT500', message = 'SIMPLE_CORE_FINAL_TABLE_COUNT_MISMATCH';
  end if;
  if (select count(*) from logistics_core.assets) <> (select count(*) from pg_temp.simple_core_assets)
     or (select count(*) from logistics_core.funds) <> (select count(*) from pg_temp.simple_core_funds)
     or (select count(*) from logistics_core.rent_roll) <> (select count(*) from pg_temp.simple_core_rent_roll)
     or (select count(*) from logistics_core.income_expense) <> (select count(*) from pg_temp.simple_core_income_expense) then
    raise exception using errcode = 'PT500', message = 'SIMPLE_CORE_FINAL_ROW_COUNT_MISMATCH';
  end if;
  if exists (
    select 1 from logistics_core.assets final
    join pg_temp.simple_core_assets staged using (asset_code)
    where to_jsonb(final) is distinct from to_jsonb(staged)
  ) or exists (
    select 1 from logistics_core.funds final
    join pg_temp.simple_core_funds staged using (fund_code)
    where to_jsonb(final) is distinct from to_jsonb(staged)
  ) or exists (
    select 1 from logistics_core.rent_roll final
    join pg_temp.simple_core_rent_roll staged using (asset_code)
    where final.rows is distinct from staged.rows
  ) or exists (
    select 1 from logistics_core.income_expense final
    join pg_temp.simple_core_income_expense staged using (asset_code)
    where final.statement is distinct from staged.statement
  ) then
    raise exception using errcode = 'PT500', message = 'SIMPLE_CORE_FINAL_READBACK_MISMATCH';
  end if;

  -- The allowlists below are recursive: a technically-shaped key cannot hide
  -- inside any repeated document, cost term, rent-free period, statement row,
  -- or monthly amounts object.
  for v_document in select * from logistics_core.funds loop
    perform logistics_core.assert_investments_valid(v_document.investments);
    perform logistics_core.assert_loans_valid(v_document.loans);
    for v_row in select value from jsonb_array_elements(v_document.investments) loop
      for v_key in select jsonb_object_keys(v_row) loop
        if v_key <> all(array[
          'tranche', 'beneficiary_name', 'agreed_amount_krw', 'contributed_amount_krw'
        ]::text[]) then
          raise exception using errcode = 'PT500', message = 'SIMPLE_CORE_INVESTMENT_KEY_FORBIDDEN';
        end if;
      end loop;
    end loop;
    for v_row in select value from jsonb_array_elements(v_document.loans) loop
      for v_key in select jsonb_object_keys(v_row) loop
        if v_key <> all(array[
          'tranche', 'lender_name', 'committed_amount_krw', 'drawdown_date',
          'maturity_date', 'loan_type', 'interest_type', 'coupon_rate',
          'all_in_rate', 'fee_rate'
        ]::text[]) then
          raise exception using errcode = 'PT500', message = 'SIMPLE_CORE_LOAN_KEY_FORBIDDEN';
        end if;
      end loop;
    end loop;
  end loop;

  for v_document in select * from logistics_core.rent_roll loop
    perform logistics_core.assert_rent_rows_valid(v_document.rows);
    for v_row in select value from jsonb_array_elements(v_document.rows) loop
      for v_key in select jsonb_object_keys(v_row) loop
        if v_key <> all(array[
          'occupancy_status', 'tenant_name', 'business_registration_number',
          'temperature_type', 'goods_type', 'floor_label', 'zone_label',
          'subtenant_name', 'free_area_type', 'exclusive_area_sqm',
          'common_area_sqm', 'leased_area_sqm', 'signed_date',
          'commencement_date', 'expiry_date', 'operation_start_date',
          'deposit_total_krw', 'security_type', 'security_ratio',
          'monthly_rent_total_krw', 'monthly_cam_total_krw', 'pallet_rack_fee',
          'rent_free_periods', 'fit_out_start_date', 'fit_out_end_date', 'fit_out_months',
          'fit_out_amount', 'tenant_improvement_amount',
          'deposit_escalation_first_date', 'deposit_escalation_interval_months',
          'deposit_escalation_rate', 'rent_escalation_first_date',
          'rent_escalation_interval_months', 'rent_escalation_rate',
          'cam_escalation_first_date', 'cam_escalation_interval_months',
          'cam_escalation_rate', 'tenant_cost_terms', 'landlord_cost_terms',
          'renewal_terms', 'termination_terms', 'restoration_terms', 'notes'
        ]::text[]) then
          raise exception using errcode = 'PT500', message = 'SIMPLE_CORE_RENT_KEY_FORBIDDEN';
        end if;
      end loop;
      foreach v_key in array array['tenant_cost_terms', 'landlord_cost_terms'] loop
        if v_row ? v_key and jsonb_typeof(v_row->v_key) = 'object' and exists (
          select 1 from jsonb_object_keys(v_row->v_key) nested(key) where nested.key <> 'items'
        ) then
          raise exception using errcode = 'PT500', message = 'SIMPLE_CORE_COST_TERM_KEY_FORBIDDEN';
        end if;
      end loop;
      for v_period in
        select value from jsonb_array_elements(coalesce(v_row->'rent_free_periods', '[]'::jsonb))
      loop
        if exists (
          select 1 from jsonb_object_keys(v_period) nested(key)
          where nested.key <> all(array['start_date', 'end_date', 'months', 'reason', 'notes']::text[])
        ) then
          raise exception using errcode = 'PT500', message = 'SIMPLE_CORE_RENT_FREE_KEY_FORBIDDEN';
        end if;
      end loop;
    end loop;
  end loop;

  for v_document in select * from logistics_core.income_expense loop
    perform logistics_core.assert_statement_valid(v_document.statement);
    if exists (
      select 1 from jsonb_object_keys(v_document.statement) root(key)
      where root.key <> all(array[
        'periods', 'potential_income', 'income_loss', 'operating_expense',
        'below_noi', 'debt_service'
      ]::text[])
    ) then
      raise exception using errcode = 'PT500', message = 'SIMPLE_CORE_STATEMENT_KEY_FORBIDDEN';
    end if;
    for v_row in
      select value from jsonb_array_elements(
        v_document.statement->'potential_income'
        || v_document.statement->'income_loss'
        || v_document.statement->'operating_expense'
        || v_document.statement->'below_noi'
        || v_document.statement->'debt_service'
      )
    loop
      if exists (
        select 1 from jsonb_object_keys(v_row) nested(key)
        where nested.key <> all(array['name', 'selected', 'amounts']::text[])
      ) then
        raise exception using errcode = 'PT500', message = 'SIMPLE_CORE_STATEMENT_ROW_KEY_FORBIDDEN';
      end if;
    end loop;
  end loop;
end;
$validate_final_contract$;

-- No object outside the archive may still depend on it.  This must be checked
-- before CASCADE so the cleanup cannot silently remove a public API or trigger.
do $validate_no_archive_external_dependencies$
declare
  v_unexpected text[];
begin
  select array_agg(dependency.description order by dependency.description)
  into v_unexpected
  from (
    select distinct pg_catalog.pg_describe_object(d.classid, d.objid, d.objsubid) as description
    from pg_catalog.pg_depend d
    where d.refobjid in (
      select class.oid
      from pg_catalog.pg_class class
      join pg_catalog.pg_namespace namespace on namespace.oid = class.relnamespace
      where namespace.nspname = 'logistics_core_rollback_20260807'
      union all
      select procedure.oid
      from pg_catalog.pg_proc procedure
      join pg_catalog.pg_namespace namespace on namespace.oid = procedure.pronamespace
      where namespace.nspname = 'logistics_core_rollback_20260807'
    )
      and (
        d.classid = 'pg_proc'::regclass and exists (
          select 1 from pg_catalog.pg_proc dependent
          join pg_catalog.pg_namespace namespace on namespace.oid = dependent.pronamespace
          where dependent.oid = d.objid
            and namespace.nspname <> 'logistics_core_rollback_20260807'
            and namespace.nspname !~ '^pg_'
            and namespace.nspname <> 'information_schema'
        )
        or d.classid = 'pg_trigger'::regclass and exists (
          select 1 from pg_catalog.pg_trigger trigger
          join pg_catalog.pg_class relation on relation.oid = trigger.tgrelid
          join pg_catalog.pg_namespace namespace on namespace.oid = relation.relnamespace
          where trigger.oid = d.objid
            and namespace.nspname <> 'logistics_core_rollback_20260807'
            and namespace.nspname !~ '^pg_'
            and namespace.nspname <> 'information_schema'
        )
        or d.classid = 'pg_class'::regclass and exists (
          select 1 from pg_catalog.pg_class dependent
          join pg_catalog.pg_namespace namespace on namespace.oid = dependent.relnamespace
          where dependent.oid = d.objid
            and namespace.nspname <> 'logistics_core_rollback_20260807'
            and namespace.nspname !~ '^pg_'
            and namespace.nspname <> 'information_schema'
        )
      )
  ) dependency;

  if v_unexpected is not null then
    raise exception using errcode = 'PT500', message = 'SIMPLE_CORE_ARCHIVE_EXTERNAL_DEPENDENCY',
      detail = array_to_string(v_unexpected, E'\n');
  end if;
end;
$validate_no_archive_external_dependencies$;

drop schema logistics_core_rollback_20260807 cascade;

do $validate_post_archive_drop$
declare
  v_wrapper_count integer;
  v_trigger_function_schema text;
begin
  if to_regnamespace('logistics_core_rollback_20260807') is not null then
    raise exception using errcode = 'PT500', message = 'SIMPLE_CORE_ARCHIVE_DROP_FAILED';
  end if;

  if (
    select count(*)
    from pg_catalog.pg_class class
    join pg_catalog.pg_namespace namespace on namespace.oid = class.relnamespace
    where namespace.nspname = 'logistics_core'
      and class.relkind in ('r', 'p')
  ) <> 4 then
    raise exception using errcode = 'PT500', message = 'SIMPLE_CORE_POST_DROP_TABLE_COUNT_MISMATCH';
  end if;

  select count(*) into v_wrapper_count
  from pg_catalog.pg_proc function
  join pg_catalog.pg_namespace namespace on namespace.oid = function.pronamespace
  where namespace.nspname = 'logistics_api'
    and function.proname in (
      'home_read', 'home_batch_save', 'rent_roll_read', 'rent_roll_batch_save',
      'finance_read', 'finance_batch_save', 'maturities_read', 'calculations_explain'
    );
  if v_wrapper_count <> 8 then
    raise exception using errcode = 'PT500', message = 'SIMPLE_CORE_POST_DROP_WRAPPER_MISMATCH';
  end if;

  select function_namespace.nspname
  into v_trigger_function_schema
  from pg_catalog.pg_trigger trigger
  join pg_catalog.pg_proc function on function.oid = trigger.tgfoid
  join pg_catalog.pg_namespace function_namespace on function_namespace.oid = function.pronamespace
  where trigger.tgrelid = 'public.ll_user_permissions'::regclass
    and trigger.tgname = 'll_user_permissions_temporary_login_gate'
    and not trigger.tgisinternal;
  if v_trigger_function_schema is distinct from 'logistics_core' then
    raise exception using errcode = 'PT500', message = 'SIMPLE_CORE_POST_DROP_LOGIN_GATE_MISSING';
  end if;
end;
$validate_post_archive_drop$;

notify pgrst, 'reload schema';

commit;
