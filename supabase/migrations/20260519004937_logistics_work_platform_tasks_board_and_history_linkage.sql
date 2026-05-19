-- Gate 6 logistics work platform persistence and A112127001 history linkage.
-- All new objects remain in public.ll_* and browser writes stay blocked by RLS.

create table if not exists public.ll_work_platform_tasks (
  id uuid primary key default gen_random_uuid(),
  scope text not null default 'personal',
  task_name text not null,
  company_name text,
  related_asset_id text references public.ll_assets(asset_id),
  related_asset_name text,
  related_tenant_id text references public.ll_tenants(tenant_id),
  next_action text,
  issue text,
  notes text,
  due_date date,
  priority text,
  status text not null default 'new',
  completed_at timestamptz,
  created_by uuid references auth.users(id),
  created_by_email text,
  created_by_name text,
  organization text,
  payload jsonb not null default '{}'::jsonb,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ll_work_platform_tasks_asset_idx
  on public.ll_work_platform_tasks(related_asset_id, status, created_at desc);

create index if not exists ll_work_platform_tasks_scope_idx
  on public.ll_work_platform_tasks(scope, organization, created_by, created_at desc);

create table if not exists public.ll_work_platform_board_posts (
  id uuid primary key default gen_random_uuid(),
  log_id text not null unique,
  workspace_code text not null default 'WS_LOGISTICS',
  workspace_label text not null default '물류센터 워크 플랫폼',
  work_date date not null default current_date,
  title text not null,
  content text not null,
  related_asset_id text references public.ll_assets(asset_id),
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

create index if not exists ll_work_platform_board_posts_asset_idx
  on public.ll_work_platform_board_posts(related_asset_id, status, work_date desc, created_at desc);

create index if not exists ll_work_platform_board_posts_author_idx
  on public.ll_work_platform_board_posts(created_by, created_at desc);

alter table public.ll_work_platform_tasks enable row level security;
alter table public.ll_work_platform_board_posts enable row level security;

drop policy if exists "ll_work_platform_tasks_read_scoped" on public.ll_work_platform_tasks;
create policy "ll_work_platform_tasks_read_scoped"
on public.ll_work_platform_tasks
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
          ll_work_platform_tasks.scope = 'team'
          and coalesce(ll_work_platform_tasks.organization, '') = coalesce(p.organization, '')
        )
        or (
          ll_work_platform_tasks.scope = 'sector'
          and (
            coalesce(ll_work_platform_tasks.related_asset_id, '') = any(p.managed_asset_codes)
            or coalesce((p.other_asset_permissions ->> 'read')::boolean, false)
          )
        )
      )
  )
);

drop policy if exists "ll_work_platform_board_posts_read_scoped" on public.ll_work_platform_board_posts;
create policy "ll_work_platform_board_posts_read_scoped"
on public.ll_work_platform_board_posts
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
        or coalesce(ll_work_platform_board_posts.related_asset_id, '') = any(p.managed_asset_codes)
        or coalesce((p.other_asset_permissions ->> 'read')::boolean, false)
      )
  )
);

grant select on public.ll_work_platform_tasks to authenticated;
grant select on public.ll_work_platform_board_posts to authenticated;

alter table public.ll_rent_history
  add column if not exists floor_label text,
  add column if not exists detail_area_label text,
  add column if not exists temperature_type text,
  add column if not exists source_excel_visible_row integer,
  add column if not exists source_contract_lease_space_id text references public.ll_lease_spaces(lease_space_id);

create index if not exists ll_rent_history_asset_contract_latest_idx
  on public.ll_rent_history(asset_id, source_contract_lease_space_id, is_latest);

create index if not exists ll_rent_history_asset_floor_effective_idx
  on public.ll_rent_history(asset_id, floor_label, detail_area_label, effective_date desc);

