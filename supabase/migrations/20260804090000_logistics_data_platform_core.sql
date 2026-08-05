begin;

set local lock_timeout = '5s';
set local statement_timeout = '120s';

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create schema if not exists logistics_core;
create schema if not exists logistics_api;

-- Keep the two existing Data API schemas and expose only the RPC schema added by
-- this platform. The private logistics_core schema must never be in this list.
alter role authenticator set pgrst.db_schemas = 'public, graphql_public, logistics_api';
notify pgrst, 'reload config';

comment on schema logistics_core is
  'Private canonical data model for the Gate 6 logistics data platform. Never expose through PostgREST.';
comment on schema logistics_api is
  'RPC-only Data API surface for the Gate 6 logistics data platform.';

revoke all on schema logistics_core from public, anon;
revoke all on schema logistics_api from public, anon;
grant usage on schema logistics_core to authenticated, service_role;
grant usage on schema logistics_api to authenticated, service_role;

alter default privileges for role postgres in schema logistics_core
  revoke all on tables from public, anon, authenticated;
alter default privileges for role postgres in schema logistics_core
  revoke all on sequences from public, anon, authenticated;
alter default privileges for role postgres in schema logistics_core
  revoke execute on functions from public, anon, authenticated;
alter default privileges for role postgres in schema logistics_api
  revoke all on tables from public, anon, authenticated;
alter default privileges for role postgres in schema logistics_api
  revoke execute on functions from public, anon, authenticated;

create table logistics_core.assets (
  id uuid primary key default gen_random_uuid(),
  public_key text not null unique,
  asset_key text not null unique,
  asset_code text not null unique,
  name_ko text not null,
  address_ko text,
  gross_area_sqm numeric(20, 6),
  leasable_area_sqm numeric(20, 6),
  acquisition_cost numeric(24, 4),
  current_valuation numeric(24, 4),
  currency_code text not null default 'KRW',
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  revision bigint not null default 1 check (revision > 0),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete set null,
  constraint assets_asset_key_check check (asset_key ~ '^[A-Za-z0-9][A-Za-z0-9._-]{2,127}$'),
  constraint assets_public_key_check check (public_key ~ '^[A-Za-z0-9][A-Za-z0-9._-]{2,127}$'),
  constraint assets_soft_delete_check check (deleted_at is not null or deleted_by is null)
);

create table logistics_core.funds (
  id uuid primary key default gen_random_uuid(),
  fund_key text not null unique,
  fund_code text not null unique,
  name_ko text not null,
  inception_date date,
  maturity_date date,
  status text not null default 'active' check (status in ('active', 'closed', 'planned')),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  revision bigint not null default 1 check (revision > 0),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete set null
);

create table logistics_core.fund_asset_links (
  id uuid primary key default gen_random_uuid(),
  link_key text not null unique,
  fund_id uuid not null references logistics_core.funds(id) on delete restrict,
  asset_id uuid not null references logistics_core.assets(id) on delete restrict,
  effective_from date,
  effective_to date,
  ownership_ratio numeric(12, 8),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  revision bigint not null default 1 check (revision > 0),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete set null,
  constraint fund_asset_link_dates_check check (effective_to is null or effective_from is null or effective_to >= effective_from),
  constraint fund_asset_link_ratio_check check (ownership_ratio is null or ownership_ratio between 0 and 1)
);

create table logistics_core.fund_beneficiary_tranches (
  id uuid primary key default gen_random_uuid(),
  beneficiary_key text not null unique,
  fund_id uuid not null references logistics_core.funds(id) on delete restrict,
  source_tranche_id uuid not null unique,
  source_is_active boolean not null default true,
  tranche_code text,
  beneficiary_name text,
  committed_amount_krw numeric(24, 4),
  source_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  revision bigint not null default 1 check (revision > 0),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete set null
);

create table logistics_core.lenders (
  id uuid primary key default gen_random_uuid(),
  lender_key text not null unique,
  lender_code text not null unique,
  name_ko text not null,
  registration_number text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  revision bigint not null default 1 check (revision > 0),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete set null
);

create table logistics_core.loans (
  id uuid primary key default gen_random_uuid(),
  loan_key text not null unique,
  loan_code text not null unique,
  asset_id uuid references logistics_core.assets(id) on delete restrict,
  fund_id uuid references logistics_core.funds(id) on delete restrict,
  source_tranche_id uuid not null unique,
  source_is_active boolean not null default true,
  name_ko text not null,
  commitment_amount numeric(24, 4),
  outstanding_amount numeric(24, 4),
  drawdown_date date,
  currency_code text not null default 'KRW',
  interest_terms jsonb not null default '{}'::jsonb,
  repayment_terms jsonb not null default '{"repayment_schedule_status":"not_provided","rows":[]}'::jsonb,
  repayment_schedule_status text not null default 'not_provided' check (repayment_schedule_status = 'not_provided'),
  covenant_formula_key text,
  covenant_formula_version integer,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  revision bigint not null default 1 check (revision > 0),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete set null
);

create table logistics_core.loan_lenders (
  id uuid primary key default gen_random_uuid(),
  loan_lender_key text not null unique,
  loan_id uuid not null references logistics_core.loans(id) on delete restrict,
  lender_id uuid not null references logistics_core.lenders(id) on delete restrict,
  seniority integer not null default 1 check (seniority > 0),
  commitment_amount numeric(24, 4),
  commitment_ratio numeric(12, 8),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  revision bigint not null default 1 check (revision > 0),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete set null,
  constraint loan_lender_ratio_check check (commitment_ratio is null or commitment_ratio between 0 and 1),
  unique (loan_id, lender_id, seniority)
);

