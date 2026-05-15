-- Logistics dashboard API schema preview.
-- Apply only after controlled review. All objects are public.ll_*.

create table if not exists public.ll_edit_requests (
  id uuid primary key default gen_random_uuid(),
  source_table text not null check (source_table like 'public.ll_%'),
  finding_id text,
  target_type text,
  target_name text,
  target_row_id text,
  target_cell_id text,
  field_name text,
  reason_code text,
  before_value text,
  requested_value text,
  readback_value text,
  request_payload jsonb not null default '{}'::jsonb,
  status text not null default 'submitted',
  requested_by uuid references auth.users(id),
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  approval_note text,
  rejected_by uuid references auth.users(id),
  rejected_at timestamptz,
  rejection_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ll_worklogs (
  id uuid primary key default gen_random_uuid(),
  scope text not null default 'personal',
  title text not null,
  body text,
  related_asset_id text,
  related_tenant_id text,
  priority text,
  status text not null default 'new',
  payload jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ll_api_audit_logs (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  status_code integer not null,
  requested_by uuid references auth.users(id),
  request_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.ll_edit_requests enable row level security;
alter table public.ll_worklogs enable row level security;
alter table public.ll_api_audit_logs enable row level security;

drop policy if exists "ll_edit_requests_read_own_or_manager" on public.ll_edit_requests;
create policy "ll_edit_requests_read_own_or_manager"
on public.ll_edit_requests
for select
to authenticated
using (
  requested_by = auth.uid()
  or exists (
    select 1
    from public.ll_user_permissions p
    where p.user_id = auth.uid()
      and p.logistics_role in ('Manager', 'Admin', 'System Admin')
  )
);

drop policy if exists "ll_worklogs_read_authenticated" on public.ll_worklogs;
create policy "ll_worklogs_read_authenticated"
on public.ll_worklogs
for select
to authenticated
using (
  created_by = auth.uid()
  or exists (
    select 1
    from public.ll_user_permissions p
    where p.user_id = auth.uid()
      and (
        p.logistics_role in ('Manager', 'Admin', 'System Admin')
        or (
          ll_worklogs.scope = 'team'
          and coalesce(ll_worklogs.payload ->> 'organization', '') = coalesce(p.organization, '')
        )
        or (
          ll_worklogs.scope = 'sector'
          and (
            coalesce(ll_worklogs.related_asset_id, '') = any(p.managed_asset_codes)
            or coalesce((p.other_asset_permissions ->> 'read')::boolean, false)
          )
        )
      )
  )
);

drop policy if exists "ll_api_audit_logs_read_system_admin" on public.ll_api_audit_logs;
create policy "ll_api_audit_logs_read_system_admin"
on public.ll_api_audit_logs
for select
to authenticated
using (
  exists (
    select 1
    from public.ll_user_permissions p
    where p.user_id = auth.uid()
      and p.logistics_role = 'System Admin'
  )
);

-- Browser clients do not receive INSERT/UPDATE/DELETE policies for these tables.
-- Writes are performed by Edge Functions after JWT and public.ll_user_permissions checks.
