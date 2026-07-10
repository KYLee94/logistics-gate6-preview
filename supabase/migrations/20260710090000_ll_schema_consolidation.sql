-- Consolidate public.ll_* operational records into the user-facing canonical tables.
-- This migration is intentionally destructive only after each applicable backfill
-- has been checked in the same transaction.

begin;

-- Notifications are recipient-scoped records after the delivery table is removed.
do $$
begin
  if to_regclass('public.ll_notifications') is not null then
    alter table public.ll_notifications
      add column if not exists recipient_user_id uuid references auth.users(id) on delete set null,
      add column if not exists recipient_email text,
      add column if not exists recipient_name text,
      add column if not exists delivery_status text,
      add column if not exists read_at timestamptz,
      add column if not exists dismissed_at timestamptz,
      add column if not exists notified_at timestamptz;

    update public.ll_notifications
    set notified_at = coalesce(notified_at, created_at);

    alter table public.ll_notifications
      alter column notified_at set not null,
      alter column notified_at set default now();

    alter table public.ll_notifications
      drop constraint if exists ll_notifications_delivery_status_check restrict;

    alter table public.ll_notifications
      add constraint ll_notifications_delivery_status_check
      check (delivery_status is null or delivery_status in ('unread', 'read', 'dismissed'));
  end if;
end $$;

do $$
declare
  unmatched_deliveries bigint;
begin
  if to_regclass('public.ll_notifications') is null
     or to_regclass('public.ll_notification_deliveries') is null then
    return;
  end if;

  with ranked_deliveries as (
    select
      d.*,
      row_number() over (
        partition by d.notification_id
        order by d.created_at, d.delivery_id
      ) as recipient_rank
    from public.ll_notification_deliveries d
  )
  update public.ll_notifications n
  set
    recipient_user_id = d.recipient_user_id,
    recipient_email = d.recipient_email,
    recipient_name = d.recipient_name,
    delivery_status = d.delivery_status,
    read_at = d.read_at,
    dismissed_at = d.dismissed_at
  from ranked_deliveries d
  where d.recipient_rank = 1
    and d.notification_id = n.notification_id;

  insert into public.ll_notifications (
    notification_type,
    dedupe_key,
    asset_id,
    fund_id,
    lease_id,
    lease_space_id,
    fund_tranche_id,
    title,
    body,
    due_date,
    lead_days,
    recipient_user_id,
    recipient_email,
    recipient_name,
    delivery_status,
    read_at,
    dismissed_at,
    notified_at
  )
  select
    n.notification_type,
    n.dedupe_key || ':delivery:' || d.delivery_id::text,
    n.asset_id,
    n.fund_id,
    n.lease_id,
    n.lease_space_id,
    n.fund_tranche_id,
    n.title,
    n.body,
    n.due_date,
    n.lead_days,
    d.recipient_user_id,
    d.recipient_email,
    d.recipient_name,
    d.delivery_status,
    d.read_at,
    d.dismissed_at,
    n.notified_at
  from public.ll_notification_deliveries d
  join public.ll_notifications n on n.notification_id = d.notification_id
  where (
    select count(*)
    from public.ll_notification_deliveries first_delivery
    where first_delivery.notification_id = d.notification_id
      and (first_delivery.created_at, first_delivery.delivery_id)
          <= (d.created_at, d.delivery_id)
  ) > 1
  on conflict (dedupe_key) do update set
    recipient_user_id = excluded.recipient_user_id,
    recipient_email = excluded.recipient_email,
    recipient_name = excluded.recipient_name,
    delivery_status = excluded.delivery_status,
    read_at = excluded.read_at,
    dismissed_at = excluded.dismissed_at;

  select count(*)
  into unmatched_deliveries
  from public.ll_notification_deliveries d
  where not exists (
    select 1
    from public.ll_notifications n
    where n.recipient_email = d.recipient_email
      and n.delivery_status = d.delivery_status
      and n.read_at is not distinct from d.read_at
      and n.dismissed_at is not distinct from d.dismissed_at
      and (
        n.notification_id = d.notification_id
        or n.dedupe_key = (
          (select original.dedupe_key from public.ll_notifications original where original.notification_id = d.notification_id)
          || ':delivery:' || d.delivery_id::text
        )
      )
  );

  if unmatched_deliveries <> 0 then
    raise exception 'Notification delivery backfill readback failed: % delivery rows were not preserved.', unmatched_deliveries;
  end if;
