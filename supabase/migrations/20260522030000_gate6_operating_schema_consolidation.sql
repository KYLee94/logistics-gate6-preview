-- Gate 6 operating schema consolidation.
-- Goal: reduce physical public.ll_* tables while preserving current Edge/API contracts.
-- Strategy:
--   1. Create consolidated target tables.
--   2. Backfill every legacy row with source/audit payload preserved.
--   3. Move source-cell FK from legacy ll_import_runs to ll_source_runs.
--   4. Drop legacy physical tables and recreate compatibility views where runtime reads may still exist.
--   5. Keep rollback evidence inside ll_audit_events.

begin;

create table if not exists public.ll_source_runs (
  source_run_id text primary key,
  record_type text not null check (record_type in ('import_run', 'sheet_row')),
  import_id text,
  sheet_row_id text,
  source_type text not null,
  source_name text not null,
  spreadsheet_id text,
  file_name text,
  sheet_name text,
  row_number integer,
  header_row_number integer,
  row_values_json jsonb not null default '{}'::jsonb,
  row_hash text,
  row_counts jsonb not null default '{}'::jsonb,
  status text not null default 'prepared',
  memo text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (record_type, import_id, sheet_name, row_number)
);

create index if not exists ll_source_runs_import_idx on public.ll_source_runs(import_id);
create index if not exists ll_source_runs_sheet_idx on public.ll_source_runs(source_type, source_name, sheet_name, row_number);

create table if not exists public.ll_lease_attributes (
  id uuid primary key default gen_random_uuid(),
  attribute_type text not null check (attribute_type in ('area_breakdown', 'space_spec', 'special_term')),
  lease_space_id text references public.ll_lease_spaces(lease_space_id) on update cascade on delete set null,
  lease_id text references public.ll_leases(lease_id) on update cascade on delete set null,
  asset_id text references public.ll_assets(asset_id) on update cascade on delete set null,
  tenant_id text references public.ll_tenants(tenant_id) on update cascade on delete set null,
  attribute_key text not null,
  attribute_label text,
  value_text text,
  value_numeric numeric,
  value_sqm numeric,
  value_py numeric,
  unit_label text,
  basis text not null default 'DB_general',
  source_table text not null,
  source_legacy_id text,
  source_sheet_row_id text,
  source_cell_id text references public.ll_source_cells(source_cell_id) on update cascade on delete set null,
  source_payload jsonb not null default '{}'::jsonb,
  review_status text,
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_table, source_legacy_id)
);

create index if not exists ll_lease_attributes_lookup_idx on public.ll_lease_attributes(attribute_type, lease_space_id, attribute_key);
create index if not exists ll_lease_attributes_asset_idx on public.ll_lease_attributes(asset_id, attribute_type);
create index if not exists ll_lease_attributes_lease_space_fk_idx on public.ll_lease_attributes(lease_space_id);
create index if not exists ll_lease_attributes_lease_fk_idx on public.ll_lease_attributes(lease_id);
create index if not exists ll_lease_attributes_asset_fk_idx on public.ll_lease_attributes(asset_id);
create index if not exists ll_lease_attributes_tenant_fk_idx on public.ll_lease_attributes(tenant_id);
create index if not exists ll_lease_attributes_source_cell_fk_idx on public.ll_lease_attributes(source_cell_id);

create table if not exists public.ll_fund_capital_tranches (
  id uuid primary key default gen_random_uuid(),
  fund_id text not null references public.ll_funds(fund_id) on update cascade on delete cascade,
  tranche_type text not null check (tranche_type in ('beneficiary', 'loan')),
  row_key text not null,
  tranche text,
  party_name text,
  committed_amount_krw numeric,
  drawdown_date date,
  maturity_date date,
  loan_period text,
  loan_type text,
  interest_type text,
  base_rate text,
  spread_rate text,
  loan_rate text,
  interest_rate text,
  fee text,
  fee_rate text,
  all_in text,
  all_in_rate text,
  display_order integer not null default 0,
  is_active boolean not null default true,
  deleted_at timestamptz,
  source_type text,
  source_name text,
  source_sheet_name text,
  source_row_number integer,
  source_cell_ids text[] not null default '{}'::text[],
  source_payload jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (fund_id, tranche_type, row_key)
);

create index if not exists ll_fund_capital_tranches_lookup_idx on public.ll_fund_capital_tranches(fund_id, tranche_type, is_active, display_order);
create index if not exists ll_fund_capital_tranches_fund_fk_idx on public.ll_fund_capital_tranches(fund_id);
create index if not exists ll_fund_capital_tranches_created_by_fk_idx on public.ll_fund_capital_tranches(created_by);
create index if not exists ll_fund_capital_tranches_updated_by_fk_idx on public.ll_fund_capital_tranches(updated_by);

create table if not exists public.ll_audit_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  action text,
  status_code integer,
  requested_by uuid references auth.users(id),
  edit_request_id uuid references public.ll_edit_requests(id) on update cascade on delete set null,
  target_table text,
  target_row_id text,
  target_cell_id text,
  field_name text,
  before_value text,
  after_value text,
  readback_value text,
  actor_id uuid references auth.users(id),
  approver_id uuid references auth.users(id),
  source_row_id text,
  source_cell_id text references public.ll_source_cells(source_cell_id) on update cascade on delete set null,
  approval_status text,
  legacy_table text,
  legacy_id text,
  finding_id text,
  audit_run_id text,
  finding_type text,
  severity text,
  entity_type text,
  entity_id text,
  source_sheet_name text,
  source_row_number integer,
  source_column_number integer,
  source_header text,
  source_value_text text,
  supabase_value_text text,
  event_status text,
  event_payload jsonb not null default '{}'::jsonb,
  request_payload jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ll_audit_events_type_created_idx on public.ll_audit_events(event_type, created_at desc);
