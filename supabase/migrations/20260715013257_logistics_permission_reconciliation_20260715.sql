-- One-time reconciliation for the 2026-05-13 logistics permission workbook.
-- Source: 260513_담당자별 권한 부여_수식 제거.xlsx and logisticsPermissionData.json.
--
-- Safety contract:
--   * This transaction never deletes Auth users or ll_user_permissions scope rows.
--   * Existing scope rows are classified and compared before/after, not regenerated.
--   * Take the JSON baseline emitted by scripts/ops/logistics-permission-reconciliation.cjs
--     before applying. The same script prints rollback/readback instructions.

begin;

create temporary table _ll_permission_scope_baseline on commit drop as
select
  coalesce(principal_type, '(null)') as principal_type,
  coalesce(scope_type, '(null)') as scope_type,
  count(*)::integer as row_count
from public.ll_user_permissions
group by 1, 2;

create temporary table _ll_permission_scope_hash_baseline on commit drop as
select
  coalesce(principal_type, '(null)') as principal_type,
  coalesce(scope_type, '(null)') as scope_type,
  count(*)::integer as row_count,
  md5(coalesce(string_agg(md5(to_jsonb(p)::text), ',' order by md5(to_jsonb(p)::text)), '')) as row_hash
from public.ll_user_permissions p
where scope_type is not null or scope_id is not null
group by 1, 2;

create temporary table _ll_permission_source on commit drop as
with asset_groups(group_id, asset_codes) as (
  values
    (1, array['A112127001','A112299001','A120085001','A112500002','A112721001','A112500003','A112642001','A112109001','A112606001','A112755001','A112527001','A112527002','A112527003','AP00014001','A112573001','A112505001','S00002001','A190002001','A190013001']::text[]),
    (2, array['AP00014001','S00002001','A190002001','A190013001']::text[]),
    (3, array['A112127001','A112299001','A112500002','A112721001','A112500003','A112606001','A112755001','A112527001','A112527002','A112527003']::text[]),
    (4, array['A120085001','A112642001','A112109001','A112573001','A112505001']::text[]),
    (5, array['A120085001','A112642001','A112109001','A112573001']::text[]),
    (6, array['A112500002','A112721001','A112500003','A112606001','A112755001','A112527001','A112527002','A112527003']::text[]),
    (7, array['A112127001','A112299001']::text[]),
    (8, array['A112505001']::text[]),
    (9, array['AP00014001']::text[]),
    (10, array['S00002001']::text[]),
    (11, array['A190002001','A190013001']::text[]),
    (12, array['A190002001']::text[]),
    (13, array['A190013001']::text[])
),
user_flags(email, group_id, managed_flags, other_flags) as (
  values
    ('ethan.lee@igisam.com', 1, '1110', '1110'),
    ('sjlee@igisam.com', 1, '1111', '1111'),
    ('jk.jeon@igisam.com', 1, '1111', '1111'),
    ('kylee@igisam.com', 1, '1111', '1111'),
    ('gwansik.yoon@igisam.com', 2, '1110', '1110'),
    ('jmjung@igisam.com', 3, '1110', '1110'),
    ('hyungsuk.woo@igisam.com', 4, '1110', '1000'),
    ('seunghoon.lee@igisam.com', 1, '1111', '1111'),
    ('hyunho.lee@igisam.com', 5, '1111', '1000'),
    ('kim17826@igisam.com', 5, '1111', '0000'),
    ('minsukim@igisam.com', 5, '1111', '0000'),
    ('shkang@igisam.com', 5, '1111', '0000'),
    ('mihyunu@igisam.com', 5, '1111', '0000'),
    ('gulee@igisam.com', 5, '1111', '0000'),
    ('jslee@igisam.com', 5, '1111', '0000'),
    ('whan@igisam.com', 5, '1111', '0000'),
    ('hkim@igisam.com', 3, '1110', '1110'),
    ('jihkim@igisam.com', 6, '1111', '1000'),
    ('oce@igisam.com', 6, '1111', '0000'),
    ('jhlee@igisam.com', 6, '1111', '0000'),
    ('davidlee@igisam.com', 6, '1111', '0000'),
    ('dy.kwon@igisam.com', 7, '1111', '1000'),
    ('jwlim@igisam.com', 7, '1111', '0000'),
    ('dmpark@igisam.com', 7, '1111', '0000'),
    ('sw.jeoung@igisam.com', 7, '1111', '0000'),
    ('shyung.choi@igisam.com', 8, '1111', '0000'),
    ('jy3142@igisam.com', 9, '1111', '0000'),
    ('minz@igisam.com', 9, '1111', '0000'),
    ('cskim@igisam.com', 9, '1111', '0000'),
    ('cwcho@igisam.com', 9, '1111', '0000'),
    ('choijt@igisam.com', 10, '1111', '0000'),
    ('hayoung.lee@igisam.com', 10, '1111', '0000'),
    ('sh.han@igisam.com', 10, '1111', '0000'),
    ('double0507@igisam.com', 10, '1111', '0000'),
    ('ysoh@igisam.com', 11, '1111', '1000'),
    ('chhan@igisam.com', 11, '1111', '0000'),
    ('jh.ryu@igisam.com', 12, '1111', '0000'),
    ('uyeong.yang@igisam.com', 13, '1111', '0000')
)
select
  lower(btrim(u.email)) as email,
  regexp_replace(lower(btrim(u.email)), '[^a-z0-9]+', '_', 'g') as staff_id,
  a.asset_codes,
  jsonb_build_object(
    'read', substr(u.managed_flags, 1, 1) = '1',
    'create', substr(u.managed_flags, 2, 1) = '1',
    'update', substr(u.managed_flags, 3, 1) = '1',
    'delete', substr(u.managed_flags, 4, 1) = '1'
  ) as managed_asset_permissions,
  jsonb_build_object(
    'read', substr(u.other_flags, 1, 1) = '1',
    'create', substr(u.other_flags, 2, 1) = '1',
    'update', substr(u.other_flags, 3, 1) = '1',
    'delete', substr(u.other_flags, 4, 1) = '1'
  ) as other_asset_permissions
