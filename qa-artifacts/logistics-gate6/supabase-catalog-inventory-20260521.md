# Supabase public.ll_* Catalog Inventory - 2026-05-21

- Project: `qvegpozwrcmspdvjokiz`
- Scope: `public.ll_*`
- Mode: read-only catalog inventory via `npx supabase db query --linked`
- This artifact does not execute cleanup, DROP, DELETE, RLS, policy, or grant changes.

## Summary

| Metric | Value |
| --- | --- |
| table_count | 20 |
| base_table_count | 20 |
| view_count | 0 |
| legacy_compatibility_view_count | 0 |
| legacy_compatibility_view_denylist_count | 21 |
| column_count | 507 |
| constraint_count | 77 |
| index_count | 102 |
| policy_count | 2 |
| grant_count | 554 |
| missing_primary_key_count | 0 |
| missing_fk_index_count | 0 |
| rls_disabled_count | 0 |
| cleanup_candidate_count | 0 |

## Object Type Matrix

| Object | Type | Owner | RLS | Comment |
| --- | --- | --- | --- | --- |
| ll_assets | BASE TABLE | postgres | enabled |  |
| ll_audit_events | BASE TABLE | postgres | enabled |  |
| ll_board_posts | BASE TABLE | postgres | enabled |  |
| ll_cache_entries | BASE TABLE | postgres | enabled |  |
| ll_edit_requests | BASE TABLE | postgres | enabled |  |
| ll_fund_asset_links | BASE TABLE | postgres | enabled |  |
| ll_fund_capital_tranches | BASE TABLE | postgres | enabled |  |
| ll_funds | BASE TABLE | postgres | enabled |  |
| ll_lease_attributes | BASE TABLE | postgres | enabled |  |
| ll_lease_spaces | BASE TABLE | postgres | enabled |  |
| ll_leases | BASE TABLE | postgres | enabled |  |
| ll_rent_history | BASE TABLE | postgres | enabled |  |
| ll_schema_metadata | BASE TABLE | postgres | enabled |  |
| ll_source_cells | BASE TABLE | postgres | enabled |  |
| ll_source_field_registry | BASE TABLE | postgres | enabled |  |
| ll_source_runs | BASE TABLE | postgres | enabled |  |
| ll_tenants | BASE TABLE | postgres | enabled |  |
| ll_user_permissions | BASE TABLE | postgres | enabled |  |
| ll_weekly_records | BASE TABLE | postgres | enabled |  |
| ll_work_items | BASE TABLE | postgres | enabled |  |

## Compatibility View Denylist

| View | Current object exists |
| --- | --- |
| ll_lease_space_area_breakdowns | no |
| ll_lease_space_specs | no |
| ll_lease_special_terms | no |
| ll_fund_beneficiary_tranches | no |
| ll_fund_loan_tranches | no |
| ll_api_audit_logs | no |
| ll_data_change_audit_logs | no |
| ll_source_review_logs | no |
| ll_issues | no |
| ll_work_platform_tasks | no |
| ll_work_platform_task_snapshots | no |
| ll_work_platform_board_posts | no |
| ll_weekly_reports | no |
| ll_weekly_assets | no |
| ll_weekly_projects | no |
| ll_weekly_doc_ingest_runs | no |
| ll_sheet_rows | no |
| ll_import_runs | no |
| ll_data_quality_findings | no |
| ll_asset_managers | no |
| ll_migration_row_backups | no |

## Table Matrix

| Table | Rows | Columns | PK | FKs | Indexes | RLS | Policies | Grants | Group | Decision | Local uses |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ll_assets | 17 | 23 | asset_id | 1 | 3 | enabled | 0 | 28 | Core Normalized | keep | 77 |
| ll_audit_events | 6006 | 38 | id | 5 | 8 | enabled | 0 | 28 | Permission / Audit | delete_prohibited | 68 |
| ll_board_posts | 3 | 27 | id | 2 | 5 | enabled | 0 | 28 | Work Platform / Weekly | keep | 23 |
| ll_cache_entries | 67 | 30 | id | 0 | 5 | enabled | 0 | 28 | Cache / Snapshot | keep | 24 |
| ll_edit_requests | 8 | 28 | id | 3 | 5 | enabled | 1 | 28 | Permission / Audit | delete_prohibited | 36 |
| ll_fund_asset_links | 17 | 14 | id | 2 | 4 | enabled | 0 | 28 | Fund | keep | 19 |
| ll_fund_capital_tranches | 103 | 33 | id | 3 | 6 | enabled | 0 | 28 | Fund | keep | 28 |
| ll_funds | 15 | 19 | fund_id | 0 | 3 | enabled | 0 | 28 | Fund | keep | 41 |
| ll_lease_attributes | 2658 | 23 | id | 5 | 9 | enabled | 0 | 28 | Detail Normalized | keep | 39 |
| ll_lease_spaces | 80 | 31 | lease_space_id | 4 | 5 | enabled | 0 | 28 | Core Normalized | keep | 61 |
| ll_leases | 45 | 33 | lease_id | 3 | 4 | enabled | 0 | 28 | Core Normalized | keep | 16 |
| ll_rent_history | 163 | 26 | rent_history_id | 6 | 8 | enabled | 0 | 28 | Core Normalized | keep | 87 |
| ll_schema_metadata | 695 | 17 | metadata_id | 0 | 3 | enabled | 0 | 28 | Metadata | keep | 14 |
| ll_source_cells | 196657 | 27 | source_cell_id | 1 | 5 | enabled | 0 | 22 | Raw Source | delete_prohibited | 32 |
| ll_source_field_registry | 134 | 21 | source_field_id | 1 | 4 | enabled | 0 | 28 | Raw Source | delete_prohibited | 14 |
| ll_source_runs | 351 | 20 | source_run_id | 0 | 4 | enabled | 0 | 28 | Raw Source | delete_prohibited | 24 |
| ll_tenants | 36 | 16 | tenant_id | 1 | 3 | enabled | 0 | 28 | Core Normalized | keep | 34 |
| ll_user_permissions | 9 | 10 | user_id | 0 | 1 | enabled | 1 | 28 | Permission / Audit | delete_prohibited | 31 |
| ll_weekly_records | 26 | 29 | id | 3 | 7 | enabled | 0 | 28 | Work Platform / Weekly | keep | 70 |
| ll_work_items | 46 | 42 | id | 5 | 10 | enabled | 0 | 28 | Work Platform / Weekly | keep | 43 |

