select jsonb_build_object(
  'schemas', jsonb_build_object(
    'logistics_core', to_regnamespace('logistics_core') is not null,
    'logistics_api', to_regnamespace('logistics_api') is not null,
    'authenticator_config', (
      select setting
      from (
        select unnest(coalesce(rolconfig, array[]::text[])) as setting
        from pg_roles
        where rolname = 'authenticator'
      ) role_setting
      where setting like 'pgrst.db_schemas=%'
      limit 1
    )
  ),
  'legacy_counts', jsonb_build_object(
    'assets', (select count(*) from public.ll_assets),
    'funds', (select count(*) from public.ll_funds),
    'loans', (select count(*) from public.ll_fund_capital_tranches where tranche_type = 'loan'),
    'tenants', (select count(*) from public.ll_tenants),
    'leases', (select count(*) from public.ll_leases),
    'lease_spaces', (select count(*) from public.ll_lease_spaces),
    'rent_history_total', (select count(*) from public.ll_rent_history),
    'rent_history_actionable', (
      select count(*)
      from public.ll_rent_history source
      join logistics_core.contract_spaces allocation
        on allocation.contract_space_key = 'contract_space_' || (to_jsonb(source)->>'lease_space_id')
    ),
    'rent_history_quarantined', (
      select count(*)
      from public.ll_rent_history source
      left join logistics_core.contract_spaces allocation
        on allocation.contract_space_key = 'contract_space_' || (to_jsonb(source)->>'lease_space_id')
      where allocation.id is null
    ),
    'lease_attributes', (select count(*) from public.ll_lease_attributes)
  ),
  'core_counts', jsonb_build_object(
    'assets', (select count(*) from logistics_core.assets where deleted_at is null),
    'funds', (select count(*) from logistics_core.funds where deleted_at is null),
    'loans', (select count(*) from logistics_core.loans where deleted_at is null),
    'tenants', (select count(*) from logistics_core.tenants where deleted_at is null),
    'leases', (select count(*) from logistics_core.lease_contracts where deleted_at is null),
    'lease_spaces', (select count(*) from logistics_core.contract_spaces where deleted_at is null),
    'rent_history_actionable', (select count(*) from logistics_core.rent_terms where deleted_at is null),
    'post_cutover_rent_change_audit', (select count(*) from logistics_core.rent_term_history),
    'lease_attributes', (select count(*) from logistics_core.lease_attributes where deleted_at is null),
    'active_finance_rows', (select count(*) from logistics_core.monthly_ledger_entries where deleted_at is null)
  ),
  'migration', (
    select jsonb_build_object(
      'status', status,
      'critical_exception_count', critical_exception_count,
      'source_hash', source_hash,
      'target_hash', target_hash,
      'open_warning_exception_count', (
        select count(*)
        from logistics_core.migration_exceptions exception
        where exception.run_id = migration_runs.run_id
          and exception.severity = 'warning'
          and exception.resolution_status = 'open'
      )
    )
    from logistics_core.migration_runs
    order by created_at desc
    limit 1
  ),
  'pilot', jsonb_build_object(
    'active_count', (select count(*) from logistics_core.platform_pilot_users where is_active = true),
    'active_user_ids', (
      select coalesce(jsonb_agg(user_id order by user_id), '[]'::jsonb)
      from logistics_core.platform_pilot_users
      where is_active = true
    )
  ),
  'write_state', jsonb_build_object(
    'feature_enabled', (
      select v2_write_enabled
      from logistics_core.platform_feature_flags
      where flag_key = 'data_platform_v2'
    ),
    'route_counts', (
      select coalesce(jsonb_object_agg(writer_mode, route_count), '{}'::jsonb)
      from (
        select writer_mode, count(*) as route_count
        from logistics_core.asset_writer_routes
        group by writer_mode
      ) route_summary
    ),
    'rent_roll_mutation_granted', has_function_privilege(
      'authenticated',
      'logistics_api.rent_roll_batch_save(uuid,text,jsonb,jsonb)',
      'EXECUTE'
    ),
    'finance_mutation_granted', has_function_privilege(
      'authenticated',
      'logistics_api.finance_batch_save(uuid,text,jsonb,jsonb)',
      'EXECUTE'
    )
  )
) as shadow_readback;
