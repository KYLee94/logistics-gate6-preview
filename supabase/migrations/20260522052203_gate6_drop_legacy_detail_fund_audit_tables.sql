-- Gate 6 cleanup phase: remove legacy physical detail/fund/audit tables after
-- Edge API was switched to the consolidated operating tables.
--
-- Consolidated primary tables:
--   - public.ll_lease_attributes
--   - public.ll_fund_capital_tranches
--   - public.ll_audit_events
--
-- Compatibility views keep read-only legacy names available for old QA/export
-- tooling while reducing physical public.ll_* table count.

begin;

do $$
declare
  migration_id text := '20260522052203_gate6_drop_legacy_detail_fund_audit_tables';
begin
  if to_regclass('public.ll_migration_row_backups') is not null then
    if to_regclass('public.ll_lease_space_area_breakdowns') is not null then
      insert into public.ll_migration_row_backups (migration_id, table_name, row_key, before_payload)
      select migration_id, 'public.ll_lease_space_area_breakdowns', id::text, to_jsonb(t)
      from public.ll_lease_space_area_breakdowns t
      on conflict do nothing;
    end if;

    if to_regclass('public.ll_lease_space_specs') is not null then
      insert into public.ll_migration_row_backups (migration_id, table_name, row_key, before_payload)
      select migration_id, 'public.ll_lease_space_specs', id::text, to_jsonb(t)
      from public.ll_lease_space_specs t
      on conflict do nothing;
    end if;

    if to_regclass('public.ll_lease_special_terms') is not null then
      insert into public.ll_migration_row_backups (migration_id, table_name, row_key, before_payload)
      select migration_id, 'public.ll_lease_special_terms', id::text, to_jsonb(t)
      from public.ll_lease_special_terms t
      on conflict do nothing;
    end if;

    if to_regclass('public.ll_fund_beneficiary_tranches') is not null then
      insert into public.ll_migration_row_backups (migration_id, table_name, row_key, before_payload)
      select migration_id, 'public.ll_fund_beneficiary_tranches', id::text, to_jsonb(t)
      from public.ll_fund_beneficiary_tranches t
      on conflict do nothing;
    end if;

    if to_regclass('public.ll_fund_loan_tranches') is not null then
      insert into public.ll_migration_row_backups (migration_id, table_name, row_key, before_payload)
      select migration_id, 'public.ll_fund_loan_tranches', id::text, to_jsonb(t)
      from public.ll_fund_loan_tranches t
      on conflict do nothing;
    end if;

    if to_regclass('public.ll_api_audit_logs') is not null then
      insert into public.ll_migration_row_backups (migration_id, table_name, row_key, before_payload)
      select migration_id, 'public.ll_api_audit_logs', id::text, to_jsonb(t)
      from public.ll_api_audit_logs t
      on conflict do nothing;
    end if;

    if to_regclass('public.ll_data_change_audit_logs') is not null then
      insert into public.ll_migration_row_backups (migration_id, table_name, row_key, before_payload)
      select migration_id, 'public.ll_data_change_audit_logs', id::text, to_jsonb(t)
      from public.ll_data_change_audit_logs t
      on conflict do nothing;
    end if;
  end if;
end $$;

drop table if exists public.ll_lease_space_area_breakdowns cascade;
drop table if exists public.ll_lease_space_specs cascade;
drop table if exists public.ll_lease_special_terms cascade;
drop table if exists public.ll_fund_beneficiary_tranches cascade;
drop table if exists public.ll_fund_loan_tranches cascade;
drop table if exists public.ll_api_audit_logs cascade;
drop table if exists public.ll_data_change_audit_logs cascade;

create or replace view public.ll_lease_space_area_breakdowns
with (security_invoker = true) as
select
  id,
  lease_space_id,
  lease_id,
  asset_id,
  tenant_id,
  attribute_key as area_type,
  attribute_label as area_label,
  value_sqm as area_sqm,
  value_py as area_py,
  basis,
  source_sheet_row_id,
  source_cell_id,
  review_status,
  review_note,
  created_at,
  updated_at
from public.ll_lease_attributes
where attribute_type = 'area_breakdown';

create or replace view public.ll_lease_space_specs
with (security_invoker = true) as
select
  id,
  lease_space_id,
  lease_id,
  asset_id,
  tenant_id,
  attribute_key as spec_key,
  attribute_label as spec_label,
  value_text as spec_value,
  value_numeric as spec_numeric,
  unit_label,
  basis,
  source_sheet_row_id,
  source_cell_id,
  review_status,
  review_note,
  created_at,
  updated_at