end $$;

-- Keep only articles. The collection date and timestamp make a separate run-log table unnecessary.
do $$
declare
  distinct_keys_before bigint;
  distinct_keys_after bigint;
begin
  if to_regclass('public.ll_news_items') is null then
    return;
  end if;

  alter table public.ll_news_items
    add column if not exists news_date date,
    add column if not exists ingested_at timestamptz;

  if to_regclass('public.ll_news_runs') is not null then
    update public.ll_news_items item
    set news_date = coalesce(
      item.news_date,
      to_date(substring(run.run_key from 'daily-news:([0-9]{4}-[0-9]{2}-[0-9]{2}):0700KST'), 'YYYY-MM-DD')
    )
    from public.ll_news_runs run
    where item.news_run_id = run.news_run_id
      and item.news_date is null;
  end if;

  update public.ll_news_items
  set
    news_date = coalesce(news_date, (published_at at time zone 'Asia/Seoul')::date, current_date),
    ingested_at = coalesce(ingested_at, created_at, now());

  alter table public.ll_news_items
    alter column news_date set not null,
    alter column ingested_at set not null,
    alter column ingested_at set default now();

  select count(distinct (news_date, dedupe_key))
  into distinct_keys_before
  from public.ll_news_items;

  with ranked_items as (
    select
      news_item_id,
      row_number() over (
        partition by news_date, dedupe_key
        order by published_at desc nulls last, ingested_at desc, news_item_id desc
      ) as keep_rank
    from public.ll_news_items
  )
  delete from public.ll_news_items n
  using ranked_items r
  where n.news_item_id = r.news_item_id
    and r.keep_rank > 1;

  select count(distinct (news_date, dedupe_key))
  into distinct_keys_after
  from public.ll_news_items;

  if distinct_keys_before <> distinct_keys_after then
    raise exception 'News item dedupe backfill readback failed: expected % keys, found %.', distinct_keys_before, distinct_keys_after;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.ll_news_items'::regclass
      and conname = 'll_news_items_news_date_dedupe_key_key'
  ) then
    alter table public.ll_news_items
      add constraint ll_news_items_news_date_dedupe_key_key unique (news_date, dedupe_key);
  end if;

  create index if not exists ll_news_items_news_date_published_at_idx
    on public.ll_news_items(news_date desc, published_at desc);
end $$;

