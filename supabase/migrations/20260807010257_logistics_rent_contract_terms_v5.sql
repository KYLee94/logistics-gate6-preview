begin;

set local lock_timeout = '5s';
set local statement_timeout = '120s';

-- Contract-level rent-free periods are additive. Existing public.ll_* tables
-- remain untouched and continue to be maintained by the established writer.
create table logistics_core.lease_rent_free_periods (
  id uuid primary key default gen_random_uuid(),
  period_key text not null unique,
  contract_id uuid not null references logistics_core.lease_contracts(id) on delete restrict,
  source_rent_term_id uuid references logistics_core.rent_terms(id) on delete restrict,
  sequence_no integer not null check (sequence_no > 0 and sequence_no <= 120),
  start_date date,
  end_date date,
  months numeric(12, 4),
  reason text,
  notes text,
  original_source_payload jsonb not null,
  current_source_payload jsonb not null,
  provenance text not null,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  revision bigint not null default 1 check (revision > 0),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete set null,
  constraint lease_rent_free_period_dates_check check (
    end_date is null or start_date is null or end_date >= start_date
  ),
  constraint lease_rent_free_period_months_check check (months is null or months >= 0),
  constraint lease_rent_free_period_value_check check (
    start_date is not null or end_date is not null or months is not null
    or nullif(btrim(reason), '') is not null or nullif(btrim(notes), '') is not null
  )
);

create unique index lease_rent_free_periods_contract_sequence_active_idx
  on logistics_core.lease_rent_free_periods(contract_id, sequence_no)
  where deleted_at is null;
create index lease_rent_free_periods_contract_idx
  on logistics_core.lease_rent_free_periods(contract_id, sequence_no, revision)
  where deleted_at is null;

alter table logistics_core.lease_rent_free_periods enable row level security;
revoke all on table logistics_core.lease_rent_free_periods from public, anon, authenticated;

create trigger lease_rent_free_periods_set_updated_revision
before update on logistics_core.lease_rent_free_periods
for each row execute function logistics_core.set_updated_revision();

alter table logistics_core.rent_terms
  add column if not exists fit_out_start_date date,
  add column if not exists fit_out_end_date date;

-- These fields have no verified operating source. They intentionally remain
-- NULL until an authorized user saves them from the home screen.
alter table logistics_core.assets
  add column if not exists zoning_text text,
  add column if not exists building_area_sqm numeric(20, 6),
  add column if not exists primary_use text,
  add column if not exists building_coverage_ratio numeric(12, 8),
  add column if not exists floor_area_ratio numeric(12, 8),
  add column if not exists structure_text text,
  add column if not exists parking_count integer,
  add column if not exists completion_date date;

do $constraint$
begin
  if not exists (
    select 1
    from pg_catalog.pg_constraint constraint_row
    where constraint_row.conrelid = 'logistics_core.rent_terms'::regclass
      and constraint_row.conname = 'rent_terms_fit_out_dates_check'
  ) then
    alter table logistics_core.rent_terms
      add constraint rent_terms_fit_out_dates_check
      check (fit_out_end_date is null or fit_out_start_date is null or fit_out_end_date >= fit_out_start_date);
  end if;
end;
$constraint$;

create or replace function logistics_core.normalize_escalation_rate_percent(raw_value text)
returns text
language plpgsql
immutable
security invoker
set search_path = pg_catalog
as $body$
declare
  v_trimmed text := nullif(btrim(raw_value), '');
  v_has_percent boolean;
  v_numeric_text text;
  v_numeric numeric;
begin
  if v_trimmed is null then return null; end if;
  v_has_percent := right(v_trimmed, 1) = '%';
  v_numeric_text := btrim(case when v_has_percent then left(v_trimmed, -1) else v_trimmed end);
  if v_numeric_text !~ '^(?:[0-9]+(?:[.][0-9]*)?|[.][0-9]+)$' then
    raise exception using errcode = 'PT422', message = 'RATE_NORMALIZATION_EXCEPTION';
  end if;
  v_numeric := v_numeric_text::numeric;
  if not v_has_percent and v_numeric > 0 and v_numeric < 1 then
    v_numeric := v_numeric * 100;
  end if;
  if v_numeric < 0 or v_numeric > 100 then
    raise exception using errcode = 'PT422', message = 'RATE_NORMALIZATION_EXCEPTION';
  end if;
  v_numeric_text := v_numeric::text;
  if position('.' in v_numeric_text) > 0 then
    v_numeric_text := trim(trailing '.' from trim(trailing '0' from v_numeric_text));
  end if;
  return v_numeric_text || '%';
end;
$body$;

create or replace function logistics_core.escalation_rate_provenance(raw_value text)
returns text
language plpgsql
immutable
security invoker
set search_path = pg_catalog
as $body$
declare
  v_trimmed text := nullif(btrim(raw_value), '');
  v_numeric_text text;
  v_numeric numeric;
begin
  if v_trimmed is null then return 'not_provided'; end if;
  if right(v_trimmed, 1) = '%' then
    perform logistics_core.normalize_escalation_rate_percent(v_trimmed);
    return 'explicit_percent';
  end if;
  v_numeric_text := v_trimmed;
  if v_numeric_text !~ '^(?:[0-9]+(?:[.][0-9]*)?|[.][0-9]+)$' then
    raise exception using errcode = 'PT422', message = 'RATE_NORMALIZATION_EXCEPTION';
  end if;
  v_numeric := v_numeric_text::numeric;
  perform logistics_core.normalize_escalation_rate_percent(v_trimmed);
  if v_numeric > 0 and v_numeric < 1 then return 'fraction_to_percent'; end if;
  return 'percent_number';
end;
$body$;

create or replace function logistics_core.normalize_option_term(raw_value text)
returns text
language sql
immutable
security invoker
set search_path = pg_catalog
as $body$
  select case
    when nullif(btrim(raw_value), '') is null then null
    when lower(btrim(raw_value)) in ('n', 'no') or btrim(raw_value) = '없음' then '없음'
    when lower(btrim(raw_value)) in ('y', 'yes') or btrim(raw_value) = '있음' then '있음'
    else btrim(raw_value)
  end;
