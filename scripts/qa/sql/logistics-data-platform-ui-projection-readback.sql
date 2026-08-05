select jsonb_build_object(
  'assets', (select count(*) from logistics_core.assets where deleted_at is null),
  'funds', (select count(*) from logistics_core.funds where deleted_at is null),
  'investments', (select count(*) from logistics_core.fund_beneficiary_tranches where deleted_at is null and source_is_active),
  'active_loans', (select count(*) from public.ll_fund_capital_tranches where tranche_type = 'loan' and is_active and deleted_at is null),
  'tenants', (select count(*) from logistics_core.tenants where deleted_at is null),
  'human_tenant_names', (
    select count(*)
    from logistics_core.tenants
    where deleted_at is null
      and nullif(btrim(legal_name_ko), '') is not null
      and legal_name_ko <> tenant_key
  ),
  'internal_tenant_names', (
    select count(*)
    from logistics_core.tenants
    where deleted_at is null and legal_name_ko = tenant_key
  ),
  'active_internal_tenant_names', (
    select count(*)
    from logistics_core.tenants
    where deleted_at is null and status = 'active' and legal_name_ko = tenant_key
  ),
  'leases', (select count(*) from logistics_core.lease_contracts where deleted_at is null),
  'spaces', (select count(*) from logistics_core.spaces where deleted_at is null),
  'ordered_spaces', (select count(*) from logistics_core.spaces where deleted_at is null and display_order is not null),
  'rent_terms', (select count(*) from logistics_core.rent_terms where deleted_at is null),
  'finance_entries', (select count(*) from logistics_core.monthly_ledger_entries where deleted_at is null),
  'maturities', jsonb_build_object(
    'lease', (select count(*) from logistics_core.maturities where deleted_at is null and status = 'active' and maturity_type = 'lease'),
    'fund', (select count(*) from logistics_core.maturities where deleted_at is null and status = 'active' and maturity_type = 'fund'),
    'loan', (select count(*) from logistics_core.maturities where deleted_at is null and status = 'active' and maturity_type = 'loan')
  ),
  'rpc', jsonb_build_object(
    'home_wrapper', to_regprocedure('logistics_core.home_read_entry(uuid,text,jsonb,jsonb)') is not null,
    'rent_roll_wrapper', to_regprocedure('logistics_core.rent_roll_read_entry(uuid,text,jsonb,jsonb)') is not null,
    'rent_roll_save_wrapper', to_regprocedure('logistics_core.rent_roll_batch_save_entry(uuid,text,jsonb,jsonb)') is not null,
    'rent_roll_write_granted', has_function_privilege('authenticated', 'logistics_api.rent_roll_batch_save(uuid,text,jsonb,jsonb)', 'EXECUTE'),
    'finance_write_granted', has_function_privilege('authenticated', 'logistics_api.finance_batch_save(uuid,text,jsonb,jsonb)', 'EXECUTE'),
    'core_direct_read_denied', not has_function_privilege('authenticated', 'logistics_core.rent_roll_read_entry(uuid,text,jsonb,jsonb)', 'EXECUTE'),
    'core_direct_write_denied', not has_function_privilege('authenticated', 'logistics_core.rent_roll_batch_save_entry(uuid,text,jsonb,jsonb)', 'EXECUTE')
  )
) as ui_projection_readback;
