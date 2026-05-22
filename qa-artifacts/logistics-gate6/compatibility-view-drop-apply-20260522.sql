-- Gate 6 compatibility view cleanup apply
-- Approved by user on 2026-05-22.
-- Scope: public.ll_* legacy compatibility views only.

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

commit;
