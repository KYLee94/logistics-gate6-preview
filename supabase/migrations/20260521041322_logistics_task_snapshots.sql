-- Logistics work platform weekly task snapshots.
-- Mirrors the IOTA reference archive flow: active task rows are periodically
-- captured into a week-level snapshot, while deleted rows remain audit-only.

create table if not exists public.ll_work_platform_task_snapshots (
  id uuid primary key default gen_random_uuid(),
  workspace text not null default 'logistics',
  week_key text not null,
  week_label text not null,
  week_range text,
  group_label text,
  basis_date date not null default current_date,
  snapshot_data jsonb not null default '[]'::jsonb,
  task_count integer not null default 0,
  created_by uuid references auth.users(id),
  created_by_email text,
  created_by_name text,
  organization text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace, week_key, created_by)
);

create index if not exists ll_work_platform_task_snapshots_lookup_idx
  on public.ll_work_platform_task_snapshots(workspace, created_by, basis_date desc, created_at desc);

alter table public.ll_work_platform_task_snapshots enable row level security;

drop policy if exists "ll_work_platform_task_snapshots_read_own" on public.ll_work_platform_task_snapshots;
create policy "ll_work_platform_task_snapshots_read_own"
on public.ll_work_platform_task_snapshots
for select
to authenticated
using (
  created_by = auth.uid()
  or exists (
    select 1
    from public.ll_user_permissions p
    where p.user_id = auth.uid()
      and p.logistics_role in ('Manager', 'Admin', 'System Admin')
  )
);

grant select on public.ll_work_platform_task_snapshots to authenticated;

comment on table public.ll_work_platform_task_snapshots is
  '물류센터 워크 플랫폼 지난 TASK 관리용 주차별 snapshot 테이블. 삭제 task는 감사용으로만 ll_work_platform_tasks에 남고 snapshot에는 저장하지 않는다.';
