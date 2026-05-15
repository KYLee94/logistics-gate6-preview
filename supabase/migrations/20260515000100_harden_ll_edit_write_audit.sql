-- Harden Logistics Data Quality write/readback/audit flow.
-- Mutation scope: public.ll_* objects only.

alter table if exists public.ll_edit_requests
  add column if not exists write_started_at timestamptz,
  add column if not exists written_at timestamptz,
  add column if not exists write_status text,
  add column if not exists write_error text,
  add column if not exists write_result jsonb not null default '{}'::jsonb;

create table if not exists public.ll_data_change_audit_logs (
  id uuid primary key default gen_random_uuid(),
  edit_request_id uuid references public.ll_edit_requests(id) on delete set null,
  action text not null,
  target_table text not null check (target_table like 'public.ll_%'),
  target_row_id text,
  target_cell_id text,
  field_name text,
  before_value text,
  after_value text,
  readback_value text,
  actor_id uuid references auth.users(id),
  approver_id uuid references auth.users(id),
  source_row_id text,
  source_cell_id text,
  approval_status text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.ll_data_change_audit_logs enable row level security;

drop policy if exists "ll_data_change_audit_logs_read_manager" on public.ll_data_change_audit_logs;
create policy "ll_data_change_audit_logs_read_manager"
on public.ll_data_change_audit_logs
for select
to authenticated
using (
  actor_id = auth.uid()
  or approver_id = auth.uid()
  or exists (
    select 1
    from public.ll_user_permissions p
    where p.user_id = auth.uid()
      and p.logistics_role in ('Manager', 'Admin', 'System Admin')
  )
);

create index if not exists idx_ll_edit_requests_status
on public.ll_edit_requests(status);

create index if not exists idx_ll_data_change_audit_logs_request
on public.ll_data_change_audit_logs(edit_request_id);

create index if not exists idx_ll_data_change_audit_logs_target
on public.ll_data_change_audit_logs(target_table, target_row_id, field_name);

-- Browser clients still receive no INSERT/UPDATE/DELETE policies.
-- ll-dashboard-api writes using service role only after JWT, public.ll_user_permissions,
-- stale-value readback, post-write readback, rollback, and audit checks.
