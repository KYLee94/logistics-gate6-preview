-- Retire the two remaining board/weekly storage tables only after their rows
-- are fully represented by ll_work_items. This file is intentionally atomic.

begin;

alter table public.ll_work_items
  add column if not exists board_log_id text,
  add column if not exists workspace_code text,
  add column if not exists workspace_label text,
  add column if not exists work_date date,
  add column if not exists board_content text,
  add column if not exists triage_type text,
  add column if not exists issue_status text,
  add column if not exists stakeholder_category text,
  add column if not exists stakeholder_name text,
  add column if not exists visibility_groups text[] not null default '{}'::text[],
  add column if not exists visibility_individuals text[] not null default '{}'::text[],
  add column if not exists comments jsonb not null default '[]'::jsonb,
  add column if not exists attachments jsonb not null default '[]'::jsonb,
  add column if not exists board_metadata jsonb not null default '{}'::jsonb,
  add column if not exists weekly_record_type text,
  add column if not exists weekly_report_id uuid references public.ll_work_items(id) on delete set null,
  add column if not exists report_year integer,
  add column if not exists report_month integer,
  add column if not exists report_week integer,
  add column if not exists weekly_source_file_name text,
  add column if not exists weekly_source_sha256 text,
  add column if not exists weekly_source_text text,
  add column if not exists weekly_report_json jsonb not null default '{}'::jsonb,
  add column if not exists asset_code text,
  add column if not exists asset_name text,
  add column if not exists fund_code text,
  add column if not exists fund_name text,
  add column if not exists project_type text,
  add column if not exists project_name text,
  add column if not exists stakeholder text,
  add column if not exists weekly_status text,
  add column if not exists weekly_plan text,
  add column if not exists weekly_row_json jsonb not null default '{}'::jsonb,
  add column if not exists weekly_requested_by uuid references auth.users(id) on delete set null,
  add column if not exists weekly_parsed_counts jsonb not null default '{}'::jsonb,
  add column if not exists weekly_message text;

alter table public.ll_work_items
  drop constraint if exists ll_work_items_item_type_check restrict;

alter table public.ll_work_items
  add constraint ll_work_items_item_type_check
  check (item_type in (
    'issue',
    'task',
    'task_snapshot',
    'board_post',
    'weekly_report',
    'weekly_asset',
    'weekly_project',
    'weekly_doc_ingest'
  ));

do $$
declare
  board_source_count bigint := 0;
  board_target_count bigint := 0;
  weekly_source_count bigint := 0;
  weekly_target_count bigint := 0;
  board_source_checksum text := '';
  board_target_checksum text := '';
  weekly_source_checksum text := '';
  weekly_target_checksum text := '';
