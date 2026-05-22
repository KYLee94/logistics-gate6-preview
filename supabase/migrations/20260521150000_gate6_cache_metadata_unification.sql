-- Gate 6 schema cleanup phase 3a.
-- Add unified cache and schema metadata tables, backfill legacy metric/external cache rows, and update asset manager orgs.
-- This migration is additive only. Legacy cache tables are dropped in the next migration after Edge deployment.

begin;

create table if not exists public.ll_cache_entries (
  id uuid primary key default gen_random_uuid(),
  cache_type text not null,
  cache_key text not null,
  entity_type text,
  entity_id text,
  provider text,
  provider_status integer,
  metric_scope text,
  metric_key text,
  asset_id text,
  asset_name text,
  tenant_id text,
  tenant_name text,
  basis_date date,
  numeric_value numeric,
  text_value text,
  unit text,
  source_table text,
  source_row_count integer,
  request_payload jsonb not null default '{}'::jsonb,
  response_payload jsonb not null default '{}'::jsonb,
  payload jsonb not null default '{}'::jsonb,
  scope_hash text,
  user_safe boolean not null default true,
  computed_at timestamptz,
  fetched_at timestamptz,
  expires_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ll_cache_entries_type_key_unique unique (cache_type, cache_key)
);

alter table public.ll_cache_entries enable row level security;

create index if not exists ll_cache_entries_type_entity_idx
  on public.ll_cache_entries(cache_type, entity_type, entity_id);

create index if not exists ll_cache_entries_provider_idx
  on public.ll_cache_entries(provider, fetched_at desc)
  where cache_type = 'external_api';

create index if not exists ll_cache_entries_metric_idx
  on public.ll_cache_entries(metric_scope, metric_key, basis_date)
  where cache_type = 'dashboard_metric';

do $$
begin
  if to_regclass('public.ll_dashboard_metric_snapshots') is not null then
    insert into public.ll_cache_entries (
      cache_type,
      cache_key,
      entity_type,
      entity_id,
      metric_scope,
      metric_key,
      asset_id,
      asset_name,
      tenant_id,
      tenant_name,
      basis_date,
      numeric_value,
      text_value,
      unit,
      source_table,
      source_row_count,
      payload,
      computed_at,
      created_at,
      updated_at
    )
    select
      'dashboard_metric',
      s.snapshot_key,
      s.metric_scope,
      coalesce(nullif(s.asset_id, ''), nullif(s.tenant_id, ''), s.metric_scope),
      s.metric_scope,
      s.metric_key,
      s.asset_id,
      s.asset_name,
      s.tenant_id,
      s.tenant_name,
      s.basis_date,
      s.numeric_value,
      s.text_value,
      s.unit,
      s.source_table,
      s.source_row_count,
      jsonb_build_object(
        'metric_scope', s.metric_scope,
        'metric_key', s.metric_key,
        'source_payload', s.source_payload
      ),
      s.computed_at,
      s.created_at,
      s.updated_at
    from public.ll_dashboard_metric_snapshots s
    on conflict (cache_type, cache_key) do update
    set entity_type = excluded.entity_type,
        entity_id = excluded.entity_id,
        metric_scope = excluded.metric_scope,
        metric_key = excluded.metric_key,
        asset_id = excluded.asset_id,
        asset_name = excluded.asset_name,
        tenant_id = excluded.tenant_id,
        tenant_name = excluded.tenant_name,
        basis_date = excluded.basis_date,
        numeric_value = excluded.numeric_value,
        text_value = excluded.text_value,
        unit = excluded.unit,
        source_table = excluded.source_table,
        source_row_count = excluded.source_row_count,
        payload = excluded.payload,
        computed_at = excluded.computed_at,
        updated_at = now();
  end if;

  if to_regclass('public.ll_external_api_cache') is not null then
    insert into public.ll_cache_entries (
      cache_type,
      cache_key,
      entity_type,
      entity_id,
      provider,
      provider_status,
      request_payload,
      response_payload,
      payload,
      fetched_at,
      expires_at,
      created_by,
      created_at,
      updated_at
    )
    select
      'external_api',
      c.provider || ':' || c.cache_key,
      case
        when c.provider like 'opendart/%' then 'tenant'
        when c.provider like 'building-register/%' then 'asset'
        when c.provider like 'naver/%' then 'location'
        else 'external'
      end,
      c.cache_key,
      c.provider,
      c.provider_status,
      c.request_payload,
      c.response_payload,
      c.response_payload,
      c.fetched_at,
      c.expires_at,
      c.created_by,
      c.fetched_at,
      c.updated_at
    from public.ll_external_api_cache c
    on conflict (cache_type, cache_key) do update
    set entity_type = excluded.entity_type,
        entity_id = excluded.entity_id,
        provider = excluded.provider,
        provider_status = excluded.provider_status,
        request_payload = excluded.request_payload,
        response_payload = excluded.response_payload,
        payload = excluded.payload,
        fetched_at = excluded.fetched_at,
        expires_at = excluded.expires_at,
        created_by = excluded.created_by,
        updated_at = now();
  end if;
