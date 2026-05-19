update auth.users
set
  email_confirmed_at = coalesce(email_confirmed_at, now())
where id = 'd4bdb487-99a4-43b8-a7db-169080776677';

insert into public.ll_user_permissions (
  user_id,
  email,
  logistics_role,
  organization,
  managed_asset_codes,
  managed_asset_permissions,
  other_asset_permissions,
  can_ingest_weekly
) values (
  'd4bdb487-99a4-43b8-a7db-169080776677',
  'codex-logistics-crud-1779154256342@igisam.com',
  'System Admin',
  '기획추진센터',
  array[]::text[],
  '{"read":true,"create":true,"update":true,"delete":true}'::jsonb,
  '{"read":true,"create":true,"update":true,"delete":true}'::jsonb,
  true
)
on conflict (user_id) do update
set
  logistics_role = excluded.logistics_role,
  organization = excluded.organization,
  managed_asset_permissions = excluded.managed_asset_permissions,
  other_asset_permissions = excluded.other_asset_permissions,
  can_ingest_weekly = excluded.can_ingest_weekly,
  updated_at = now();

select
  u.email,
  u.email_confirmed_at,
  p.logistics_role,
  p.organization
from auth.users u
left join public.ll_user_permissions p on p.user_id = u.id
where u.id = 'd4bdb487-99a4-43b8-a7db-169080776677';
