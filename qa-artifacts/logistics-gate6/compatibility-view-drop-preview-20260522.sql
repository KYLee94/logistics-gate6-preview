-- Gate 6 compatibility view cleanup preview
-- Scope: public.ll_* legacy compatibility views only.
-- Do not run until:
-- 1) qa:legacy-view-denylist passes against src, supabase/functions, scripts/qa, and dist.
-- 2) gh-pages bundle is confirmed to use the canonical Edge/API contract.
-- 3) Data Quality e2e and dashboard API parity pass after paired Edge + frontend deploy.

begin;

drop view if exists public.ll_lease_space_area_breakdowns;
drop view if exists public.ll_lease_space_specs;
drop view if exists public.ll_lease_special_terms;
drop view if exists public.ll_fund_beneficiary_tranches;
drop view if exists public.ll_fund_loan_tranches;
drop view if exists public.ll_api_audit_logs;
drop view if exists public.ll_data_change_audit_logs;
drop view if exists public.ll_source_review_logs;
drop view if exists public.ll_issues;
drop view if exists public.ll_work_platform_tasks;
drop view if exists public.ll_work_platform_task_snapshots;
drop view if exists public.ll_work_platform_board_posts;
drop view if exists public.ll_weekly_reports;
drop view if exists public.ll_weekly_assets;
drop view if exists public.ll_weekly_projects;
drop view if exists public.ll_weekly_doc_ingest_runs;
drop view if exists public.ll_sheet_rows;
drop view if exists public.ll_import_runs;
drop view if exists public.ll_data_quality_findings;
drop view if exists public.ll_asset_managers;
drop view if exists public.ll_migration_row_backups;

-- Readback: remaining legacy compatibility views must be zero rows.
select
  c.relname as remaining_legacy_view
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'v'
  and c.relname in (
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
    'll_work_platform_task_snapshots',
    'll_work_platform_board_posts',
    'll_weekly_reports',
    'll_weekly_assets',
    'll_weekly_projects',
    'll_weekly_doc_ingest_runs',
    'll_sheet_rows',
    'll_import_runs',
    'll_data_quality_findings',
    'll_asset_managers',
    'll_migration_row_backups'
  )
order by c.relname;

-- Guard: physical base table count should remain 20.
select count(*) as ll_base_table_count
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relname like 'll\_%' escape '\';

rollback;
