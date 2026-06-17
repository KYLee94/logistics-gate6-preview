-- Gate 6 sector meeting data model refresh.
-- This migration intentionally replaces the old ll_market_* RAG tables with a
-- workbook-first market source model. Apply only after reviewing the generated
-- preflight report because it drops old market retrieval tables/storage objects.

begin;

create extension if not exists pgcrypto with schema public;

create table if not exists public.ll_market_deprecation_backups (
  backup_id uuid primary key default gen_random_uuid(),
  backup_scope text not null,
  source_table text,
  source_bucket text,
  row_count bigint,
  object_count bigint,
  snapshot_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

insert into public.ll_market_deprecation_backups (backup_scope, source_table, row_count, snapshot_payload)
select 'pre_drop_market_rag', 'll_market_documents', count(*), jsonb_build_object('table', 'public.ll_market_documents')
from public.ll_market_documents
where to_regclass('public.ll_market_documents') is not null
on conflict do nothing;

insert into public.ll_market_deprecation_backups (backup_scope, source_table, row_count, snapshot_payload)
select 'pre_drop_market_rag', 'll_market_chunks', count(*), jsonb_build_object('table', 'public.ll_market_chunks')
from public.ll_market_chunks
where to_regclass('public.ll_market_chunks') is not null
on conflict do nothing;

insert into public.ll_market_deprecation_backups (backup_scope, source_table, row_count, snapshot_payload)
select 'pre_drop_market_rag', 'll_market_facts', count(*), jsonb_build_object('table', 'public.ll_market_facts')
from public.ll_market_facts
where to_regclass('public.ll_market_facts') is not null
on conflict do nothing;

insert into public.ll_market_deprecation_backups (backup_scope, source_bucket, object_count, snapshot_payload)
select
  'pre_drop_market_storage',
  'll-market-sources',
  count(*),
  jsonb_build_object('bucket', 'll-market-sources')
from storage.objects
where bucket_id = 'll-market-sources';

create table if not exists public.ll_source_files (
  source_file_id uuid primary key default gen_random_uuid(),
  source_domain text not null check (source_domain in ('lease_contracts', 'sector_market', 'permissions', 'fund_info', 'asset_specs', 'operating_costs')),
  source_key text not null unique,
  source_version text not null,
  file_name text not null,
  original_file_name text,
  source_hash text not null,
  storage_bucket text,
  storage_path text,
  mime_type text,
  file_size_bytes bigint,
  active_version boolean not null default false,
  parse_status text not null default 'prepared' check (parse_status in ('prepared', 'validated', 'published', 'failed', 'archived')),
  report_period text,
  as_of_date date,
  row_counts jsonb not null default '{}'::jsonb,
  validation_summary jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  uploaded_by uuid references auth.users(id),
  published_by uuid references auth.users(id),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists ll_source_files_domain_active_uidx
  on public.ll_source_files(source_domain)
  where active_version is true;

create index if not exists ll_source_files_domain_period_idx
  on public.ll_source_files(source_domain, report_period, active_version, created_at desc);

create table if not exists public.ll_source_sheets (
  source_sheet_id uuid primary key default gen_random_uuid(),
  source_file_id uuid not null references public.ll_source_files(source_file_id) on update cascade on delete cascade,
  sheet_name text not null,
  sheet_index integer not null,
  header_row_number integer,
  first_data_row_number integer,
  last_row_number integer,
  column_count integer,
  row_count integer,
  sheet_hash text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (source_file_id, sheet_name),
  unique (source_file_id, sheet_index)
);

create table if not exists public.ll_source_columns (
  source_column_id uuid primary key default gen_random_uuid(),
  source_sheet_id uuid not null references public.ll_source_sheets(source_sheet_id) on update cascade on delete cascade,
  column_index integer not null,
  column_letter text,
  header_label text,
  normalized_header text,
  value_type text,
  unit_label text,
  target_table text,
  target_field text,
  edit_group text,
  is_required boolean not null default false,
  is_user_editable boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (source_sheet_id, column_index)
);

create table if not exists public.ll_source_rows (
  source_row_id uuid primary key default gen_random_uuid(),
  source_sheet_id uuid not null references public.ll_source_sheets(source_sheet_id) on update cascade on delete cascade,
  source_file_id uuid not null references public.ll_source_files(source_file_id) on update cascade on delete cascade,
  sheet_name text not null,
  row_number integer not null,
  row_hash text not null,
  natural_key text,
  row_values jsonb not null default '{}'::jsonb,
  normalized_values jsonb not null default '{}'::jsonb,
  validation_flags jsonb not null default '[]'::jsonb,
  source_locator jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_file_id, sheet_name, row_number)
);

create index if not exists ll_source_rows_sheet_idx on public.ll_source_rows(source_sheet_id, row_number);
create index if not exists ll_source_rows_natural_key_idx on public.ll_source_rows(source_file_id, natural_key);
create index if not exists ll_source_rows_values_gin_idx on public.ll_source_rows using gin (row_values);

create table if not exists public.ll_sector_market_lease_observations (
  observation_id uuid primary key default gen_random_uuid(),
  source_row_id uuid not null references public.ll_source_rows(source_row_id) on update cascade on delete cascade,
  source_file_id uuid not null references public.ll_source_files(source_file_id) on update cascade on delete cascade,
  report_year integer,
  report_quarter text,
  report_period text,
  center_name text,
  pnu text,
  legal_dong_code text,
  legal_address text,
  region_group text,
  region text,
  province text,
  city text,
  district text,
  gross_area_py numeric,
  completion_year integer,
  temperature_type text,
  size_bucket text,
  deposit_manwon_per_py numeric,
  rent_manwon_per_py numeric,
  management_fee_manwon_per_py numeric,
  rent_free_months_per_year numeric,
  fit_out_months numeric,
  tenant_improvement_manwon_per_py numeric,
  leasable_area_py numeric,
  vacancy_area_py numeric,
  vacancy_rate numeric,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (source_row_id)
);

create index if not exists ll_sector_market_lease_period_region_idx
  on public.ll_sector_market_lease_observations(report_year, report_quarter, region, temperature_type, size_bucket);

create table if not exists public.ll_sector_market_supply_cases (
  supply_case_id uuid primary key default gen_random_uuid(),
  source_row_id uuid not null references public.ll_source_rows(source_row_id) on update cascade on delete cascade,
  source_file_id uuid not null references public.ll_source_files(source_file_id) on update cascade on delete cascade,
  supply_kind text not null check (supply_kind in ('new_supply', 'pipeline')),
  expected_year integer,
  expected_quarter text,
  initial_expected_year integer,
  initial_expected_quarter text,
  warehouse_name text,
  pnu text,
  legal_address text,
  region_group text,
  region text,
  province text,
  city text,
  district text,
  construction_type text,
  site_area_sqm numeric,
  site_area_py numeric,
  building_area_sqm numeric,
  building_area_py numeric,
  gross_area_sqm numeric,
  gross_area_py numeric,
  main_use text,
  temperature_type text,
  permit_date date,
  start_date date,
  completion_date date,
  owner_name text,
  owner_type text,
  construction_company text,
  progress_status text,
  schedule_confidence text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (source_row_id)
);

create index if not exists ll_sector_market_supply_period_idx
  on public.ll_sector_market_supply_cases(supply_kind, expected_year, expected_quarter, region);

create table if not exists public.ll_sector_market_transaction_cases (
  transaction_case_id uuid primary key default gen_random_uuid(),
  source_row_id uuid not null references public.ll_source_rows(source_row_id) on update cascade on delete cascade,
  source_file_id uuid not null references public.ll_source_files(source_file_id) on update cascade on delete cascade,
  transaction_type text,
  transaction_code text,
  warehouse_name text,
  pnu text,
  legal_address text,
  national_region text,
  capital_region text,
  size_bucket text,
  temperature_type text,
  province text,
  city text,
  district text,
  building_area_sqm numeric,
  building_area_py numeric,
  gross_area_sqm numeric,
  gross_area_py numeric,
  land_area_sqm numeric,
  land_area_py numeric,
  contract_date date,
  closing_date date,
  transaction_year integer,
  transaction_quarter text,
  transaction_amount_thousand_krw numeric,
  transaction_amount_krw numeric,
  unit_price_thousand_krw_per_py numeric,
  seller_name text,
  seller_type text,
  buyer_name text,
  buyer_type text,
  senior_loan_rate text,
  tenant_name text,
  lease_start_date date,
  lease_end_date date,
  remaining_lease_months numeric,
  leased_area_sqm numeric,
  target_area_sqm numeric,
  deposit_thousand_krw_per_py numeric,
  rent_thousand_krw_per_py numeric,
  management_fee_thousand_krw_per_py numeric,
  vacancy_rate numeric,
  initial_cap_rate numeric,
  stabilized_cap_rate numeric,
  cap_rate numeric,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (source_row_id)
);

create index if not exists ll_sector_market_transaction_period_idx
  on public.ll_sector_market_transaction_cases(transaction_year, transaction_quarter, capital_region);
create index if not exists ll_sector_market_transaction_name_idx
  on public.ll_sector_market_transaction_cases(warehouse_name);

create table if not exists public.ll_sector_market_cap_rate_series (
  cap_rate_id uuid primary key default gen_random_uuid(),
  source_row_id uuid not null references public.ll_source_rows(source_row_id) on update cascade on delete cascade,
  source_file_id uuid not null references public.ll_source_files(source_file_id) on update cascade on delete cascade,
  report_year integer not null,
  report_quarter text not null,
  capital_area_cap_rate numeric,
  national_cap_rate numeric,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (source_row_id),
  unique (source_file_id, report_year, report_quarter)
);

create table if not exists public.ll_asset_operating_costs (
  operating_cost_id uuid primary key default gen_random_uuid(),
  asset_id text not null references public.ll_assets(asset_id) on update cascade on delete cascade,
  period_start date not null,
  period_end date,
  pm_cost_krw numeric,
  fm_cost_krw numeric,
  pm_headcount numeric,
  fm_headcount numeric,
  insurance_cost_krw numeric,
  utility_cost_krw numeric,
  other_cost_krw numeric,
  source_file_id uuid references public.ll_source_files(source_file_id) on update cascade on delete set null,
  source_row_id uuid references public.ll_source_rows(source_row_id) on update cascade on delete set null,
  payload jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (asset_id, period_start)
);

create table if not exists public.ll_asset_specs (
  asset_spec_id uuid primary key default gen_random_uuid(),
  asset_id text not null references public.ll_assets(asset_id) on update cascade on delete cascade,
  spec_scope text not null default 'asset',
  floor_label text,
  area_label text,
  temperature_type text,
  clear_height_m numeric,
  corridor_width_m numeric,
  ramp_width_m numeric,
  floor_load_warehouse_kg_sqm numeric,
  floor_load_corridor_kg_sqm numeric,
  dock_count integer,
  power_capacity_kw numeric,
  lighting_spec text,
  wall_material text,
  source_file_id uuid references public.ll_source_files(source_file_id) on update cascade on delete set null,
  source_row_id uuid references public.ll_source_rows(source_row_id) on update cascade on delete set null,
  payload jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (asset_id, spec_scope, floor_label, area_label)
);

create table if not exists public.ll_asset_spec_files (
  asset_spec_file_id uuid primary key default gen_random_uuid(),
  asset_id text not null references public.ll_assets(asset_id) on update cascade on delete cascade,
  file_type text not null check (file_type in ('floor_plan', 'area_schedule', 'photo', 'other')),
  title text not null,
  storage_bucket text not null,
  storage_path text not null,
  source_file_id uuid references public.ll_source_files(source_file_id) on update cascade on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (asset_id, file_type, storage_bucket, storage_path)
);

create table if not exists public.ll_notifications (
  notification_id uuid primary key default gen_random_uuid(),
  notification_type text not null check (notification_type in ('lease_maturity', 'loan_maturity', 'data_update', 'system')),
  dedupe_key text not null unique,
  asset_id text references public.ll_assets(asset_id) on update cascade on delete set null,
  fund_id text references public.ll_funds(fund_id) on update cascade on delete set null,
  lease_id text references public.ll_leases(lease_id) on update cascade on delete set null,
  lease_space_id text references public.ll_lease_spaces(lease_space_id) on update cascade on delete set null,
  fund_tranche_id uuid references public.ll_fund_capital_tranches(id) on update cascade on delete set null,
  title text not null,
  body text not null,
  due_date date,
  lead_days integer,
  payload jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.ll_notification_deliveries (
  delivery_id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.ll_notifications(notification_id) on update cascade on delete cascade,
  recipient_user_id uuid references auth.users(id) on update cascade on delete cascade,
  recipient_email text not null,
  recipient_name text,
  delivery_status text not null default 'unread' check (delivery_status in ('unread', 'read', 'dismissed')),
  read_at timestamptz,
  dismissed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (notification_id, recipient_email)
);

create index if not exists ll_notification_deliveries_recipient_idx
  on public.ll_notification_deliveries(lower(recipient_email), delivery_status, created_at desc);

create table if not exists public.ll_news_runs (
  news_run_id uuid primary key default gen_random_uuid(),
  run_key text not null unique,
  scheduled_for timestamptz not null,
  window_start timestamptz not null,
  window_end timestamptz not null,
  source_summary jsonb not null default '{}'::jsonb,
  run_status text not null default 'prepared' check (run_status in ('prepared', 'completed', 'failed')),
  error_message text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.ll_news_items (
  news_item_id uuid primary key default gen_random_uuid(),
  news_run_id uuid references public.ll_news_runs(news_run_id) on update cascade on delete set null,
  dedupe_key text not null,
  canonical_url text not null,
  original_url text,
  title text not null,
  publisher text,
  published_at timestamptz,
  summary text,
  importance_score numeric,
  matched_keywords text[] not null default '{}'::text[],
  source_name text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists ll_news_items_run_dedupe_key on public.ll_news_items(news_run_id, dedupe_key);
create index if not exists ll_news_items_published_idx on public.ll_news_items(published_at desc, importance_score desc);
create index if not exists ll_news_items_keywords_gin_idx on public.ll_news_items using gin (matched_keywords);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'logistics-sector-market-workbooks',
  'logistics-sector-market-workbooks',
  false,
  104857600,
  array[
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'application/json',
    'text/plain',
    'application/octet-stream'
  ]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types,
  updated_at = now();

alter table public.ll_source_files enable row level security;
alter table public.ll_source_sheets enable row level security;
alter table public.ll_source_columns enable row level security;
alter table public.ll_source_rows enable row level security;
alter table public.ll_sector_market_lease_observations enable row level security;
alter table public.ll_sector_market_supply_cases enable row level security;
alter table public.ll_sector_market_transaction_cases enable row level security;
alter table public.ll_sector_market_cap_rate_series enable row level security;
alter table public.ll_asset_operating_costs enable row level security;
alter table public.ll_asset_specs enable row level security;
alter table public.ll_asset_spec_files enable row level security;
alter table public.ll_notifications enable row level security;
alter table public.ll_notification_deliveries enable row level security;
alter table public.ll_news_runs enable row level security;
alter table public.ll_news_items enable row level security;
alter table public.ll_market_deprecation_backups enable row level security;

grant select, insert, update, delete on
  public.ll_source_files,
  public.ll_source_sheets,
  public.ll_source_columns,
  public.ll_source_rows,
  public.ll_sector_market_lease_observations,
  public.ll_sector_market_supply_cases,
  public.ll_sector_market_transaction_cases,
  public.ll_sector_market_cap_rate_series,
  public.ll_asset_operating_costs,
  public.ll_asset_specs,
  public.ll_asset_spec_files,
  public.ll_notifications,
  public.ll_notification_deliveries,
  public.ll_news_runs,
  public.ll_news_items,
  public.ll_market_deprecation_backups
to service_role;

insert into public.ll_schema_metadata (
  metadata_key, object_type, table_schema, table_name, column_name, domain_group, role_category, description, is_active, updated_at
)
values
  ('public.ll_source_files', 'table', 'public', 'll_source_files', null, 'Source Management', 'source_file', 'Versioned workbook/file registry for logistics data management.', true, now()),
  ('public.ll_source_rows', 'table', 'public', 'll_source_rows', null, 'Source Management', 'raw_row_archive', 'Row-level source preservation for every managed workbook.', true, now()),
  ('public.ll_sector_market_lease_observations', 'table', 'public', 'll_sector_market_lease_observations', null, 'Market Data', 'normalized_market_fact', 'Normalized lease market observations from the active sector market workbook.', true, now()),
  ('public.ll_sector_market_supply_cases', 'table', 'public', 'll_sector_market_supply_cases', null, 'Market Data', 'normalized_market_fact', 'Normalized new supply and pipeline cases from the active sector market workbook.', true, now()),
  ('public.ll_sector_market_transaction_cases', 'table', 'public', 'll_sector_market_transaction_cases', null, 'Market Data', 'normalized_market_fact', 'Normalized logistics transaction cases from the active sector market workbook.', true, now()),
  ('public.ll_asset_operating_costs', 'table', 'public', 'll_asset_operating_costs', null, 'Asset Operations', 'operating_cost', 'Asset-level PM/FM/insurance/utility cost fact table.', true, now()),
  ('public.ll_notifications', 'table', 'public', 'll_notifications', null, 'Work Platform', 'notification', 'Canonical notification events for maturity and data update alerts.', true, now()),
  ('public.ll_news_items', 'table', 'public', 'll_news_items', null, 'Work Platform', 'news', 'Daily logistics center news items collected by server automation.', true, now())
on conflict (metadata_key) do update set
  domain_group = excluded.domain_group,
  role_category = excluded.role_category,
  description = excluded.description,
  is_active = true,
  updated_at = now();

drop function if exists public.match_ll_market_chunks(extensions.vector(768), integer, double precision, text[], integer[]);
drop function if exists public.match_ll_market_facts(extensions.vector(768), integer, double precision, text[], integer[]);
drop table if exists public.ll_market_facts cascade;
drop table if exists public.ll_market_chunks cascade;
drop table if exists public.ll_market_documents cascade;

-- Supabase blocks direct SQL deletes from storage.objects/storage.buckets.
-- The old ll-market-sources bucket must be removed through the Storage API
-- after this migration; the preflight report confirms it is empty.

commit;