$body$;

revoke all on function logistics_core.normalize_escalation_rate_percent(text) from public, anon, authenticated;
revoke all on function logistics_core.escalation_rate_provenance(text) from public, anon, authenticated;
revoke all on function logistics_core.normalize_option_term(text) from public, anon, authenticated;

create table logistics_core.rent_escalation_normalization_audit (
  id uuid primary key default gen_random_uuid(),
  rent_term_id uuid not null references logistics_core.rent_terms(id) on delete restrict,
  normalization_version text not null,
  rent_before text,
  rent_after text,
  rent_provenance text not null,
  cam_before text,
  cam_after text,
  cam_provenance text not null,
  source_hash text not null,
  audit_status text not null check (audit_status in ('verified', 'exception')),
  audited_at timestamptz not null default now(),
  unique (rent_term_id, normalization_version)
);

alter table logistics_core.rent_escalation_normalization_audit enable row level security;
revoke all on table logistics_core.rent_escalation_normalization_audit from public, anon, authenticated;

create trigger rent_escalation_normalization_audit_immutable
before update or delete on logistics_core.rent_escalation_normalization_audit
for each row execute function logistics_core.prevent_audit_mutation();

insert into logistics_core.rent_escalation_normalization_audit (
  rent_term_id, normalization_version,
  rent_before, rent_after, rent_provenance,
  cam_before, cam_after, cam_provenance,
  source_hash, audit_status
)
select
  term.id,
  'gate6-percent-v1',
  coalesce(term.rent_escalation_rate, term.rent_escalation_rule->>'rate'),
  logistics_core.normalize_escalation_rate_percent(coalesce(term.rent_escalation_rate, term.rent_escalation_rule->>'rate')),
  logistics_core.escalation_rate_provenance(coalesce(term.rent_escalation_rate, term.rent_escalation_rule->>'rate')),
  coalesce(term.cam_escalation_rate, term.cam_escalation_rule->>'rate'),
  logistics_core.normalize_escalation_rate_percent(coalesce(term.cam_escalation_rate, term.cam_escalation_rule->>'rate')),
  logistics_core.escalation_rate_provenance(coalesce(term.cam_escalation_rate, term.cam_escalation_rule->>'rate')),
  logistics_core.json_sha256(jsonb_build_object(
    'rent_term_id', term.id,
    'rent_rate', coalesce(term.rent_escalation_rate, term.rent_escalation_rule->>'rate'),
    'cam_rate', coalesce(term.cam_escalation_rate, term.cam_escalation_rule->>'rate'),
    'updated_at', term.updated_at
  )),
  'verified'
from logistics_core.rent_terms term
where term.deleted_at is null;

update logistics_core.rent_terms term
set rent_escalation_rate = audit.rent_after,
    rent_escalation_rule = case
      when audit.rent_after is null then term.rent_escalation_rule
      else jsonb_set(coalesce(term.rent_escalation_rule, '{}'::jsonb), '{rate}', to_jsonb(audit.rent_after), true)
    end,
    cam_escalation_rate = audit.cam_after,
    cam_escalation_rule = case
      when audit.cam_after is null then term.cam_escalation_rule
      else jsonb_set(coalesce(term.cam_escalation_rule, '{}'::jsonb), '{rate}', to_jsonb(audit.cam_after), true)
    end
from logistics_core.rent_escalation_normalization_audit audit
where audit.rent_term_id = term.id
  and audit.normalization_version = 'gate6-percent-v1'
  and (
    term.rent_escalation_rate is distinct from audit.rent_after
    or term.cam_escalation_rate is distinct from audit.cam_after
    or term.rent_escalation_rule->>'rate' is distinct from audit.rent_after
    or term.cam_escalation_rule->>'rate' is distinct from audit.cam_after
  );

update logistics_core.lease_contracts contract
set renewal_terms = logistics_core.normalize_option_term(contract.renewal_terms),
    termination_terms = logistics_core.normalize_option_term(contract.termination_terms)
where contract.deleted_at is null
  and (
    contract.renewal_terms is distinct from logistics_core.normalize_option_term(contract.renewal_terms)
    or contract.termination_terms is distinct from logistics_core.normalize_option_term(contract.termination_terms)
  );

do $constraints$
begin
  if not exists (
    select 1 from pg_catalog.pg_constraint constraint_row
    where constraint_row.conrelid = 'logistics_core.lease_contracts'::regclass
      and constraint_row.conname = 'lease_contracts_option_term_normalized_check'
  ) then
    alter table logistics_core.lease_contracts
      add constraint lease_contracts_option_term_normalized_check check (
        coalesce(lower(btrim(renewal_terms)) not in ('n', 'no', 'y', 'yes'), true)
        and coalesce(lower(btrim(termination_terms)) not in ('n', 'no', 'y', 'yes'), true)
      );
  end if;
end;
$constraints$;

do $audit$
declare
  v_active_count bigint;
  v_audit_count bigint;
  v_exception_count bigint;
begin
  select count(*) into v_active_count
  from logistics_core.rent_terms term where term.deleted_at is null;
  select count(*) into v_audit_count
  from logistics_core.rent_escalation_normalization_audit audit
  where audit.normalization_version = 'gate6-percent-v1';
  select count(*) into v_exception_count
  from logistics_core.rent_escalation_normalization_audit audit
  where audit.normalization_version = 'gate6-percent-v1'
    and audit.audit_status <> 'verified';
  if v_active_count <> v_audit_count then
    raise exception using errcode = 'PT500', message = 'RATE_NORMALIZATION_AUDIT_ROW_COUNT_MISMATCH';
  end if;
  if v_exception_count <> 0 then
    raise exception using errcode = 'PT500', message = 'RATE_NORMALIZATION_EXCEPTION';
  end if;
end;
$audit$;