from user_flags u
join asset_groups a using (group_id);

create temporary table _ll_admin_auth_binding_targets (
  profile_email text primary key,
  allowed_auth_emails text[] not null
) on commit drop;

insert into _ll_admin_auth_binding_targets (profile_email, allowed_auth_emails)
values
  ('kylee@igisam.com', array['kylee@igisam.com', '10524@igisam.com']::text[]),
  ('sjlee@igisam.com', array['sjlee@igisam.com']::text[]),
  ('jk.jeon@igisam.com', array['jk.jeon@igisam.com']::text[]);

do $$
declare
  source_users integer;
  source_assets integer;
  source_assignments integer;
  source_managed integer[];
  source_other integer[];
begin
  select count(*) into source_users from _ll_permission_source;
  select count(distinct asset_code) into source_assets
  from _ll_permission_source s
  cross join lateral unnest(s.asset_codes) as codes(asset_code);
  select sum(cardinality(asset_codes)) into source_assignments from _ll_permission_source;
  select
    array[
      count(*) filter (where (managed_asset_permissions ->> 'read')::boolean),
      count(*) filter (where (managed_asset_permissions ->> 'create')::boolean),
      count(*) filter (where (managed_asset_permissions ->> 'update')::boolean),
      count(*) filter (where (managed_asset_permissions ->> 'delete')::boolean)
    ],
    array[
      count(*) filter (where (other_asset_permissions ->> 'read')::boolean),
      count(*) filter (where (other_asset_permissions ->> 'create')::boolean),
      count(*) filter (where (other_asset_permissions ->> 'update')::boolean),
      count(*) filter (where (other_asset_permissions ->> 'delete')::boolean)
    ]
  into source_managed, source_other
  from _ll_permission_source;

  if source_users <> 38 or source_assets <> 19 or source_assignments <> 211
    or source_managed <> array[38, 38, 38, 33]
    or source_other <> array[13, 8, 8, 4] then
    raise exception 'Workbook source guard failed: users %, assets %, assignments %, managed %, other %',
      source_users, source_assets, source_assignments, source_managed, source_other;
  end if;

  if exists (
    select 1
    from _ll_permission_source
    group by email
    having count(*) <> 1
  ) then
    raise exception 'Workbook source contains duplicate normalized emails.';
  end if;

  if exists (
    select 1
    from _ll_permission_source
    group by staff_id
    having count(*) <> 1
  ) then
    raise exception 'Workbook source contains duplicate normalized staff_id values.';
  end if;

  if exists (
    select 1
    from public.ll_staff_profiles
    where email is not null and btrim(email) <> ''
    group by lower(btrim(email))
    having count(*) > 1
  ) then
    raise exception 'll_staff_profiles has duplicate normalized emails; reconcile manually before this migration.';
  end if;

  if exists (
    select 1
    from public.ll_staff_profiles
    where staff_id is not null and btrim(staff_id) <> ''
    group by btrim(staff_id)
    having count(*) > 1
  ) then
    raise exception 'll_staff_profiles has duplicate normalized staff_id values; reconcile manually before this migration.';
  end if;

  if exists (
    select 1
    from _ll_permission_source s
    join public.ll_staff_profiles sp
      on sp.staff_id = s.staff_id
    where lower(btrim(coalesce(sp.email, ''))) <> s.email
  ) then
    raise exception 'A generated staff_id belongs to another email; reconcile manually before this migration.';
  end if;

  if exists (
    select 1
    from _ll_permission_source s
    join public.ll_staff_profiles sp on lower(btrim(sp.email)) = s.email
    where btrim(coalesce(sp.staff_id, '')) <> s.staff_id
  ) then
    raise exception 'Existing staff_id does not match the canonical permission email; reconcile manually before this migration.';
  end if;

  if exists (
    select 1
    from public.ll_user_permissions
    where email is not null and btrim(email) <> ''
    group by lower(btrim(email))
    having count(*) > 1
  ) then
    raise exception 'll_user_permissions has duplicate normalized emails; reconcile manually before this migration.';
  end if;

  if exists (
    select 1
    from auth.users au
    join _ll_permission_source s on lower(btrim(au.email)) = s.email
    group by lower(btrim(au.email))
    having count(*) > 1
  ) then
    raise exception 'auth.users has duplicate normalized emails for a permission source user.';
  end if;

  if (
    select count(*)
    from auth.users au
    where lower(btrim(au.email)) in ('kylee@igisam.com', '10524@igisam.com')
  ) > 1 then
    raise exception 'Both kylee canonical and alias Auth users exist; admin binding is ambiguous.';
  end if;

  if exists (
    select 1
    from _ll_admin_auth_binding_targets target
    where (
      select count(*)
      from auth.users au
      where lower(btrim(au.email)) = any(target.allowed_auth_emails)
    ) <> 1
  ) then
    raise exception 'Each admin permission profile must resolve to exactly one allowed Auth user.';
  end if;

  if exists (
    select 1
    from _ll_permission_source s
    join auth.users au on lower(btrim(au.email)) = s.email
    join public.ll_user_permissions p on p.user_id = au.id
    where lower(btrim(coalesce(p.email, ''))) <> s.email
  ) then
    raise exception 'Auth user id is already bound to a different permission email; reconcile manually before this migration.';
  end if;

  if exists (
    select 1
    from _ll_admin_auth_binding_targets target
    join auth.users au on lower(btrim(au.email)) = any(target.allowed_auth_emails)
    join public.ll_user_permissions p on p.user_id = au.id
    where lower(btrim(coalesce(p.email, ''))) <> target.profile_email
  ) then
    raise exception 'Allowed admin Auth user id is already bound to a different permission email; reconcile manually before this migration.';
  end if;

  if exists (
    (select distinct asset_code from _ll_permission_source s cross join lateral unnest(s.asset_codes) as codes(asset_code))
    except
    (select asset_code from public.ll_assets where asset_code is not null)
  ) or exists (
    (select asset_code from public.ll_assets where asset_code is not null)
    except
    (select distinct asset_code from _ll_permission_source s cross join lateral unnest(s.asset_codes) as codes(asset_code))
  ) then
    raise exception 'Canonical ll_assets code set differs from the 19-code workbook source; do not extend the workbook source in this migration.';
  end if;
