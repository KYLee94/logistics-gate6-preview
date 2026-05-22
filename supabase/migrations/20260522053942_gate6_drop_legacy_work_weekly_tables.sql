-- Gate 6 operating schema cleanup: move Work Platform / Weekly / QA legacy
-- physical tables behind consolidated tables and keep read compatibility views.
-- This migration is intentionally not touching core contract/source tables.

begin;

insert into public.ll_migration_row_backups (migration_id, table_name, row_key, before_payload)
select '20260522053942_gate6_drop_legacy_work_weekly_tables', 'public.ll_work_platform_tasks', id::text, to_jsonb(t)
from public.ll_work_platform_tasks t
on conflict (migration_id, table_name, row_key) do nothing;

insert into public.ll_migration_row_backups (migration_id, table_name, row_key, before_payload)
select '20260522053942_gate6_drop_legacy_work_weekly_tables', 'public.ll_work_platform_task_snapshots', id::text, to_jsonb(t)
from public.ll_work_platform_task_snapshots t
on conflict (migration_id, table_name, row_key) do nothing;

insert into public.ll_migration_row_backups (migration_id, table_name, row_key, before_payload)
select '20260522053942_gate6_drop_legacy_work_weekly_tables', 'public.ll_work_platform_board_posts', id::text, to_jsonb(t)
from public.ll_work_platform_board_posts t
on conflict (migration_id, table_name, row_key) do nothing;

insert into public.ll_migration_row_backups (migration_id, table_name, row_key, before_payload)
select '20260522053942_gate6_drop_legacy_work_weekly_tables', 'public.ll_weekly_reports', id::text, to_jsonb(t)
from public.ll_weekly_reports t
on conflict (migration_id, table_name, row_key) do nothing;

insert into public.ll_migration_row_backups (migration_id, table_name, row_key, before_payload)
select '20260522053942_gate6_drop_legacy_work_weekly_tables', 'public.ll_weekly_assets', id::text, to_jsonb(t)
from public.ll_weekly_assets t
on conflict (migration_id, table_name, row_key) do nothing;

insert into public.ll_migration_row_backups (migration_id, table_name, row_key, before_payload)
select '20260522053942_gate6_drop_legacy_work_weekly_tables', 'public.ll_weekly_projects', id::text, to_jsonb(t)
from public.ll_weekly_projects t
on conflict (migration_id, table_name, row_key) do nothing;

insert into public.ll_migration_row_backups (migration_id, table_name, row_key, before_payload)
select '20260522053942_gate6_drop_legacy_work_weekly_tables', 'public.ll_weekly_doc_ingest_runs', id::text, to_jsonb(t)
from public.ll_weekly_doc_ingest_runs t
on conflict (migration_id, table_name, row_key) do nothing;

insert into public.ll_migration_row_backups (migration_id, table_name, row_key, before_payload)
select '20260522053942_gate6_drop_legacy_work_weekly_tables', 'public.ll_issues', issue_id::text, to_jsonb(t)
from public.ll_issues t
on conflict (migration_id, table_name, row_key) do nothing;

insert into public.ll_migration_row_backups (migration_id, table_name, row_key, before_payload)
select '20260522053942_gate6_drop_legacy_work_weekly_tables', 'public.ll_data_quality_findings', finding_id::text, to_jsonb(t)
from public.ll_data_quality_findings t
on conflict (migration_id, table_name, row_key) do nothing;

insert into public.ll_migration_row_backups (migration_id, table_name, row_key, before_payload)
select '20260522053942_gate6_drop_legacy_work_weekly_tables', 'public.ll_source_review_logs', id::text, to_jsonb(t)
from public.ll_source_review_logs t
on conflict (migration_id, table_name, row_key) do nothing;

-- Re-backfill current legacy rows before removing physical tables.
insert into public.ll_work_items (
  id, item_type, task_name, company_name, related_asset_id, related_asset_name, related_tenant_id,
  next_action, issue, notes, due_date, priority, status, completed_at, created_by, created_by_email,
  created_by_name, organization, payload, deleted_at, created_at, updated_at
)
select id, 'task', task_name, company_name, related_asset_id, related_asset_name, related_tenant_id,
       next_action, issue, notes, due_date, priority, status, completed_at, created_by, created_by_email,
       created_by_name, organization, payload, deleted_at, created_at, updated_at