create table logistics_core.tenants (
  id uuid primary key default gen_random_uuid(),
  tenant_key text not null unique,
  tenant_code text not null unique,
  legal_name_ko text not null,
  business_registration_number text,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  revision bigint not null default 1 check (revision > 0),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete set null
);

create table logistics_core.lease_contracts (
  id uuid primary key default gen_random_uuid(),
  contract_key text not null unique,
  contract_code text not null unique,
  asset_id uuid not null references logistics_core.assets(id) on delete restrict,
  tenant_id uuid not null references logistics_core.tenants(id) on delete restrict,
  signed_date date,
  commencement_date date,
  expiry_date date,
  status text not null check (status in ('planned', 'active', 'ended', 'terminated')),
  deposit_amount numeric(24, 4),
  deposit_per_py_krw numeric(24, 4),
  operation_start_date date,
  renewal_terms text,
  termination_terms text,
  restoration_terms text,
  bond_terms text,
  special_terms text,
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  revision bigint not null default 1 check (revision > 0),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete set null
);

create table logistics_core.spaces (
  id uuid primary key default gen_random_uuid(),
  space_key text not null unique,
  asset_id uuid not null references logistics_core.assets(id) on delete restrict,
  floor_label text,
  zone_label text,
  use_type text,
  occupancy_status text not null default 'vacant' check (occupancy_status in ('occupied', 'vacant', 'planned')),
  use_category text,
  leasable_area_sqm numeric(20, 6),
  exclusive_area_sqm numeric(20, 6),
  common_area_sqm numeric(20, 6),
  leased_area_sqm numeric(20, 6),
  efficiency_ratio numeric(12, 8),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  revision bigint not null default 1 check (revision > 0),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete set null
);

create table logistics_core.contract_spaces (
  id uuid primary key default gen_random_uuid(),
  contract_space_key text not null unique,
  contract_id uuid not null references logistics_core.lease_contracts(id) on delete restrict,
  space_id uuid not null references logistics_core.spaces(id) on delete restrict,
  allocated_leasable_area_sqm numeric(20, 6),
  allocated_exclusive_area_sqm numeric(20, 6),
  effective_from date,
  effective_to date,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  revision bigint not null default 1 check (revision > 0),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete set null,
  constraint contract_space_dates_check check (effective_to is null or effective_to >= effective_from)
);

create table logistics_core.rent_terms (
  id uuid primary key default gen_random_uuid(),
  rent_term_key text not null unique,
  contract_space_id uuid not null references logistics_core.contract_spaces(id) on delete restrict,
  effective_from_month date,
  effective_to_month date,
  base_monthly_rent numeric(24, 4),
  base_monthly_management_fee numeric(24, 4),
  rent_per_pyeong numeric(24, 8),
  management_fee_per_pyeong numeric(24, 8),
  rent_free_months numeric(12, 4) not null default 0,
  rent_free_schedule jsonb not null default '[]'::jsonb,
  deposit_escalation_rule jsonb not null default '{}'::jsonb,
  rent_escalation_rule jsonb not null default '{}'::jsonb,
  cam_escalation_rule jsonb not null default '{}'::jsonb,
  fit_out_months numeric(12, 4),
  fit_out_amount numeric(24, 4),
  effective_rent numeric(24, 4),
  tenant_cost_terms jsonb not null default '{}'::jsonb,
  landlord_cost_terms jsonb not null default '{}'::jsonb,
  pallet_rack_fee numeric(24, 4),
  notes text,
  tenant_improvement_amount numeric(24, 4),
  interior_support_amount numeric(24, 4),
  escalation_rate numeric(12, 8),
  escalation_interval_months integer,
  calculation_method text not null default 'fixed_monthly'
    check (calculation_method in ('fixed_monthly', 'per_area')),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  revision bigint not null default 1 check (revision > 0),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete set null,
  constraint rent_term_month_check check (
    (effective_from_month is null or extract(day from effective_from_month) = 1)
    and (effective_to_month is null or extract(day from effective_to_month) = 1)
    and (effective_to_month is null or effective_from_month is null or effective_to_month >= effective_from_month)
  )
);