end $$;

-- Normalize only user/profile emails. Asset and other_assets scope rows have no email values.
update public.ll_staff_profiles
set email = lower(btrim(email)), updated_at = now()
where email is not null and email <> lower(btrim(email));

update public.ll_user_permissions
set email = lower(btrim(email)), updated_at = now()
where scope_type is null
  and scope_id is null
  and email is not null
  and email <> lower(btrim(email));

-- The JSON source is used for profile display values already present in the canonical profile row.
-- Upsert only fills a missing profile from its matching permission profile; it never changes scope rows.
insert into public.ll_staff_profiles (
  staff_id, staff_name, email, organization, photo_url,
  source_system, source_table, source_pk, source_ref, source_payload, is_active, updated_at
)
select
  s.staff_id,
  coalesce(nullif(p.staff_name, ''), s.email),
  s.email,
  p.organization,
  p.image_url,
  'google_sheets',
  '260513_인원별 권한',
  s.email,
  '260513_담당자별 권한 부여_수식 제거.xlsx:Sheet1',
  jsonb_build_object('reconciled_at', now(), 'source', '260513_permission_workbook'),
  true,
  now()
from _ll_permission_source s
left join public.ll_user_permissions p
  on lower(btrim(p.email)) = s.email
 and p.scope_type is null
 and p.scope_id is null
