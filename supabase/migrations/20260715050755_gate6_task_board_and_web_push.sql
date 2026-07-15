-- Replace the retired task/board surfaces with the compact logistics task board.
-- Weekly/project/issue rows share ll_work_items and must remain byte-for-byte stable.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '90s';

create temporary table gate6_retired_work_item_expected (
  item_type text primary key,
  row_count bigint not null,
  checksum text not null
) on commit drop;

insert into gate6_retired_work_item_expected (item_type, row_count, checksum) values
  ('task', 7, 'e2abca4c6a161098e26d98f4462eab4c'),
  ('task_snapshot', 17, '2d834be2b75b6d5c97c0a03a4a43ea2f'),
  ('board_post', 0, 'd41d8cd98f00b204e9800998ecf8427e');

do $$
declare
  mismatch_count integer;
begin
  with current_state as (
    select
      expected.item_type,
      count(w.id)::bigint as row_count,
      md5(coalesce(string_agg(row_to_json(w)::text, chr(30) order by w.id), '')) as checksum
    from gate6_retired_work_item_expected expected
    left join public.ll_work_items w on w.item_type = expected.item_type
    group by expected.item_type
  )
  select count(*)
  into mismatch_count
  from gate6_retired_work_item_expected expected
  join current_state using (item_type)
  where expected.row_count is distinct from current_state.row_count
     or expected.checksum is distinct from current_state.checksum;

  if mismatch_count <> 0 then
    raise exception 'Retired task data changed after backup. Regenerate and approve the backup before cleanup.';
  end if;
end $$;

create temporary table gate6_preserved_work_item_baseline on commit drop as
select
  item_type,
  count(*)::bigint as row_count,
  md5(coalesce(string_agg(row_to_json(w)::text, chr(30) order by w.id), '')) as checksum
from public.ll_work_items w
where item_type in ('issue', 'weekly_report', 'weekly_asset', 'weekly_project', 'weekly_doc_ingest')
group by item_type;

delete from public.ll_work_items
where item_type in ('task', 'task_snapshot', 'board_post');

do $$
declare
  mismatch_count integer;
begin
  with after_state as (
    select
      item_type,
      count(*)::bigint as row_count,
      md5(coalesce(string_agg(row_to_json(w)::text, chr(30) order by w.id), '')) as checksum
    from public.ll_work_items w
    where item_type in ('issue', 'weekly_report', 'weekly_asset', 'weekly_project', 'weekly_doc_ingest')
    group by item_type
  )
  select count(*)
  into mismatch_count
  from gate6_preserved_work_item_baseline before_state
  full join after_state using (item_type)
  where before_state.row_count is distinct from after_state.row_count
     or before_state.checksum is distinct from after_state.checksum;

  if mismatch_count <> 0 then
    raise exception 'Protected ll_work_items rows changed during retired task/board cleanup.';
  end if;
end $$;

drop view if exists public.ll_work_platform_tasks restrict;
drop view if exists public.ll_work_platform_task_snapshots restrict;
drop view if exists public.ll_work_platform_board_posts restrict;

alter table public.ll_work_items
  drop constraint if exists ll_work_items_item_type_check restrict;

alter table public.ll_work_items
  add constraint ll_work_items_item_type_check
  check (item_type in (
    'issue',
    'task',
    'weekly_report',
    'weekly_asset',
    'weekly_project',
    'weekly_doc_ingest'
  ));

do $$
declare
  dependent_values bigint;
begin
  select count(*)
  into dependent_values
  from public.ll_work_items
  where board_log_id is not null
     or workspace_code is not null
     or workspace_label is not null
     or work_date is not null
     or board_content is not null
     or triage_type is not null
     or issue_status is not null
     or stakeholder_category is not null
     or cardinality(visibility_groups) > 0
     or cardinality(visibility_individuals) > 0
     or comments <> '[]'::jsonb
     or attachments <> '[]'::jsonb
     or board_metadata <> '{}'::jsonb
     or snapshot_data <> '[]'::jsonb
     or task_count <> 0
     or coalesce(payload, '{}'::jsonb) <> '{}'::jsonb;

  if dependent_values <> 0 then
    raise exception 'Retired board/snapshot columns still contain protected values.';
  end if;
