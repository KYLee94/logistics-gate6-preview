-- LOGISTICS_LOGIN_ALLOWLIST_FIVE_USERS_V1
-- Add 이정훈B and 오채은 to the temporary login allowlist while preserving
-- the exact eight-asset CRUD scope from the canonical permission workbook.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

create temporary table _logistics_five_user_allowlist (
  permission_email text primary key,
  staff_name text not null,
  is_new_member boolean not null,
  managed_asset_codes text[]
) on commit drop;

insert into _logistics_five_user_allowlist (
  permission_email,
  staff_name,
  is_new_member,
  managed_asset_codes
)
values
  ('kylee@igisam.com', '이관용', false, null),
  ('sjlee@igisam.com', '이시정', false, null),
  ('jk.jeon@igisam.com', '전기영', false, null),
  (
    'jhlee@igisam.com',
    '이정훈B',
    true,
    array[
      'A112500002', 'A112721001', 'A112500003', 'A112606001',
      'A112755001', 'A112527001', 'A112527002', 'A112527003'
    ]::text[]
  ),
  (
    'oce@igisam.com',
    '오채은',
    true,
    array[
      'A112500002', 'A112721001', 'A112500003', 'A112606001',
      'A112755001', 'A112527001', 'A112527002', 'A112527003'
    ]::text[]
  );

create temporary table _logistics_login_gate_untouched_baseline on commit drop as
select
  count(*)::integer as row_count,
  md5(coalesce(string_agg(md5(to_jsonb(permission)::text), ',' order by permission.user_id::text), '')) as row_hash
from public.ll_user_permissions permission
where lower(btrim(coalesce(permission.email, ''))) not in ('jhlee@igisam.com', 'oce@igisam.com');

do $preflight$
declare
  v_target_count integer;
  v_active_emails text[];
  v_allowed_emails text[];
  v_legacy_emails constant text[] := array['jk.jeon@igisam.com', 'kylee@igisam.com', 'sjlee@igisam.com']::text[];
  v_final_emails constant text[] := array['jhlee@igisam.com', 'jk.jeon@igisam.com', 'kylee@igisam.com', 'oce@igisam.com', 'sjlee@igisam.com']::text[];
begin
  select count(*)
  into v_target_count
  from _logistics_five_user_allowlist expected
  join public.ll_user_permissions permission
    on lower(btrim(permission.email)) = expected.permission_email
   and permission.scope_type is null
   and permission.scope_id is null
  join auth.users auth_user
    on lower(btrim(auth_user.email)) = expected.permission_email
  where expected.is_new_member = true;

  if v_target_count <> 2 then
    raise exception using errcode = 'PT422', message = 'LOGIN_GATE_TARGET_AUTH_BINDING_COUNT_INVALID';
  end if;

  if exists (
    select 1
    from _logistics_five_user_allowlist expected
    join public.ll_user_permissions permission
      on lower(btrim(permission.email)) = expected.permission_email
     and permission.scope_type is null
     and permission.scope_id is null
    join auth.users auth_user
      on lower(btrim(auth_user.email)) = expected.permission_email
    where expected.is_new_member = true
      and (
        btrim(permission.staff_name) is distinct from expected.staff_name
        or auth_user.email_confirmed_at is null
        or coalesce(auth_user.banned_until, '-infinity'::timestamptz) > statement_timestamp()
        or auth_user.deleted_at is not null
      )
  ) then
    raise exception using errcode = 'PT422', message = 'LOGIN_GATE_TARGET_AUTH_USER_NOT_LOGIN_CAPABLE';
  end if;

  if exists (
    select 1
    from _logistics_five_user_allowlist expected
    join public.ll_user_permissions permission
      on lower(btrim(permission.email)) = expected.permission_email
     and permission.scope_type is null
     and permission.scope_id is null
    where expected.is_new_member = true
      and (
        cardinality(permission.managed_asset_codes) <> 8
        or array(
          select asset_code
          from unnest(permission.managed_asset_codes) as assets(asset_code)
          order by asset_code
        ) is distinct from array(
          select asset_code
          from unnest(expected.managed_asset_codes) as assets(asset_code)
          order by asset_code
        )
      )
  ) then
    raise exception using errcode = 'PT422', message = 'LOGIN_GATE_TARGET_MANAGED_ASSET_SCOPE_MISMATCH';
  end if;

  if exists (
    select 1
    from _logistics_five_user_allowlist expected
    join auth.users auth_user
      on lower(btrim(auth_user.email)) = expected.permission_email
    join public.ll_user_permissions permission
      on permission.user_id = auth_user.id
    where expected.is_new_member = true
      and lower(btrim(coalesce(permission.email, ''))) <> expected.permission_email
  ) then
    raise exception using errcode = 'PT422', message = 'LOGIN_GATE_TARGET_AUTH_ID_ALREADY_BOUND';
  end if;

  select array_agg(lower(btrim(permission.email)) order by lower(btrim(permission.email)))
  into v_active_emails
  from public.ll_user_permissions permission
  where permission.scope_type is null
    and permission.scope_id is null
    and permission.account_status = 'active';

  select array_agg(lower(btrim(permission.email)) order by lower(btrim(permission.email)))
  into v_allowed_emails
  from public.ll_user_permissions permission
  where permission.scope_type is null
    and permission.scope_id is null
    and lower(coalesce(
      permission.profile_payload #>> '{temporary_login_gate_20260806,allowed}',
      'false'
    )) = 'true';

  if v_active_emails is distinct from v_legacy_emails
     and v_active_emails is distinct from v_final_emails then
    raise exception using errcode = 'PT422', message = 'LOGIN_GATE_ACTIVE_BASELINE_UNEXPECTED';
  end if;

  if v_allowed_emails is distinct from v_legacy_emails
     and v_allowed_emails is distinct from v_final_emails then
    raise exception using errcode = 'PT422', message = 'LOGIN_GATE_ALLOWED_BASELINE_UNEXPECTED';
  end if;