where not exists (
  select 1
  from public.ll_staff_profiles sp
  where lower(btrim(sp.email)) = s.email
);

update public.ll_user_permissions p
set
  user_id = case
    when exists (
      select 1
      from _ll_admin_auth_binding_targets target
      where target.profile_email = s.email
    ) then (
      select au.id
      from _ll_admin_auth_binding_targets target
      join auth.users au on lower(btrim(au.email)) = any(target.allowed_auth_emails)
      where target.profile_email = s.email
    )
    else coalesce((select au.id from auth.users au where lower(btrim(au.email)) = s.email), p.user_id)
  end,
  logistics_role = case
    when s.email in ('kylee@igisam.com', 'jk.jeon@igisam.com', 'sjlee@igisam.com', 'seunghoon.lee@igisam.com', 'ethan.lee@igisam.com') then 'System Admin'
    else coalesce(nullif(p.logistics_role, ''), 'Reader')
  end,
  managed_asset_codes = s.asset_codes,
  managed_asset_permissions = s.managed_asset_permissions,
  other_asset_permissions = s.other_asset_permissions,
  can_ingest_weekly = s.email in ('kylee@igisam.com', 'jk.jeon@igisam.com', 'sjlee@igisam.com', 'seunghoon.lee@igisam.com', 'ethan.lee@igisam.com'),
  -- Only the three named backend administrators receive this feature grant.
  -- Other users keep non-privileged feature choices, but restricted features are explicit false.
  feature_permissions = case
    when s.email in ('kylee@igisam.com', 'sjlee@igisam.com', 'jk.jeon@igisam.com') then coalesce(p.feature_permissions, '{}'::jsonb) || jsonb_build_object(
      'ai_chat', true,
      'data_quality', true,
      'analysis_tools', true,
      'data_playground', true,
      'login_history', true,
      'building_register_refresh', true,
      'opendart_refresh', true,
      'market_research', true,
      'permission_admin', true,
      'approval_management', true
    )
    else coalesce(p.feature_permissions, '{}'::jsonb) || jsonb_build_object(
      'ai_chat', false,
      'login_history', false,
      'building_register_refresh', false,
      'opendart_refresh', false,
      'market_research', false,
      'permission_admin', false,
      'approval_management', false
    )
  end,
  account_status = 'active',
  can_read = coalesce((s.managed_asset_permissions ->> 'read')::boolean, false)
    or coalesce((s.other_asset_permissions ->> 'read')::boolean, false),
  can_write = coalesce((s.managed_asset_permissions ->> 'create')::boolean, false)
    or coalesce((s.managed_asset_permissions ->> 'update')::boolean, false)
    or coalesce((s.other_asset_permissions ->> 'create')::boolean, false)
    or coalesce((s.other_asset_permissions ->> 'update')::boolean, false),
  can_delete = coalesce((s.managed_asset_permissions ->> 'delete')::boolean, false)
    or coalesce((s.other_asset_permissions ->> 'delete')::boolean, false),
  profile_payload = coalesce(p.profile_payload, '{}'::jsonb) || jsonb_build_object(
    'permission_source', '260513_permission_workbook',
    'permission_reconciled_at', now()
  ),
  source_payload = coalesce(p.source_payload, '{}'::jsonb) || jsonb_build_object(
    'permission_reconciliation', '2026-07-15',
    'asset_assignment_count', cardinality(s.asset_codes)
  ),
  updated_at = now()