end $$;

alter table public.ll_work_items
  drop column if exists board_log_id restrict,
  drop column if exists workspace_code restrict,
  drop column if exists workspace_label restrict,
  drop column if exists work_date restrict,
  drop column if exists board_content restrict,
  drop column if exists triage_type restrict,
  drop column if exists issue_status restrict,
  drop column if exists stakeholder_category restrict,
  drop column if exists visibility_groups restrict,
  drop column if exists visibility_individuals restrict,
  drop column if exists comments restrict,
  drop column if exists attachments restrict,
  drop column if exists board_metadata restrict,
  drop column if exists snapshot_data restrict,
  drop column if exists task_count restrict,
  drop column if exists payload restrict;

alter table public.ll_work_items
  add column if not exists task_code text,
  add column if not exists task_category text,
  add column if not exists stakeholder_name text,
  add column if not exists client_request_id uuid;

alter table public.ll_work_items enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.ll_work_items'::regclass
      and conname = 'll_work_items_related_asset_fkey'
  ) then
    alter table public.ll_work_items
      add constraint ll_work_items_related_asset_fkey
      foreign key (related_asset_id)
      references public.ll_assets(asset_id)
      on update cascade
      on delete restrict
      not valid;
  end if;
end $$;

alter table public.ll_work_items
  validate constraint ll_work_items_related_asset_fkey;

create sequence if not exists public.ll_task_code_seq as bigint start with 1 increment by 1 no cycle;

create or replace function public.ll_assign_task_code()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.item_type = 'task' and nullif(btrim(new.task_code), '') is null then
    new.task_code := 'T-' || lpad(nextval('public.ll_task_code_seq')::text, 6, '0');
  end if;
  return new;
end;
$$;

revoke all on function public.ll_assign_task_code() from public, anon, authenticated;

drop trigger if exists ll_work_items_assign_task_code on public.ll_work_items;
create trigger ll_work_items_assign_task_code
before insert on public.ll_work_items
for each row execute function public.ll_assign_task_code();

alter table public.ll_work_items
  drop constraint if exists ll_work_items_task_board_required_check restrict,
  drop constraint if exists ll_work_items_task_category_check restrict,
  drop constraint if exists ll_work_items_task_status_check restrict;

alter table public.ll_work_items
  add constraint ll_work_items_task_board_required_check
    check (item_type <> 'task' or (
      task_code is not null
      and related_asset_id is not null
      and nullif(btrim(task_name), '') is not null
      and created_by is not null
      and client_request_id is not null
    )),
  add constraint ll_work_items_task_category_check
    check (item_type <> 'task' or task_category in (
      '투자·사업성·금융',
      '인허가·법무·세무',
      '설계·시공·원가',
      '임대·마케팅',
      '자산운영·시설·안전',
      '재무·회계·보고',
      '매각·리파이낸싱',
      '공통관리·내부운영'
    )),
  add constraint ll_work_items_task_status_check
    check (item_type <> 'task' or status in ('예정', '진행중', '검토중', '보류', '완료'));

create unique index if not exists ll_work_items_task_code_unique
  on public.ll_work_items(task_code)
  where item_type = 'task';

create unique index if not exists ll_work_items_task_client_request_unique
  on public.ll_work_items(created_by, client_request_id)
  where item_type = 'task' and client_request_id is not null;

create index if not exists ll_work_items_task_asset_updated_idx
  on public.ll_work_items(related_asset_id, updated_at desc)
  where item_type = 'task' and deleted_at is null;

create index if not exists ll_work_items_task_status_updated_idx
  on public.ll_work_items(status, updated_at desc)
  where item_type = 'task' and deleted_at is null;

create index if not exists ll_work_items_task_category_updated_idx
  on public.ll_work_items(task_category, updated_at desc)
  where item_type = 'task' and deleted_at is null;