from public.ll_work_platform_tasks
on conflict (id) do update set
  task_name = excluded.task_name,
  company_name = excluded.company_name,
  related_asset_id = excluded.related_asset_id,
  related_asset_name = excluded.related_asset_name,
  related_tenant_id = excluded.related_tenant_id,
  next_action = excluded.next_action,
  issue = excluded.issue,
  notes = excluded.notes,
  due_date = excluded.due_date,
  priority = excluded.priority,
  status = excluded.status,
  completed_at = excluded.completed_at,
  payload = excluded.payload,
  deleted_at = excluded.deleted_at,
  updated_at = now();

insert into public.ll_work_items (
  id, item_type, workspace, week_key, week_label, week_range, group_label, basis_date,
  snapshot_data, task_count, created_by, created_by_email, created_by_name, organization,
  payload, created_at, updated_at
)
select id, 'task_snapshot', workspace, week_key, week_label, week_range, group_label, basis_date,
       snapshot_data, task_count, created_by, created_by_email, created_by_name, organization,
       payload, created_at, updated_at
from public.ll_work_platform_task_snapshots
on conflict (id) do update set
  workspace = excluded.workspace,
  week_key = excluded.week_key,
  week_label = excluded.week_label,
  week_range = excluded.week_range,
  group_label = excluded.group_label,
  basis_date = excluded.basis_date,
  snapshot_data = excluded.snapshot_data,
  task_count = excluded.task_count,
  payload = excluded.payload,
  updated_at = now();

insert into public.ll_board_posts (
  id, log_id, workspace_code, workspace_label, work_date, title, content, related_asset_id, related_asset_name,
  triage_type, issue_status, priority, stakeholder_category, stakeholder_name, visibility_groups,
  visibility_individuals, comments, attachments, metadata, status, created_by, created_by_email,
  created_by_name, organization, deleted_at, created_at, updated_at
)
select id, log_id, workspace_code, workspace_label, work_date, title, content, related_asset_id, related_asset_name,
       triage_type, issue_status, priority, stakeholder_category, stakeholder_name, visibility_groups,
       visibility_individuals, comments, attachments, metadata, status, created_by, created_by_email,
       created_by_name, organization, deleted_at, created_at, updated_at
from public.ll_work_platform_board_posts
on conflict (id) do update set
  log_id = excluded.log_id,
  title = excluded.title,
  content = excluded.content,
  related_asset_id = excluded.related_asset_id,
  related_asset_name = excluded.related_asset_name,
  triage_type = excluded.triage_type,
  issue_status = excluded.issue_status,
  priority = excluded.priority,
  stakeholder_category = excluded.stakeholder_category,
  stakeholder_name = excluded.stakeholder_name,
  visibility_groups = excluded.visibility_groups,
  visibility_individuals = excluded.visibility_individuals,
  comments = excluded.comments,
  attachments = excluded.attachments,
  metadata = excluded.metadata,
  status = excluded.status,
  deleted_at = excluded.deleted_at,
  updated_at = now();

insert into public.ll_work_items (
  item_type, legacy_text_id, entity_type, entity_id, asset_id, tenant_id, issue_type, severity,
  title, description, status, due_date, owner, source_sheet_row_id, source_payload, created_at, updated_at
)
select 'issue', issue_id, entity_type, entity_id, asset_id, tenant_id, issue_type, severity,
       title, description, coalesce(status, 'open'), due_date, owner, source_sheet_row_id, source_payload, created_at, updated_at
from public.ll_issues
on conflict (item_type, legacy_text_id) do update set
  entity_type = excluded.entity_type,
  entity_id = excluded.entity_id,
  asset_id = excluded.asset_id,
  tenant_id = excluded.tenant_id,
  issue_type = excluded.issue_type,
  severity = excluded.severity,
  title = excluded.title,
  description = excluded.description,
  status = excluded.status,
  due_date = excluded.due_date,
  owner = excluded.owner,
  source_payload = excluded.source_payload,
  updated_at = now();

