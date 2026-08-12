-- LOGISTICS_TWO_USER_MANAGED_ASSET_PARTITION_V1
-- Correct the temporary five-user rollout so each manager receives CRUD only
-- for the assets whose canonical assetManagerName identifies that person.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

create temporary table _logistics_manager_asset_partition (
  permission_email text primary key,
  staff_name text not null,
  expected_count integer not null,
  managed_asset_codes text[] not null
) on commit drop;

insert into _logistics_manager_asset_partition (
  permission_email,
  staff_name,
  expected_count,
  managed_asset_codes
)
values
  (
    'oce@igisam.com',
    '오채은',
    3,
    array['A112500002', 'A112721001', 'A112500003']::text[]
  ),
  (
    'jhlee@igisam.com',
    '이정훈B',
    5,
    array['A112606001', 'A112755001', 'A112527001', 'A112527002', 'A112527003']::text[]
  );

create temporary table _logistics_permission_partition_untouched_baseline on commit drop as
select
  count(*)::integer as row_count,
  md5(coalesce(string_agg(md5(to_jsonb(permission)::text), ',' order by permission.user_id::text), '')) as row_hash
from public.ll_user_permissions permission
where lower(btrim(coalesce(permission.email, ''))) not in ('jhlee@igisam.com', 'oce@igisam.com');

do $preflight$
declare
  v_target_count integer;
  v_distinct_asset_count integer;
begin
  select count(*)::integer
  into v_target_count
  from _logistics_manager_asset_partition expected
  join public.ll_user_permissions permission
    on lower(btrim(permission.email)) = expected.permission_email
   and permission.scope_type is null
   and permission.scope_id is null
  join auth.users auth_user
    on auth_user.id = permission.user_id
   and lower(btrim(auth_user.email)) = expected.permission_email
  where btrim(permission.staff_name) = expected.staff_name
    and permission.account_status = 'active'
    and lower(coalesce(
      permission.profile_payload #>> '{temporary_login_gate_20260806,allowed}',
      'false'
    )) = 'true'
    and auth_user.email_confirmed_at is not null
    and coalesce(auth_user.banned_until, '-infinity'::timestamptz) <= statement_timestamp()
    and auth_user.deleted_at is null;

  if v_target_count <> 2 then
    raise exception using errcode = 'PT422', message = 'MANAGER_ASSET_PARTITION_TARGET_LOGIN_BINDING_INVALID';
  end if;

  select count(distinct asset_code)::integer
  into v_distinct_asset_count
  from _logistics_manager_asset_partition expected
  cross join lateral unnest(expected.managed_asset_codes) as assets(asset_code);

  if v_distinct_asset_count <> 8 then
    raise exception using errcode = 'PT422', message = 'MANAGER_ASSET_PARTITION_DISTINCT_ASSET_COUNT_INVALID';
  end if;

  if exists (
    select asset_code
    from _logistics_manager_asset_partition expected
    cross join lateral unnest(expected.managed_asset_codes) as assets(asset_code)
    group by asset_code
    having count(*) <> 1
  ) then
    raise exception using errcode = 'PT422', message = 'MANAGER_ASSET_PARTITION_OVERLAP_DETECTED';
  end if;

  if exists (
    select 1
    from _logistics_manager_asset_partition expected
    where cardinality(expected.managed_asset_codes) <> expected.expected_count
       or exists (
         select 1
         from unnest(expected.managed_asset_codes) as assets(asset_code)
         left join logistics_core.assets asset on asset.asset_code = assets.asset_code
         where asset.asset_code is null
       )
  ) then
    raise exception using errcode = 'PT422', message = 'MANAGER_ASSET_PARTITION_CANONICAL_ASSET_MISMATCH';
  end if;

  if exists (
    select 1
    from _logistics_manager_asset_partition expected
    join public.ll_user_permissions permission
      on lower(btrim(permission.email)) = expected.permission_email
     and permission.scope_type is null
     and permission.scope_id is null
    where cardinality(permission.managed_asset_codes) <> 8
       or permission.managed_asset_permissions is distinct from jsonb_build_object(
         'read', true, 'create', true, 'update', true, 'delete', true
       )
       or permission.other_asset_permissions is distinct from jsonb_build_object(
         'read', false, 'create', false, 'update', false, 'delete', false
       )
  ) then
    raise exception using errcode = 'PT422', message = 'MANAGER_ASSET_PARTITION_ROLLOUT_BASELINE_INVALID';
  end if;