create index if not exists ll_work_items_task_creator_updated_idx
  on public.ll_work_items(created_by, updated_at desc)
  where item_type = 'task' and deleted_at is null;

alter table public.ll_notifications
  drop constraint if exists ll_notifications_notification_type_check restrict;

alter table public.ll_notifications
  add constraint ll_notifications_notification_type_check
  check (notification_type in ('lease_maturity', 'loan_maturity', 'data_update', 'system', 'task_share'));

create table if not exists public.ll_notification_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on update cascade on delete cascade,
  recipient_email text not null,
  endpoint text not null unique,
  p256dh_key text not null,
  auth_key text not null,
  browser_family text not null default 'browser',
  enabled boolean not null default true,
  last_seen_at timestamptz not null default now(),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ll_notification_subscriptions_user_enabled_idx
  on public.ll_notification_subscriptions(user_id, enabled, updated_at desc);

alter table public.ll_notification_subscriptions enable row level security;
revoke all on table public.ll_notification_subscriptions from anon, authenticated;

create extension if not exists pg_net with schema extensions;

do $$
begin
  if to_regprocedure('net.http_post(text,jsonb,jsonb,jsonb,integer)') is null then
    raise exception 'pg_net http_post is unavailable.';
  end if;
  if (
    select count(distinct name)
    from vault.decrypted_secrets
    where name in (
      'll_web_push_public_key',
      'll_web_push_private_key',
      'll_web_push_subject',
      'll_web_push_webhook_secret'
    )
      and nullif(decrypted_secret, '') is not null
  ) <> 4 then
    raise exception 'Four Gate 6 web push Vault secrets are required before enabling web push.';
  end if;
end $$;

create or replace function public.ll_web_push_runtime_config()
returns table (
  public_key text,
  private_key text,
  subject text,
  webhook_secret text
)
language sql
security definer
set search_path = vault, pg_catalog
as $$
  select
    max(decrypted_secret) filter (where name = 'll_web_push_public_key') as public_key,
    max(decrypted_secret) filter (where name = 'll_web_push_private_key') as private_key,
    max(decrypted_secret) filter (where name = 'll_web_push_subject') as subject,
    max(decrypted_secret) filter (where name = 'll_web_push_webhook_secret') as webhook_secret
  from vault.decrypted_secrets
  where name in (
    'll_web_push_public_key',
    'll_web_push_private_key',
    'll_web_push_subject',
    'll_web_push_webhook_secret'
  );
$$;

revoke all on function public.ll_web_push_runtime_config() from public, anon, authenticated;
grant execute on function public.ll_web_push_runtime_config() to service_role;

create or replace function public.ll_queue_web_push_notification()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, vault
as $$
declare
  webhook_secret text;
begin
  if new.notification_type <> 'task_share' or new.delivery_status = 'dismissed' then
    return new;
  end if;

  select decrypted_secret
  into webhook_secret
  from vault.decrypted_secrets
  where name = 'll_web_push_webhook_secret'
  limit 1;

  if nullif(webhook_secret, '') is null then
    return new;
  end if;

  perform net.http_post(
    url := 'https://qvegpozwrcmspdvjokiz.supabase.co/functions/v1/ll-push-notifications',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', webhook_secret),
    body := jsonb_build_object(
      'type', 'INSERT',
      'table', 'll_notifications',
      'schema', 'public',
      'record', jsonb_build_object(
        'notification_id', new.notification_id,
        'recipient_user_id', new.recipient_user_id,
        'title', new.title,
        'body', new.body,
        'payload', new.payload
      )
    ),
    timeout_milliseconds := 1000
  );
  return new;
end;
$$;

revoke all on function public.ll_queue_web_push_notification() from public, anon, authenticated;

drop trigger if exists ll_notifications_queue_web_push on public.ll_notifications;
create trigger ll_notifications_queue_web_push
after insert on public.ll_notifications
for each row execute function public.ll_queue_web_push_notification();

commit;
