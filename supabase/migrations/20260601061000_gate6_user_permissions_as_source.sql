-- Gate 6 user permission source-of-truth hardening.
-- Additive only: no new physical data tables.

begin;

alter table public.ll_user_permissions
  add column if not exists staff_name text,
  add column if not exists image_url text,
  add column if not exists account_status text not null default 'active',
  add column if not exists feature_permissions jsonb not null default '{}'::jsonb,
  add column if not exists last_login_at timestamptz,
  add column if not exists profile_payload jsonb not null default '{}'::jsonb;

update public.ll_user_permissions
set account_status = coalesce(nullif(account_status, ''), 'active'),
    feature_permissions = coalesce(feature_permissions, '{}'::jsonb),
    profile_payload = coalesce(profile_payload, '{}'::jsonb)
where account_status is null
   or account_status = ''
   or feature_permissions is null
   or profile_payload is null;

create unique index if not exists ll_user_permissions_email_unique_idx
  on public.ll_user_permissions (lower(email))
  where email is not null and btrim(email) <> '';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'll_user_permissions_email_key'
      and conrelid = 'public.ll_user_permissions'::regclass
  ) then
    alter table public.ll_user_permissions
      add constraint ll_user_permissions_email_key unique (email);
  end if;
end $$;

create index if not exists ll_user_permissions_status_idx
  on public.ll_user_permissions (account_status, lower(email))
  where email is not null and btrim(email) <> '';

create or replace view public.ll_login_history as
select
  e.id,
  e.created_at as logged_at,
  lower(coalesce(e.event_payload->>'email', e.request_payload->>'email', e.event_payload->>'auth_email', e.request_payload->>'auth_email')) as email,
  lower(coalesce(e.event_payload->>'auth_email', e.request_payload->>'auth_email', e.event_payload->>'email', e.request_payload->>'email')) as auth_email,
  coalesce(e.event_payload->>'staff_name', e.request_payload->>'staff_name') as staff_name,
  coalesce(e.event_payload->>'organization', e.request_payload->>'organization') as organization,
  coalesce(e.event_payload->>'logistics_role', e.request_payload->>'logistics_role') as logistics_role,
  coalesce(e.event_status, case when e.status_code between 200 and 399 then 'success' else 'failed' end) as status,
  coalesce(e.event_payload->>'source', e.request_payload->>'source') as source,
  coalesce(e.event_payload->>'client_timezone', e.request_payload->>'client_timezone') as client_timezone
from public.ll_audit_events e
where e.event_type = 'auth_login';

grant select on public.ll_login_history to service_role;

insert into public.ll_schema_metadata (
  metadata_key, object_type, table_schema, table_name, column_name, domain_group, role_category, description, is_active, updated_at
)
values
  ('public.ll_user_permissions.staff_name', 'column', 'public', 'll_user_permissions', 'staff_name', 'Permission / Audit', 'business_attribute', 'Human-readable logistics user name for Supabase-backed login and permission UI.', true, now()),
  ('public.ll_user_permissions.image_url', 'column', 'public', 'll_user_permissions', 'image_url', 'Permission / Audit', 'business_attribute', 'Profile image URL for logistics permission users.', true, now()),
  ('public.ll_user_permissions.account_status', 'column', 'public', 'll_user_permissions', 'account_status', 'Permission / Audit', 'business_attribute', 'Login authorization status such as active or inactive.', true, now()),
  ('public.ll_user_permissions.feature_permissions', 'column', 'public', 'll_user_permissions', 'feature_permissions', 'Permission / Audit', 'structured_payload', 'Per-feature access flags for AI chat, data quality, login history, and API refresh controls.', true, now()),
  ('public.ll_user_permissions.last_login_at', 'column', 'public', 'll_user_permissions', 'last_login_at', 'Permission / Audit', 'audit_timestamp', 'Latest successful logistics login timestamp.', true, now()),
  ('public.ll_user_permissions.profile_payload', 'column', 'public', 'll_user_permissions', 'profile_payload', 'Permission / Audit', 'structured_payload', 'Supplemental profile fields migrated from the legacy static permission source.', true, now()),
  ('public.ll_login_history', 'table', 'public', 'll_login_history', null, 'Permission / Audit', 'compatibility_view', 'Readable view over ll_audit_events where event_type=auth_login.', true, now())
on conflict (metadata_key) do update set
  object_type = excluded.object_type,
  table_schema = excluded.table_schema,
  table_name = excluded.table_name,
  column_name = excluded.column_name,
  domain_group = excluded.domain_group,
  role_category = excluded.role_category,
  description = excluded.description,
  is_active = true,
  updated_at = now();

commit;