end;
$preflight$;

update public.ll_user_permissions permission
set
  managed_asset_codes = expected.managed_asset_codes,
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
  can_read = true,
  can_write = true,
  can_delete = true,
  source_payload = coalesce(permission.source_payload, '{}'::jsonb) || jsonb_build_object(
    'managed_asset_partition', 'asset_manager_name',
    'managed_asset_partition_applied_at', now(),
    'managed_asset_count', expected.expected_count
  ),
  updated_at = now()
from _logistics_manager_asset_partition expected
where lower(btrim(permission.email)) = expected.permission_email
  and permission.scope_type is null
  and permission.scope_id is null;

do $readback$
declare
  v_untouched_row_count integer;
  v_untouched_row_hash text;
begin
  if exists (
    select 1
    from _logistics_manager_asset_partition expected
    join public.ll_user_permissions permission
      on lower(btrim(permission.email)) = expected.permission_email
     and permission.scope_type is null
     and permission.scope_id is null
    where permission.account_status <> 'active'
       or lower(coalesce(
         permission.profile_payload #>> '{temporary_login_gate_20260806,allowed}',
         'false'
       )) <> 'true'
       or cardinality(permission.managed_asset_codes) <> expected.expected_count
       or array(
         select asset_code
         from unnest(permission.managed_asset_codes) as assets(asset_code)
         order by asset_code
       ) is distinct from array(
         select asset_code
         from unnest(expected.managed_asset_codes) as assets(asset_code)
         order by asset_code
       )
       or permission.managed_asset_permissions is distinct from jsonb_build_object(
         'read', true, 'create', true, 'update', true, 'delete', true
       )
       or permission.other_asset_permissions is distinct from jsonb_build_object(
         'read', false, 'create', false, 'update', false, 'delete', false
       )
       or permission.can_read is distinct from true
       or permission.can_write is distinct from true
       or permission.can_delete is distinct from true
  ) then
    raise exception using errcode = 'PT500', message = 'MANAGER_ASSET_PARTITION_READBACK_MISMATCH';
  end if;

  if exists (
    select asset_code
    from _logistics_manager_asset_partition expected
    join public.ll_user_permissions permission
      on lower(btrim(permission.email)) = expected.permission_email
     and permission.scope_type is null
     and permission.scope_id is null
    cross join lateral unnest(permission.managed_asset_codes) as assets(asset_code)
    group by asset_code
    having count(*) <> 1
  ) then
    raise exception using errcode = 'PT500', message = 'MANAGER_ASSET_PARTITION_POST_WRITE_OVERLAP';
  end if;

  select
    count(*)::integer,
    md5(coalesce(string_agg(md5(to_jsonb(permission)::text), ',' order by permission.user_id::text), ''))
  into v_untouched_row_count, v_untouched_row_hash
  from public.ll_user_permissions permission
  where lower(btrim(coalesce(permission.email, ''))) not in ('jhlee@igisam.com', 'oce@igisam.com');

  if not exists (
    select 1
    from _logistics_permission_partition_untouched_baseline baseline
    where baseline.row_count = v_untouched_row_count
      and baseline.row_hash = v_untouched_row_hash
  ) then
    raise exception using errcode = 'PT500', message = 'MANAGER_ASSET_PARTITION_UNTOUCHED_ROWS_CHANGED';
  end if;
end;
$readback$;

commit;