insert into public.ll_weekly_records (
  id, record_type, week_key, organization, report_year, report_month, report_week,
  source_file_name, source_sha256, source_text, report_json, created_by, created_at, updated_at
)
select id, 'report', week_key, organization, report_year, report_month, report_week,
       source_file_name, source_sha256, source_text, report_json, created_by, created_at, updated_at
from public.ll_weekly_reports
on conflict (id) do update set
  week_key = excluded.week_key,
  organization = excluded.organization,
  report_year = excluded.report_year,
  report_month = excluded.report_month,
  report_week = excluded.report_week,
  source_file_name = excluded.source_file_name,
  source_sha256 = excluded.source_sha256,
  source_text = excluded.source_text,
  report_json = excluded.report_json,
  updated_at = now();

insert into public.ll_weekly_records (
  id, record_type, report_id, asset_code, asset_name, fund_code, fund_name,
  status, issue, plan, row_json, created_at, updated_at
)
select id, 'asset', report_id, asset_code, asset_name, fund_code, fund_name,
       status, issue, plan, row_json, created_at, created_at
from public.ll_weekly_assets
on conflict (id) do update set
  report_id = excluded.report_id,
  asset_code = excluded.asset_code,
  asset_name = excluded.asset_name,
  fund_code = excluded.fund_code,
  fund_name = excluded.fund_name,
  status = excluded.status,
  issue = excluded.issue,
  plan = excluded.plan,
  row_json = excluded.row_json,
  updated_at = now();

insert into public.ll_weekly_records (
  id, record_type, report_id, project_type, project_name, stakeholder,
  status, issue, plan, row_json, created_at, updated_at
)
select id, 'project', report_id, project_type, project_name, stakeholder,
       status, issue, plan, row_json, created_at, created_at
from public.ll_weekly_projects
on conflict (id) do update set
  report_id = excluded.report_id,
  project_type = excluded.project_type,
  project_name = excluded.project_name,
  stakeholder = excluded.stakeholder,
  status = excluded.status,
  issue = excluded.issue,
  plan = excluded.plan,
  row_json = excluded.row_json,
  updated_at = now();

insert into public.ll_weekly_records (
  id, record_type, report_id, week_key, organization, source_file_name, source_sha256,
  requested_by, status, message, parsed_counts, created_at, updated_at
)
select id, 'doc_ingest', report_id, week_key, organization, source_file_name, source_sha256,
       requested_by, status, message, parsed_counts, created_at, created_at
from public.ll_weekly_doc_ingest_runs
on conflict (id) do update set
  report_id = excluded.report_id,
  week_key = excluded.week_key,
  organization = excluded.organization,
  source_file_name = excluded.source_file_name,
  source_sha256 = excluded.source_sha256,
  requested_by = excluded.requested_by,
  status = excluded.status,
  message = excluded.message,
  parsed_counts = excluded.parsed_counts,
  updated_at = now();

insert into public.ll_audit_events (
  event_type, finding_id, audit_run_id, finding_type, severity, entity_type, entity_id,
  source_sheet_name, source_row_number, source_column_number, source_header, source_value_text,
  supabase_value_text, event_status, event_payload, legacy_table, legacy_id, created_at, updated_at
)
select 'data_quality_finding', finding_id, audit_run_id, finding_type, severity, entity_type, entity_id,
       source_sheet_name, source_row_number, source_column_number, source_header, source_value_text,
       supabase_value_text, status, finding_payload, 'public.ll_data_quality_findings', finding_id, created_at, updated_at
from public.ll_data_quality_findings
where not exists (
  select 1 from public.ll_audit_events e
  where e.event_type = 'data_quality_finding'
    and coalesce(e.finding_id, e.legacy_id) = public.ll_data_quality_findings.finding_id
);