with history_rows as (
  select
    rh.rent_history_id,
    substring(rh.source_sheet_row_id from 'r([0-9]+)$')::integer as source_ordinal
  from public.ll_rent_history rh
  where rh.asset_id = 'asset_a112127001'
    and rh.source_sheet_row_id like 'sheet_db_history:r%'
)
update public.ll_rent_history rh
set
  source_excel_visible_row = h.source_ordinal + 13,
  floor_label = case
    when h.source_ordinal between 2 and 31 then (10 - floor((h.source_ordinal - 2)::numeric / 3))::integer::text
    when h.source_ordinal between 32 and 35 then 'B1'
    when h.source_ordinal between 36 and 39 then 'B2'
    when h.source_ordinal = 40 then 'B1'
    when h.source_ordinal = 41 then 'B2'
    when h.source_ordinal between 42 and 44 then 'B1'
    when h.source_ordinal between 45 and 47 then 'B2'
    when h.source_ordinal = 48 then 'B1'
    when h.source_ordinal = 49 then 'B2'
    when h.source_ordinal between 50 and 71 then 'B2'
    else rh.floor_label
  end,
  detail_area_label = case
    when h.source_ordinal between 32 and 39 then '1~5섹터'
    when h.source_ordinal between 40 and 41 then '6섹터'
    when h.source_ordinal between 42 and 47 then '7섹터'
    when h.source_ordinal between 48 and 49 then '8~10섹터'
    when h.source_ordinal between 50 and 56 then '11섹터'
    when h.source_ordinal between 57 and 63 then '12섹터'
    when h.source_ordinal between 64 and 71 then '13~14섹터'
    else null
  end,
  temperature_type = case
    when h.source_ordinal in (2,3,4,8,9,10,14,15,16,20,21,22,26,27,28,32,33,34,35,40,42,43,44,48) then '사무실'
    when h.source_ordinal between 2 and 71 then 'N'
    else rh.temperature_type
  end,
  source_contract_lease_space_id = case
    when h.source_ordinal between 2 and 31 then 'asset_a112127001|tenant_brn_1108105034|20190301|20340228|1~10|na'
    when h.source_ordinal between 32 and 39 then 'asset_a112127001|tenant_brn_1108105034|20230109|20280108|b2~b1|1~5섹터'
    when h.source_ordinal between 40 and 41 then 'asset_a112127001|tenant_brn_1108105034|20250501|20280131|b2~b1|6섹터'
    when h.source_ordinal between 42 and 47 then 'asset_a112127001|tenant_brn_1108105034|20240201|20280131|b2~b1|7섹터'
    when h.source_ordinal between 48 and 49 then 'asset_a112127001|tenant_brn_1108105034|20260201|20280131|b2~b1|8~10섹터'
    when h.source_ordinal between 50 and 56 then 'asset_a112127001|tenant_brn_2118640630|20240101|20270331|b2|11섹터'
    when h.source_ordinal between 57 and 63 then 'asset_a112127001|tenant_brn_2118640630|20240401|20270331|b2|12섹터'
    when h.source_ordinal between 64 and 71 then 'asset_a112127001|tenant_brn_2118640630|20240401|20270331|b2|13~14섹터'
    else rh.source_contract_lease_space_id
  end,
  updated_at = now()
from history_rows h
where rh.rent_history_id = h.rent_history_id;

update public.ll_rent_history
set lease_space_id = source_contract_lease_space_id,
    updated_at = now()
where asset_id = 'asset_a112127001'
  and source_contract_lease_space_id is not null
  and lease_space_id is null;

update public.ll_lease_spaces ls
set
  floor_label = case
    when lease_space_id like '%|1~10|na' then '1~10'
    when lease_space_id like '%|b2~b1|%' then 'B2~B1'
    when lease_space_id like '%|b2|%' then 'B2'
    else floor_label
  end,
  detail_area_label = case
    when lease_space_id like '%|1~10|na' then null
    else detail_area_label
  end,
  review_status = 'linked_from_db_history',
  review_note = concat_ws(' / ', nullif(review_note, ''), 'DB_히스토리 누적 시트와 source_contract_lease_space_id로 연결'),
  updated_at = now()
where asset_id = 'asset_a112127001';

with ranked as (
  select
    rent_history_id,
    row_number() over (
      partition by asset_id, tenant_id, coalesce(source_contract_lease_space_id, lease_space_id, ''), coalesce(floor_label, ''), coalesce(detail_area_label, ''), coalesce(temperature_type, '')
      order by effective_date desc nulls last, source_sheet_row_id desc
    ) = 1 as next_is_latest
  from public.ll_rent_history
  where asset_id = 'asset_a112127001'
)
update public.ll_rent_history rh
set is_latest = ranked.next_is_latest,
    updated_at = now()
from ranked
where rh.rent_history_id = ranked.rent_history_id;

with latest_amounts as (
  select
    source_contract_lease_space_id as lease_space_id,
    sum(coalesce(monthly_rent_total, 0)) as monthly_rent_total,
    sum(coalesce(monthly_mf_total, 0)) as monthly_mf_total
  from public.ll_rent_history
  where asset_id = 'asset_a112127001'
    and is_latest = true
    and source_contract_lease_space_id is not null
  group by source_contract_lease_space_id
)
update public.ll_lease_spaces ls
set
  current_monthly_rent_total = latest_amounts.monthly_rent_total,
  current_monthly_mf_total = latest_amounts.monthly_mf_total,
  current_monthly_cost_total = latest_amounts.monthly_rent_total + latest_amounts.monthly_mf_total,
  e_noc = case
    when coalesce(ls.leased_area_sqm, 0) > 0
      then round(((latest_amounts.monthly_rent_total + latest_amounts.monthly_mf_total) / (ls.leased_area_sqm * 0.3025))::numeric, 2)
    else null
  end,
  review_status = 'linked_from_db_history',
  review_note = concat_ws(' / ', nullif(ls.review_note, ''), '최신 DB_히스토리 누적 행 기준 월 임관리비 및 E.NOC 재계산'),
  updated_at = now()
from latest_amounts
where ls.lease_space_id = latest_amounts.lease_space_id;

comment on table public.ll_work_platform_tasks is '물류센터 워크 플랫폼 주요 TASK 관리 전용 테이블. Writes are server-side only.';
comment on table public.ll_work_platform_board_posts is '물류센터 워크 플랫폼 협업게시판 전용 테이블. Writes are server-side only.';
comment on column public.ll_rent_history.source_contract_lease_space_id is 'DB_히스토리 누적 행을 DB_일반 계약 공간과 연결하는 보조 FK.';