begin
  if to_regclass('public.ll_board_posts') is not null then
    select
      count(*),
      md5(coalesce(string_agg(concat_ws(chr(31),
        coalesce(b.id::text, '<null>'),
        coalesce(b.log_id, '<null>'),
        coalesce(b.title, '<null>'),
        coalesce(b.content, '<null>'),
        coalesce(b.related_asset_id, '<null>'),
        coalesce(b.priority, '<null>'),
        coalesce(b.status, '<null>'),
        coalesce(b.metadata::text, '<null>'),
        coalesce(b.created_at::text, '<null>'),
        coalesce(b.updated_at::text, '<null>')
      ), chr(30) order by b.id), ''))
    into board_source_count, board_source_checksum
    from public.ll_board_posts b;

    insert into public.ll_work_items (
      item_type,
      legacy_text_id,
      board_log_id,
      workspace_code,
      workspace_label,
      workspace,
      work_date,
      title,
      description,
      board_content,
      related_asset_id,
      related_asset_name,
      triage_type,
      issue_status,
      priority,
      stakeholder_category,
      stakeholder_name,
      visibility_groups,
      visibility_individuals,
      comments,
      attachments,
      board_metadata,
      status,
      created_by,
      created_by_email,
      created_by_name,
      organization,
      source_payload,
      deleted_at,
      created_at,
      updated_at
    )
    select
      'board_post',
      'public.ll_board_posts:' || b.id::text,
      b.log_id,
      b.workspace_code,
      b.workspace_label,
      b.workspace_code,
      b.work_date,
      b.title,
      b.content,
      b.content,
      b.related_asset_id,
      b.related_asset_name,
      b.triage_type,
      b.issue_status,
      b.priority,
      b.stakeholder_category,
      b.stakeholder_name,
      b.visibility_groups,
      b.visibility_individuals,
      b.comments,
      b.attachments,
      b.metadata,
      b.status,
      b.created_by,
      b.created_by_email,
      b.created_by_name,
      b.organization,
      jsonb_build_object(
        'source_table', 'public.ll_board_posts',
        'source_pk', b.id::text
      ),
      b.deleted_at,
      b.created_at,
      b.updated_at
    from public.ll_board_posts b
    on conflict (item_type, legacy_text_id) do update set
      board_log_id = excluded.board_log_id,
      workspace_code = excluded.workspace_code,
      workspace_label = excluded.workspace_label,
      workspace = excluded.workspace,
      work_date = excluded.work_date,
      title = excluded.title,
      description = excluded.description,
      board_content = excluded.board_content,
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
      board_metadata = excluded.board_metadata,
      status = excluded.status,
      created_by = excluded.created_by,
      created_by_email = excluded.created_by_email,
      created_by_name = excluded.created_by_name,
      organization = excluded.organization,
      source_payload = excluded.source_payload,
      deleted_at = excluded.deleted_at,
      created_at = excluded.created_at,
      updated_at = excluded.updated_at;

    select
      count(*),
      md5(coalesce(string_agg(concat_ws(chr(31),
        coalesce(w.source_payload ->> 'source_pk', '<null>'),
        coalesce(w.board_log_id, '<null>'),
        coalesce(w.title, '<null>'),
        coalesce(w.board_content, '<null>'),
        coalesce(w.related_asset_id, '<null>'),
        coalesce(w.priority, '<null>'),
        coalesce(w.status, '<null>'),
        coalesce(w.board_metadata::text, '<null>'),
        coalesce(w.created_at::text, '<null>'),
        coalesce(w.updated_at::text, '<null>')
      ), chr(30) order by w.source_payload ->> 'source_pk'), ''))
    into board_target_count, board_target_checksum
    from public.ll_work_items w
    where w.item_type = 'board_post'
      and w.source_payload ->> 'source_table' = 'public.ll_board_posts';

    if board_source_count <> board_target_count
       or board_source_checksum <> board_target_checksum then
      raise exception 'Board post backfill count/checksum validation failed: source count %, target count %.', board_source_count, board_target_count;
    end if;
  end if;

  if to_regclass('public.ll_weekly_records') is not null then
    select
      count(*),
      md5(coalesce(string_agg(concat_ws(chr(31),
        coalesce(r.id::text, '<null>'),
        coalesce(r.record_type, '<null>'),
        coalesce(r.report_id::text, '<null>'),
        coalesce(r.week_key, '<null>'),
        coalesce(r.organization, '<null>'),
        coalesce(r.source_file_name, '<null>'),
        coalesce(r.source_sha256, '<null>'),
        coalesce(r.source_text, '<null>'),
        coalesce(r.report_json::text, '<null>'),
        coalesce(r.asset_name, '<null>'),
        coalesce(r.project_name, '<null>'),
        coalesce(r.status, '<null>'),
        coalesce(r.plan, '<null>'),
        coalesce(r.row_json::text, '<null>'),
        coalesce(r.parsed_counts::text, '<null>'),
        coalesce(r.message, '<null>'),
        coalesce(r.created_at::text, '<null>'),
        coalesce(r.updated_at::text, '<null>')
      ), chr(30) order by r.id), ''))
    into weekly_source_count, weekly_source_checksum
    from public.ll_weekly_records r;

    insert into public.ll_work_items (
      item_type,
      legacy_text_id,
      weekly_record_type,
      weekly_report_id,
      week_key,
      organization,
      report_year,
      report_month,
      report_week,
      weekly_source_file_name,
      weekly_source_sha256,
      weekly_source_text,
      weekly_report_json,
      asset_code,
      asset_name,
      fund_code,
      fund_name,
      project_type,
      project_name,
      stakeholder,
      weekly_status,
      issue,
      weekly_plan,
      weekly_row_json,
      weekly_requested_by,
      weekly_parsed_counts,
      weekly_message,
      created_by,
      source_payload,
      created_at,
      updated_at
    )
    select
      case r.record_type
        when 'report' then 'weekly_report'
        when 'asset' then 'weekly_asset'
        when 'project' then 'weekly_project'
        when 'doc_ingest' then 'weekly_doc_ingest'
      end,
      'public.ll_weekly_records:' || r.id::text,
      r.record_type,
      null,
      r.week_key,
      r.organization,
      r.report_year,
      r.report_month,
      r.report_week,
      r.source_file_name,
      r.source_sha256,
      r.source_text,
      r.report_json,
      r.asset_code,
      r.asset_name,
      r.fund_code,
      r.fund_name,
      r.project_type,
      r.project_name,
      r.stakeholder,
      r.status,
      r.issue,
      r.plan,
      r.row_json,
      r.requested_by,
      r.parsed_counts,
      r.message,
      r.created_by,
      jsonb_build_object(
        'source_table', 'public.ll_weekly_records',
        'source_pk', r.id::text
      ),
      r.created_at,
      r.updated_at
    from public.ll_weekly_records r
    on conflict (item_type, legacy_text_id) do update set
      weekly_record_type = excluded.weekly_record_type,
      week_key = excluded.week_key,
      organization = excluded.organization,
      report_year = excluded.report_year,
      report_month = excluded.report_month,
      report_week = excluded.report_week,
      weekly_source_file_name = excluded.weekly_source_file_name,
      weekly_source_sha256 = excluded.weekly_source_sha256,
      weekly_source_text = excluded.weekly_source_text,
      weekly_report_json = excluded.weekly_report_json,
      asset_code = excluded.asset_code,
      asset_name = excluded.asset_name,
      fund_code = excluded.fund_code,
      fund_name = excluded.fund_name,
      project_type = excluded.project_type,
      project_name = excluded.project_name,
      stakeholder = excluded.stakeholder,
      weekly_status = excluded.weekly_status,
      issue = excluded.issue,
      weekly_plan = excluded.weekly_plan,
      weekly_row_json = excluded.weekly_row_json,
      weekly_requested_by = excluded.weekly_requested_by,
      weekly_parsed_counts = excluded.weekly_parsed_counts,
      weekly_message = excluded.weekly_message,
      created_by = excluded.created_by,
      source_payload = excluded.source_payload,
      created_at = excluded.created_at,
      updated_at = excluded.updated_at;

    update public.ll_work_items child
    set weekly_report_id = parent.id
    from public.ll_weekly_records r
    left join public.ll_work_items parent
      on parent.source_payload ->> 'source_table' = 'public.ll_weekly_records'
     and parent.source_payload ->> 'source_pk' = r.report_id::text
    where child.source_payload ->> 'source_table' = 'public.ll_weekly_records'
      and child.source_payload ->> 'source_pk' = r.id::text
      and child.weekly_report_id is distinct from parent.id;

    select
      count(*),
      md5(coalesce(string_agg(concat_ws(chr(31),
        coalesce(w.source_payload ->> 'source_pk', '<null>'),
        coalesce(w.weekly_record_type, '<null>'),
        coalesce(parent.source_payload ->> 'source_pk', '<null>'),
        coalesce(w.week_key, '<null>'),
        coalesce(w.organization, '<null>'),
        coalesce(w.weekly_source_file_name, '<null>'),
        coalesce(w.weekly_source_sha256, '<null>'),
        coalesce(w.weekly_source_text, '<null>'),
        coalesce(w.weekly_report_json::text, '<null>'),
        coalesce(w.asset_name, '<null>'),
        coalesce(w.project_name, '<null>'),
        coalesce(w.weekly_status, '<null>'),
        coalesce(w.weekly_plan, '<null>'),
        coalesce(w.weekly_row_json::text, '<null>'),
        coalesce(w.weekly_parsed_counts::text, '<null>'),
        coalesce(w.weekly_message, '<null>'),
        coalesce(w.created_at::text, '<null>'),
        coalesce(w.updated_at::text, '<null>')
      ), chr(30) order by w.source_payload ->> 'source_pk'), ''))
    into weekly_target_count, weekly_target_checksum
    from public.ll_work_items w
    left join public.ll_work_items parent on parent.id = w.weekly_report_id
    where w.source_payload ->> 'source_table' = 'public.ll_weekly_records';

    if weekly_source_count <> weekly_target_count
       or weekly_source_checksum <> weekly_target_checksum then
      raise exception 'Weekly record backfill count/checksum validation failed: source count %, target count %.', weekly_source_count, weekly_target_count;
    end if;
  end if;
end $$;

drop table if exists public.ll_board_posts restrict;
drop table if exists public.ll_weekly_records restrict;

commit;