end;
$preflight$;

update public.ll_user_permissions permission
set
  user_id = auth_user.id,
  managed_asset_permissions = jsonb_build_object(
    'read', true,
    'create', true,
    'update', true,
    'delete', true
  ),
  other_asset_permissions = jsonb_build_object(
    'read', false,
    'create', false,
    'update', false,
    'delete', false
  ),
  account_status = 'active',
  can_read = true,
  can_write = true,
  can_delete = true,
  profile_payload = jsonb_set(
    coalesce(permission.profile_payload, '{}'::jsonb),
    '{temporary_login_gate_20260806}',
    jsonb_build_object(
      'previous_account_status', coalesce(
        permission.profile_payload #>> '{temporary_login_gate_20260806,previous_account_status}',
        permission.account_status
      ),
      'allowed', true,
      'applied_at', now(),
      'mode', 'temporary_until_platform_owner_release',
      'allowlist_version', 'five_users_v1'
    ),
    true
  ),
  updated_at = now()
from _logistics_five_user_allowlist expected
join auth.users auth_user
  on lower(btrim(auth_user.email)) = expected.permission_email
where expected.is_new_member = true
  and lower(btrim(permission.email)) = expected.permission_email
  and permission.scope_type is null
  and permission.scope_id is null;

do $readback$
declare
  v_active_count integer;
  v_allowed_count integer;
  v_active_emails text[];
  v_allowed_emails text[];
  v_final_emails constant text[] := array['jhlee@igisam.com', 'jk.jeon@igisam.com', 'kylee@igisam.com', 'oce@igisam.com', 'sjlee@igisam.com']::text[];
  v_untouched_row_count integer;
  v_untouched_row_hash text;
begin
  select
    count(*)::integer,
    array_agg(lower(btrim(permission.email)) order by lower(btrim(permission.email)))
  into v_active_count, v_active_emails
  from public.ll_user_permissions permission
  where permission.scope_type is null
    and permission.scope_id is null
    and permission.account_status = 'active';

  select
    count(*)::integer,
    array_agg(lower(btrim(permission.email)) order by lower(btrim(permission.email)))
  into v_allowed_count, v_allowed_emails
  from public.ll_user_permissions permission
  where permission.scope_type is null
    and permission.scope_id is null
    and lower(coalesce(
      permission.profile_payload #>> '{temporary_login_gate_20260806,allowed}',
      'false'
    )) = 'true';

  if v_active_count <> 5
     or v_active_emails is distinct from v_final_emails then
    raise exception using errcode = 'PT500', message = 'LOGIN_GATE_FIVE_ACTIVE_USERS_READBACK_MISMATCH';
  end if;

  if v_allowed_count <> 5
     or v_allowed_emails is distinct from v_final_emails then
    raise exception using errcode = 'PT500', message = 'LOGIN_GATE_FIVE_ALLOWED_USERS_READBACK_MISMATCH';
  end if;

  if exists (
    select 1
    from _logistics_five_user_allowlist expected
    join public.ll_user_permissions permission
      on lower(btrim(permission.email)) = expected.permission_email
     and permission.scope_type is null
     and permission.scope_id is null
    join auth.users auth_user
      on lower(btrim(auth_user.email)) = expected.permission_email
     and permission.user_id = auth_user.id
    where expected.is_new_member = true
      and (
        permission.account_status <> 'active'
        or lower(coalesce(
          permission.profile_payload #>> '{temporary_login_gate_20260806,allowed}',
          'false'
        )) <> 'true'
        or auth_user.email_confirmed_at is null
        or coalesce(auth_user.banned_until, '-infinity'::timestamptz) > statement_timestamp()
        or auth_user.deleted_at is not null
        or permission.managed_asset_permissions is distinct from jsonb_build_object(
          'read', true, 'create', true, 'update', true, 'delete', true
        )
        or permission.other_asset_permissions is distinct from jsonb_build_object(
          'read', false, 'create', false, 'update', false, 'delete', false
        )
        or permission.can_read is distinct from true
        or permission.can_write is distinct from true
        or permission.can_delete is distinct from true
        or cardinality(permission.managed_asset_codes) <> 8
        or array(
          select asset_code
          from unnest(permission.managed_asset_codes) as assets(asset_code)
          order by asset_code
        ) is distinct from array(
          select asset_code
          from unnest(expected.managed_asset_codes) as assets(asset_code)
          order by asset_code
        )
      )
  ) then
    raise exception using errcode = 'PT500', message = 'LOGIN_GATE_TARGET_PERMISSION_READBACK_MISMATCH';
  end if;

  select
    count(*)::integer,
    md5(coalesce(string_agg(md5(to_jsonb(permission)::text), ',' order by permission.user_id::text), ''))
  into v_untouched_row_count, v_untouched_row_hash
  from public.ll_user_permissions permission
  where lower(btrim(coalesce(permission.email, ''))) not in ('jhlee@igisam.com', 'oce@igisam.com');

  if not exists (
    select 1
    from _logistics_login_gate_untouched_baseline baseline
    where baseline.row_count = v_untouched_row_count
      and baseline.row_hash = v_untouched_row_hash
  ) then
    raise exception using errcode = 'PT500', message = 'LOGIN_GATE_UNTOUCHED_PERMISSION_ROWS_CHANGED';
  end if;
end;
$readback$;

commit;