-- Fail before backfill if an existing JSON schedule cannot be represented
-- without guessing. The migration intentionally has no fallback values.
do $rent_free_preflight$
begin
  if exists (
    select 1 from logistics_core.rent_terms term
    where term.deleted_at is null
      and jsonb_typeof(term.rent_free_schedule) <> 'array'
  ) then
    raise exception using errcode = 'PT500', message = 'RENT_FREE_BACKFILL_EXCEPTION';
  end if;
  if exists (
    select 1
    from logistics_core.rent_terms term
    cross join lateral jsonb_array_elements(term.rent_free_schedule) period(value)
    where term.deleted_at is null
      and (
        jsonb_typeof(period.value) <> 'object'
        or (
          nullif(coalesce(period.value->>'start_date', period.value->>'from'), '') is not null
          and coalesce(period.value->>'start_date', period.value->>'from') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
        )
        or (
          nullif(coalesce(period.value->>'end_date', period.value->>'to'), '') is not null
          and coalesce(period.value->>'end_date', period.value->>'to') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
        )
        or (
          nullif(coalesce(period.value->>'months', period.value->>'rent_free_months'), '') is not null
          and coalesce(period.value->>'months', period.value->>'rent_free_months') !~ '^[0-9]+(?:[.][0-9]+)?$'
        )
      )
  ) then
    raise exception using errcode = 'PT500', message = 'RENT_FREE_BACKFILL_EXCEPTION';
  end if;
end;
$rent_free_preflight$;

with schedule_sources as (
  select
    allocation.contract_id,
    term.id as source_rent_term_id,
    term.effective_from_month,
    term.rent_term_key,
    period.ordinality,
    nullif(coalesce(period.value->>'start_date', period.value->>'from'), '')::date as start_date,
    nullif(coalesce(period.value->>'end_date', period.value->>'to'), '')::date as end_date,
    nullif(coalesce(period.value->>'months', period.value->>'rent_free_months'), '')::numeric as months,
    nullif(coalesce(period.value->>'reason', period.value->>'type'), '') as reason,
    nullif(period.value->>'notes', '') as notes,
    period.value as original_source_payload,
    'rent_free_schedule'::text as provenance
  from logistics_core.rent_terms term
  join logistics_core.contract_spaces allocation on allocation.id = term.contract_space_id
  cross join lateral jsonb_array_elements(term.rent_free_schedule) with ordinality period(value, ordinality)
  where term.deleted_at is null
    and allocation.deleted_at is null
), scalar_sources as (
  select
    allocation.contract_id,
    term.id as source_rent_term_id,
    term.effective_from_month,
    term.rent_term_key,
    1::bigint as ordinality,
    term.rent_free_start_date as start_date,
    term.rent_free_end_date as end_date,
    nullif(term.rent_free_months, 0) as months,
    null::text as reason,
    null::text as notes,
    jsonb_build_object(
      'rent_free_start_date', term.rent_free_start_date,
      'rent_free_end_date', term.rent_free_end_date,
      'rent_free_months', term.rent_free_months,
      'rent_term_key', term.rent_term_key
    ) as original_source_payload,
    'rent_term_scalar'::text as provenance
  from logistics_core.rent_terms term
  join logistics_core.contract_spaces allocation on allocation.id = term.contract_space_id
  where term.deleted_at is null
    and allocation.deleted_at is null
    and jsonb_array_length(term.rent_free_schedule) = 0
    and (term.rent_free_start_date is not null or term.rent_free_end_date is not null or term.rent_free_months > 0)
), numbered as (
  select source_row.*,
    row_number() over (
      partition by source_row.contract_id
      order by source_row.effective_from_month nulls first, source_row.rent_term_key, source_row.ordinality
    ) as sequence_no
  from (
    select * from schedule_sources
    union all
    select * from scalar_sources
  ) source_row
)
insert into logistics_core.lease_rent_free_periods (
  period_key, contract_id, source_rent_term_id, sequence_no,
  start_date, end_date, months, reason, notes,
  original_source_payload, current_source_payload, provenance
)
select
  'rfp-' || encode(extensions.digest(convert_to(
    numbered.contract_id::text || '|' || numbered.source_rent_term_id::text || '|' || numbered.ordinality::text,
    'UTF8'
  ), 'sha256'), 'hex'),
  numbered.contract_id,
  numbered.source_rent_term_id,
  numbered.sequence_no,
  numbered.start_date,
  numbered.end_date,
  numbered.months,
  numbered.reason,
  numbered.notes,
  numbered.original_source_payload,
  jsonb_strip_nulls(jsonb_build_object(
    'start_date', numbered.start_date,
    'end_date', numbered.end_date,
    'months', numbered.months,
    'reason', numbered.reason,
    'notes', numbered.notes
  )),
  numbered.provenance
from numbered;

do $rent_free_readback$
begin
  if exists (
    select 1
    from logistics_core.lease_rent_free_periods period
    where period.deleted_at is null
      and (period.sequence_no > 120 or period.end_date < period.start_date or period.months < 0)
  ) then
    raise exception using errcode = 'PT500', message = 'RENT_FREE_BACKFILL_EXCEPTION';
  end if;
end;
$rent_free_readback$;

do $home_rename$
begin
  if to_regprocedure('logistics_core.home_read_entry_v5(uuid,text,jsonb,jsonb)') is null then
    execute 'alter function logistics_core.home_read_entry(uuid, text, jsonb, jsonb) rename to home_read_entry_v5';
  end if;
  if to_regprocedure('logistics_core.home_batch_save_entry_v5(uuid,text,jsonb,jsonb)') is null then
    execute 'alter function logistics_core.home_batch_save_entry(uuid, text, jsonb, jsonb) rename to home_batch_save_entry_v5';
  end if;
end;
$home_rename$;

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
  v_base_response jsonb;
  v_asset_overview jsonb;
  v_asset_id uuid;