end $$;

create table if not exists public.ll_schema_metadata (
  metadata_id uuid primary key default gen_random_uuid(),
  metadata_key text not null unique,
  object_type text not null check (object_type in ('table', 'column')),
  table_schema text not null default 'public',
  table_name text not null,
  column_name text,
  data_type text,
  is_nullable boolean,
  domain_group text not null,
  role_category text not null,
  description text not null,
  pk_columns jsonb not null default '[]'::jsonb,
  foreign_keys jsonb not null default '[]'::jsonb,
  source_system text not null default 'gate6_schema_cleanup',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.ll_schema_metadata enable row level security;

create index if not exists ll_schema_metadata_table_idx
  on public.ll_schema_metadata(table_schema, table_name, object_type);

with tables as (
  select t.table_schema, t.table_name
  from information_schema.tables t
  where t.table_schema = 'public'
    and t.table_name like 'll_%'
    and t.table_type = 'BASE TABLE'
),
classified as (
  select
    table_schema,
    table_name,
    case
      when table_name in ('ll_source_cells', 'll_sheet_rows', 'll_import_runs', 'll_source_field_registry', 'll_source_review_logs') then 'Raw Source'
      when table_name in ('ll_assets', 'll_tenants', 'll_leases', 'll_lease_spaces', 'll_rent_history', 'll_asset_managers') then 'Core Normalized'
      when table_name in ('ll_lease_space_area_breakdowns', 'll_lease_space_specs', 'll_lease_special_terms') then 'Detail Normalized'
      when table_name in ('ll_funds', 'll_fund_asset_links', 'll_fund_beneficiary_tranches', 'll_fund_loan_tranches') then 'Fund'
      when table_name in ('ll_work_platform_tasks', 'll_work_platform_board_posts', 'll_work_platform_task_snapshots', 'll_weekly_reports', 'll_weekly_assets', 'll_weekly_projects', 'll_weekly_doc_ingest_runs', 'll_issues') then 'Work Platform / Weekly'
      when table_name in ('ll_user_permissions', 'll_edit_requests', 'll_data_change_audit_logs', 'll_api_audit_logs', 'll_data_quality_findings') then 'Permission / Audit'
      when table_name in ('ll_cache_entries', 'll_dashboard_metric_snapshots', 'll_external_api_cache') then 'Cache / Snapshot'
      when table_name in ('ll_schema_metadata') then 'Metadata'
      when table_name in ('ll_migration_row_backups') then 'Migration Safety'
      else 'Review Required'
    end as domain_group
  from tables
)
insert into public.ll_schema_metadata (
  metadata_key,
  object_type,
  table_schema,
  table_name,
  domain_group,
  role_category,
  description,
  is_active,
  updated_at
)
select
  table_schema || '.' || table_name,
  'table',
  table_schema,
  table_name,
  domain_group,
  case
    when domain_group in ('Raw Source', 'Permission / Audit', 'Migration Safety') then 'delete_prohibited'
    when domain_group = 'Cache / Snapshot' then 'cache_contract'
    else 'keep'
  end,
  domain_group || ' table for Gate 6 logistics work platform.',
  true,
  now()
from classified
on conflict (metadata_key) do update
set domain_group = excluded.domain_group,
    role_category = excluded.role_category,
    description = excluded.description,
    is_active = true,
    updated_at = now();

with columns as (
  select
    c.table_schema,
    c.table_name,
    c.column_name,
    c.data_type,
    (c.is_nullable = 'YES') as is_nullable
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name like 'll_%'
),
classified_columns as (
  select
    c.*,
    m.domain_group,
    case
      when c.column_name like '%_id' or c.column_name in ('id', 'asset_id', 'tenant_id', 'fund_id') then 'key_or_relationship'
      when c.column_name like 'source_%' or c.column_name in ('raw_value', 'display_value', 'cell_hash') then 'source_evidence'
      when c.column_name like '%payload%' or c.data_type in ('json', 'jsonb') then 'structured_payload'
      when c.column_name like '%created%' or c.column_name like '%updated%' or c.column_name like '%audit%' then 'audit_timestamp'
      when c.column_name like '%amount%' or c.column_name like '%total%' or c.column_name like '%area%' or c.data_type in ('numeric', 'integer', 'double precision') then 'business_metric'
      else 'business_attribute'
    end as role_category
  from columns c
  join public.ll_schema_metadata m
    on m.object_type = 'table'
   and m.table_schema = c.table_schema
   and m.table_name = c.table_name
)
insert into public.ll_schema_metadata (
  metadata_key,
  object_type,
  table_schema,
  table_name,
  column_name,
  data_type,
  is_nullable,
  domain_group,
  role_category,
  description,
  is_active,
  updated_at
)
select
  table_schema || '.' || table_name || '.' || column_name,
  'column',
  table_schema,
  table_name,
  column_name,
  data_type,
  is_nullable,
  domain_group,
  role_category,
  column_name || ' column on ' || table_name || '.',
  true,
  now()
from classified_columns
on conflict (metadata_key) do update
set data_type = excluded.data_type,
    is_nullable = excluded.is_nullable,
    domain_group = excluded.domain_group,
    role_category = excluded.role_category,
    description = excluded.description,
    is_active = true,
    updated_at = now();

insert into public.ll_migration_row_backups (migration_id, table_name, row_key, before_payload)
select '20260521150000_gate6_asset_manager_org_refresh', 'public.ll_asset_managers', asset_manager_id, to_jsonb(am)
from public.ll_asset_managers am
where lower(trim(am.manager_email)) in (
  'mihyunu@igisam.com',
  'jslee@igisam.com',
  'dmpark@igisam.com',
  'shyung.choi@igisam.com',
  'jy3142@igisam.com',
  'choijt@igisam.com'
)
on conflict (migration_id, table_name, row_key) do nothing;

with staff(name, email, team) as (
  values
    ('유미현', 'mihyunu@igisam.com', '사업그룹4파트'),
    ('이준수', 'jslee@igisam.com', '사업그룹4파트'),
    ('박동민', 'dmpark@igisam.com', '자산관리3파트'),
    ('최성현', 'shyung.choi@igisam.com', '사업그룹3파트'),
    ('이주영', 'jy3142@igisam.com', '투자1그룹4파트'),
    ('최정택', 'choijt@igisam.com', '투자1그룹4파트')
)
update public.ll_asset_managers am
set manager_name = staff.name,
    manager_email = staff.email,
    manager_team = staff.team,
    updated_at = now()
from staff
where lower(trim(am.manager_email)) = staff.email
  and (
    am.manager_name is distinct from staff.name
    or am.manager_team is distinct from staff.team
    or lower(trim(am.manager_email)) is distinct from staff.email
  );

commit;