/*
Deferred phase: these tables still have live read paths. Their merge must follow
the corresponding API migration, not precede it.
-- Bring board posts and weekly records into the shared work-item surface before removal.
do $$
begin
  if to_regclass('public.ll_work_items') is not null then
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
      add column if not exists asset_code text,
      add column if not exists asset_name text,
      add column if not exists fund_code text,
      add column if not exists fund_name text,
      add column if not exists project_type text,
      add column if not exists project_name text,
      add column if not exists stakeholder text,
      add column if not exists plan text,
      add column if not exists weekly_detail jsonb not null default '{}'::jsonb,
      add column if not exists weekly_requested_by uuid references auth.users(id) on delete set null,
      add column if not exists weekly_parse_summary jsonb not null default '{}'::jsonb,
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
  end if;
end $$;

do $$
declare
  unmatched_board_posts bigint;
  unmatched_weekly_records bigint;
begin
  if to_regclass('public.ll_work_items') is null then
    return;
  end if;

  if to_regclass('public.ll_board_posts') is not null then
    insert into public.ll_work_items (
      id,
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
      deleted_at,
      created_at,
      updated_at
    )
    select
      b.id,
      'board_post',
      'board:' || b.log_id,
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
      deleted_at = excluded.deleted_at,
      updated_at = excluded.updated_at;

    select count(*)
    into unmatched_board_posts
    from public.ll_board_posts b
    where not exists (
      select 1
      from public.ll_work_items w
      where w.item_type = 'board_post'
        and w.legacy_text_id = 'board:' || b.log_id
        and w.board_log_id = b.log_id
        and w.board_content is not distinct from b.content
        and w.comments = b.comments
        and w.attachments = b.attachments
    );

    if unmatched_board_posts <> 0 then
      raise exception 'Board post backfill readback failed: % rows were not preserved.', unmatched_board_posts;
    end if;
  end if;

  if to_regclass('public.ll_weekly_records') is not null then
    insert into public.ll_work_items (
      id,
      item_type,
      legacy_text_id,
      weekly_record_type,
      week_key,
      organization,
      report_year,
      report_month,
      report_week,
      weekly_detail,
      weekly_parse_summary,
      weekly_message,
      created_by,
      created_at,
      updated_at
    )
    select
      r.id,
      'weekly_report',
      'weekly:' || r.id::text,
      r.record_type,
      r.week_key,
      r.organization,
      r.report_year,
      r.report_month,
      r.report_week,
      r.report_json,
      r.parsed_counts,
      r.message,
      r.created_by,
      r.created_at,
      r.updated_at
    from public.ll_weekly_records r
    where r.record_type = 'report'
    on conflict (item_type, legacy_text_id) do update set
      week_key = excluded.week_key,
      organization = excluded.organization,
      report_year = excluded.report_year,
      report_month = excluded.report_month,
      report_week = excluded.report_week,
      weekly_detail = excluded.weekly_detail,
      weekly_parse_summary = excluded.weekly_parse_summary,
      weekly_message = excluded.weekly_message,
      updated_at = excluded.updated_at;

    insert into public.ll_work_items (
      id,
      item_type,
      legacy_text_id,
      weekly_record_type,
      weekly_report_id,
      week_key,
      organization,
      report_year,
      report_month,
      report_week,
      asset_code,
      asset_name,
      fund_code,
      fund_name,
      project_type,
      project_name,
      stakeholder,
      status,
      issue,
      plan,
      weekly_detail,
      weekly_requested_by,
      weekly_parse_summary,
      weekly_message,
      created_by,
      created_at,
      updated_at
    )
    select
      r.id,
      'weekly_' || r.record_type,
      'weekly:' || r.id::text,
      r.record_type,
      r.report_id,
      r.week_key,
      r.organization,
      r.report_year,
      r.report_month,
      r.report_week,
      r.asset_code,
      r.asset_name,
      r.fund_code,
      r.fund_name,
      r.project_type,
      r.project_name,
      r.stakeholder,
      coalesce(r.status, 'new'),
      r.issue,
      r.plan,
      r.row_json,
      r.requested_by,
      r.parsed_counts,
      r.message,
      r.created_by,
      r.created_at,
      r.updated_at
    from public.ll_weekly_records r
    where r.record_type in ('asset', 'project', 'doc_ingest')
    on conflict (item_type, legacy_text_id) do update set
      weekly_report_id = excluded.weekly_report_id,
      week_key = excluded.week_key,
      organization = excluded.organization,
      report_year = excluded.report_year,
      report_month = excluded.report_month,
      report_week = excluded.report_week,
      asset_code = excluded.asset_code,
      asset_name = excluded.asset_name,
      fund_code = excluded.fund_code,
      fund_name = excluded.fund_name,
      project_type = excluded.project_type,
      project_name = excluded.project_name,
      stakeholder = excluded.stakeholder,
      status = excluded.status,
      issue = excluded.issue,
      plan = excluded.plan,
      weekly_detail = excluded.weekly_detail,
      weekly_requested_by = excluded.weekly_requested_by,
      weekly_parse_summary = excluded.weekly_parse_summary,
      weekly_message = excluded.weekly_message,
      updated_at = excluded.updated_at;

    select count(*)
    into unmatched_weekly_records
    from public.ll_weekly_records r
    where not exists (
      select 1
      from public.ll_work_items w
      where w.id = r.id
        and w.legacy_text_id = 'weekly:' || r.id::text
        and w.weekly_record_type = r.record_type
        and w.weekly_detail is not distinct from case when r.record_type = 'report' then r.report_json else r.row_json end
        and w.weekly_parse_summary = r.parsed_counts
    );

    if unmatched_weekly_records <> 0 then
      raise exception 'Weekly record backfill readback failed: % rows were not preserved.', unmatched_weekly_records;
    end if;
  end if;
end $$;

-- Existing read-only compatibility views must stop depending on the retiring tables/columns.
create or replace view public.ll_work_platform_board_posts with (security_invoker = true) as
select
  id,
  board_log_id as log_id,
  coalesce(workspace_code, 'WS_LOGISTICS') as workspace_code,
  coalesce(workspace_label, 'Logistics Work Platform') as workspace_label,
  coalesce(work_date, created_at::date) as work_date,
  coalesce(title, '') as title,
  coalesce(board_content, description, '') as content,
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
  board_metadata as metadata,
  status,
  created_by,
  created_by_email,
  created_by_name,
  organization,
  deleted_at,
  created_at,
  updated_at
from public.ll_work_items
where item_type = 'board_post';

create or replace view public.ll_weekly_reports with (security_invoker = true) as
select
  id,
  week_key,
  organization,
  report_year,
  report_month,
  report_week,
  null::text as source_file_name,
  null::text as source_sha256,
  null::text as source_text,
  weekly_detail as report_json,
  created_by,
  created_at,
  updated_at
from public.ll_work_items
where item_type = 'weekly_report';

create or replace view public.ll_weekly_assets with (security_invoker = true) as
select
  id,
  weekly_report_id as report_id,
  asset_code,
  asset_name,
  fund_code,
  fund_name,
  status,
  issue,
  plan,
  weekly_detail as row_json,
  created_at
from public.ll_work_items
where item_type = 'weekly_asset';

create or replace view public.ll_weekly_projects with (security_invoker = true) as
select
  id,
  weekly_report_id as report_id,
  project_type,
  project_name,
  stakeholder,
  status,
  issue,
  plan,
  weekly_detail as row_json,
  created_at
from public.ll_work_items
where item_type = 'weekly_project';

create or replace view public.ll_weekly_doc_ingest_runs with (security_invoker = true) as
select
  id,
  weekly_report_id as report_id,
  week_key,
  organization,
  null::text as source_file_name,
  null::text as source_sha256,
  weekly_requested_by as requested_by,
  status,
  weekly_message as message,
  weekly_parse_summary as parsed_counts,
  created_at
from public.ll_work_items
where item_type = 'weekly_doc_ingest';

create or replace view public.ll_issues with (security_invoker = true) as
select
  legacy_text_id as issue_id,
  entity_type,
  entity_id,
  asset_id,
  tenant_id,
  issue_type,
  severity,
  title,
  description,
  status,
  due_date,
  owner,
  null::text as source_sheet_row_id,
  '{}'::jsonb as source_payload,
  created_at,
  updated_at
from public.ll_work_items
where item_type = 'issue';

create or replace view public.ll_lease_space_area_breakdowns with (security_invoker = true) as
select
  id,
  lease_space_id,
  lease_id,
  asset_id,
  tenant_id,
  attribute_key as area_type,
  attribute_label as area_label,
  value_sqm as area_sqm,
  value_py as area_py,
  basis,
  null::text as source_sheet_row_id,
  null::text as source_cell_id,
  null::text as review_status,
  null::text as review_note,
  created_at,
  updated_at
from public.ll_lease_attributes
where attribute_type = 'area_breakdown';

create or replace view public.ll_lease_space_specs with (security_invoker = true) as
select
  id,
  lease_space_id,
  lease_id,
  asset_id,
  tenant_id,
  attribute_key as spec_key,
  attribute_label as spec_label,
  value_text as spec_value,
  value_numeric as spec_numeric,
  unit_label,
  basis,
  null::text as source_sheet_row_id,
  null::text as source_cell_id,
  null::text as review_status,
  null::text as review_note,
  created_at,
  updated_at
from public.ll_lease_attributes
where attribute_type = 'space_spec';

create or replace view public.ll_lease_special_terms with (security_invoker = true) as
select
  id,
  lease_id,
  lease_space_id,
  asset_id,
  tenant_id,
  attribute_key as term_key,
  attribute_label as term_label,
  value_text as term_value,
  value_numeric as term_numeric,
  unit_label,
  basis,
  null::text as source_sheet_row_id,
  null::text as source_cell_id,
  null::text as review_status,
  null::text as review_note,
  created_at,
  updated_at
from public.ll_lease_attributes
where attribute_type = 'special_term';

create or replace view public.ll_fund_beneficiary_tranches with (security_invoker = true) as
select
  id,
  fund_id,
  row_key,
  tranche,
  party_name as beneficiary_name,
  committed_amount_krw,
  display_order,
  is_active,
  deleted_at,
  null::text as source_type,
  null::text as source_name,
  null::text as source_sheet_name,
  null::integer as source_row_number,
  '{}'::text[] as source_cell_ids,
  '{}'::jsonb as source_payload,
  null::uuid as created_by,
  null::uuid as updated_by,
  null::timestamptz as created_at,
  null::timestamptz as updated_at
from public.ll_fund_capital_tranches
where tranche_type = 'beneficiary';

create or replace view public.ll_fund_loan_tranches with (security_invoker = true) as
select
  id,
  fund_id,
  row_key,
  tranche,
  party_name as lender_name,
  committed_amount_krw,
  drawdown_date,
  maturity_date,
  loan_period,
  loan_type,
  interest_type,
  base_rate,
  spread_rate,
  loan_rate,
  interest_rate,
  fee,
  fee_rate,
  all_in,
  all_in_rate,
  display_order,
  is_active,
  deleted_at,
  null::text as source_type,
  null::text as source_name,
  null::text as source_sheet_name,
  null::integer as source_row_number,
  '{}'::text[] as source_cell_ids,
  '{}'::jsonb as source_payload,
  null::uuid as created_by,
  null::uuid as updated_by,
  null::timestamptz as created_at,
  null::timestamptz as updated_at
from public.ll_fund_capital_tranches
where tranche_type = 'loan';

create or replace view public.ll_data_change_audit_logs with (security_invoker = true) as
select
  id,
  edit_request_id,
  action,
  target_table,
  target_row_id,
  target_cell_id,
  field_name,
  before_value,
  after_value,
  readback_value,
  actor_id,
  approver_id,
  source_row_id,
  null::text as source_cell_id,
  approval_status,
  metadata,
  created_at
from public.ll_audit_events
where event_type = 'data_change';

-- Remove source references from canonical data before deleting their parent tables.
do $$
begin
  if to_regclass('public.ll_lease_attributes') is not null then
    alter table public.ll_lease_attributes
      drop constraint if exists ll_lease_attributes_source_cell_id_fkey restrict,
      drop constraint if exists ll_lease_attributes_source_table_source_legacy_id_key restrict,
      drop column if exists source_table restrict,
      drop column if exists source_legacy_id restrict,
      drop column if exists source_sheet_row_id restrict,
      drop column if exists source_cell_id restrict,
      drop column if exists source_payload restrict,
      drop column if exists review_status restrict,
      drop column if exists review_note restrict;
  end if;

  if to_regclass('public.ll_audit_events') is not null then
    alter table public.ll_audit_events
      drop constraint if exists ll_audit_events_source_cell_id_fkey restrict,
      drop column if exists source_cell_id restrict;
  end if;

  if to_regclass('public.ll_work_items') is not null then
    alter table public.ll_work_items
      drop column if exists source_sheet_row_id restrict,
      drop column if exists source_payload restrict;
  end if;

  if to_regclass('public.ll_fund_capital_tranches') is not null then
    alter table public.ll_fund_capital_tranches
      drop column if exists source_type restrict,
      drop column if exists source_name restrict,
      drop column if exists source_sheet_name restrict,
      drop column if exists source_row_number restrict,
      drop column if exists source_cell_ids restrict,
      drop column if exists source_payload restrict,
      drop column if exists created_by restrict,
      drop column if exists updated_by restrict,
      drop column if exists created_at restrict,
      drop column if exists updated_at restrict;
  end if;

  if to_regclass('public.ll_sector_market_lease_observations') is not null then
    alter table public.ll_sector_market_lease_observations
      drop constraint if exists ll_sector_market_lease_observations_source_row_id_key restrict,
      drop constraint if exists ll_sector_market_lease_observations_source_row_id_fkey restrict,
      drop constraint if exists ll_sector_market_lease_observations_source_file_id_fkey restrict,
      drop column if exists source_row_id restrict,
      drop column if exists source_file_id restrict,
      drop column if exists payload restrict;
  end if;

  if to_regclass('public.ll_sector_market_supply_cases') is not null then
    alter table public.ll_sector_market_supply_cases
      drop constraint if exists ll_sector_market_supply_cases_source_row_id_key restrict,
      drop constraint if exists ll_sector_market_supply_cases_source_row_id_fkey restrict,
      drop constraint if exists ll_sector_market_supply_cases_source_file_id_fkey restrict,
      drop column if exists source_row_id restrict,
      drop column if exists source_file_id restrict,
      drop column if exists payload restrict;
  end if;

  if to_regclass('public.ll_sector_market_transaction_cases') is not null then
    alter table public.ll_sector_market_transaction_cases
      drop constraint if exists ll_sector_market_transaction_cases_source_row_id_key restrict,
      drop constraint if exists ll_sector_market_transaction_cases_source_row_id_fkey restrict,
      drop constraint if exists ll_sector_market_transaction_cases_source_file_id_fkey restrict,
      drop column if exists source_row_id restrict,
      drop column if exists source_file_id restrict,
      drop column if exists payload restrict;
  end if;

  if to_regclass('public.ll_sector_market_cap_rate_series') is not null then
    alter table public.ll_sector_market_cap_rate_series
      drop constraint if exists ll_sector_market_cap_rate_series_source_row_id_key restrict,
      drop constraint if exists ll_sector_market_cap_rate_series_source_file_id_report_year_report_quarter_key restrict,
      drop constraint if exists ll_sector_market_cap_rate_series_source_row_id_fkey restrict,
      drop constraint if exists ll_sector_market_cap_rate_series_source_file_id_fkey restrict,
      drop column if exists source_row_id restrict,
      drop column if exists source_file_id restrict,
      drop column if exists payload restrict;
  end if;

  if to_regclass('public.ll_asset_operating_costs') is not null then
    alter table public.ll_asset_operating_costs
      drop constraint if exists ll_asset_operating_costs_source_file_id_fkey restrict,
      drop constraint if exists ll_asset_operating_costs_source_row_id_fkey restrict,
      drop column if exists source_file_id restrict,
      drop column if exists source_row_id restrict,
      drop column if exists payload restrict,
      drop column if exists created_by restrict,
      drop column if exists updated_by restrict,
      drop column if exists created_at restrict,
      drop column if exists updated_at restrict;
  end if;

  if to_regclass('public.ll_asset_specs') is not null then
    alter table public.ll_asset_specs
      drop constraint if exists ll_asset_specs_source_file_id_fkey restrict,
      drop constraint if exists ll_asset_specs_source_row_id_fkey restrict,
      drop column if exists source_file_id restrict,
      drop column if exists source_row_id restrict,
      drop column if exists payload restrict,
      drop column if exists created_by restrict,
      drop column if exists updated_by restrict,
      drop column if exists created_at restrict,
      drop column if exists updated_at restrict;
  end if;

  if to_regclass('public.ll_asset_spec_files') is not null then
    alter table public.ll_asset_spec_files
      add column if not exists uploaded_at timestamptz;

    update public.ll_asset_spec_files
    set uploaded_at = coalesce(uploaded_at, created_at);

    alter table public.ll_asset_spec_files
      alter column uploaded_at set not null,
      alter column uploaded_at set default now();

    alter table public.ll_asset_spec_files
      drop constraint if exists ll_asset_spec_files_source_file_id_fkey restrict,
      drop column if exists source_file_id restrict,
      drop column if exists metadata restrict,
      drop column if exists created_by restrict,
      drop column if exists created_at restrict;
  end if;

  if to_regclass('public.ll_notifications') is not null then
    alter table public.ll_notifications
      drop column if exists payload restrict,
      drop column if exists created_by restrict,
      drop column if exists created_at restrict;
  end if;
end $$;

*/

-- Phase 1 is additive only. It makes the new Edge contract available while the
-- deployed Edge function can still use the legacy tables during rollout.
do $$
declare
  missing_notification_recipient_count bigint;
  missing_news_date_count bigint;
begin
  if to_regclass('public.ll_notifications') is not null
     and to_regclass('public.ll_notification_deliveries') is not null then
    select count(*)
    into missing_notification_recipient_count
    from public.ll_notification_deliveries d
    left join public.ll_notifications n
      on n.notification_id = d.notification_id
     and n.recipient_email = d.recipient_email
     and n.delivery_status = d.delivery_status
    where n.notification_id is null;
    if missing_notification_recipient_count <> 0 then
      raise exception 'Notification migration readback failed: % recipient rows are missing.', missing_notification_recipient_count;
    end if;
  end if;

  if to_regclass('public.ll_news_items') is not null then
    select count(*)
    into missing_news_date_count
    from public.ll_news_items
    where news_date is null or ingested_at is null;
    if missing_news_date_count <> 0 then
      raise exception 'News migration readback failed: % news rows are missing collection fields.', missing_news_date_count;
    end if;
  end if;
end $$;

commit;