## FK Index Coverage

| Table | Constraint | Columns | Supporting index |
| --- | --- | --- | --- |
| ll_assets | ll_assets_source_sheet_row_id_fkey | source_sheet_row_id | yes |
| ll_audit_events | ll_audit_events_actor_id_fkey | actor_id | yes |
| ll_audit_events | ll_audit_events_approver_id_fkey | approver_id | yes |
| ll_audit_events | ll_audit_events_edit_request_id_fkey | edit_request_id | yes |
| ll_audit_events | ll_audit_events_requested_by_fkey | requested_by | yes |
| ll_audit_events | ll_audit_events_source_cell_id_fkey | source_cell_id | yes |
| ll_board_posts | ll_board_posts_created_by_fkey | created_by | yes |
| ll_board_posts | ll_board_posts_related_asset_id_fkey | related_asset_id | yes |
| ll_edit_requests | ll_edit_requests_approved_by_fkey | approved_by | yes |
| ll_edit_requests | ll_edit_requests_rejected_by_fkey | rejected_by | yes |
| ll_edit_requests | ll_edit_requests_requested_by_fkey | requested_by | yes |
| ll_fund_asset_links | ll_fund_asset_links_asset_id_fkey | asset_id | yes |
| ll_fund_asset_links | ll_fund_asset_links_fund_id_fkey | fund_id | yes |
| ll_fund_capital_tranches | ll_fund_capital_tranches_created_by_fkey | created_by | yes |
| ll_fund_capital_tranches | ll_fund_capital_tranches_fund_id_fkey | fund_id | yes |
| ll_fund_capital_tranches | ll_fund_capital_tranches_updated_by_fkey | updated_by | yes |
| ll_lease_attributes | ll_lease_attributes_asset_id_fkey | asset_id | yes |
| ll_lease_attributes | ll_lease_attributes_lease_id_fkey | lease_id | yes |
| ll_lease_attributes | ll_lease_attributes_lease_space_id_fkey | lease_space_id | yes |
| ll_lease_attributes | ll_lease_attributes_source_cell_id_fkey | source_cell_id | yes |
| ll_lease_attributes | ll_lease_attributes_tenant_id_fkey | tenant_id | yes |
| ll_lease_spaces | ll_lease_spaces_asset_id_fkey | asset_id | yes |
| ll_lease_spaces | ll_lease_spaces_lease_id_fkey | lease_id | yes |
| ll_lease_spaces | ll_lease_spaces_source_sheet_row_id_fkey | source_sheet_row_id | yes |
| ll_lease_spaces | ll_lease_spaces_tenant_id_fkey | tenant_id | yes |
| ll_leases | ll_leases_asset_id_fkey | asset_id | yes |
| ll_leases | ll_leases_source_sheet_row_id_fkey | source_sheet_row_id | yes |
| ll_leases | ll_leases_tenant_id_fkey | tenant_id | yes |
| ll_rent_history | ll_rent_history_asset_id_fkey | asset_id | yes |
| ll_rent_history | ll_rent_history_lease_id_fkey | lease_id | yes |
| ll_rent_history | ll_rent_history_lease_space_id_fkey | lease_space_id | yes |
| ll_rent_history | ll_rent_history_source_contract_lease_space_id_fkey | source_contract_lease_space_id | yes |
| ll_rent_history | ll_rent_history_source_sheet_row_id_fkey | source_sheet_row_id | yes |
| ll_rent_history | ll_rent_history_tenant_id_fkey | tenant_id | yes |
| ll_source_cells | ll_source_cells_import_id_fkey | import_id | yes |
| ll_source_field_registry | ll_source_field_registry_source_cell_id_fkey | source_cell_id | yes |
| ll_tenants | ll_tenants_source_sheet_row_id_fkey | source_sheet_row_id | yes |
| ll_weekly_records | ll_weekly_records_created_by_fkey | created_by | yes |
| ll_weekly_records | ll_weekly_records_report_id_fkey | report_id | yes |
| ll_weekly_records | ll_weekly_records_requested_by_fkey | requested_by | yes |
| ll_work_items | ll_work_items_asset_id_fkey | asset_id | yes |
| ll_work_items | ll_work_items_created_by_fkey | created_by | yes |
| ll_work_items | ll_work_items_related_asset_id_fkey | related_asset_id | yes |
| ll_work_items | ll_work_items_related_tenant_id_fkey | related_tenant_id | yes |
| ll_work_items | ll_work_items_tenant_id_fkey | tenant_id | yes |

## Cleanup Candidate Classification

| Table | Rows | Group | Decision | Local uses | Reason |
| --- | --- | --- | --- | --- | --- |

## Required Gates Before Cleanup

- Browser-visible parity for Home, Asset, Company, PDF Report, Analysis Tools, and Pivot Table.
- SQL preview, impact scope, rollback/export plan, readback query, and user approval.
- No static fallback data exposure for 401/403 responses.
- No cleanup of raw source, core normalized, permission, audit, or source-cell evidence tables.
