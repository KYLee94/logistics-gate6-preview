-- Logistics weekly Word ingest schema.
-- Preview only until applied through a controlled Supabase migration.
-- Mutation scope: public.ll_* tables only.

create table if not exists public.ll_user_permissions (
  user_id uuid primary key,
  email text,
  logistics_role text not null default 'Reader',
  organization text,
  managed_asset_codes text[] not null default '{}',
  managed_asset_permissions jsonb not null default '{"read": true, "create": false, "update": false, "delete": false}'::jsonb,
  other_asset_permissions jsonb not null default '{"read": false, "create": false, "update": false, "delete": false}'::jsonb,
  can_ingest_weekly boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ll_weekly_reports (
  id uuid primary key default gen_random_uuid(),
  week_key text not null,
  organization text not null default 'organization_unknown',
  report_year integer not null,
  report_month integer not null,
  report_week integer not null,
  source_file_name text not null,
  source_sha256 text not null,
  source_text text,
  report_json jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (week_key, organization)
);

create table if not exists public.ll_weekly_assets (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.ll_weekly_reports(id) on delete cascade,
  asset_code text,
  asset_name text,
  fund_code text,
  fund_name text,
  status text,
  issue text,
  plan text,
  row_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.ll_weekly_projects (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.ll_weekly_reports(id) on delete cascade,
  project_type text not null default 'weekly',
  project_name text,
  stakeholder text,
  status text,
  issue text,
  plan text,
  row_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.ll_weekly_doc_ingest_runs (
  id uuid primary key default gen_random_uuid(),
  report_id uuid references public.ll_weekly_reports(id) on delete set null,
  week_key text not null,
  organization text not null default 'organization_unknown',
  source_file_name text not null,
  source_sha256 text not null,
  requested_by uuid references auth.users(id),
  status text not null default 'received',
  message text,
  parsed_counts jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.ll_user_permissions enable row level security;
alter table public.ll_weekly_reports enable row level security;
alter table public.ll_weekly_assets enable row level security;
alter table public.ll_weekly_projects enable row level security;
alter table public.ll_weekly_doc_ingest_runs enable row level security;

drop policy if exists "ll_user_permissions_self_read" on public.ll_user_permissions;
create policy "ll_user_permissions_self_read"
on public.ll_user_permissions
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "ll_weekly_reports_read_authenticated" on public.ll_weekly_reports;
create policy "ll_weekly_reports_read_authenticated"
on public.ll_weekly_reports
for select
to authenticated
using (
  organization = (
    select p.organization
    from public.ll_user_permissions p
    where p.user_id = auth.uid()
  )
  or exists (
    select 1
    from public.ll_user_permissions p
    where p.user_id = auth.uid()
      and p.logistics_role in ('Admin', 'System Admin')
  )
);

drop policy if exists "ll_weekly_assets_read_authenticated" on public.ll_weekly_assets;
create policy "ll_weekly_assets_read_authenticated"
on public.ll_weekly_assets
for select
to authenticated
using (
  exists (
    select 1
    from public.ll_weekly_reports r
    join public.ll_user_permissions p on p.user_id = auth.uid()
    where r.id = report_id
      and (r.organization = p.organization or p.logistics_role in ('Admin', 'System Admin'))
  )
);

drop policy if exists "ll_weekly_projects_read_authenticated" on public.ll_weekly_projects;
create policy "ll_weekly_projects_read_authenticated"
on public.ll_weekly_projects
for select
to authenticated
using (
  exists (
    select 1
    from public.ll_weekly_reports r
    join public.ll_user_permissions p on p.user_id = auth.uid()
    where r.id = report_id
      and (r.organization = p.organization or p.logistics_role in ('Admin', 'System Admin'))
  )
);

drop policy if exists "ll_weekly_doc_ingest_runs_read_own" on public.ll_weekly_doc_ingest_runs;
create policy "ll_weekly_doc_ingest_runs_read_own"
on public.ll_weekly_doc_ingest_runs
for select
to authenticated
using (requested_by = auth.uid());

-- Writes are intentionally not granted to browser clients.
-- The ll-weekly-doc-ingest Edge Function writes through the service role after JWT and ll_user_permissions checks.