create table logistics_core.rent_term_history (
  id uuid primary key default gen_random_uuid(),
  rent_term_id uuid not null references logistics_core.rent_terms(id) on delete restrict,
  effective_at timestamptz not null,
  change_type text not null check (change_type in ('created', 'updated', 'soft_deleted', 'restored')),
  before_values jsonb,
  after_values jsonb,
  reason text not null,
  source_reference jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

create table logistics_core.lease_attributes (
  id uuid primary key default gen_random_uuid(),
  source_attribute_id uuid not null unique,
  attribute_type text not null check (attribute_type in ('area_breakdown', 'space_spec', 'special_term')),
  asset_id uuid references logistics_core.assets(id) on delete restrict,
  tenant_id uuid references logistics_core.tenants(id) on delete restrict,
  contract_id uuid references logistics_core.lease_contracts(id) on delete restrict,
  space_id uuid references logistics_core.spaces(id) on delete restrict,
  attribute_key text not null,
  attribute_label text,
  value_text text,
  value_numeric numeric,
  value_sqm numeric,
  value_py numeric,
  unit_label text,
  basis text,
  provenance jsonb not null default '{}'::jsonb,
  source_payload jsonb not null default '{}'::jsonb,
  source_row_hash text not null,
  review_status text,
  review_note text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  revision bigint not null default 1 check (revision > 0),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete set null,
  constraint lease_attributes_soft_delete_check check (deleted_at is not null or deleted_by is null)
);

create table logistics_core.cashflow_accounts (
  id uuid primary key default gen_random_uuid(),
  account_code text not null unique,
  name_ko text not null,
  parent_account_id uuid references logistics_core.cashflow_accounts(id) on delete restrict,
  account_kind text not null check (account_kind in ('atomic', 'derived')),
  statement_section text not null check (statement_section in (
    'potential_income', 'income_loss', 'other_operating_income', 'operating_expense',
    'below_noi', 'debt_service', 'derived_subtotal'
  )),
  normal_sign smallint not null default 1 check (normal_sign in (-1, 1)),
  display_order integer not null,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  revision bigint not null default 1 check (revision > 0),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete set null
);

create table logistics_core.formula_definitions (
  id uuid primary key default gen_random_uuid(),
  formula_key text not null,
  version integer not null check (version > 0),
  name_ko text not null,
  description_ko text not null,
  effective_from date not null,
  effective_to date,
  input_contract jsonb not null,
  expression_ast jsonb not null,
  rounding_contract jsonb not null default '{"scale": 2, "mode": "half_up"}'::jsonb,
  result_unit text not null,
  authority_reference text,
  status text not null check (status in ('draft', 'approved', 'retired')),
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  test_vector_hash text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  unique (formula_key, version),
  constraint formula_effective_dates_check check (effective_to is null or effective_to >= effective_from),
  constraint formula_approval_check check (
    status <> 'approved' or (approved_at is not null and test_vector_hash is not null)
  )
);

create table logistics_core.monthly_ledger_entries (
  id uuid primary key default gen_random_uuid(),
  entry_key text not null unique,
  asset_id uuid not null references logistics_core.assets(id) on delete restrict,
  month date not null,
  account_id uuid not null references logistics_core.cashflow_accounts(id) on delete restrict,
  scenario text not null check (scenario in ('actual', 'budget', 'forecast')),
  accounting_basis text not null check (accounting_basis in ('accrual', 'cash')),
  amount numeric(24, 4) not null,
  currency_code text not null default 'KRW',
  source_kind text not null check (source_kind in (
    'rent_roll_calculation', 'manual_input', 'approved_import', 'adjustment'
  )),
  source_ref text not null,
  source_line_key text not null,
  formula_definition_id uuid references logistics_core.formula_definitions(id) on delete restrict,
  data_status text not null default 'provided' check (data_status in ('provided', 'not_provided')),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  revision bigint not null default 1 check (revision > 0),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete set null,
  constraint monthly_ledger_month_check check (extract(day from month) = 1),
  constraint monthly_ledger_source_ref_check check (btrim(source_ref) <> ''),
  constraint monthly_ledger_source_line_key_check check (btrim(source_line_key) <> ''),
  unique (asset_id, month, account_id, scenario, accounting_basis, source_kind, source_ref, source_line_key)
);

comment on table logistics_core.monthly_ledger_entries is
  'Stores atomic monthly source rows only. Quarter, year, NOI and other derived subtotals are computed by calculations/explain and never persisted here.';

create table logistics_core.ledger_adjustments (
  id uuid primary key default gen_random_uuid(),
  adjustment_key text not null unique,
  ledger_entry_id uuid not null references logistics_core.monthly_ledger_entries(id) on delete restrict,
  calculated_amount numeric(24, 4) not null,
  adjustment_amount numeric(24, 4) not null,
  adjusted_amount numeric(24, 4) not null,
  reason text not null check (length(btrim(reason)) > 0),
  evidence_reference jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  revision bigint not null default 1 check (revision > 0),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete set null,
  constraint ledger_adjustment_math_check check (adjusted_amount = calculated_amount + adjustment_amount)
);

create table logistics_core.user_permission_profiles (
  user_id uuid primary key references auth.users(id) on update cascade on delete cascade,
  scope_mode text not null default 'listed' check (scope_mode in ('listed', 'all')),
  managed_read boolean not null default false,
  managed_create boolean not null default false,
  managed_update boolean not null default false,
  managed_delete boolean not null default false,
  other_read boolean not null default false,
  other_create boolean not null default false,
  other_update boolean not null default false,
  other_delete boolean not null default false,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  revision bigint not null default 1 check (revision > 0),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete set null
);

create table logistics_core.user_asset_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on update cascade on delete cascade,
  asset_id uuid not null references logistics_core.assets(id) on delete restrict,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  revision bigint not null default 1 check (revision > 0),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete set null,
  unique (user_id, asset_id)
);

create table logistics_core.asset_writer_routes (
  asset_id uuid primary key references logistics_core.assets(id) on delete restrict,
  writer_mode text not null default 'locked' check (writer_mode in ('legacy', 'v2', 'locked')),
  reason text not null,
  changed_at timestamptz not null default now(),
  changed_by uuid references auth.users(id) on delete set null,
  revision bigint not null default 1 check (revision > 0)
);

