select jsonb_build_object(
  'counts', jsonb_build_object(
    'assets', (select count(*) from public.ll_assets),
    'funds', (select count(*) from public.ll_funds),
    'loans', (select count(*) from public.ll_fund_capital_tranches where tranche_type = 'loan'),
    'tenants', (select count(*) from public.ll_tenants),
    'leases', (select count(*) from public.ll_leases),
    'lease_spaces', (select count(*) from public.ll_lease_spaces),
    'rent_history', (select count(*) from public.ll_rent_history),
    'lease_attributes', (select count(*) from public.ll_lease_attributes)
  ),
  'loan_quality', (
    select jsonb_build_object(
      'blank_row_keys', count(*) filter (where nullif(btrim(row_key), '') is null),
      'duplicate_natural_keys', count(*) - count(distinct (fund_id, row_key)),
      'missing_commitment', count(*) filter (where committed_amount_krw is null),
      'missing_drawdown', count(*) filter (where drawdown_date is null),
      'missing_maturity', count(*) filter (where maturity_date is null)
    )
    from public.ll_fund_capital_tranches
    where tranche_type = 'loan'
  ),
  'lease_quality', (
    select jsonb_build_object(
      'missing_lease_id', count(*) filter (where nullif(lease_id, '') is null),
      'missing_asset_id', count(*) filter (where nullif(asset_id, '') is null),
      'missing_tenant_id', count(*) filter (where nullif(tenant_id, '') is null),
      'missing_start', count(*) filter (where coalesce(current_start_date, first_start_date) is null),
      'missing_end', count(*) filter (where coalesce(current_end_date, first_end_date) is null)
    )
    from public.ll_leases
  ),
  'lease_attribute_keys', (
    select coalesce(jsonb_agg(to_jsonb(attribute_summary) order by attribute_type, attribute_key), '[]'::jsonb)
    from (
      select
        attribute_type,
        attribute_key,
        count(*) as row_count,
        count(*) filter (where review_status is distinct from 'ok') as not_reviewed_count
      from public.ll_lease_attributes
      group by attribute_type, attribute_key
    ) attribute_summary
  ),
  'full_permission_users', (
    select coalesce(jsonb_agg(to_jsonb(permission_summary) order by user_id), '[]'::jsonb)
    from (
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
    ) permission_summary
  )
) as readiness;
