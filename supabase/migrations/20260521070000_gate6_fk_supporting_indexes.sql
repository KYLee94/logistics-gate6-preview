-- Gate 6 schema cleanup: non-destructive FK supporting indexes.
-- This migration does not delete, rename, or alter existing data/columns.
-- Some legacy tables may already have been retired on the remote project, so
-- every index creation is guarded by a table-exists check.
-- Rollback: drop the indexes created below if needed.

do $$
begin
  if to_regclass('public.ll_api_audit_logs') is not null then
    create index if not exists idx_ll_api_audit_logs_requested_by_fk on public.ll_api_audit_logs (requested_by);
  end if;
  if to_regclass('public.ll_asset_managers') is not null then
    create index if not exists idx_ll_asset_managers_asset_id_fk on public.ll_asset_managers (asset_id);
    create index if not exists idx_ll_asset_managers_source_sheet_row_id_fk on public.ll_asset_managers (source_sheet_row_id);
  end if;
  if to_regclass('public.ll_assets') is not null then
    create index if not exists idx_ll_assets_source_sheet_row_id_fk on public.ll_assets (source_sheet_row_id);
  end if;
  if to_regclass('public.ll_dashboard_read_snapshots') is not null then
    create index if not exists idx_ll_dashboard_read_snapshots_user_id_fk on public.ll_dashboard_read_snapshots (user_id);
  end if;
  if to_regclass('public.ll_data_change_audit_logs') is not null then
    create index if not exists idx_ll_data_change_audit_logs_actor_id_fk on public.ll_data_change_audit_logs (actor_id);
    create index if not exists idx_ll_data_change_audit_logs_approver_id_fk on public.ll_data_change_audit_logs (approver_id);
  end if;
  if to_regclass('public.ll_edit_requests') is not null then
    create index if not exists idx_ll_edit_requests_approved_by_fk on public.ll_edit_requests (approved_by);
    create index if not exists idx_ll_edit_requests_rejected_by_fk on public.ll_edit_requests (rejected_by);
    create index if not exists idx_ll_edit_requests_requested_by_fk on public.ll_edit_requests (requested_by);
  end if;
  if to_regclass('public.ll_external_api_cache') is not null then
    create index if not exists idx_ll_external_api_cache_created_by_fk on public.ll_external_api_cache (created_by);
  end if;
  if to_regclass('public.ll_fund_beneficiary_tranches') is not null then
    create index if not exists idx_ll_fund_beneficiary_tranches_created_by_fk on public.ll_fund_beneficiary_tranches (created_by);
    create index if not exists idx_ll_fund_beneficiary_tranches_updated_by_fk on public.ll_fund_beneficiary_tranches (updated_by);
  end if;
  if to_regclass('public.ll_fund_loan_tranches') is not null then
    create index if not exists idx_ll_fund_loan_tranches_created_by_fk on public.ll_fund_loan_tranches (created_by);
    create index if not exists idx_ll_fund_loan_tranches_updated_by_fk on public.ll_fund_loan_tranches (updated_by);
  end if;
  if to_regclass('public.ll_issues') is not null then
    create index if not exists idx_ll_issues_asset_id_fk on public.ll_issues (asset_id);
    create index if not exists idx_ll_issues_source_sheet_row_id_fk on public.ll_issues (source_sheet_row_id);
    create index if not exists idx_ll_issues_tenant_id_fk on public.ll_issues (tenant_id);
  end if;
  if to_regclass('public.ll_lease_space_area_breakdowns') is not null then
    create index if not exists idx_ll_lease_space_area_breakdowns_source_cell_id_fk on public.ll_lease_space_area_breakdowns (source_cell_id);
    create index if not exists idx_ll_lease_space_area_breakdowns_tenant_id_fk on public.ll_lease_space_area_breakdowns (tenant_id);
  end if;
  if to_regclass('public.ll_lease_space_specs') is not null then
    create index if not exists idx_ll_lease_space_specs_source_cell_id_fk on public.ll_lease_space_specs (source_cell_id);
    create index if not exists idx_ll_lease_space_specs_tenant_id_fk on public.ll_lease_space_specs (tenant_id);
  end if;
  if to_regclass('public.ll_lease_spaces') is not null then
    create index if not exists idx_ll_lease_spaces_lease_id_fk on public.ll_lease_spaces (lease_id);
    create index if not exists idx_ll_lease_spaces_source_sheet_row_id_fk on public.ll_lease_spaces (source_sheet_row_id);
  end if;
  if to_regclass('public.ll_lease_special_terms') is not null then
    create index if not exists idx_ll_lease_special_terms_source_cell_id_fk on public.ll_lease_special_terms (source_cell_id);
    create index if not exists idx_ll_lease_special_terms_tenant_id_fk on public.ll_lease_special_terms (tenant_id);
  end if;
  if to_regclass('public.ll_leases') is not null then
    create index if not exists idx_ll_leases_source_sheet_row_id_fk on public.ll_leases (source_sheet_row_id);
  end if;
  if to_regclass('public.ll_rent_history') is not null then
    create index if not exists idx_ll_rent_history_lease_id_fk on public.ll_rent_history (lease_id);
    create index if not exists idx_ll_rent_history_source_contract_lease_space_id_fk on public.ll_rent_history (source_contract_lease_space_id);
    create index if not exists idx_ll_rent_history_source_sheet_row_id_fk on public.ll_rent_history (source_sheet_row_id);
    create index if not exists idx_ll_rent_history_tenant_id_fk on public.ll_rent_history (tenant_id);
  end if;
  if to_regclass('public.ll_source_field_registry') is not null then
    create index if not exists idx_ll_source_field_registry_source_cell_id_fk on public.ll_source_field_registry (source_cell_id);
  end if;
  if to_regclass('public.ll_tenants') is not null then
    create index if not exists idx_ll_tenants_source_sheet_row_id_fk on public.ll_tenants (source_sheet_row_id);
  end if;
  if to_regclass('public.ll_weekly_assets') is not null then
    create index if not exists idx_ll_weekly_assets_report_id_fk on public.ll_weekly_assets (report_id);
  end if;
  if to_regclass('public.ll_weekly_doc_ingest_runs') is not null then
    create index if not exists idx_ll_weekly_doc_ingest_runs_report_id_fk on public.ll_weekly_doc_ingest_runs (report_id);
    create index if not exists idx_ll_weekly_doc_ingest_runs_requested_by_fk on public.ll_weekly_doc_ingest_runs (requested_by);
  end if;
  if to_regclass('public.ll_weekly_projects') is not null then
    create index if not exists idx_ll_weekly_projects_report_id_fk on public.ll_weekly_projects (report_id);
  end if;
  if to_regclass('public.ll_weekly_reports') is not null then
    create index if not exists idx_ll_weekly_reports_created_by_fk on public.ll_weekly_reports (created_by);
  end if;
  if to_regclass('public.ll_work_platform_task_snapshots') is not null then
    create index if not exists idx_ll_work_platform_task_snapshots_created_by_fk on public.ll_work_platform_task_snapshots (created_by);
  end if;
  if to_regclass('public.ll_work_platform_tasks') is not null then
    create index if not exists idx_ll_work_platform_tasks_created_by_fk on public.ll_work_platform_tasks (created_by);
    create index if not exists idx_ll_work_platform_tasks_related_tenant_id_fk on public.ll_work_platform_tasks (related_tenant_id);
  end if;
  if to_regclass('public.ll_worklogs') is not null then
    create index if not exists idx_ll_worklogs_created_by_fk on public.ll_worklogs (created_by);
  end if;
end $$;