create index if not exists ll_audit_events_requested_by_fk_idx on public.ll_audit_events(requested_by);
create index if not exists ll_audit_events_actor_fk_idx on public.ll_audit_events(actor_id);
create index if not exists ll_audit_events_approver_fk_idx on public.ll_audit_events(approver_id);
create index if not exists ll_audit_events_edit_request_fk_idx on public.ll_audit_events(edit_request_id);
create index if not exists ll_audit_events_target_idx on public.ll_audit_events(target_table, target_row_id, field_name);
create index if not exists ll_audit_events_source_cell_fk_idx on public.ll_audit_events(source_cell_id);

create table if not exists public.ll_work_items (
  id uuid primary key default gen_random_uuid(),
  item_type text not null check (item_type in ('issue', 'task', 'task_snapshot')),
  legacy_text_id text,
  entity_type text,
  entity_id text,
  asset_id text references public.ll_assets(asset_id) on update cascade on delete set null,
  tenant_id text references public.ll_tenants(tenant_id) on update cascade on delete set null,
  issue_type text,
  severity text,
  title text,
  description text,
  owner text,
  task_name text,
  company_name text,
  related_asset_id text references public.ll_assets(asset_id) on update cascade on delete set null,
  related_asset_name text,
  related_tenant_id text references public.ll_tenants(tenant_id) on update cascade on delete set null,
  next_action text,
  issue text,
  notes text,
  due_date date,
  priority text,
  status text not null default 'new',
  completed_at timestamptz,
  workspace text,
  week_key text,
  week_label text,
  week_range text,
  group_label text,
  basis_date date,
  snapshot_data jsonb not null default '[]'::jsonb,
  task_count integer not null default 0,
  created_by uuid references auth.users(id),
  created_by_email text,
  created_by_name text,
  organization text,
  payload jsonb not null default '{}'::jsonb,
  source_sheet_row_id text,
  source_payload jsonb not null default '{}'::jsonb,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (item_type, legacy_text_id),
  unique (item_type, workspace, week_key, created_by)
);

create index if not exists ll_work_items_type_status_idx on public.ll_work_items(item_type, status, created_at desc);
create index if not exists ll_work_items_related_asset_idx on public.ll_work_items(related_asset_id, status, created_at desc);
create index if not exists ll_work_items_created_by_fk_idx on public.ll_work_items(created_by);
create index if not exists ll_work_items_asset_fk_idx on public.ll_work_items(asset_id);
create index if not exists ll_work_items_related_asset_fk_idx on public.ll_work_items(related_asset_id);
create index if not exists ll_work_items_tenant_fk_idx on public.ll_work_items(tenant_id);
create index if not exists ll_work_items_related_tenant_fk_idx on public.ll_work_items(related_tenant_id);