create table logistics_core.platform_feature_flags (
  flag_key text primary key,
  v2_write_enabled boolean not null default false,
  reason text not null,
  changed_at timestamptz not null default now(),
  changed_by uuid references auth.users(id) on delete set null,
  revision bigint not null default 1 check (revision > 0)
);

create table logistics_core.platform_pilot_users (
  user_id uuid primary key references auth.users(id) on update cascade on delete cascade,
  is_active boolean not null default true,
  selection_source text not null,
  selection_reason text not null,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  revision bigint not null default 1 check (revision > 0)
);

create table logistics_core.maturities (
  id uuid primary key default gen_random_uuid(),
  maturity_key text not null unique,
  maturity_type text not null check (maturity_type in ('lease', 'fund', 'loan')),
  asset_id uuid references logistics_core.assets(id) on delete restrict,
  lease_contract_id uuid references logistics_core.lease_contracts(id) on delete restrict,
  fund_id uuid references logistics_core.funds(id) on delete restrict,
  loan_id uuid references logistics_core.loans(id) on delete restrict,
  target_name_ko text not null,
  official_date date not null,
  status text not null default 'active' check (status in ('active', 'cancelled', 'completed')),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  revision bigint not null default 1 check (revision > 0),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete set null,
  constraint maturity_exactly_one_target_check check (
    num_nonnulls(lease_contract_id, fund_id, loan_id) = 1
    and (maturity_type <> 'lease' or lease_contract_id is not null)
    and (maturity_type <> 'fund' or fund_id is not null)
    and (maturity_type <> 'loan' or loan_id is not null)
  )
);

create table logistics_core.maturity_schedules (
  id uuid primary key default gen_random_uuid(),
  maturity_id uuid not null references logistics_core.maturities(id) on delete restrict,
  maturity_revision bigint not null check (maturity_revision > 0),
  lead_days integer not null check (lead_days in (30, 7, 3, 1, 0)),
  scheduled_for_kst date not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'cancelled', 'completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (maturity_id, maturity_revision, lead_days)
);

create table logistics_core.maturity_asset_scopes (
  id uuid primary key default gen_random_uuid(),
  maturity_id uuid not null references logistics_core.maturities(id) on delete restrict,
  asset_id uuid not null references logistics_core.assets(id) on delete restrict,
  scope_revision bigint not null default 1 check (scope_revision > 0),
  created_at timestamptz not null default now(),
  retired_at timestamptz
);

create unique index maturity_asset_scopes_active_unique
  on logistics_core.maturity_asset_scopes(maturity_id, asset_id)
  where retired_at is null;

create table logistics_core.api_idempotency_keys (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  action text not null,
  client_request_id uuid not null,
  request_hash text not null,
  status text not null check (status in ('processing', 'completed', 'failed')),
  response jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  expires_at timestamptz not null default (now() + interval '30 days'),
  unique (actor_user_id, action, client_request_id)
);

create table logistics_core.audit_events (
  event_id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  asset_id uuid references logistics_core.assets(id) on delete restrict,
  entity_revision bigint,
  before_hash text,
  after_hash text,
  change_payload jsonb not null default '{}'::jsonb,
  reason text,
  client_request_id uuid,
  formula_key text,
  formula_version integer,
  mapping_version text,
  correlation_id uuid not null
);