from public.ll_lease_attributes
where attribute_type = 'space_spec';

create or replace view public.ll_lease_special_terms
with (security_invoker = true) as
select
  id,
  lease_space_id,
  lease_id,
  asset_id,
  tenant_id,
  attribute_key as term_key,
  attribute_label as term_label,
  value_text as term_value,
  value_numeric as term_numeric,
  unit_label,
  basis,
  source_sheet_row_id,
  source_cell_id,
  review_status,
  review_note,
  created_at,
  updated_at
from public.ll_lease_attributes
where attribute_type = 'special_term';

create or replace view public.ll_fund_beneficiary_tranches
with (security_invoker = true) as
select
  id,
  fund_id,
  row_key,
  tranche,
  party_name as beneficiary_name,
  committed_amount_krw,
  display_order,
  is_active,
  deleted_at,
  source_type,
  source_name,
  source_sheet_name,
  source_row_number,
  source_cell_ids,
  source_payload,
  created_by,
  updated_by,
  created_at,
  updated_at
from public.ll_fund_capital_tranches
where tranche_type = 'beneficiary';

create or replace view public.ll_fund_loan_tranches
with (security_invoker = true) as
select
  id,
  fund_id,
  row_key,
  tranche,
  party_name as lender_name,
  committed_amount_krw,
  drawdown_date,
  maturity_date,
  loan_period,
  loan_type,
  interest_type,
  base_rate,
  spread_rate,
  loan_rate,
  interest_rate,
  fee,
  fee_rate,
  all_in,
  all_in_rate,
  display_order,
  is_active,
  deleted_at,
  source_type,
  source_name,
  source_sheet_name,
  source_row_number,
  source_cell_ids,
  source_payload,
  created_by,
  updated_by,
  created_at,
  updated_at
from public.ll_fund_capital_tranches
where tranche_type = 'loan';

create or replace view public.ll_api_audit_logs
with (security_invoker = true) as
select
  id,
  action,
  status_code,
  requested_by,
  request_payload,
  created_at
from public.ll_audit_events
where event_type = 'api';

create or replace view public.ll_data_change_audit_logs
with (security_invoker = true) as
select
  id,
  edit_request_id,
  action,
  target_table,
  target_row_id,
  target_cell_id,
  field_name,
  before_value,
  after_value,
  readback_value,
  actor_id,
  approver_id,
  source_row_id,
  source_cell_id,
  approval_status,
  metadata,
  created_at
from public.ll_audit_events
where event_type = 'data_change';

grant select on public.ll_lease_space_area_breakdowns to authenticated, service_role;
grant select on public.ll_lease_space_specs to authenticated, service_role;
grant select on public.ll_lease_special_terms to authenticated, service_role;
grant select on public.ll_fund_beneficiary_tranches to authenticated, service_role;
grant select on public.ll_fund_loan_tranches to authenticated, service_role;
grant select on public.ll_api_audit_logs to service_role;
grant select on public.ll_data_change_audit_logs to service_role;

insert into public.ll_schema_metadata (
  metadata_id,
  metadata_key,
  object_type,
  table_schema,
  table_name,
  column_name,
  domain_group,
  role_category,
  description,
  source_system,
  is_active,
  updated_at
)
values
  (
    gen_random_uuid(),
    'legacy_detail_tables_replaced',
    'table',
    'public',
    'll_lease_attributes',
    null,
    'Detail Normalized',
    'active_primary',
    'Legacy physical detail tables were replaced by compatibility views over ll_lease_attributes.',
    'Gate 6 schema consolidation',
    true,
    now()
  ),
  (
    gen_random_uuid(),
    'legacy_fund_tranche_tables_replaced',
    'table',
    'public',
    'll_fund_capital_tranches',
    null,
    'Fund',
    'active_primary',
    'Legacy physical beneficiary and loan tranche tables were replaced by compatibility views over ll_fund_capital_tranches.',
    'Gate 6 schema consolidation',
    true,
    now()
  ),
  (
    gen_random_uuid(),
    'legacy_audit_tables_replaced',
    'table',
    'public',
    'll_audit_events',
    null,
    'Permission / Audit',
    'active_primary',
    'Legacy physical API and data-change audit tables were replaced by compatibility views over ll_audit_events.',
    'Gate 6 schema consolidation',
    true,
    now()
  )
on conflict (metadata_key) do update
set
  domain_group = excluded.domain_group,
  role_category = excluded.role_category,
  description = excluded.description,
  source_system = excluded.source_system,
  is_active = excluded.is_active,
  updated_at = now();

commit;