insert into public.ll_audit_events (
  event_type, event_payload, source_sheet_name, source_row_id, source_row_number,
  event_status, legacy_table, legacy_id, created_at, updated_at
)
select 'source_review',
       jsonb_build_object(
         'source_type', source_type,
         'source_name', source_name,
         'sheet_name', sheet_name,
         'log_date', log_date,
         'reviewer_name', reviewer_name,
         'check_category', check_category,
         'check_result', check_result,
         'review_memo', review_memo,
         'proposed_action', proposed_action,
         'source_payload', source_payload
       ),
       sheet_name, source_row_id, row_number, check_result,
       'public.ll_source_review_logs', id::text, created_at, updated_at
from public.ll_source_review_logs
where not exists (
  select 1 from public.ll_audit_events e
  where e.event_type = 'source_review'
    and e.legacy_table = 'public.ll_source_review_logs'
    and e.legacy_id = public.ll_source_review_logs.id::text
);

drop table if exists public.ll_work_platform_tasks cascade;
drop table if exists public.ll_work_platform_task_snapshots cascade;
drop table if exists public.ll_work_platform_board_posts cascade;
drop table if exists public.ll_weekly_reports cascade;
drop table if exists public.ll_weekly_assets cascade;
drop table if exists public.ll_weekly_projects cascade;
drop table if exists public.ll_weekly_doc_ingest_runs cascade;
drop table if exists public.ll_issues cascade;
drop table if exists public.ll_data_quality_findings cascade;
drop table if exists public.ll_source_review_logs cascade;

create view public.ll_work_platform_tasks with (security_invoker = true) as
select id, task_name, company_name, related_asset_id, related_asset_name, related_tenant_id,
       next_action, issue, notes, due_date, priority, status, completed_at, created_by,
       created_by_email, created_by_name, organization, payload, deleted_at, created_at, updated_at
from public.ll_work_items
where item_type = 'task';

create view public.ll_work_platform_task_snapshots with (security_invoker = true) as
select id, workspace, week_key, week_label, week_range, group_label, basis_date, snapshot_data,
       task_count, created_by, created_by_email, created_by_name, organization, payload, created_at, updated_at
from public.ll_work_items
where item_type = 'task_snapshot';

create view public.ll_work_platform_board_posts with (security_invoker = true) as
select * from public.ll_board_posts;

create view public.ll_weekly_reports with (security_invoker = true) as
select id, week_key, organization, report_year, report_month, report_week, source_file_name,
       source_sha256, source_text, report_json, created_by, created_at, updated_at
from public.ll_weekly_records
where record_type = 'report';

create view public.ll_weekly_assets with (security_invoker = true) as
select id, report_id, asset_code, asset_name, fund_code, fund_name, status, issue, plan, row_json, created_at
from public.ll_weekly_records
where record_type = 'asset';

create view public.ll_weekly_projects with (security_invoker = true) as
select id, report_id, project_type, project_name, stakeholder, status, issue, plan, row_json, created_at
from public.ll_weekly_records
where record_type = 'project';

create view public.ll_weekly_doc_ingest_runs with (security_invoker = true) as
select id, report_id, week_key, organization, source_file_name, source_sha256,
       requested_by, status, message, parsed_counts, created_at
from public.ll_weekly_records
where record_type = 'doc_ingest';

create view public.ll_issues with (security_invoker = true) as
select legacy_text_id as issue_id, entity_type, entity_id, asset_id, tenant_id, issue_type,
       severity, title, description, status, due_date, owner, source_sheet_row_id,
       source_payload, created_at, updated_at
from public.ll_work_items
where item_type = 'issue';

create view public.ll_data_quality_findings with (security_invoker = true) as
select coalesce(finding_id, legacy_id) as finding_id, audit_run_id, finding_type,
       coalesce(severity, 'warning') as severity, entity_type, entity_id,
       source_sheet_name, source_row_number, source_column_number, source_header,
       source_value_text, supabase_value_text, coalesce(event_status, 'open') as status,
       event_payload as finding_payload, created_at, updated_at
from public.ll_audit_events
where event_type = 'data_quality_finding';