from _ll_permission_source s
where lower(btrim(p.email)) = s.email
  and p.scope_type is null
  and p.scope_id is null;

insert into public.ll_user_permissions (
  user_id, email, staff_name, organization, image_url, logistics_role,
  managed_asset_codes, managed_asset_permissions, other_asset_permissions,
  can_ingest_weekly, account_status, feature_permissions,
  profile_payload, source_system, source_payload, can_read, can_write, can_delete, updated_at
)
select
  coalesce(
    (
      select au.id
      from _ll_admin_auth_binding_targets target
      join auth.users au on lower(btrim(au.email)) = any(target.allowed_auth_emails)
      where target.profile_email = s.email
    ),
    (select au.id from auth.users au where lower(btrim(au.email)) = s.email),
    gen_random_uuid()
  ),
  s.email,
  sp.staff_name,
  sp.organization,
  sp.photo_url,
  case when s.email in ('kylee@igisam.com', 'jk.jeon@igisam.com', 'sjlee@igisam.com', 'seunghoon.lee@igisam.com', 'ethan.lee@igisam.com') then 'System Admin' else 'Reader' end,
  s.asset_codes,
  s.managed_asset_permissions,
  s.other_asset_permissions,
  s.email in ('kylee@igisam.com', 'jk.jeon@igisam.com', 'sjlee@igisam.com', 'seunghoon.lee@igisam.com', 'ethan.lee@igisam.com'),
  'active',
  case
    when s.email in ('kylee@igisam.com', 'sjlee@igisam.com', 'jk.jeon@igisam.com') then jsonb_build_object(
      'ai_chat', true,
      'data_quality', true,
      'analysis_tools', true,
      'data_playground', true,
      'login_history', true,
      'building_register_refresh', true,
      'opendart_refresh', true,
      'market_research', true,
      'permission_admin', true,
      'approval_management', true
    )
    else '{}'::jsonb
  end,
  jsonb_build_object('permission_source', '260513_permission_workbook', 'permission_reconciled_at', now()),
  'google_sheets',
  jsonb_build_object('permission_reconciliation', '2026-07-15', 'asset_assignment_count', cardinality(s.asset_codes)),
  coalesce((s.managed_asset_permissions ->> 'read')::boolean, false)
    or coalesce((s.other_asset_permissions ->> 'read')::boolean, false),
  coalesce((s.managed_asset_permissions ->> 'create')::boolean, false)
    or coalesce((s.managed_asset_permissions ->> 'update')::boolean, false)
    or coalesce((s.other_asset_permissions ->> 'create')::boolean, false)
    or coalesce((s.other_asset_permissions ->> 'update')::boolean, false),
  coalesce((s.managed_asset_permissions ->> 'delete')::boolean, false)
    or coalesce((s.other_asset_permissions ->> 'delete')::boolean, false),
  now()
from _ll_permission_source s
join public.ll_staff_profiles sp on lower(btrim(sp.email)) = s.email
where not exists (
  select 1
  from public.ll_user_permissions p
  where lower(btrim(p.email)) = s.email
    and p.scope_type is null
    and p.scope_id is null
);