begin
  -- v5 owns request authentication, asset scope and read permission checks.
  v_base_response := logistics_core.home_read_entry_v5(
    p_request_id, p_asset_key, p_payload, p_expected_revisions
  );
  if nullif(btrim(p_asset_key), '') is null then return v_base_response; end if;
  v_asset_id := logistics_core.resolve_asset_id(p_asset_key);

  select jsonb_build_object(
    'zoning_text', asset.zoning_text,
    'building_area_sqm', asset.building_area_sqm,
    'primary_use', asset.primary_use,
    'building_coverage_ratio', asset.building_coverage_ratio,
    'floor_area_ratio', asset.floor_area_ratio,
    'structure_text', asset.structure_text,
    'parking_count', asset.parking_count,
    'completion_date', asset.completion_date
  )
  into v_asset_overview
  from logistics_core.assets asset
  where asset.id = v_asset_id and asset.deleted_at is null;

  if v_asset_overview is null then
    raise exception using errcode = 'PT500', message = 'HOME_ASSET_OVERVIEW_READBACK_MISMATCH';
  end if;
  return jsonb_set(
    v_base_response,
    '{data,asset}',
    coalesce(v_base_response #> '{data,asset}', '{}'::jsonb) || v_asset_overview,
    true
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
set search_path = pg_catalog, logistics_core, public
as $body$
declare
  v_actor_id uuid := logistics_core.request_actor();
  v_asset_id uuid := logistics_core.resolve_asset_id(p_asset_key);
  v_asset_key text;
  v_public_key text;
  v_existing_operations jsonb := '[]'::jsonb;
  v_overview_operations jsonb := '[]'::jsonb;
  v_transformed_payload jsonb;
  v_operation jsonb;
  v_field_name text;
  v_request_digest text;
  v_existing_request logistics_core.api_idempotency_keys%rowtype;
  v_base_response jsonb;
  v_final_response jsonb;
  v_before_row jsonb;
  v_after_row jsonb;
  v_current_revision bigint;
  v_expected_revision bigint;
  v_asset_revision_checked boolean := false;
  v_changed_count integer := 0;
begin
  perform logistics_core.assert_v2_writer_route(v_asset_id);
  if jsonb_typeof(p_payload->'operations') <> 'array' then
    raise exception using errcode = 'PT422', message = 'HOME_OPERATIONS_ARRAY_REQUIRED';
  end if;

  select asset.asset_key, asset.public_key, asset.revision
  into v_asset_key, v_public_key, v_current_revision
  from logistics_core.assets asset
  where asset.id = v_asset_id and asset.deleted_at is null;

  for v_operation in select value from jsonb_array_elements(p_payload->'operations') loop
    if v_operation->>'entity' = 'asset'
       and v_operation->>'field' = any(array[
         'zoning_text', 'building_area_sqm', 'primary_use', 'building_coverage_ratio',
         'floor_area_ratio', 'structure_text', 'parking_count', 'completion_date'
       ]) then
      v_overview_operations := v_overview_operations || jsonb_build_array(v_operation);
    else
      v_existing_operations := v_existing_operations || jsonb_build_array(v_operation);
      if v_operation->>'entity' = 'asset' and v_operation->>'entity_key' = v_asset_key then
        v_asset_revision_checked := true;
      end if;
    end if;
  end loop;
  if jsonb_array_length(v_overview_operations) > 0 then
    perform logistics_core.assert_asset_permission(v_actor_id, v_asset_id, 'update');
  end if;

  v_transformed_payload := jsonb_set(p_payload, '{operations}', v_existing_operations, true)
    || jsonb_build_object('asset_overview_operations', v_overview_operations);
  v_request_digest := logistics_core.request_hash(
    'v2/home/batch-save', p_asset_key, v_transformed_payload, p_expected_revisions
  );
  select request.* into v_existing_request
  from logistics_core.api_idempotency_keys request
  where request.actor_user_id = v_actor_id
    and request.action = 'v2/home/batch-save'
    and request.client_request_id = p_request_id
  for update;
  if v_existing_request.id is not null then
    if v_existing_request.request_hash <> v_request_digest then
      raise exception using errcode = 'PT409', message = 'IDEMPOTENCY_CONFLICT';
    end if;
    if v_existing_request.status = 'completed' and v_existing_request.response is not null then
      return v_existing_request.response;
    end if;
    raise exception using errcode = 'PT409', message = 'IDEMPOTENT_REQUEST_IN_PROGRESS';
  end if;

  v_base_response := logistics_core.home_batch_save_entry_v5(
    p_request_id, p_asset_key, v_transformed_payload, p_expected_revisions
  );
  select asset.asset_key, asset.public_key, asset.revision
  into v_asset_key, v_public_key, v_current_revision
  from logistics_core.assets asset
  where asset.id = v_asset_id and asset.deleted_at is null
  for update;

  for v_operation in select value from jsonb_array_elements(v_overview_operations) loop
    if not (v_operation ? 'value')
       or nullif(v_operation->>'entity_key', '') is null
       or v_operation->>'entity_key' <> v_asset_key then
      raise exception using errcode = 'PT422', message = 'INVALID_HOME_OPERATION';
    end if;
    v_field_name := v_operation->>'field';
    if not v_asset_revision_checked then
      v_expected_revision := coalesce(
        nullif(v_operation->>'expected_revision', '')::bigint,
        nullif(p_expected_revisions->>('asset:' || v_asset_key), '')::bigint,
        nullif(p_expected_revisions->>v_asset_key, '')::bigint
      );
      if v_expected_revision is not null and v_expected_revision <> v_current_revision then
        raise exception using errcode = 'PT409', message = 'REVISION_CONFLICT';
      end if;
      v_asset_revision_checked := true;
    end if;

    select to_jsonb(asset) into v_before_row
    from logistics_core.assets asset where asset.id = v_asset_id;
    perform logistics_core.set_core_field(
      'logistics_core.assets'::regclass,
      v_asset_id,
      v_field_name,
      v_operation->>'value',
      v_actor_id
    );
    select to_jsonb(asset), asset.revision into v_after_row, v_current_revision
    from logistics_core.assets asset where asset.id = v_asset_id;

    update public.ll_assets legacy
    set source_payload = jsonb_set(
          jsonb_set(
            coalesce(legacy.source_payload, '{}'::jsonb),
            '{data_platform_overrides}',
            coalesce(legacy.source_payload->'data_platform_overrides', '{}'::jsonb)
              || jsonb_build_object(v_field_name, v_operation->'value'),
            true
          ),
          '{data_platform_metadata}',
          coalesce(legacy.source_payload->'data_platform_metadata', '{}'::jsonb)
            || jsonb_build_object(
              'request_id', p_request_id,
              'updated_by', v_actor_id,
              'updated_at', now()
            ),
          true
        ),
        updated_at = now()
    where legacy.asset_id = v_public_key;
    if not found then
      raise exception using errcode = 'PT500', message = 'HOME_ASSET_OVERVIEW_READBACK_MISMATCH';
    end if;
    if not exists (
      select 1 from public.ll_assets legacy
      where legacy.asset_id = v_public_key
        and legacy.source_payload #> array['data_platform_overrides', v_field_name]
          is not distinct from v_operation->'value'
    ) then
      raise exception using errcode = 'PT500', message = 'HOME_ASSET_OVERVIEW_READBACK_MISMATCH';
    end if;

    insert into logistics_core.audit_events (
      actor_user_id, action, entity_type, entity_id, asset_id, entity_revision,
      before_hash, after_hash, change_payload, reason, client_request_id,
      mapping_version, correlation_id
    ) values (
      v_actor_id, 'update', 'asset', v_asset_id, v_asset_id, v_current_revision,
      logistics_core.json_sha256(v_before_row), logistics_core.json_sha256(v_after_row),
      jsonb_build_object('field', v_field_name, 'legacy_projection', 'data_platform_overrides'),
      coalesce(nullif(v_operation->>'reason', ''), '홈 자산 개요 직접 수정'),
      p_request_id, 'gate6-data-platform-5', p_request_id
    );
    v_changed_count := v_changed_count + 1;
  end loop;

  v_final_response := jsonb_set(
    v_base_response,
    '{data,changed_count}',
    to_jsonb(coalesce((v_base_response #>> '{data,changed_count}')::integer, 0) + v_changed_count),
    true
  );
  v_final_response := jsonb_set(v_final_response, '{revision}', to_jsonb(v_current_revision), true);
  v_final_response := jsonb_set(v_final_response, '{data,asset_overview_readback}', '"verified"'::jsonb, true);
  update logistics_core.api_idempotency_keys request
  set response = v_final_response, completed_at = now()
  where request.actor_user_id = v_actor_id
    and request.action = 'v2/home/batch-save'
    and request.client_request_id = p_request_id
    and request.status = 'completed';
  if not found then
    raise exception using errcode = 'PT500', message = 'HOME_ASSET_OVERVIEW_READBACK_MISMATCH';
  end if;
  return v_final_response;
end;
$body$;

revoke all on function logistics_core.home_read_entry_v5(uuid, text, jsonb, jsonb)
  from public, anon, authenticated;
revoke all on function logistics_core.home_batch_save_entry_v5(uuid, text, jsonb, jsonb)
  from public, anon, authenticated;
revoke all on function logistics_core.home_read_entry(uuid, text, jsonb, jsonb)
  from public, anon, authenticated;
revoke all on function logistics_core.home_batch_save_entry(uuid, text, jsonb, jsonb)
  from public, anon, authenticated;

do $rename$
begin
  if to_regprocedure('logistics_core.rent_roll_read_entry_v5(uuid,text,jsonb,jsonb)') is null then
    execute 'alter function logistics_core.rent_roll_read_entry(uuid, text, jsonb, jsonb) rename to rent_roll_read_entry_v5';
  end if;
  if to_regprocedure('logistics_core.rent_roll_batch_save_entry_v5(uuid,text,jsonb,jsonb)') is null then
    execute 'alter function logistics_core.rent_roll_batch_save_entry(uuid, text, jsonb, jsonb) rename to rent_roll_batch_save_entry_v5';
  end if;
end;
$rename$;

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
  v_base_response jsonb;
  v_rows jsonb;
begin
  -- v5 performs request_actor(), asset resolution and read permission checks.
  v_base_response := logistics_core.rent_roll_read_entry_v5(
    p_request_id, p_asset_key, p_payload, p_expected_revisions
  );

  select coalesce(jsonb_agg(
    row_item.value || jsonb_build_object(
      'rent_free_periods', coalesce(periods.rows, '[]'::jsonb),
      'fit_out_start_date', term.fit_out_start_date,
      'fit_out_end_date', term.fit_out_end_date,
      'rent_escalation_rate', logistics_core.normalize_escalation_rate_percent(
        coalesce(term.rent_escalation_rate, term.rent_escalation_rule->>'rate')
      ),
      'cam_escalation_rate', logistics_core.normalize_escalation_rate_percent(
        coalesce(term.cam_escalation_rate, term.cam_escalation_rule->>'rate')
      ),
      'renewal_terms', logistics_core.normalize_option_term(contract.renewal_terms),
      'termination_terms', logistics_core.normalize_option_term(contract.termination_terms)
    ) order by row_item.ordinality
  ), '[]'::jsonb)
  into v_rows
  from jsonb_array_elements(coalesce(v_base_response #> '{data,rows}', '[]'::jsonb))
    with ordinality row_item(value, ordinality)
  left join logistics_core.lease_contracts contract
    on contract.contract_key = row_item.value->>'contract_key'
   and contract.deleted_at is null
  left join logistics_core.rent_terms term
    on term.rent_term_key = row_item.value->>'rent_term_key'
   and term.deleted_at is null
  left join lateral (
    select jsonb_agg(jsonb_build_object(
      'period_key', period.period_key,
      'start_date', period.start_date,
      'end_date', period.end_date,
      'months', period.months,
      'reason', period.reason,
      'notes', period.notes,
      'original_source_payload', period.original_source_payload,
      'provenance', period.provenance,
      'revision', period.revision
    ) order by period.sequence_no) as rows
    from logistics_core.lease_rent_free_periods period
    where period.contract_id = contract.id and period.deleted_at is null
  ) periods on true;

  return jsonb_set(v_base_response, '{data,rows}', v_rows, true);
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
set search_path = pg_catalog, logistics_core, extensions
as $body$
declare
  v_actor_id uuid := logistics_core.request_actor();
  v_asset_id uuid := logistics_core.resolve_asset_id(p_asset_key);
  v_transformed_payload jsonb := p_payload;
  v_row jsonb;
  v_period jsonb;
  v_row_index integer := 0;
  v_period_ordinality integer;
  v_operation text;
  v_contract_id uuid;
  v_term_id uuid;
  v_period_key text;
  v_request_digest text;
  v_existing_request logistics_core.api_idempotency_keys%rowtype;
  v_base_response jsonb;
  v_final_response jsonb;
  v_latest_revision bigint;
  v_active_period_count integer;
  v_contract_terms_revision bigint;
  v_before_contract_terms jsonb;
  v_after_contract_terms jsonb;
begin
  perform logistics_core.assert_v2_writer_route(v_asset_id);
  if p_payload ? 'rows' and jsonb_typeof(p_payload->'rows') <> 'array' then
    raise exception using errcode = 'PT422', message = 'ROWS_ARRAY_REQUIRED';
  end if;

  if jsonb_typeof(p_payload->'rows') = 'array' then
    for v_row in select value from jsonb_array_elements(p_payload->'rows') loop
      if v_row ? 'rent_escalation_rate' then
        v_row := jsonb_set(v_row, '{rent_escalation_rate}', coalesce(
          to_jsonb(logistics_core.normalize_escalation_rate_percent(v_row->>'rent_escalation_rate')),
          'null'::jsonb
        ), true);
      end if;
      if v_row ? 'cam_escalation_rate' then
        v_row := jsonb_set(v_row, '{cam_escalation_rate}', coalesce(
          to_jsonb(logistics_core.normalize_escalation_rate_percent(v_row->>'cam_escalation_rate')),
          'null'::jsonb
        ), true);
      end if;
      if v_row ? 'renewal_terms' then
        v_row := jsonb_set(v_row, '{renewal_terms}', coalesce(
          to_jsonb(logistics_core.normalize_option_term(v_row->>'renewal_terms')),
          'null'::jsonb
        ), true);
      end if;
      if v_row ? 'termination_terms' then
        v_row := jsonb_set(v_row, '{termination_terms}', coalesce(
          to_jsonb(logistics_core.normalize_option_term(v_row->>'termination_terms')),
          'null'::jsonb
        ), true);
      end if;
      if v_row ? 'fit_out_start_date'
         and nullif(v_row->>'fit_out_start_date', '') is not null
         and v_row->>'fit_out_start_date' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
        raise exception using errcode = 'PT422', message = 'FIT_OUT_DATE_INVALID';
      end if;
      if v_row ? 'fit_out_end_date'
         and nullif(v_row->>'fit_out_end_date', '') is not null
         and v_row->>'fit_out_end_date' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
        raise exception using errcode = 'PT422', message = 'FIT_OUT_DATE_INVALID';
      end if;
      if nullif(v_row->>'fit_out_start_date', '')::date is not null
         and nullif(v_row->>'fit_out_end_date', '')::date is not null
         and (v_row->>'fit_out_end_date')::date < (v_row->>'fit_out_start_date')::date then
        raise exception using errcode = 'PT422', message = 'FIT_OUT_DATE_RANGE_INVALID';
      end if;
      if v_row ? 'rent_free_periods' then
        if jsonb_typeof(v_row->'rent_free_periods') <> 'array' then
          raise exception using errcode = 'PT422', message = 'RENT_FREE_PERIODS_ARRAY_REQUIRED';
        end if;
        if jsonb_array_length(v_row->'rent_free_periods') > 120 then
          raise exception using errcode = 'PT422', message = 'RENT_FREE_PERIOD_LIMIT_EXCEEDED';
        end if;
        if exists (
          select 1 from jsonb_array_elements(v_row->'rent_free_periods') item(value)
          where jsonb_typeof(item.value) <> 'object'
            or (
              nullif(item.value->>'start_date', '') is null
              and nullif(item.value->>'end_date', '') is null
              and nullif(item.value->>'months', '') is null
              and nullif(btrim(item.value->>'reason'), '') is null
              and nullif(btrim(item.value->>'notes'), '') is null
            )
            or (
              nullif(item.value->>'start_date', '') is not null
              and item.value->>'start_date' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
            )
            or (
              nullif(item.value->>'end_date', '') is not null
              and item.value->>'end_date' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
            )
            or (
              nullif(item.value->>'months', '') is not null
              and item.value->>'months' !~ '^[0-9]+(?:[.][0-9]+)?$'
            )
        ) then
          raise exception using errcode = 'PT422', message = 'INVALID_RENT_FREE_PERIOD';
        end if;
        v_row := jsonb_set(v_row, '{rent_free_schedule}', v_row->'rent_free_periods', true);
      end if;
      v_transformed_payload := jsonb_set(
        v_transformed_payload, array['rows', v_row_index::text], v_row, true
      );
      v_row_index := v_row_index + 1;
    end loop;
  end if;

  if exists (
    select 1
    from jsonb_array_elements(coalesce(v_transformed_payload->'rows', '[]'::jsonb)) row_item(value)
    where row_item.value ? 'rent_free_periods'
      and nullif(row_item.value->>'contract_key', '') is not null
    group by row_item.value->>'contract_key'
    having count(distinct row_item.value->'rent_free_periods') > 1
  ) then
    raise exception using errcode = 'PT422', message = 'CONFLICTING_CONTRACT_RENT_FREE_PERIODS';
  end if;

  v_request_digest := logistics_core.request_hash(
    'v2/rent-roll/batch-save', p_asset_key, v_transformed_payload, p_expected_revisions
  );
  select request.* into v_existing_request
  from logistics_core.api_idempotency_keys request
  where request.actor_user_id = v_actor_id
    and request.action = 'v2/rent-roll/batch-save'
    and request.client_request_id = p_request_id
  for update;
  if v_existing_request.id is not null then
    if v_existing_request.request_hash <> v_request_digest then
      raise exception using errcode = 'PT409', message = 'IDEMPOTENCY_CONFLICT';
    end if;
    if v_existing_request.status = 'completed' and v_existing_request.response is not null then
      return v_existing_request.response;
    end if;
    raise exception using errcode = 'PT409', message = 'IDEMPOTENT_REQUEST_IN_PROGRESS';
  end if;

  -- v5 owns authentication, exact per-row permission checks, locking,
  -- revision checks, legacy projection and the first idempotency completion.
  v_base_response := logistics_core.rent_roll_batch_save_entry_v5(
    p_request_id, p_asset_key, v_transformed_payload, p_expected_revisions
  );

  if jsonb_typeof(v_transformed_payload->'rows') = 'array' then
    for v_row in select value from jsonb_array_elements(v_transformed_payload->'rows') loop
      v_operation := coalesce(nullif(v_row->>'operation', ''), 'update');
      if v_operation <> 'delete'
         and coalesce(nullif(v_row->>'occupancy_status', ''), 'occupied') <> 'vacant' then
        select contract.id, term.id
        into v_contract_id, v_term_id
        from logistics_core.lease_contracts contract
        join logistics_core.contract_spaces allocation on allocation.contract_id = contract.id
        join logistics_core.rent_terms term on term.contract_space_id = allocation.id
        where contract.asset_id = v_asset_id
          and contract.contract_key = v_row->>'contract_key'
          and term.rent_term_key = v_row->>'rent_term_key'
          and contract.deleted_at is null
          and allocation.deleted_at is null
          and term.deleted_at is null;
        if v_contract_id is null or v_term_id is null then
          raise exception using errcode = 'PT500', message = 'READBACK_MISMATCH';
        end if;

        select jsonb_build_object(
          'fit_out_start_date', term.fit_out_start_date,
          'fit_out_end_date', term.fit_out_end_date,
          'rent_free_periods', coalesce((
            select jsonb_agg(to_jsonb(period) order by period.sequence_no)
            from logistics_core.lease_rent_free_periods period
            where period.contract_id = v_contract_id and period.deleted_at is null
          ), '[]'::jsonb)
        )
        into v_before_contract_terms
        from logistics_core.rent_terms term
        where term.id = v_term_id;

        if v_row ? 'fit_out_start_date' or v_row ? 'fit_out_end_date' then
          update logistics_core.rent_terms term
          set fit_out_start_date = case when v_row ? 'fit_out_start_date' then nullif(v_row->>'fit_out_start_date', '')::date else term.fit_out_start_date end,
              fit_out_end_date = case when v_row ? 'fit_out_end_date' then nullif(v_row->>'fit_out_end_date', '')::date else term.fit_out_end_date end,
              updated_by = v_actor_id
          where term.id = v_term_id;
        end if;

        if v_row ? 'rent_free_periods' then
          update logistics_core.lease_rent_free_periods period
          set deleted_at = now(), deleted_by = v_actor_id, updated_by = v_actor_id
          where period.contract_id = v_contract_id and period.deleted_at is null;

          v_period_ordinality := 0;
          for v_period in select value from jsonb_array_elements(v_row->'rent_free_periods') loop
            v_period_ordinality := v_period_ordinality + 1;
            select period.period_key into v_period_key
            from logistics_core.lease_rent_free_periods period
            where period.contract_id = v_contract_id
              and period.sequence_no = v_period_ordinality
            order by period.updated_at desc, period.created_at desc
            limit 1;
            v_period_key := coalesce(
              nullif(v_period->>'period_key', ''),
              v_period_key,
              'rfp-' || encode(extensions.digest(convert_to(
                v_contract_id::text || '|' || p_request_id::text || '|' || v_period_ordinality::text,
                'UTF8'
              ), 'sha256'), 'hex')
            );
            insert into logistics_core.lease_rent_free_periods (
              period_key, contract_id, source_rent_term_id, sequence_no,
              start_date, end_date, months, reason, notes,
              original_source_payload, current_source_payload, provenance,
              created_by, updated_by, deleted_at, deleted_by
            ) values (
              v_period_key, v_contract_id, v_term_id, v_period_ordinality,
              nullif(v_period->>'start_date', '')::date,
              nullif(v_period->>'end_date', '')::date,
              nullif(v_period->>'months', '')::numeric,
              nullif(btrim(v_period->>'reason'), ''),
              nullif(btrim(v_period->>'notes'), ''),
              v_period,
              v_period,
              'v2_direct_input',
              v_actor_id,
              v_actor_id,
              null,
              null
            ) on conflict (period_key) do update set
              contract_id = excluded.contract_id,
              source_rent_term_id = excluded.source_rent_term_id,
              sequence_no = excluded.sequence_no,
              start_date = excluded.start_date,
              end_date = excluded.end_date,
              months = excluded.months,
              reason = excluded.reason,
              notes = excluded.notes,
              current_source_payload = excluded.current_source_payload,
              provenance = excluded.provenance,
              updated_by = excluded.updated_by,
              deleted_at = null,
              deleted_by = null;
          end loop;

          select count(*) into v_active_period_count
          from logistics_core.lease_rent_free_periods period
          where period.contract_id = v_contract_id and period.deleted_at is null;
          if v_active_period_count <> jsonb_array_length(v_row->'rent_free_periods') then
            raise exception using errcode = 'PT500', message = 'READBACK_MISMATCH';
          end if;
        end if;

        if exists (
          select 1 from logistics_core.rent_terms term
          where term.id = v_term_id
            and (
              (v_row ? 'fit_out_start_date' and term.fit_out_start_date is distinct from nullif(v_row->>'fit_out_start_date', '')::date)
              or (v_row ? 'fit_out_end_date' and term.fit_out_end_date is distinct from nullif(v_row->>'fit_out_end_date', '')::date)
            )
        ) then
          raise exception using errcode = 'PT500', message = 'READBACK_MISMATCH';
        end if;

        if v_row ? 'rent_free_periods'
           or v_row ? 'fit_out_start_date'
           or v_row ? 'fit_out_end_date' then
          select jsonb_build_object(
            'fit_out_start_date', term.fit_out_start_date,
            'fit_out_end_date', term.fit_out_end_date,
            'rent_free_periods', coalesce((
              select jsonb_agg(to_jsonb(period) order by period.sequence_no)
              from logistics_core.lease_rent_free_periods period
              where period.contract_id = v_contract_id and period.deleted_at is null
            ), '[]'::jsonb)
          ), greatest(
            term.revision,
            coalesce((
              select max(period.revision)
              from logistics_core.lease_rent_free_periods period
              where period.contract_id = v_contract_id
            ), 0)
          )
          into v_after_contract_terms, v_contract_terms_revision
          from logistics_core.rent_terms term
          where term.id = v_term_id;

          insert into logistics_core.audit_events (
            actor_user_id, action, entity_type, entity_id, asset_id, entity_revision,
            before_hash, after_hash, change_payload, reason, client_request_id,
            mapping_version, correlation_id
          ) values (
            v_actor_id, 'update', 'lease_contract_terms', v_contract_id, v_asset_id,
            v_contract_terms_revision,
            logistics_core.json_sha256(v_before_contract_terms),
            logistics_core.json_sha256(v_after_contract_terms),
            jsonb_strip_nulls(jsonb_build_object(
              'rent_free_periods_changed', v_row ? 'rent_free_periods',
              'fit_out_start_date_changed', v_row ? 'fit_out_start_date',
              'fit_out_end_date_changed', v_row ? 'fit_out_end_date',
              'rent_term_id', v_term_id
            )),
            coalesce(nullif(v_row->>'reason', ''), '렌트프리·인테리어 공사 기간 수정'),
            p_request_id, 'gate6-data-platform-5', p_request_id
          );
        end if;
      end if;
    end loop;
  end if;

  select greatest(
    coalesce((v_base_response->>'revision')::bigint, 0),
    coalesce((select max(term.revision)
      from logistics_core.rent_terms term
      join logistics_core.contract_spaces allocation on allocation.id = term.contract_space_id
      join logistics_core.spaces space on space.id = allocation.space_id
      where space.asset_id = v_asset_id), 0),
    coalesce((select max(period.revision)
      from logistics_core.lease_rent_free_periods period
      join logistics_core.lease_contracts contract on contract.id = period.contract_id
      where contract.asset_id = v_asset_id), 0)
  ) into v_latest_revision;

  v_final_response := jsonb_set(v_base_response, '{revision}', to_jsonb(v_latest_revision), true);
  v_final_response := jsonb_set(v_final_response, '{data,contract_terms_readback}', '"verified"'::jsonb, true);
  update logistics_core.api_idempotency_keys request
  set response = v_final_response,
      completed_at = now()
  where request.actor_user_id = v_actor_id
    and request.action = 'v2/rent-roll/batch-save'
    and request.client_request_id = p_request_id
    and request.status = 'completed';
  if not found then
    raise exception using errcode = 'PT500', message = 'READBACK_MISMATCH';
  end if;
  return v_final_response;
end;
$body$;

revoke all on function logistics_core.rent_roll_read_entry_v5(uuid, text, jsonb, jsonb)
  from public, anon, authenticated;
revoke all on function logistics_core.rent_roll_batch_save_entry_v5(uuid, text, jsonb, jsonb)
  from public, anon, authenticated;
revoke all on function logistics_core.rent_roll_read_entry(uuid, text, jsonb, jsonb)
  from public, anon, authenticated;
revoke all on function logistics_core.rent_roll_batch_save_entry(uuid, text, jsonb, jsonb)
  from public, anon, authenticated;

do $maturity_rename$
begin
  if to_regprocedure('logistics_core.maturities_read_entry_v2(uuid,text,jsonb,jsonb)') is null then
    execute 'alter function logistics_core.maturities_read_entry(uuid, text, jsonb, jsonb) rename to maturities_read_entry_v2';
  end if;
end;
$maturity_rename$;

create or replace function logistics_core.maturities_read_entry(
  p_request_id uuid,
  p_asset_key text,
  p_payload jsonb,
  p_expected_revisions jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, logistics_core, public
as $body$
declare
  v_actor_id uuid := logistics_core.request_actor();
  v_asset_id uuid := logistics_core.resolve_asset_id(p_asset_key);
  v_legacy_asset_id text;
  v_base_response jsonb;
  v_active_rows jsonb;
  v_active_alerts jsonb;
begin
  -- v2 performs the canonical permission check and creates only active alerts.
  v_base_response := logistics_core.maturities_read_entry_v2(
    p_request_id, p_asset_key, p_payload, p_expected_revisions
  );

  select coalesce(jsonb_agg(row_item.value order by row_item.ordinality), '[]'::jsonb)
  into v_active_rows
  from jsonb_array_elements(coalesce(v_base_response #> '{data,maturities}', '[]'::jsonb))
    with ordinality row_item(value, ordinality)
  where row_item.value->>'status' = 'active';

  select asset.public_key into v_legacy_asset_id
  from logistics_core.assets asset where asset.id = v_asset_id;
  select coalesce(jsonb_agg(jsonb_build_object(
    'notification_id', notification.notification_id,
    'type', notification.notification_type,
    'title', notification.title,
    'body', notification.body,
    'due_date', notification.due_date,
    'lead_days', notification.lead_days,
    'status', notification.delivery_status,
    'read_at', notification.read_at,
    'dismissed_at', notification.dismissed_at
  ) order by notification.due_date, notification.notification_id), '[]'::jsonb)
  into v_active_alerts
  from public.ll_notifications notification
  where notification.recipient_user_id = v_actor_id
    and notification.asset_id = v_legacy_asset_id
    and notification.delivery_status <> 'dismissed'
    and exists (
      select 1
      from logistics_core.maturities maturity
      where maturity.status = 'active'
        and maturity.deleted_at is null
        and notification.dedupe_key like 'v2:maturity:' || maturity.maturity_key || ':%'
        and (
          maturity.asset_id = v_asset_id
          or exists (
            select 1 from logistics_core.maturity_asset_scopes scope
            where scope.maturity_id = maturity.id
              and scope.asset_id = v_asset_id
              and scope.retired_at is null
          )
        )
    );

  return jsonb_set(
    v_base_response,
    '{data}',
    coalesce(v_base_response->'data', '{}'::jsonb) || jsonb_build_object(
      'maturities', v_active_rows,
      'in_app_alerts', v_active_alerts,
      'delivery_channel', 'in_app_only'
    ),
    true
  );
end;
$body$;

revoke all on function logistics_core.maturities_read_entry_v2(uuid, text, jsonb, jsonb)
  from public, anon, authenticated;
revoke all on function logistics_core.maturities_read_entry(uuid, text, jsonb, jsonb)
  from public, anon, authenticated;

notify pgrst, 'reload schema';

commit;