create table if not exists public.ll_board_posts (
  id uuid primary key default gen_random_uuid(),
  log_id text not null unique,
  workspace_code text not null default 'WS_LOGISTICS',
  workspace_label text not null default 'Logistics Work Platform',
  work_date date not null default current_date,
  title text not null,
  content text not null,
  related_asset_id text references public.ll_assets(asset_id) on update cascade on delete set null,
  related_asset_name text,
  triage_type text,
  issue_status text,
  priority text,
  stakeholder_category text,
  stakeholder_name text,
  visibility_groups text[] not null default '{}'::text[],
  visibility_individuals text[] not null default '{}'::text[],
  comments jsonb not null default '[]'::jsonb,
  attachments jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  status text not null default 'active',
  created_by uuid references auth.users(id),
  created_by_email text,
  created_by_name text,
  organization text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ll_board_posts_asset_status_idx on public.ll_board_posts(related_asset_id, status, created_at desc);
create index if not exists ll_board_posts_created_by_fk_idx on public.ll_board_posts(created_by);
create index if not exists ll_board_posts_related_asset_fk_idx on public.ll_board_posts(related_asset_id);

create table if not exists public.ll_weekly_records (
  id uuid primary key default gen_random_uuid(),
  record_type text not null check (record_type in ('report', 'asset', 'project', 'doc_ingest')),
  report_id uuid references public.ll_weekly_records(id) on update cascade on delete cascade,
  week_key text,
  organization text,
  report_year integer,
  report_month integer,
  report_week integer,
  source_file_name text,
  source_sha256 text,
  source_text text,
  report_json jsonb not null default '{}'::jsonb,
  asset_code text,
  asset_name text,
  fund_code text,
  fund_name text,
  project_type text,
  project_name text,
  stakeholder text,
  status text,
  issue text,
  plan text,
  row_json jsonb not null default '{}'::jsonb,
  requested_by uuid references auth.users(id),
  parsed_counts jsonb not null default '{}'::jsonb,
  message text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ll_weekly_records_report_idx on public.ll_weekly_records(record_type, report_id, created_at);
create index if not exists ll_weekly_records_week_idx on public.ll_weekly_records(record_type, week_key, organization);
create index if not exists ll_weekly_records_asset_idx on public.ll_weekly_records(asset_name);
create index if not exists ll_weekly_records_report_fk_idx on public.ll_weekly_records(report_id);
create index if not exists ll_weekly_records_created_by_fk_idx on public.ll_weekly_records(created_by);
create index if not exists ll_weekly_records_requested_by_fk_idx on public.ll_weekly_records(requested_by);

alter table public.ll_source_runs enable row level security;
alter table public.ll_lease_attributes enable row level security;
alter table public.ll_fund_capital_tranches enable row level security;
alter table public.ll_audit_events enable row level security;
alter table public.ll_work_items enable row level security;
alter table public.ll_board_posts enable row level security;
alter table public.ll_weekly_records enable row level security;

insert into public.ll_source_runs (
  source_run_id, record_type, import_id, source_type, source_name, spreadsheet_id, file_name,
  started_at, finished_at, status, row_counts, memo, created_at, updated_at
)
select import_id, 'import_run', import_id, source_type, source_name, spreadsheet_id, file_name,
       started_at, finished_at, status, row_counts, memo, created_at, coalesce(finished_at, created_at, now())
from public.ll_import_runs
on conflict (source_run_id) do update set
  source_type = excluded.source_type,
  source_name = excluded.source_name,
  spreadsheet_id = excluded.spreadsheet_id,
  file_name = excluded.file_name,
  started_at = excluded.started_at,
  finished_at = excluded.finished_at,
  status = excluded.status,
  row_counts = excluded.row_counts,
  memo = excluded.memo,
  updated_at = now();

insert into public.ll_source_runs (
  source_run_id, record_type, import_id, sheet_row_id, source_type, source_name,
  sheet_name, row_number, header_row_number, row_values_json, row_hash, created_at, updated_at
)
select sheet_row_id, 'sheet_row', import_id, sheet_row_id, source_type, source_name,
       sheet_name, row_number, header_row_number, row_values_json, row_hash, created_at, created_at
from public.ll_sheet_rows
on conflict (source_run_id) do update set
  import_id = excluded.import_id,
  sheet_name = excluded.sheet_name,
  row_number = excluded.row_number,
  header_row_number = excluded.header_row_number,
  row_values_json = excluded.row_values_json,
  row_hash = excluded.row_hash,
  updated_at = now();

update public.ll_source_cells
set source_run_id = import_id,
    updated_at = now()
where coalesce(source_run_id, '') = ''
  and import_id is not null;

insert into public.ll_lease_attributes (
  id, attribute_type, lease_space_id, lease_id, asset_id, tenant_id, attribute_key, attribute_label,
  value_sqm, value_py, basis, source_table, source_legacy_id, source_sheet_row_id, source_cell_id,
  source_payload, review_status, review_note, created_at, updated_at
)
select id, 'area_breakdown', lease_space_id, lease_id, asset_id, tenant_id, area_type, area_label,
       area_sqm, area_py, basis, 'public.ll_lease_space_area_breakdowns', id::text, source_sheet_row_id, source_cell_id,
       source_payload, review_status, review_note, created_at, updated_at
from public.ll_lease_space_area_breakdowns
on conflict (source_table, source_legacy_id) do update set
  lease_space_id = excluded.lease_space_id,
  lease_id = excluded.lease_id,
  asset_id = excluded.asset_id,
  tenant_id = excluded.tenant_id,
  attribute_key = excluded.attribute_key,
  attribute_label = excluded.attribute_label,
  value_sqm = excluded.value_sqm,
  value_py = excluded.value_py,
  basis = excluded.basis,
  source_sheet_row_id = excluded.source_sheet_row_id,
  source_cell_id = excluded.source_cell_id,
  source_payload = excluded.source_payload,
  review_status = excluded.review_status,
  review_note = excluded.review_note,
  updated_at = now();

insert into public.ll_lease_attributes (
  id, attribute_type, lease_space_id, lease_id, asset_id, tenant_id, attribute_key, attribute_label,
  value_text, value_numeric, unit_label, basis, source_table, source_legacy_id, source_sheet_row_id,
  source_cell_id, source_payload, review_status, review_note, created_at, updated_at
)
select id, 'space_spec', lease_space_id, lease_id, asset_id, tenant_id, spec_key, spec_label,
       spec_value, spec_numeric, unit_label, basis, 'public.ll_lease_space_specs', id::text, source_sheet_row_id,
       source_cell_id, source_payload, review_status, review_note, created_at, updated_at
from public.ll_lease_space_specs
on conflict (source_table, source_legacy_id) do update set
  lease_space_id = excluded.lease_space_id,
  lease_id = excluded.lease_id,
  asset_id = excluded.asset_id,
  tenant_id = excluded.tenant_id,
  attribute_key = excluded.attribute_key,
  attribute_label = excluded.attribute_label,
  value_text = excluded.value_text,
  value_numeric = excluded.value_numeric,
  unit_label = excluded.unit_label,
  basis = excluded.basis,
  source_sheet_row_id = excluded.source_sheet_row_id,
  source_cell_id = excluded.source_cell_id,
  source_payload = excluded.source_payload,
  review_status = excluded.review_status,
  review_note = excluded.review_note,
  updated_at = now();

insert into public.ll_lease_attributes (
  id, attribute_type, lease_space_id, lease_id, asset_id, tenant_id, attribute_key, attribute_label,
  value_text, value_numeric, unit_label, basis, source_table, source_legacy_id, source_sheet_row_id,
  source_cell_id, source_payload, review_status, review_note, created_at, updated_at
)
select id, 'special_term', lease_space_id, lease_id, asset_id, tenant_id, term_key, term_label,
       term_value, term_numeric, unit_label, basis, 'public.ll_lease_special_terms', id::text, source_sheet_row_id,
       source_cell_id, source_payload, review_status, review_note, created_at, updated_at
from public.ll_lease_special_terms
on conflict (source_table, source_legacy_id) do update set
  lease_space_id = excluded.lease_space_id,
  lease_id = excluded.lease_id,
  asset_id = excluded.asset_id,
  tenant_id = excluded.tenant_id,
  attribute_key = excluded.attribute_key,
  attribute_label = excluded.attribute_label,
  value_text = excluded.value_text,
  value_numeric = excluded.value_numeric,
  unit_label = excluded.unit_label,
  basis = excluded.basis,
  source_sheet_row_id = excluded.source_sheet_row_id,
  source_cell_id = excluded.source_cell_id,
  source_payload = excluded.source_payload,
  review_status = excluded.review_status,
  review_note = excluded.review_note,
  updated_at = now();

insert into public.ll_fund_capital_tranches (
  id, fund_id, tranche_type, row_key, tranche, party_name, committed_amount_krw,
  display_order, is_active, deleted_at, source_type, source_name, source_sheet_name, source_row_number,
  source_cell_ids, source_payload, created_by, updated_by, created_at, updated_at
)
select id, fund_id, 'beneficiary', row_key, tranche, beneficiary_name, committed_amount_krw,
       display_order, is_active, deleted_at, source_type, source_name, source_sheet_name, source_row_number,
       source_cell_ids, source_payload, created_by, updated_by, created_at, updated_at
from public.ll_fund_beneficiary_tranches
on conflict (fund_id, tranche_type, row_key) do update set
  tranche = excluded.tranche,
  party_name = excluded.party_name,
  committed_amount_krw = excluded.committed_amount_krw,
  display_order = excluded.display_order,
  is_active = excluded.is_active,
  deleted_at = excluded.deleted_at,
  source_type = excluded.source_type,
  source_name = excluded.source_name,
  source_sheet_name = excluded.source_sheet_name,
  source_row_number = excluded.source_row_number,
  source_cell_ids = excluded.source_cell_ids,
  source_payload = excluded.source_payload,
  updated_by = excluded.updated_by,
  updated_at = now();

insert into public.ll_fund_capital_tranches (
  id, fund_id, tranche_type, row_key, tranche, party_name, committed_amount_krw,
  drawdown_date, maturity_date, loan_period, loan_type, interest_type, base_rate, spread_rate,
  loan_rate, interest_rate, fee, fee_rate, all_in, all_in_rate, display_order, is_active, deleted_at,
  source_type, source_name, source_sheet_name, source_row_number, source_cell_ids, source_payload,
  created_by, updated_by, created_at, updated_at
)
select id, fund_id, 'loan', row_key, tranche, lender_name, committed_amount_krw,
       drawdown_date, maturity_date, loan_period, loan_type, interest_type, base_rate, spread_rate,
       loan_rate, interest_rate, fee, fee_rate, all_in, all_in_rate, display_order, is_active, deleted_at,
       source_type, source_name, source_sheet_name, source_row_number, source_cell_ids, source_payload,
       created_by, updated_by, created_at, updated_at
from public.ll_fund_loan_tranches
on conflict (fund_id, tranche_type, row_key) do update set
  tranche = excluded.tranche,
  party_name = excluded.party_name,
  committed_amount_krw = excluded.committed_amount_krw,
  drawdown_date = excluded.drawdown_date,
  maturity_date = excluded.maturity_date,
  loan_period = excluded.loan_period,
  loan_type = excluded.loan_type,
  interest_type = excluded.interest_type,
  base_rate = excluded.base_rate,
  spread_rate = excluded.spread_rate,
  loan_rate = excluded.loan_rate,
  interest_rate = excluded.interest_rate,
  fee = excluded.fee,
  fee_rate = excluded.fee_rate,
  all_in = excluded.all_in,
  all_in_rate = excluded.all_in_rate,
  display_order = excluded.display_order,
  is_active = excluded.is_active,
  deleted_at = excluded.deleted_at,
  source_type = excluded.source_type,
  source_name = excluded.source_name,
  source_sheet_name = excluded.source_sheet_name,
  source_row_number = excluded.source_row_number,
  source_cell_ids = excluded.source_cell_ids,
  source_payload = excluded.source_payload,
  updated_by = excluded.updated_by,
  updated_at = now();

insert into public.ll_audit_events (
  id, event_type, action, status_code, requested_by, request_payload, legacy_table, legacy_id, created_at, updated_at
)
select id, 'api', action, status_code, requested_by, request_payload, 'public.ll_api_audit_logs', id::text, created_at, created_at
from public.ll_api_audit_logs
on conflict (id) do nothing;

insert into public.ll_audit_events (
  id, event_type, action, edit_request_id, target_table, target_row_id, target_cell_id, field_name,
  before_value, after_value, readback_value, actor_id, approver_id, source_row_id, source_cell_id,
  approval_status, metadata, legacy_table, legacy_id, created_at, updated_at
)
select id, 'data_change', action, edit_request_id, target_table, target_row_id, target_cell_id, field_name,
       before_value, after_value, readback_value, actor_id, approver_id, source_row_id,
       nullif(nullif(source_cell_id, ''), 'undefined') as source_cell_id,
       approval_status, metadata, 'public.ll_data_change_audit_logs', id::text, created_at, created_at
from public.ll_data_change_audit_logs
on conflict (id) do nothing;

insert into public.ll_audit_events (
  id, event_type, source_row_id, source_sheet_name, source_row_number, event_payload,
  legacy_table, legacy_id, created_at, updated_at
)
select id, 'source_review', source_row_id, sheet_name, row_number,
       jsonb_build_object(
         'source_type', source_type,
         'source_name', source_name,
         'sheet_name', sheet_name,
         'log_date', log_date,
         'reviewer_name', reviewer_name,
         'check_category', check_category,
         'check_result', check_result,
         'review_memo', review_memo,
         'proposed_action', proposed_action,
         'source_payload', source_payload
       ),
       'public.ll_source_review_logs', id::text, created_at, updated_at
from public.ll_source_review_logs
on conflict (id) do nothing;

insert into public.ll_audit_events (
  event_type, finding_id, audit_run_id, finding_type, severity, entity_type, entity_id,
  source_sheet_name, source_row_number, source_column_number, source_header, source_value_text,
  supabase_value_text, event_status, event_payload, legacy_table, legacy_id, created_at, updated_at
)
select 'data_quality_finding', finding_id, audit_run_id, finding_type, severity, entity_type, entity_id,
       source_sheet_name, source_row_number, source_column_number, source_header, source_value_text,
       supabase_value_text, status, finding_payload, 'public.ll_data_quality_findings', finding_id, created_at, updated_at
from public.ll_data_quality_findings
on conflict do nothing;

insert into public.ll_work_items (
  item_type, legacy_text_id, entity_type, entity_id, asset_id, tenant_id, issue_type, severity,
  title, description, status, due_date, owner, source_sheet_row_id, source_payload, created_at, updated_at
)
select 'issue', issue_id, entity_type, entity_id, asset_id, tenant_id, issue_type, severity,
       title, description, coalesce(status, 'open'), due_date, owner, source_sheet_row_id, source_payload, created_at, updated_at
from public.ll_issues
on conflict (item_type, legacy_text_id) do update set
  entity_type = excluded.entity_type,
  entity_id = excluded.entity_id,
  asset_id = excluded.asset_id,
  tenant_id = excluded.tenant_id,
  issue_type = excluded.issue_type,
  severity = excluded.severity,
  title = excluded.title,
  description = excluded.description,
  status = excluded.status,
  due_date = excluded.due_date,
  owner = excluded.owner,
  source_payload = excluded.source_payload,
  updated_at = now();

insert into public.ll_work_items (
  id, item_type, task_name, company_name, related_asset_id, related_asset_name, related_tenant_id,
  next_action, issue, notes, due_date, priority, status, completed_at, created_by, created_by_email,
  created_by_name, organization, payload, deleted_at, created_at, updated_at
)
select id, 'task', task_name, company_name, related_asset_id, related_asset_name, related_tenant_id,
       next_action, issue, notes, due_date, priority, status, completed_at, created_by, created_by_email,
       created_by_name, organization, payload, deleted_at, created_at, updated_at
from public.ll_work_platform_tasks
on conflict (id) do update set
  task_name = excluded.task_name,
  company_name = excluded.company_name,
  related_asset_id = excluded.related_asset_id,
  related_asset_name = excluded.related_asset_name,
  related_tenant_id = excluded.related_tenant_id,
  next_action = excluded.next_action,
  issue = excluded.issue,
  notes = excluded.notes,
  due_date = excluded.due_date,
  priority = excluded.priority,
  status = excluded.status,
  completed_at = excluded.completed_at,
  payload = excluded.payload,
  deleted_at = excluded.deleted_at,
  updated_at = now();

insert into public.ll_work_items (
  id, item_type, workspace, week_key, week_label, week_range, group_label, basis_date,
  snapshot_data, task_count, created_by, created_by_email, created_by_name, organization,
  payload, created_at, updated_at
)
select id, 'task_snapshot', workspace, week_key, week_label, week_range, group_label, basis_date,
       snapshot_data, task_count, created_by, created_by_email, created_by_name, organization,
       payload, created_at, updated_at
from public.ll_work_platform_task_snapshots
on conflict (id) do update set
  workspace = excluded.workspace,
  week_key = excluded.week_key,
  week_label = excluded.week_label,
  week_range = excluded.week_range,
  group_label = excluded.group_label,
  basis_date = excluded.basis_date,
  snapshot_data = excluded.snapshot_data,
  task_count = excluded.task_count,
  payload = excluded.payload,
  updated_at = now();

insert into public.ll_board_posts (
  id, log_id, workspace_code, workspace_label, work_date, title, content, related_asset_id, related_asset_name,
  triage_type, issue_status, priority, stakeholder_category, stakeholder_name, visibility_groups,
  visibility_individuals, comments, attachments, metadata, status, created_by, created_by_email,
  created_by_name, organization, deleted_at, created_at, updated_at
)
select id, log_id, workspace_code, workspace_label, work_date, title, content, related_asset_id, related_asset_name,
       triage_type, issue_status, priority, stakeholder_category, stakeholder_name, visibility_groups,
       visibility_individuals, comments, attachments, metadata, status, created_by, created_by_email,
       created_by_name, organization, deleted_at, created_at, updated_at
from public.ll_work_platform_board_posts
on conflict (id) do update set
  log_id = excluded.log_id,
  title = excluded.title,
  content = excluded.content,
  related_asset_id = excluded.related_asset_id,
  related_asset_name = excluded.related_asset_name,
  triage_type = excluded.triage_type,
  issue_status = excluded.issue_status,
  priority = excluded.priority,
  stakeholder_category = excluded.stakeholder_category,
  stakeholder_name = excluded.stakeholder_name,
  visibility_groups = excluded.visibility_groups,
  visibility_individuals = excluded.visibility_individuals,
  comments = excluded.comments,
  attachments = excluded.attachments,
  metadata = excluded.metadata,
  status = excluded.status,
  deleted_at = excluded.deleted_at,
  updated_at = now();

insert into public.ll_weekly_records (
  id, record_type, week_key, organization, report_year, report_month, report_week,
  source_file_name, source_sha256, source_text, report_json, created_by, created_at, updated_at
)
select id, 'report', week_key, organization, report_year, report_month, report_week,
       source_file_name, source_sha256, source_text, report_json, created_by, created_at, updated_at
from public.ll_weekly_reports
on conflict (id) do update set
  week_key = excluded.week_key,
  organization = excluded.organization,
  report_year = excluded.report_year,
  report_month = excluded.report_month,
  report_week = excluded.report_week,
  source_file_name = excluded.source_file_name,
  source_sha256 = excluded.source_sha256,
  source_text = excluded.source_text,
  report_json = excluded.report_json,
  updated_at = now();

insert into public.ll_weekly_records (
  id, record_type, report_id, asset_code, asset_name, fund_code, fund_name,
  status, issue, plan, row_json, created_at, updated_at
)
select id, 'asset', report_id, asset_code, asset_name, fund_code, fund_name,
       status, issue, plan, row_json, created_at, created_at
from public.ll_weekly_assets
on conflict (id) do update set
  report_id = excluded.report_id,
  asset_code = excluded.asset_code,
  asset_name = excluded.asset_name,
  fund_code = excluded.fund_code,
  fund_name = excluded.fund_name,
  status = excluded.status,
  issue = excluded.issue,
  plan = excluded.plan,
  row_json = excluded.row_json,
  updated_at = now();

insert into public.ll_weekly_records (
  id, record_type, report_id, project_type, project_name, stakeholder,
  status, issue, plan, row_json, created_at, updated_at
)
select id, 'project', report_id, project_type, project_name, stakeholder,
       status, issue, plan, row_json, created_at, created_at
from public.ll_weekly_projects
on conflict (id) do update set
  report_id = excluded.report_id,
  project_type = excluded.project_type,
  project_name = excluded.project_name,
  stakeholder = excluded.stakeholder,
  status = excluded.status,
  issue = excluded.issue,
  plan = excluded.plan,
  row_json = excluded.row_json,
  updated_at = now();

insert into public.ll_weekly_records (
  id, record_type, report_id, week_key, organization, source_file_name, source_sha256,
  requested_by, status, message, parsed_counts, created_at, updated_at
)
select id, 'doc_ingest', report_id, week_key, organization, source_file_name, source_sha256,
       requested_by, status, message, parsed_counts, created_at, created_at
from public.ll_weekly_doc_ingest_runs
on conflict (id) do update set
  report_id = excluded.report_id,
  week_key = excluded.week_key,
  organization = excluded.organization,
  source_file_name = excluded.source_file_name,
  source_sha256 = excluded.source_sha256,
  requested_by = excluded.requested_by,
  status = excluded.status,
  message = excluded.message,
  parsed_counts = excluded.parsed_counts,
  updated_at = now();

insert into public.ll_audit_events (event_type, legacy_table, legacy_id, event_payload, created_at, updated_at)
select 'legacy_table_backup', table_name, row_key, before_payload, created_at, created_at
from public.ll_migration_row_backups
on conflict do nothing;

-- Guard row counts before destructive consolidation.
do $$
declare
  old_area integer := (select count(*) from public.ll_lease_space_area_breakdowns);
  old_specs integer := (select count(*) from public.ll_lease_space_specs);
  old_terms integer := (select count(*) from public.ll_lease_special_terms);
  old_beneficiaries integer := (select count(*) from public.ll_fund_beneficiary_tranches);
  old_loans integer := (select count(*) from public.ll_fund_loan_tranches);
  old_weekly integer := (select count(*) from public.ll_weekly_reports) + (select count(*) from public.ll_weekly_assets) + (select count(*) from public.ll_weekly_projects) + (select count(*) from public.ll_weekly_doc_ingest_runs);
  new_area integer := (select count(*) from public.ll_lease_attributes where attribute_type = 'area_breakdown');
  new_specs integer := (select count(*) from public.ll_lease_attributes where attribute_type = 'space_spec');
  new_terms integer := (select count(*) from public.ll_lease_attributes where attribute_type = 'special_term');
  new_beneficiaries integer := (select count(*) from public.ll_fund_capital_tranches where tranche_type = 'beneficiary');
  new_loans integer := (select count(*) from public.ll_fund_capital_tranches where tranche_type = 'loan');
  new_weekly integer := (select count(*) from public.ll_weekly_records);
begin
  if new_area < old_area then raise exception 'area breakdown backfill incomplete: old %, new %', old_area, new_area; end if;
  if new_specs < old_specs then raise exception 'space specs backfill incomplete: old %, new %', old_specs, new_specs; end if;
  if new_terms < old_terms then raise exception 'special terms backfill incomplete: old %, new %', old_terms, new_terms; end if;
  if new_beneficiaries < old_beneficiaries then raise exception 'beneficiary backfill incomplete: old %, new %', old_beneficiaries, new_beneficiaries; end if;
  if new_loans < old_loans then raise exception 'loan backfill incomplete: old %, new %', old_loans, new_loans; end if;
  if new_weekly < old_weekly then raise exception 'weekly backfill incomplete: old %, new %', old_weekly, new_weekly; end if;
end $$;

commit;

/*
Phase 2 compatibility swap/drop is intentionally disabled in this migration file.

Reason:
- Current Edge/API runtime still reads and writes several legacy table names directly.
- Dropping physical tables and recreating compatibility views before those runtime paths are fully
  converted can break Work Platform, Weekly, Fund, Audit, and Data Quality writes.
- Keep this block as the reviewed future cleanup draft only. Execute it later as a separate
  approved cleanup migration after runtime reference count is 0 and rollback/export SQL is ready.

alter table public.ll_source_cells drop constraint if exists ll_source_cells_import_id_fkey;
alter table public.ll_source_cells
  add constraint ll_source_cells_source_run_id_fkey
  foreign key (source_run_id) references public.ll_source_runs(source_run_id)
  on update cascade on delete set null;
create index if not exists ll_source_cells_source_run_fk_idx on public.ll_source_cells(source_run_id);

drop table if exists public.ll_lease_space_area_breakdowns;
drop table if exists public.ll_lease_space_specs;
drop table if exists public.ll_lease_special_terms;
drop table if exists public.ll_fund_beneficiary_tranches;
drop table if exists public.ll_fund_loan_tranches;
drop table if exists public.ll_api_audit_logs;
drop table if exists public.ll_data_change_audit_logs;
drop table if exists public.ll_source_review_logs;
drop table if exists public.ll_issues;
drop table if exists public.ll_work_platform_task_snapshots;
drop table if exists public.ll_work_platform_tasks;
drop table if exists public.ll_work_platform_board_posts;
drop table if exists public.ll_weekly_assets;
drop table if exists public.ll_weekly_projects;
drop table if exists public.ll_weekly_doc_ingest_runs;
drop table if exists public.ll_weekly_reports;
drop table if exists public.ll_sheet_rows;
drop table if exists public.ll_import_runs;
drop table if exists public.ll_data_quality_findings;
drop table if exists public.ll_asset_managers;
drop table if exists public.ll_migration_row_backups;

create view public.ll_lease_space_area_breakdowns as
select id, lease_space_id, lease_id, asset_id, tenant_id,
       attribute_key as area_type, attribute_label as area_label,
       value_sqm as area_sqm, value_py as area_py, basis, source_sheet_row_id,
       source_cell_id, source_payload, review_status, review_note, created_at, updated_at
from public.ll_lease_attributes
where attribute_type = 'area_breakdown';

create view public.ll_lease_space_specs as
select id, lease_space_id, lease_id, asset_id, tenant_id,
       attribute_key as spec_key, attribute_label as spec_label,
       value_text as spec_value, value_numeric as spec_numeric, unit_label, basis,
       source_sheet_row_id, source_cell_id, source_payload, review_status, review_note, created_at, updated_at
from public.ll_lease_attributes
where attribute_type = 'space_spec';

create view public.ll_lease_special_terms as
select id, lease_id, lease_space_id, asset_id, tenant_id,
       attribute_key as term_key, attribute_label as term_label,
       value_text as term_value, value_numeric as term_numeric, unit_label, basis,
       source_sheet_row_id, source_cell_id, source_payload, review_status, review_note, created_at, updated_at
from public.ll_lease_attributes
where attribute_type = 'special_term';

create view public.ll_fund_beneficiary_tranches as
select id, fund_id, row_key, tranche, party_name as beneficiary_name, committed_amount_krw,
       display_order, is_active, deleted_at, source_type, source_name, source_sheet_name, source_row_number,
       source_cell_ids, source_payload, created_by, updated_by, created_at, updated_at
from public.ll_fund_capital_tranches
where tranche_type = 'beneficiary';

create view public.ll_fund_loan_tranches as
select id, fund_id, row_key, tranche, party_name as lender_name, committed_amount_krw,
       drawdown_date, maturity_date, loan_period, interest_rate, fee, all_in, display_order,
       is_active, deleted_at, source_type, source_name, source_sheet_name, source_row_number,
       source_cell_ids, source_payload, created_by, updated_by, created_at, updated_at,
       loan_type, interest_type, base_rate, spread_rate, loan_rate, fee_rate, all_in_rate
from public.ll_fund_capital_tranches
where tranche_type = 'loan';

create view public.ll_api_audit_logs as
select id, action, status_code, requested_by, request_payload, created_at
from public.ll_audit_events
where event_type = 'api';

create view public.ll_data_change_audit_logs as
select id, edit_request_id, action, target_table, target_row_id, target_cell_id, field_name,
       before_value, after_value, readback_value, actor_id, approver_id, source_row_id,
       source_cell_id, approval_status, metadata, created_at
from public.ll_audit_events
where event_type in ('data_change', 'fund_overview_write');

create view public.ll_source_review_logs as
select id, coalesce(event_payload->>'source_type', 'xlsx') as source_type,
       event_payload->>'source_name' as source_name,
       coalesce(event_payload->>'sheet_name', source_sheet_name, 'Log') as sheet_name,
       source_row_id,
       source_row_number as row_number,
       event_payload->>'log_date' as log_date,
       event_payload->>'reviewer_name' as reviewer_name,
       event_payload->>'check_category' as check_category,
       event_payload->>'check_result' as check_result,
       event_payload->>'review_memo' as review_memo,
       event_payload->>'proposed_action' as proposed_action,
       coalesce(event_payload->'source_payload', '{}'::jsonb) as source_payload,
       created_at, updated_at
from public.ll_audit_events
where event_type = 'source_review';

create view public.ll_data_quality_findings as
select coalesce(finding_id, legacy_id) as finding_id, audit_run_id, finding_type,
       coalesce(severity, 'warning') as severity, entity_type, entity_id,
       source_sheet_name, source_row_number, source_column_number, source_header,
       source_value_text, supabase_value_text, coalesce(event_status, 'open') as status,
       event_payload as finding_payload, created_at, updated_at
from public.ll_audit_events
where event_type = 'data_quality_finding';

create view public.ll_issues as
select legacy_text_id as issue_id, entity_type, entity_id, asset_id, tenant_id, issue_type,
       severity, title, description, status, due_date, owner, source_sheet_row_id,
       source_payload, created_at, updated_at
from public.ll_work_items
where item_type = 'issue';

create view public.ll_work_platform_tasks as
select id, task_name, company_name, related_asset_id, related_asset_name, related_tenant_id,
       next_action, issue, notes, due_date, priority, status, completed_at, created_by,
       created_by_email, created_by_name, organization, payload, deleted_at, created_at, updated_at
from public.ll_work_items
where item_type = 'task';

create view public.ll_work_platform_task_snapshots as
select id, workspace, week_key, week_label, week_range, group_label, basis_date, snapshot_data,
       task_count, created_by, created_by_email, created_by_name, organization, payload, created_at, updated_at
from public.ll_work_items
where item_type = 'task_snapshot';

create view public.ll_work_platform_board_posts as
select * from public.ll_board_posts;

create view public.ll_weekly_reports as
select id, week_key, organization, report_year, report_month, report_week, source_file_name,
       source_sha256, source_text, report_json, created_by, created_at, updated_at
from public.ll_weekly_records
where record_type = 'report';

create view public.ll_weekly_assets as
select id, report_id, asset_code, asset_name, fund_code, fund_name, status, issue, plan, row_json, created_at
from public.ll_weekly_records
where record_type = 'asset';

create view public.ll_weekly_projects as
select id, report_id, project_type, project_name, stakeholder, status, issue, plan, row_json, created_at
from public.ll_weekly_records
where record_type = 'project';

create view public.ll_weekly_doc_ingest_runs as
select id, report_id, week_key, organization, source_file_name, source_sha256,
       requested_by, status, message, parsed_counts, created_at
from public.ll_weekly_records
where record_type = 'doc_ingest';

create view public.ll_import_runs as
select import_id, source_type, source_name, spreadsheet_id, file_name, started_at, finished_at,
       status, row_counts, memo, created_at
from public.ll_source_runs
where record_type = 'import_run';

create view public.ll_sheet_rows as
select sheet_row_id, import_id, source_type, source_name, sheet_name, row_number,
       header_row_number, row_values_json, row_hash, created_at
from public.ll_source_runs
where record_type = 'sheet_row';

create view public.ll_asset_managers as
select
  'asset_manager_' || asset_id as asset_manager_id,
  asset_id,
  asset_code,
  asset_name,
  fund_code,
  fund_name,
  current_manager_name as manager_name,
  current_manager_team as manager_team,
  current_manager_email as manager_email,
  source_sheet_row_id,
  source_payload,
  created_at,
  updated_at
from public.ll_assets;

create view public.ll_migration_row_backups as
select id, coalesce(event_payload->>'migration_id', split_part(coalesce(legacy_id, ''), ':', 1)) as migration_id,
       coalesce(legacy_table, event_payload->>'table_name') as table_name,
       coalesce(event_payload->>'row_key', split_part(coalesce(legacy_id, ''), ':', 2)) as row_key,
       event_payload as before_payload,
       created_at
from public.ll_audit_events
where event_type in ('legacy_table_backup', 'migration_row_backup');

grant select on public.ll_lease_space_area_breakdowns to service_role;
grant select on public.ll_lease_space_specs to service_role;
grant select on public.ll_lease_special_terms to service_role;
grant select on public.ll_source_review_logs to service_role;
grant select on public.ll_data_quality_findings to service_role;
grant select on public.ll_issues to service_role;
grant select on public.ll_import_runs to service_role;
grant select on public.ll_sheet_rows to service_role;
grant select on public.ll_asset_managers to service_role;
grant select on public.ll_migration_row_backups to service_role;
grant select, insert, update, delete on public.ll_fund_beneficiary_tranches to service_role;
grant select, insert, update, delete on public.ll_fund_loan_tranches to service_role;
grant select, insert on public.ll_api_audit_logs to service_role;
grant select, insert on public.ll_data_change_audit_logs to service_role;
grant select, insert, update, delete on public.ll_work_platform_tasks to service_role;
grant select, insert, update, delete on public.ll_work_platform_task_snapshots to service_role;
grant select, insert, update, delete on public.ll_work_platform_board_posts to service_role;
grant select, insert, update, delete on public.ll_weekly_reports to service_role;
grant select, insert, update, delete on public.ll_weekly_assets to service_role;
grant select, insert, update, delete on public.ll_weekly_projects to service_role;
grant select, insert, update, delete on public.ll_weekly_doc_ingest_runs to service_role;

insert into public.ll_schema_metadata (
  metadata_key, object_type, table_schema, table_name, domain_group, role_category, description, is_active, updated_at
)
values
  ('public.ll_source_runs', 'table', 'public', 'll_source_runs', 'Raw Source', 'keep', 'Unified import run and sheet row registry.', true, now()),
  ('public.ll_lease_attributes', 'table', 'public', 'll_lease_attributes', 'Detail Normalized', 'keep', 'Unified lease-space area/spec/special-term attributes.', true, now()),
  ('public.ll_fund_capital_tranches', 'table', 'public', 'll_fund_capital_tranches', 'Fund', 'keep', 'Unified beneficiary and loan capital tranche table.', true, now()),
  ('public.ll_audit_events', 'table', 'public', 'll_audit_events', 'Permission / Audit', 'delete_prohibited', 'Unified API, data-change, source-review, finding, and migration audit event table.', true, now()),
  ('public.ll_work_items', 'table', 'public', 'll_work_items', 'Work Platform / Weekly', 'keep', 'Unified work-platform issue, task, and task snapshot table.', true, now()),
  ('public.ll_board_posts', 'table', 'public', 'll_board_posts', 'Work Platform / Weekly', 'keep', 'Work-platform collaboration board post table.', true, now()),
  ('public.ll_weekly_records', 'table', 'public', 'll_weekly_records', 'Work Platform / Weekly', 'keep', 'Unified weekly report, asset, project, and ingest-run record table.', true, now())
on conflict (metadata_key) do update set
  domain_group = excluded.domain_group,
  role_category = excluded.role_category,
  description = excluded.description,
  is_active = true,
  updated_at = now();

update public.ll_schema_metadata
set is_active = false,
    updated_at = now()
where table_schema = 'public'
  and table_name in (
    'll_lease_space_area_breakdowns',
    'll_lease_space_specs',
    'll_lease_special_terms',
    'll_fund_beneficiary_tranches',
    'll_fund_loan_tranches',
    'll_api_audit_logs',
    'll_data_change_audit_logs',
    'll_source_review_logs',
    'll_issues',
    'll_work_platform_tasks',
    'll_work_platform_board_posts',
    'll_work_platform_task_snapshots',
    'll_weekly_reports',
    'll_weekly_assets',
    'll_weekly_projects',
    'll_weekly_doc_ingest_runs',
    'll_import_runs',
    'll_sheet_rows',
    'll_data_quality_findings',
    'll_asset_managers',
    'll_migration_row_backups'
  );

*/