-- Hayun is retained for auditability but must not remain an active permission principal.
-- No Auth row and no scope row is deleted.
update public.ll_user_permissions
set
  account_status = 'disabled',
  logistics_role = 'Reader',
  managed_asset_codes = '{}'::text[],
  managed_asset_permissions = '{"read": false, "create": false, "update": false, "delete": false}'::jsonb,
  other_asset_permissions = '{"read": false, "create": false, "update": false, "delete": false}'::jsonb,
  can_ingest_weekly = false,
  can_read = false,
  can_write = false,
  can_delete = false,
  feature_permissions = jsonb_build_object(
    'ai_chat', false,
    'data_quality', false,
    'analysis_tools', false,
    'data_playground', false,
    'login_history', false,
    'building_register_refresh', false,
    'opendart_refresh', false,
    'market_research', false
    ,'permission_admin', false
    ,'approval_management', false
  ),
  profile_payload = coalesce(profile_payload, '{}'::jsonb) || jsonb_build_object(
    'disabled_reason', 'Not present in the 2026-05-13 canonical permission workbook',
    'disabled_at', now()
  ),
  updated_at = now()
where lower(btrim(email)) = 'hayun.jeong@igisam.com'
  and scope_type is null
  and scope_id is null;

-- Restricted backend features are explicit false for every active non-target profile,
-- including profiles outside the workbook source. This avoids frontend-only bypasses.
update public.ll_user_permissions p
set
  feature_permissions = coalesce(p.feature_permissions, '{}'::jsonb) || jsonb_build_object(
    'ai_chat', false,
    'login_history', false,
    'building_register_refresh', false,
    'opendart_refresh', false,
    'market_research', false,
    'permission_admin', false,
    'approval_management', false
  ),
  updated_at = now()
where p.scope_type is null
  and p.scope_id is null
  and p.account_status = 'active'
  and coalesce(lower(btrim(p.email)), '') not in ('kylee@igisam.com', 'sjlee@igisam.com', 'jk.jeon@igisam.com');

do $$
declare
  profile_count integer;
  permission_profile_count integer;
  raw_managed integer[];
  raw_other integer[];
  effective integer[];
  unexpected_privileged_features integer;