create table logistics_core.migration_runs (
  run_id uuid primary key default gen_random_uuid(),
  snapshot_id text not null,
  source_version text not null,
  target_version text not null,
  mapping_version text not null,
  status text not null check (status in ('planned', 'running', 'validated', 'failed', 'rolled_back')),
  source_row_count bigint,
  target_row_count bigint,
  source_hash text,
  target_hash text,
  critical_exception_count bigint not null default 0 check (critical_exception_count >= 0),
  started_at timestamptz,
  completed_at timestamptz,
  approved_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table logistics_core.migration_field_mappings (
  id uuid primary key default gen_random_uuid(),
  mapping_version text not null,
  source_table text not null,
  source_column text not null,
  target_entity text not null,
  target_field text not null,
  mapping_kind text not null check (mapping_kind in ('direct', 'split', 'combine', 'provenance_only', 'legacy_only', 'blocked')),
  transform_contract jsonb not null default '{}'::jsonb,
  reverse_contract jsonb,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  unique (mapping_version, source_table, source_column, target_entity, target_field)
);

create table logistics_core.migration_row_mappings (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references logistics_core.migration_runs(run_id) on delete restrict,
  mapping_version text not null,
  source_table text not null,
  source_pk jsonb not null,
  source_row_hash text not null,
  target_entity text not null,
  target_id uuid not null,
  target_row_hash text not null,
  created_at timestamptz not null default now(),
  unique (run_id, source_table, source_pk, target_entity, target_id)
);

create table logistics_core.migration_exceptions (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references logistics_core.migration_runs(run_id) on delete restrict,
  severity text not null check (severity in ('critical', 'warning', 'information')),
  source_table text,
  source_pk jsonb,
  target_entity text,
  expected_hash text,
  actual_hash text,
  reason text not null,
  resolution_status text not null default 'open' check (resolution_status in ('open', 'approved', 'resolved')),
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now()
);

create table logistics_core.legacy_projection_state (
  id uuid primary key default gen_random_uuid(),
  target_entity text not null,
  target_id uuid not null,
  legacy_table text not null,
  legacy_pk jsonb not null,
  projection_version text not null,
  last_success_revision bigint not null check (last_success_revision > 0),
  target_hash text not null,
  legacy_hash text not null,
  readback_status text not null check (readback_status in ('verified', 'mismatch', 'blocked')),
  verified_at timestamptz not null,
  unique (target_entity, target_id, legacy_table, legacy_pk)
);

create table logistics_core.rollback_export_state (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid not null,
  asset_id uuid not null references logistics_core.assets(id) on delete restrict,
  export_key text not null,
  export_payload jsonb not null,
  export_hash text not null,
  retained_in_core boolean not null default true,
  readback_status text not null check (readback_status in ('verified', 'mismatch', 'blocked')),
  client_request_id uuid not null,
  verified_at timestamptz not null,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  revision bigint not null default 1 check (revision > 0),
  unique (entity_type, entity_id)
);

create index assets_active_key_idx on logistics_core.assets(asset_key) where deleted_at is null;
create index fund_asset_links_asset_idx on logistics_core.fund_asset_links(asset_id, effective_from) where deleted_at is null;
create index loans_asset_idx on logistics_core.loans(asset_id) where deleted_at is null;
create index lease_contracts_asset_idx on logistics_core.lease_contracts(asset_id, status) where deleted_at is null;
create index spaces_asset_idx on logistics_core.spaces(asset_id) where deleted_at is null;
create index contract_spaces_contract_idx on logistics_core.contract_spaces(contract_id, effective_from) where deleted_at is null;
create index rent_terms_contract_space_idx on logistics_core.rent_terms(contract_space_id, effective_from_month) where deleted_at is null;
create index lease_attributes_scope_idx on logistics_core.lease_attributes(asset_id, contract_id, space_id, attribute_type) where deleted_at is null;
create index monthly_ledger_asset_month_idx on logistics_core.monthly_ledger_entries(asset_id, month, scenario, accounting_basis) where deleted_at is null;
create index user_asset_assignments_user_idx on logistics_core.user_asset_assignments(user_id, asset_id) where deleted_at is null;
create index maturities_asset_date_idx on logistics_core.maturities(asset_id, official_date) where deleted_at is null and status = 'active';
create index audit_events_asset_time_idx on logistics_core.audit_events(asset_id, occurred_at desc);

create or replace function logistics_core.set_updated_revision()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $body$
begin
  new.updated_at := now();
  new.updated_by := coalesce(auth.uid(), new.updated_by, old.updated_by);
  new.revision := old.revision + 1;
  return new;
end;
$body$;

create or replace function logistics_core.prevent_formula_mutation()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $body$
begin
  raise exception using errcode = 'PT409', message = 'FORMULA_VERSION_IMMUTABLE';
end;
$body$;

create or replace function logistics_core.prevent_audit_mutation()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $body$
begin
  raise exception using errcode = 'PT409', message = 'AUDIT_EVENT_IMMUTABLE';
end;
$body$;

create or replace function logistics_core.assert_atomic_ledger_account()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, logistics_core
as $body$
begin
  if not exists (
    select 1
    from logistics_core.cashflow_accounts account
    where account.id = new.account_id
      and account.account_kind = 'atomic'
      and account.deleted_at is null
  ) then
    raise exception using errcode = 'PT422', message = 'DERIVED_SUBTOTAL_PERSISTENCE_FORBIDDEN';
  end if;
  return new;
end;
$body$;

create trigger formula_definitions_immutable
before update or delete on logistics_core.formula_definitions
for each row execute function logistics_core.prevent_formula_mutation();

create trigger audit_events_immutable
before update or delete on logistics_core.audit_events
for each row execute function logistics_core.prevent_audit_mutation();

create trigger rent_term_history_immutable
before update or delete on logistics_core.rent_term_history
for each row execute function logistics_core.prevent_audit_mutation();

create trigger monthly_ledger_atomic_account
before insert or update of account_id on logistics_core.monthly_ledger_entries
for each row execute function logistics_core.assert_atomic_ledger_account();

do $triggers$
declare
  table_name text;
begin
  foreach table_name in array array[
    'assets', 'funds', 'fund_asset_links', 'fund_beneficiary_tranches', 'lenders', 'loans', 'loan_lenders',
    'tenants', 'lease_contracts', 'spaces', 'contract_spaces', 'rent_terms', 'lease_attributes',
    'cashflow_accounts', 'monthly_ledger_entries', 'ledger_adjustments',
    'user_permission_profiles', 'user_asset_assignments', 'platform_pilot_users', 'rollback_export_state'
  ]
  loop
    execute format(
      'create trigger %I before update on logistics_core.%I for each row execute function logistics_core.set_updated_revision()',
      table_name || '_set_updated_revision',
      table_name
    );
  end loop;
end;
$triggers$;

create or replace function logistics_core.request_actor()
returns uuid
language plpgsql
stable
security definer
set search_path = pg_catalog
as $body$
declare
  actor_id uuid := auth.uid();
begin
  if auth.uid() is null or actor_id is null then
    raise exception using errcode = 'PT401', message = 'AUTH_REQUIRED';
  end if;
  return actor_id;
end;
$body$;

create or replace function logistics_core.resolve_asset_id(p_asset_key text)
returns uuid
language plpgsql
stable
security definer
set search_path = pg_catalog, logistics_core
as $body$
declare
  resolved_id uuid;
begin
  if nullif(btrim(p_asset_key), '') is null then
    raise exception using errcode = 'PT422', message = 'ASSET_KEY_REQUIRED';
  end if;
  select asset.id
  into resolved_id
  from logistics_core.assets asset
  where asset.asset_key = btrim(p_asset_key)
    and asset.deleted_at is null;
  if resolved_id is null then
    raise exception using errcode = 'PT404', message = 'NOT_FOUND';
  end if;
  return resolved_id;
end;
$body$;

create or replace function logistics_core.assert_asset_permission(
  p_actor_user_id uuid,
  p_asset_id uuid,
  p_operation text
)
returns void
language plpgsql
stable
security definer
set search_path = pg_catalog, logistics_core
as $body$
declare
  permission logistics_core.user_permission_profiles%rowtype;
  managed boolean;
  allowed boolean;
begin
  if p_operation not in ('read', 'create', 'update', 'delete') then
    raise exception using errcode = 'PT422', message = 'INVALID_PERMISSION_OPERATION';
  end if;

  select profile.*
  into permission
  from logistics_core.user_permission_profiles profile
  where profile.user_id = p_actor_user_id
    and profile.deleted_at is null;

  if permission.user_id is null then
    raise exception using errcode = 'PT403', message = 'PERMISSION_DENIED';
  end if;

  managed := permission.scope_mode = 'all' or exists (
    select 1
    from logistics_core.user_asset_assignments assignment
    where assignment.user_id = p_actor_user_id
      and assignment.asset_id = p_asset_id
      and assignment.deleted_at is null
  );

  allowed := case
    when managed and p_operation = 'read' then permission.managed_read
    when managed and p_operation = 'create' then permission.managed_read and permission.managed_create
    when managed and p_operation = 'update' then permission.managed_read and permission.managed_update
    when managed and p_operation = 'delete' then permission.managed_read and permission.managed_delete
    when not managed and p_operation = 'read' then permission.other_read
    when not managed and p_operation = 'create' then permission.other_read and permission.other_create
    when not managed and p_operation = 'update' then permission.other_read and permission.other_update
    when not managed and p_operation = 'delete' then permission.other_read and permission.other_delete
    else false
  end;

  if not coalesce(allowed, false) then
    raise exception using errcode = 'PT403', message = 'PERMISSION_DENIED';
  end if;
end;
$body$;

create or replace function logistics_core.assert_v2_writer_route(p_asset_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = pg_catalog, logistics_core
as $body$
declare
  actor_id uuid := auth.uid();
  route_mode text;
  writes_enabled boolean;
begin
  if actor_id is null then
    raise exception using errcode = 'PT401', message = 'AUTH_REQUIRED';
  end if;

  if not exists (
    select 1
    from logistics_core.platform_pilot_users pilot
    where pilot.user_id = actor_id and pilot.is_active = true
  ) then
    raise exception using errcode = 'PT403', message = 'PILOT_ACCESS_REQUIRED';
  end if;

  select flag.v2_write_enabled
  into writes_enabled
  from logistics_core.platform_feature_flags flag
  where flag.flag_key = 'data_platform_v2';

  if not coalesce(writes_enabled, false) then
    raise exception using errcode = 'PT503', message = 'MAINTENANCE_MODE';
  end if;

  select route.writer_mode
  into route_mode
  from logistics_core.asset_writer_routes route
  where route.asset_id = p_asset_id;

  if route_mode is distinct from 'v2' then
    raise exception using errcode = 'PT503', message = 'MAINTENANCE_MODE';
  end if;
end;
$body$;

create or replace function logistics_core.actor_write_status(
  p_actor_user_id uuid,
  p_asset_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, logistics_core
as $body$
declare
  v_enabled boolean;
  v_route text;
  v_is_pilot boolean;
  v_permission logistics_core.user_permission_profiles%rowtype;
  v_managed boolean;
  v_create boolean := false;
  v_update boolean := false;
  v_delete boolean := false;
  v_reason text;
begin
  select coalesce(flag.v2_write_enabled, false)
  into v_enabled
  from logistics_core.platform_feature_flags flag
  where flag.flag_key = 'data_platform_v2';

  select route.writer_mode into v_route
  from logistics_core.asset_writer_routes route
  where route.asset_id = p_asset_id;

  select exists (
    select 1 from logistics_core.platform_pilot_users pilot
    where pilot.user_id = p_actor_user_id and pilot.is_active = true
  ) into v_is_pilot;

  select profile.* into v_permission
  from logistics_core.user_permission_profiles profile
  where profile.user_id = p_actor_user_id and profile.deleted_at is null;

  v_managed := coalesce(v_permission.scope_mode = 'all', false) or exists (
    select 1 from logistics_core.user_asset_assignments assignment
    where assignment.user_id = p_actor_user_id
      and assignment.asset_id = p_asset_id
      and assignment.deleted_at is null
  );

  if v_permission.user_id is not null then
    if v_managed then
      v_create := v_permission.managed_read and v_permission.managed_create;
      v_update := v_permission.managed_read and v_permission.managed_update;
      v_delete := v_permission.managed_read and v_permission.managed_delete;
    else
      v_create := v_permission.other_read and v_permission.other_create;
      v_update := v_permission.other_read and v_permission.other_update;
      v_delete := v_permission.other_read and v_permission.other_delete;
    end if;
  end if;

  v_reason := case
    when p_actor_user_id is null then 'AUTH_REQUIRED'
    when not coalesce(v_is_pilot, false) then 'PILOT_ACCESS_REQUIRED'
    when not coalesce(v_enabled, false) then 'PLATFORM_WRITE_DISABLED'
    when v_route is distinct from 'v2' then 'ASSET_WRITER_ROUTE_NOT_V2'
    when not (v_create and v_update and v_delete) then 'CRUD_PERMISSION_REQUIRED'
    else 'ENABLED'
  end;

  return jsonb_build_object(
    'write_enabled', v_reason = 'ENABLED',
    'write_reason', v_reason,
    'create_enabled', v_create,
    'update_enabled', v_update,
    'delete_enabled', v_delete
  );
end;
$body$;

insert into logistics_core.platform_feature_flags(flag_key, v2_write_enabled, reason)
values ('data_platform_v2', false, 'Production shadow: mutation RPC grants remain disabled')
on conflict (flag_key) do nothing;

create or replace function logistics_core.primary_response(
  p_request_id uuid,
  p_revision bigint,
  p_data jsonb
)
returns jsonb
language sql
immutable
security invoker
set search_path = pg_catalog
as $body$
  select jsonb_build_object(
    'ok', true,
    'status', 'primary',
    'request_id', p_request_id,
    'revision', p_revision,
    'data', coalesce(p_data, '{}'::jsonb)
  );
$body$;

create or replace function logistics_core.request_hash(
  p_action text,
  p_asset_key text,
  p_payload jsonb,
  p_expected_revisions jsonb
)
returns text
language sql
immutable
security invoker
set search_path = pg_catalog, extensions
as $body$
  select encode(
    extensions.digest(
      convert_to(
        jsonb_build_object(
          'action', p_action,
          'asset_key', p_asset_key,
          'payload', coalesce(p_payload, '{}'::jsonb),
          'expected_revisions', coalesce(p_expected_revisions, '{}'::jsonb)
        )::text,
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );
$body$;

create or replace function logistics_core.claim_idempotency(
  p_actor_user_id uuid,
  p_action text,
  p_request_id uuid,
  p_request_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, logistics_core
as $body$
declare
  existing logistics_core.api_idempotency_keys%rowtype;
  inserted_id uuid;
begin
  insert into logistics_core.api_idempotency_keys (
    actor_user_id, action, client_request_id, request_hash, status
  ) values (
    p_actor_user_id, p_action, p_request_id, p_request_hash, 'processing'
  )
  on conflict (actor_user_id, action, client_request_id) do nothing
  returning id into inserted_id;

  if inserted_id is not null then
    return null;
  end if;

  select request.*
  into existing
  from logistics_core.api_idempotency_keys request
  where request.actor_user_id = p_actor_user_id
    and request.action = p_action
    and request.client_request_id = p_request_id
  for update;

  if existing.request_hash <> p_request_hash then
    raise exception using errcode = 'PT409', message = 'IDEMPOTENCY_CONFLICT';
  end if;
  if existing.status = 'completed' and existing.response is not null then
    return existing.response;
  end if;
  if existing.status = 'processing' and existing.created_at < now() - interval '5 minutes' then
    update logistics_core.api_idempotency_keys
    set created_at = now()
    where id = existing.id;
  elsif existing.status = 'processing' then
    raise exception using errcode = 'PT409', message = 'IDEMPOTENT_REQUEST_IN_PROGRESS';
  end if;
  return null;
end;
$body$;

create or replace function logistics_core.complete_idempotency(
  p_actor_user_id uuid,
  p_action text,
  p_request_id uuid,
  p_response jsonb
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, logistics_core
as $body$
begin
  update logistics_core.api_idempotency_keys
  set status = 'completed', response = p_response, completed_at = now()
  where actor_user_id = p_actor_user_id
    and action = p_action
    and client_request_id = p_request_id
    and status = 'processing';
  if not found then
    raise exception using errcode = 'PT500', message = 'READBACK_MISMATCH';
  end if;
end;
$body$;

-- Account definitions are operational metadata, not sample or backfilled finance rows.
insert into logistics_core.cashflow_accounts (
  account_code, name_ko, account_kind, statement_section, normal_sign, display_order
) values
  ('MANUAL_REVENUE', '수익 직접입력', 'atomic', 'potential_income', 1, 100),
  ('MANUAL_COST', '비용 직접입력', 'atomic', 'operating_expense', -1, 200),
  ('MANUAL_RECEIPT', '수납 직접입력', 'atomic', 'potential_income', 1, 300)
on conflict (account_code) do nothing;

insert into logistics_core.formula_definitions (
  formula_key,
  version,
  name_ko,
  description_ko,
  effective_from,
  input_contract,
  expression_ast,
  result_unit,
  authority_reference,
  status,
  approved_at,
  test_vector_hash
) values
  ('contractual_rent_monthly', 1, '월 계약 임대료', '계약 조건, 인상, 렌트프리와 일할을 적용한 월 임대료', date '2026-08-01', '{}'::jsonb, '{"op":"contract_rent"}'::jsonb, 'KRW/month', 'Gate 6 SDD', 'draft', null, 'a4bc22dcb84215fc24f2e392d88b2dca4db68f167e44f6a3cfa3b872b2660011'),
  ('potential_gross_income', 1, '잠재총수입', '계약상 수입과 기타 잠재수입 합계', date '2026-08-01', '{}'::jsonb, '{"op":"sum","inputs":["contractual_rent","recoverable_charges","deposit_income","other_potential_income"]}'::jsonb, 'KRW', '한국부동산원 상업용부동산 임대동향조사', 'approved', now(), '261a5c8d4d4abcae3a9a4779cc9bb168df0d80a7134f212721d184b21e882022'),
  ('income_loss', 1, '공실·감면·미수 손실', '공실, 무상임대, 할인, 미수와 계약 조정 손실 합계', date '2026-08-01', '{}'::jsonb, '{"op":"sum","inputs":["vacancy_loss","rent_free_loss","bad_debt_loss","contract_adjustment_loss"]}'::jsonb, 'KRW', 'Gate 6 SDD', 'approved', now(), '032d4a3f5bb7992cd45ddce690fecc4f1e42d5342bbec60729dfbcc80a1e3033'),
  ('effective_gross_income', 1, '유효총수입', '잠재총수입에서 손실을 차감하고 기타 운영수입을 더한 금액', date '2026-08-01', '{}'::jsonb, '{"op":"add","left":{"op":"subtract","left":"potential_gross_income","right":"income_loss"},"right":"other_operating_income"}'::jsonb, 'KRW', 'Gate 6 SDD', 'approved', now(), '5f21a65d70935958b14410718173aace393208678a433c84b5bc7b83b36c4044'),
  ('operating_expense', 1, '운영비용', '반복 자산 운영비 합계', date '2026-08-01', '{}'::jsonb, '{"op":"sum","section":"operating_expense"}'::jsonb, 'KRW', '한국부동산원 상업용부동산 임대동향조사', 'approved', now(), 'ea75cb6482dc8786c471e97f647a9754760d31b62a2ee7af6b7f0b1b0f615055'),
  ('net_operating_income', 1, '순영업소득', '유효총수입에서 운영비용을 차감한 금액', date '2026-08-01', '{}'::jsonb, '{"op":"subtract","left":"effective_gross_income","right":"operating_expense"}'::jsonb, 'KRW', '한국부동산원 상업용부동산 임대동향조사', 'approved', now(), 'b43146a86b6f1f7407a77fba716289841855695301c42920279c517a2add6066'),
  ('asset_net_cash_flow', 1, '자산 순현금흐름', '순영업소득에서 자본적 지출 등을 조정한 금액', date '2026-08-01', '{}'::jsonb, '{"op":"asset_ncf"}'::jsonb, 'KRW', '한국신용평가 CMBS 평가방법론', 'approved', now(), '780195180135cf470e9fc288d6df98ecee30e42e888419affd9ba90b3da87077'),
  ('post_debt_cash_flow', 1, '부채상환 후 현금흐름', '대출 원장의 월별 상환 일정이 제공되지 않아 승인 전인 수식', date '2026-08-01', '{}'::jsonb, '{"op":"post_debt_cash_flow","repayment_schedule_status":"not_provided"}'::jsonb, 'KRW', 'Gate 6 SDD', 'draft', null, 'f26c9e12f86890926ed79b9946266059ec2375feb73304013175461aa6068088')
on conflict (formula_key, version) do nothing;

alter table logistics_core.assets enable row level security;
alter table logistics_core.funds enable row level security;
alter table logistics_core.fund_asset_links enable row level security;
alter table logistics_core.fund_beneficiary_tranches enable row level security;
alter table logistics_core.lenders enable row level security;
alter table logistics_core.loans enable row level security;
alter table logistics_core.loan_lenders enable row level security;
alter table logistics_core.tenants enable row level security;
alter table logistics_core.lease_contracts enable row level security;
alter table logistics_core.spaces enable row level security;
alter table logistics_core.contract_spaces enable row level security;
alter table logistics_core.rent_terms enable row level security;
alter table logistics_core.rent_term_history enable row level security;
alter table logistics_core.lease_attributes enable row level security;
alter table logistics_core.cashflow_accounts enable row level security;
alter table logistics_core.monthly_ledger_entries enable row level security;
alter table logistics_core.ledger_adjustments enable row level security;
alter table logistics_core.user_permission_profiles enable row level security;
alter table logistics_core.user_asset_assignments enable row level security;
alter table logistics_core.asset_writer_routes enable row level security;
alter table logistics_core.platform_feature_flags enable row level security;
alter table logistics_core.platform_pilot_users enable row level security;
alter table logistics_core.maturities enable row level security;
alter table logistics_core.maturity_schedules enable row level security;
alter table logistics_core.maturity_asset_scopes enable row level security;
alter table logistics_core.formula_definitions enable row level security;
alter table logistics_core.api_idempotency_keys enable row level security;
alter table logistics_core.audit_events enable row level security;
alter table logistics_core.migration_runs enable row level security;
alter table logistics_core.migration_field_mappings enable row level security;
alter table logistics_core.migration_row_mappings enable row level security;
alter table logistics_core.migration_exceptions enable row level security;
alter table logistics_core.legacy_projection_state enable row level security;
alter table logistics_core.rollback_export_state enable row level security;

revoke all on all tables in schema logistics_core from public, anon, authenticated;
revoke all on all sequences in schema logistics_core from public, anon, authenticated;
grant select, insert, update, delete on all tables in schema logistics_core to service_role;
grant usage, select on all sequences in schema logistics_core to service_role;

revoke all on all functions in schema logistics_core from public, anon, authenticated;

commit;
