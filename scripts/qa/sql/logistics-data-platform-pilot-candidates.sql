select
  permission.user_id,
  permission.logistics_role,
  permission.organization,
  coalesce((permission.feature_permissions->>'permission_admin')::boolean, false) as permission_admin,
  permission.managed_asset_codes @> array['*']::text[] as all_assets,
  permission.managed_asset_permissions,
  permission.other_asset_permissions
from public.ll_user_permissions permission
join auth.users actor on actor.id = permission.user_id
where permission.account_status = 'active'
  and coalesce((permission.managed_asset_permissions->>'read')::boolean, false)
  and coalesce((permission.managed_asset_permissions->>'create')::boolean, false)
  and coalesce((permission.managed_asset_permissions->>'update')::boolean, false)
  and coalesce((permission.managed_asset_permissions->>'delete')::boolean, false)
order by permission.user_id;