begin
  select count(*) into profile_count
  from public.ll_staff_profiles sp
  join _ll_permission_source s on lower(btrim(sp.email)) = s.email
  where sp.is_active;

  select count(*) into permission_profile_count
  from public.ll_user_permissions p
  join _ll_permission_source s on lower(btrim(p.email)) = s.email
  where p.scope_type is null and p.scope_id is null and p.account_status = 'active';

  select
    array[
      count(*) filter (where (p.managed_asset_permissions ->> 'read')::boolean),
      count(*) filter (where (p.managed_asset_permissions ->> 'create')::boolean),
      count(*) filter (where (p.managed_asset_permissions ->> 'update')::boolean),
      count(*) filter (where (p.managed_asset_permissions ->> 'delete')::boolean)
    ],
    array[
      count(*) filter (where (p.other_asset_permissions ->> 'read')::boolean),
      count(*) filter (where (p.other_asset_permissions ->> 'create')::boolean),
      count(*) filter (where (p.other_asset_permissions ->> 'update')::boolean),
      count(*) filter (where (p.other_asset_permissions ->> 'delete')::boolean)
    ],
    array[
      sum(case when (p.managed_asset_permissions ->> 'read')::boolean then cardinality(p.managed_asset_codes) else 0 end + case when (p.other_asset_permissions ->> 'read')::boolean then 19 - case when (p.managed_asset_permissions ->> 'read')::boolean then cardinality(p.managed_asset_codes) else 0 end else 0 end),
      sum(case when (p.managed_asset_permissions ->> 'create')::boolean then cardinality(p.managed_asset_codes) else 0 end + case when (p.other_asset_permissions ->> 'create')::boolean then 19 - case when (p.managed_asset_permissions ->> 'create')::boolean then cardinality(p.managed_asset_codes) else 0 end else 0 end),
      sum(case when (p.managed_asset_permissions ->> 'update')::boolean then cardinality(p.managed_asset_codes) else 0 end + case when (p.other_asset_permissions ->> 'update')::boolean then 19 - case when (p.managed_asset_permissions ->> 'update')::boolean then cardinality(p.managed_asset_codes) else 0 end else 0 end),
      sum(case when (p.managed_asset_permissions ->> 'delete')::boolean then cardinality(p.managed_asset_codes) else 0 end + case when (p.other_asset_permissions ->> 'delete')::boolean then 19 - case when (p.managed_asset_permissions ->> 'delete')::boolean then cardinality(p.managed_asset_codes) else 0 end else 0 end)
    ]
  into raw_managed, raw_other, effective
  from public.ll_user_permissions p
  join _ll_permission_source s on lower(btrim(p.email)) = s.email
  where p.scope_type is null and p.scope_id is null and p.account_status = 'active';

  if profile_count <> 38 or permission_profile_count <> 38
    or raw_managed <> array[38, 38, 38, 33]
    or raw_other <> array[13, 8, 8, 4]
    or effective <> array[318, 244, 244, 163] then
    raise exception 'Permission reconciliation readback failed: profiles %, permission profiles %, managed %, other %, effective %',
      profile_count, permission_profile_count, raw_managed, raw_other, effective;
  end if;

  if (select count(*) from public.ll_user_permissions p where lower(btrim(p.email)) in ('kylee@igisam.com', 'jk.jeon@igisam.com', 'sjlee@igisam.com', 'seunghoon.lee@igisam.com', 'ethan.lee@igisam.com') and p.scope_type is null and p.scope_id is null and cardinality(p.managed_asset_codes) = 19) <> 5 then
    raise exception 'All five administrators must retain 19 managed assets.';
  end if;

  if (
    select count(*)
    from public.ll_user_permissions p
    where lower(btrim(p.email)) in ('kylee@igisam.com', 'sjlee@igisam.com', 'jk.jeon@igisam.com')
      and p.scope_type is null and p.scope_id is null
      and cardinality(p.managed_asset_codes) = 19
      and p.managed_asset_permissions = '{"read": true, "create": true, "update": true, "delete": true}'::jsonb
      and p.other_asset_permissions = '{"read": true, "create": true, "update": true, "delete": true}'::jsonb
      and p.can_read = true and p.can_write = true and p.can_delete = true
      and coalesce((p.feature_permissions ->> 'ai_chat')::boolean, false) = true
      and coalesce((p.feature_permissions ->> 'data_quality')::boolean, false) = true
      and coalesce((p.feature_permissions ->> 'analysis_tools')::boolean, false) = true
      and coalesce((p.feature_permissions ->> 'data_playground')::boolean, false) = true
      and coalesce((p.feature_permissions ->> 'login_history')::boolean, false) = true
      and coalesce((p.feature_permissions ->> 'building_register_refresh')::boolean, false) = true
      and coalesce((p.feature_permissions ->> 'opendart_refresh')::boolean, false) = true
      and coalesce((p.feature_permissions ->> 'market_research')::boolean, false) = true
      and coalesce((p.feature_permissions ->> 'permission_admin')::boolean, false) = true
      and coalesce((p.feature_permissions ->> 'approval_management')::boolean, false) = true
  ) <> 3 then
    raise exception 'Kylee, Sjlee, and Jk.jeon must retain 19-asset CRUD and every backend feature permission.';
  end if;

  if (
    select count(*)
    from _ll_admin_auth_binding_targets target
    join public.ll_user_permissions p
      on lower(btrim(p.email)) = target.profile_email
     and p.scope_type is null
     and p.scope_id is null
  ) <> 3 or exists (
    select 1
    from _ll_admin_auth_binding_targets target
    left join public.ll_user_permissions p
      on lower(btrim(p.email)) = target.profile_email
     and p.scope_type is null
     and p.scope_id is null
    left join auth.users au on au.id = p.user_id
    where p.user_id is null
       or au.id is null
       or not (lower(btrim(au.email)) = any(target.allowed_auth_emails))
       or (
         select count(*)
         from auth.users candidate
         where lower(btrim(candidate.email)) = any(target.allowed_auth_emails)
       ) <> 1
  ) or exists (
    select 1
    from _ll_admin_auth_binding_targets target
    join public.ll_user_permissions p
      on lower(btrim(p.email)) = target.profile_email
     and p.scope_type is null
     and p.scope_id is null
    group by p.user_id
    having count(*) <> 1
  ) then
    raise exception 'Admin permission profile Auth binding readback failed: user_id must be non-null, unique, and linked to one allowed Auth email.';
  end if;

  select count(*) into unexpected_privileged_features
  from public.ll_user_permissions p
  cross join lateral jsonb_each(coalesce(p.feature_permissions, '{}'::jsonb)) as feature(feature_key, feature_value)
  where p.scope_type is null
    and p.scope_id is null
    and p.account_status = 'active'
    and coalesce(lower(btrim(p.email)), '') not in ('kylee@igisam.com', 'sjlee@igisam.com', 'jk.jeon@igisam.com')
    and feature.feature_key in ('ai_chat', 'login_history', 'building_register_refresh', 'opendart_refresh', 'market_research', 'permission_admin', 'approval_management')
    and feature.feature_value = 'true'::jsonb;

  if unexpected_privileged_features <> 0 then
    raise exception 'Permission reconciliation found % unexpected privileged feature grants for active non-target users.', unexpected_privileged_features;
  end if;

  if not exists (
    select 1 from public.ll_user_permissions p
    where lower(btrim(p.email)) = 'ethan.lee@igisam.com'
      and p.scope_type is null and p.scope_id is null
      and coalesce((p.managed_asset_permissions ->> 'delete')::boolean, true) = false
      and coalesce((p.other_asset_permissions ->> 'delete')::boolean, true) = false
      and p.can_delete = false
  ) then
    raise exception 'Ethan delete permission must remain false.';
  end if;

  if not exists (
    select 1 from public.ll_user_permissions p
    where lower(btrim(p.email)) = 'hayun.jeong@igisam.com'
      and p.scope_type is null and p.scope_id is null
      and p.account_status = 'disabled'
      and p.can_read = false and p.can_write = false and p.can_delete = false
      and p.managed_asset_permissions = '{"read": false, "create": false, "update": false, "delete": false}'::jsonb
      and p.other_asset_permissions = '{"read": false, "create": false, "update": false, "delete": false}'::jsonb
  ) then
    raise exception 'Hayun must be disabled with all rights false.';
  end if;

  if exists (
    (select principal_type, scope_type, row_count from _ll_permission_scope_baseline)
    except all
    (select coalesce(principal_type, '(null)'), coalesce(scope_type, '(null)'), count(*)::integer from public.ll_user_permissions group by 1, 2)
  ) or exists (
    (select coalesce(principal_type, '(null)'), coalesce(scope_type, '(null)'), count(*)::integer from public.ll_user_permissions group by 1, 2)
    except all
    (select principal_type, scope_type, row_count from _ll_permission_scope_baseline)
  ) then
    raise exception 'Permission scope classification changed unexpectedly; no scope rows may be added or removed by this migration.';
  end if;

  if exists (
    (select principal_type, scope_type, row_count, row_hash from _ll_permission_scope_hash_baseline)
    except all
    (select
      coalesce(principal_type, '(null)'),
      coalesce(scope_type, '(null)'),
      count(*)::integer,
      md5(coalesce(string_agg(md5(to_jsonb(p)::text), ',' order by md5(to_jsonb(p)::text)), ''))
     from public.ll_user_permissions p
     where scope_type is not null or scope_id is not null
     group by 1, 2)
  ) or exists (
    (select
      coalesce(principal_type, '(null)'),
      coalesce(scope_type, '(null)'),
      count(*)::integer,
      md5(coalesce(string_agg(md5(to_jsonb(p)::text), ',' order by md5(to_jsonb(p)::text)), ''))
     from public.ll_user_permissions p
     where scope_type is not null or scope_id is not null
     group by 1, 2)
    except all
    (select principal_type, scope_type, row_count, row_hash from _ll_permission_scope_hash_baseline)
  ) then
    raise exception 'Permission scope row hash changed unexpectedly; scope rows are immutable during this migration.';
  end if;
end $$;

commit;
