-- Gate 6 full data-management access for designated internal managers.
-- Data-only migration: updates public.ll_user_permissions, no new tables.

begin;

with manager_rows as (
  select *
  from (
    values
      ('kylee@igisam.com', '이관용', '기획추진센터'),
      ('jk.jeon@igisam.com', '전기영', '기획추진센터'),
      ('sjlee@igisam.com', '이시정', '기획추진센터'),
      ('seunghoon.lee@igisam.com', '이승훈', '사업그룹4파트'),
      ('ethan.lee@igisam.com', '이철승', '리얼에셋부문')
  ) as v(email, staff_name, organization)
),
src as (
  select
    lower(email) as email,
    staff_name,
    organization,
    'System Admin'::text as logistics_role,
    array[]::text[] as managed_asset_codes,
    '{"read": true, "create": true, "update": true, "delete": true}'::jsonb as managed_asset_permissions,
    '{"read": true, "create": true, "update": true, "delete": true}'::jsonb as other_asset_permissions,
    true as can_ingest_weekly,
    'active'::text as account_status,
    jsonb_build_object(
      'ai_chat', true,
      'data_quality', true,
      'analysis_tools', true,
      'data_playground', true,
      'login_history', true,
      'building_register_refresh', true,
      'opendart_refresh', true,
      'market_research', true
    ) as feature_permissions,
    jsonb_build_object(
      'source', 'gate6_full_management_permissions',
      'reason', 'sector_meeting_data_management_access',
      'updated_at', now()
    ) as profile_payload
  from manager_rows
),
updated as (
  update public.ll_user_permissions p
  set
    staff_name = src.staff_name,
    organization = src.organization,
    logistics_role = src.logistics_role,
    managed_asset_codes = src.managed_asset_codes,
    managed_asset_permissions = src.managed_asset_permissions,
    other_asset_permissions = src.other_asset_permissions,
    can_ingest_weekly = src.can_ingest_weekly,
    account_status = src.account_status,
    feature_permissions = coalesce(p.feature_permissions, '{}'::jsonb) || src.feature_permissions,
    profile_payload = coalesce(p.profile_payload, '{}'::jsonb) || src.profile_payload,
    updated_at = now()
  from src
  where lower(p.email) = src.email
  returning lower(p.email) as email
)
insert into public.ll_user_permissions (
  user_id,
  email,
  staff_name,
  organization,
  logistics_role,
  managed_asset_codes,
  managed_asset_permissions,
  other_asset_permissions,
  can_ingest_weekly,
  account_status,
  feature_permissions,
  profile_payload
)
select
  coalesce((select au.id from auth.users au where lower(au.email) = src.email limit 1), gen_random_uuid()),
  src.email,
  src.staff_name,
  src.organization,
  src.logistics_role,
  src.managed_asset_codes,
  src.managed_asset_permissions,
  src.other_asset_permissions,
  src.can_ingest_weekly,
  src.account_status,
  src.feature_permissions,
  src.profile_payload
from src
where not exists (select 1 from updated u where u.email = src.email)
  and not exists (select 1 from public.ll_user_permissions p where lower(p.email) = src.email);

commit;