create view public.ll_source_review_logs with (security_invoker = true) as
select id, coalesce(event_payload->>'source_type', 'xlsx') as source_type,
       event_payload->>'source_name' as source_name,
       coalesce(event_payload->>'sheet_name', source_sheet_name, 'Log') as sheet_name,
       source_row_id,
       source_row_number as row_number,
       event_payload->>'log_date' as log_date,
       event_payload->>'reviewer_name' as reviewer_name,
       event_payload->>'check_category' as check_category,
       event_payload->>'check_result' as check_result,
       event_payload->>'review_memo' as review_memo,
       event_payload->>'proposed_action' as proposed_action,
       coalesce(event_payload->'source_payload', '{}'::jsonb) as source_payload,
       created_at, updated_at
from public.ll_audit_events
where event_type = 'source_review';

grant select on public.ll_work_platform_tasks to authenticated, service_role;
grant select on public.ll_work_platform_task_snapshots to authenticated, service_role;
grant select on public.ll_work_platform_board_posts to authenticated, service_role;
grant select on public.ll_weekly_reports to authenticated, service_role;
grant select on public.ll_weekly_assets to authenticated, service_role;
grant select on public.ll_weekly_projects to authenticated, service_role;
grant select on public.ll_weekly_doc_ingest_runs to authenticated, service_role;
grant select on public.ll_issues to authenticated, service_role;
grant select on public.ll_data_quality_findings to authenticated, service_role;
grant select on public.ll_source_review_logs to authenticated, service_role;

insert into public.ll_schema_metadata (
  metadata_id, metadata_key, object_type, table_schema, table_name, column_name,
  data_type, is_nullable, domain_group, role_category, description, source_system, is_active, created_at, updated_at
) values
  (gen_random_uuid(), 'cleanup:public.ll_work_platform_tasks', 'table', 'public', 'll_work_platform_tasks', null,
   null, true, 'Work Platform / Weekly', 'compatibility_view', 'Compatibility view over ll_work_items where item_type=task.', 'gate6_cleanup_20260522053942', true, now(), now()),
  (gen_random_uuid(), 'cleanup:public.ll_work_platform_task_snapshots', 'table', 'public', 'll_work_platform_task_snapshots', null,
   null, true, 'Work Platform / Weekly', 'compatibility_view', 'Compatibility view over ll_work_items where item_type=task_snapshot.', 'gate6_cleanup_20260522053942', true, now(), now()),
  (gen_random_uuid(), 'cleanup:public.ll_work_platform_board_posts', 'table', 'public', 'll_work_platform_board_posts', null,
   null, true, 'Work Platform / Weekly', 'compatibility_view', 'Compatibility view over ll_board_posts.', 'gate6_cleanup_20260522053942', true, now(), now()),
  (gen_random_uuid(), 'cleanup:public.ll_weekly_records_legacy_views', 'table', 'public', 'll_weekly_records', null,
   null, true, 'Work Platform / Weekly', 'compatibility_view', 'Weekly report/assets/projects/doc ingest legacy views now read ll_weekly_records.', 'gate6_cleanup_20260522053942', true, now(), now()),
  (gen_random_uuid(), 'cleanup:public.ll_data_quality_findings', 'table', 'public', 'll_data_quality_findings', null,
   null, true, 'Permission / Audit', 'compatibility_view', 'Compatibility view over ll_audit_events where event_type=data_quality_finding.', 'gate6_cleanup_20260522053942', true, now(), now()),
  (gen_random_uuid(), 'cleanup:public.ll_source_review_logs', 'table', 'public', 'll_source_review_logs', null,
   null, true, 'Permission / Audit', 'compatibility_view', 'Compatibility view over ll_audit_events where event_type=source_review.', 'gate6_cleanup_20260522053942', true, now(), now())
on conflict (metadata_key) do update set
  object_type = excluded.object_type,
  table_schema = excluded.table_schema,
  table_name = excluded.table_name,
  domain_group = excluded.domain_group,
  role_category = excluded.role_category,
  description = excluded.description,
  source_system = excluded.source_system,
  is_active = excluded.is_active,
  updated_at = now();

commit;
