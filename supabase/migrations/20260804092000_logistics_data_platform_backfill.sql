begin;

set local lock_timeout = '5s';
set local statement_timeout = '120s';

-- Production-shadow projection only. public.ll_* remains the canonical source and
-- this migration never creates finance rows or a synthetic loan repayment schedule.
do $backfill$
declare
  v_run_id uuid := gen_random_uuid();
  v_mapping_version constant text := 'gate6-data-platform-1';
  v_critical_exception_count bigint := 0;
  v_source_row_count bigint := 0;
  v_target_row_count bigint := 0;
  v_pilot_candidate_count bigint := 0;
  v_source_hash text;
  v_target_hash text;
begin
  if to_regclass('public.ll_assets') is null
     or to_regclass('public.ll_funds') is null
     or to_regclass('public.ll_fund_asset_links') is null
     or to_regclass('public.ll_fund_capital_tranches') is null
     or to_regclass('public.ll_tenants') is null
     or to_regclass('public.ll_leases') is null
     or to_regclass('public.ll_lease_spaces') is null
     or to_regclass('public.ll_lease_attributes') is null
     or to_regclass('public.ll_rent_history') is null
     or to_regclass('public.ll_notifications') is null
     or to_regclass('public.ll_user_permissions') is null then
    raise exception 'Required public.ll_* canonical source is missing';
  end if;

  insert into logistics_core.migration_runs (
    run_id, snapshot_id, source_version, target_version, mapping_version,
    status, started_at
  ) values (
    v_run_id, 'r0-restored-27-tables-27512-rows', 'public.ll_*',
    'logistics_core-shadow-1', v_mapping_version, 'running', now()
  );

  insert into logistics_core.assets (
    public_key, asset_key, asset_code, name_ko, address_ko,
    gross_area_sqm, leasable_area_sqm, acquisition_cost, current_valuation
  )
  select
    source_row->>'asset_id',
    source_row->>'asset_id',
    coalesce(nullif(source_row->>'asset_code', ''), source_row->>'asset_id'),
    coalesce(nullif(source_row->>'asset_name', ''), nullif(source_row->>'name', ''), source_row->>'asset_id'),
    coalesce(source_row->>'road_address', source_row->>'address'),
    nullif(coalesce(source_row->>'gross_area_sqm', source_row->>'gross_floor_area_sqm'), '')::numeric,
    nullif(coalesce(source_row->>'leasable_area_sqm', source_row->>'lease_area_sqm'), '')::numeric,
    nullif(coalesce(source_row->>'acquisition_cost', source_row->>'acquisition_price_krw'), '')::numeric,
    nullif(coalesce(source_row->>'current_valuation', source_row->>'valuation_krw'), '')::numeric
  from (select to_jsonb(source) source_row from public.ll_assets source) source_rows
  where nullif(source_row->>'asset_id', '') is not null
  on conflict (asset_key) do update set
    public_key = excluded.public_key,
    asset_code = excluded.asset_code,
    name_ko = excluded.name_ko,
    address_ko = excluded.address_ko,
    gross_area_sqm = excluded.gross_area_sqm,
    leasable_area_sqm = excluded.leasable_area_sqm,
    acquisition_cost = excluded.acquisition_cost,
    current_valuation = excluded.current_valuation,
    deleted_at = null,
    deleted_by = null;

  insert into logistics_core.funds (
    fund_key, fund_code, name_ko, inception_date, maturity_date, status
  )
  select
    source_row->>'fund_id',
    coalesce(nullif(source_row->>'fund_code', ''), source_row->>'fund_id'),
    coalesce(nullif(source_row->>'fund_name', ''), nullif(source_row->>'name', ''), source_row->>'fund_id'),
    nullif(coalesce(source_row->>'inception_date', source_row->>'establishment_date'), '')::date,
    nullif(coalesce(source_row->>'maturity_date', source_row->>'fund_maturity_date'), '')::date,
    case when lower(coalesce(source_row->>'status', 'active')) in ('closed', 'planned')
      then lower(source_row->>'status') else 'active' end
  from (select to_jsonb(source) source_row from public.ll_funds source) source_rows
  where nullif(source_row->>'fund_id', '') is not null
  on conflict (fund_key) do update set
    fund_code = excluded.fund_code,
    name_ko = excluded.name_ko,
    inception_date = excluded.inception_date,
    maturity_date = excluded.maturity_date,
    status = excluded.status,
    deleted_at = null,
    deleted_by = null;

  insert into logistics_core.fund_asset_links (
    link_key, fund_id, asset_id, effective_from, effective_to, ownership_ratio
  )
  select
    coalesce(nullif(source_row->>'link_id', ''),
      'fund_asset_' || substr(md5((source_row->>'fund_id') || ':' || (source_row->>'asset_id')), 1, 24)),
    fund.id,
    asset.id,
    nullif(source_row->>'effective_from', '')::date,
    nullif(source_row->>'effective_to', '')::date,
    nullif(coalesce(source_row->>'ownership_ratio', source_row->>'ownership_rate'), '')::numeric
  from (select to_jsonb(source) source_row from public.ll_fund_asset_links source) source_rows
  join logistics_core.funds fund on fund.fund_key = source_row->>'fund_id'
  join logistics_core.assets asset on asset.asset_key = source_row->>'asset_id'
  on conflict (link_key) do update set
    fund_id = excluded.fund_id,
    asset_id = excluded.asset_id,
    effective_from = excluded.effective_from,
    effective_to = excluded.effective_to,
    ownership_ratio = excluded.ownership_ratio,
    deleted_at = null,
    deleted_by = null;

  insert into logistics_core.fund_beneficiary_tranches (
    beneficiary_key, fund_id, source_tranche_id, source_is_active, tranche_code,
    beneficiary_name, committed_amount_krw, source_payload
  )
  select
    'beneficiary_' || (source_row->>'id'),
    fund.id,
    (source_row->>'id')::uuid,
    coalesce(nullif(source_row->>'is_active', '')::boolean, true),
    source_row->>'tranche',
    source_row->>'party_name',
    nullif(source_row->>'committed_amount_krw', '')::numeric,
    source_row
  from (select to_jsonb(source) source_row from public.ll_fund_capital_tranches source) source_rows
  join logistics_core.funds fund on fund.fund_key = source_row->>'fund_id'
  where source_row->>'tranche_type' = 'beneficiary'
  on conflict (source_tranche_id) do update set
    fund_id = excluded.fund_id,
    source_is_active = excluded.source_is_active,
    tranche_code = excluded.tranche_code,
    beneficiary_name = excluded.beneficiary_name,
    committed_amount_krw = excluded.committed_amount_krw,
    source_payload = excluded.source_payload,
    deleted_at = null,
    deleted_by = null;

  insert into logistics_core.lenders (
    lender_key, lender_code, name_ko
  )
  select distinct on (lower(btrim(source_row->>'party_name')))
    'lender_' || substr(md5(lower(btrim(source_row->>'party_name'))), 1, 24),
    'L-' || substr(md5(lower(btrim(source_row->>'party_name'))), 1, 12),
    btrim(source_row->>'party_name')
  from (select to_jsonb(source) source_row from public.ll_fund_capital_tranches source) source_rows
  where source_row->>'tranche_type' = 'loan'
    and nullif(btrim(source_row->>'party_name'), '') is not null
  order by lower(btrim(source_row->>'party_name'))
  on conflict (lender_key) do update set
    lender_code = excluded.lender_code,
    name_ko = excluded.name_ko,
    deleted_at = null,
    deleted_by = null;

  insert into logistics_core.loans (
    loan_key, loan_code, asset_id, fund_id, source_tranche_id, source_is_active, name_ko,
    commitment_amount, outstanding_amount, drawdown_date, interest_terms, repayment_terms,
    repayment_schedule_status
  )
  select
    'loan_' || (source_row->>'id'),
    (source_row->>'fund_id') || ':' || coalesce(nullif(source_row->>'row_key', ''), 'loan_' || (source_row->>'id')),
    null,
    fund.id,
    (source_row->>'id')::uuid,
    coalesce(nullif(source_row->>'is_active', '')::boolean, true),
    concat_ws(' ', nullif(source_row->>'loan_type', ''), nullif(source_row->>'tranche', ''), nullif(source_row->>'party_name', '')),
    nullif(source_row->>'committed_amount_krw', '')::numeric,
    null,
    nullif(source_row->>'drawdown_date', '')::date,
    jsonb_build_object(
      'loan_period', source_row->>'loan_period',
      'loan_type', source_row->>'loan_type',
      'interest_type', source_row->>'interest_type',
      'base_rate', source_row->>'base_rate',
      'spread_rate', source_row->>'spread_rate',
      'loan_rate', source_row->>'loan_rate',
      'interest_rate', source_row->>'interest_rate',
      'fee', source_row->>'fee',
      'fee_rate', source_row->>'fee_rate',
      'all_in', source_row->>'all_in',
      'all_in_rate', source_row->>'all_in_rate',
      'source_payload_values', source_row#>'{source_payload,values}'
    ),
    '{"repayment_schedule_status":"not_provided","rows":[],"reason":"SOURCE_HAS_NO_MONTHLY_REPAYMENT_SCHEDULE"}'::jsonb,
    'not_provided'
  from (select to_jsonb(source) source_row from public.ll_fund_capital_tranches source) source_rows
  join logistics_core.funds fund on fund.fund_key = source_row->>'fund_id'
  where source_row->>'tranche_type' = 'loan'
  on conflict (source_tranche_id) do update set
    loan_key = excluded.loan_key,
    loan_code = excluded.loan_code,
    asset_id = excluded.asset_id,
    fund_id = excluded.fund_id,
    source_is_active = excluded.source_is_active,
    name_ko = excluded.name_ko,
    commitment_amount = excluded.commitment_amount,
    outstanding_amount = excluded.outstanding_amount,
    drawdown_date = excluded.drawdown_date,
    interest_terms = excluded.interest_terms,
    repayment_terms = excluded.repayment_terms,
    repayment_schedule_status = excluded.repayment_schedule_status,
    deleted_at = null,
    deleted_by = null;

  insert into logistics_core.loan_lenders (
    loan_lender_key, loan_id, lender_id, commitment_amount
  )
  select
    'loan_lender_' || (source_row->>'id'),
    loan.id,
    lender.id,
    nullif(source_row->>'committed_amount_krw', '')::numeric
  from (select to_jsonb(source) source_row from public.ll_fund_capital_tranches source) source_rows
  join logistics_core.loans loan on loan.source_tranche_id = (source_row->>'id')::uuid
  join logistics_core.lenders lender
    on lender.lender_key = 'lender_' || substr(md5(lower(btrim(source_row->>'party_name'))), 1, 24)
  where source_row->>'tranche_type' = 'loan'
    and nullif(btrim(source_row->>'party_name'), '') is not null
  on conflict (loan_lender_key) do update set
    loan_id = excluded.loan_id,
    lender_id = excluded.lender_id,
    commitment_amount = excluded.commitment_amount,
    deleted_at = null,
    deleted_by = null;

  insert into logistics_core.tenants (
    tenant_key, tenant_code, legal_name_ko, business_registration_number, status
  )
  select
    source_row->>'tenant_id',
    coalesce(nullif(source_row->>'tenant_code', ''), source_row->>'tenant_id'),
    coalesce(nullif(source_row->>'tenant_name', ''), nullif(source_row->>'legal_name', ''), source_row->>'tenant_id'),
    coalesce(source_row->>'business_registration_number', source_row->>'business_number'),
    case when coalesce(source_row->>'is_active', 'true')::boolean then 'active' else 'inactive' end
  from (select to_jsonb(source) source_row from public.ll_tenants source) source_rows
  where nullif(source_row->>'tenant_id', '') is not null
  on conflict (tenant_key) do update set
    tenant_code = excluded.tenant_code,
    legal_name_ko = excluded.legal_name_ko,
    business_registration_number = excluded.business_registration_number,
    status = excluded.status,
    deleted_at = null,
    deleted_by = null;

  insert into logistics_core.lease_contracts (
    contract_key, contract_code, asset_id, tenant_id, signed_date, commencement_date,
    expiry_date, status, deposit_amount, renewal_terms, termination_terms, special_terms
  )
  select
    source_row->>'lease_id',
    coalesce(nullif(source_row->>'contract_code', ''), source_row->>'lease_id'),
    asset.id,
    tenant.id,
    nullif(coalesce(source_row->>'signed_date', source_row->>'contract_date'), '')::date,
    nullif(coalesce(source_row->>'commencement_date', source_row->>'current_start_date', source_row->>'start_date'), '')::date,
    nullif(coalesce(source_row->>'expiry_date', source_row->>'current_end_date', source_row->>'end_date'), '')::date,
    case when lower(coalesce(source_row->>'status', source_row->>'contract_status', 'active')) in ('planned', 'ended', 'terminated')
      then lower(coalesce(source_row->>'status', source_row->>'contract_status')) else 'active' end,
    nullif(coalesce(source_row->>'deposit_amount', source_row->>'deposit_total_krw'), '')::numeric,
    source_row->>'renewal_terms', source_row->>'termination_terms', source_row->>'special_terms'
  from (select to_jsonb(source) source_row from public.ll_leases source) source_rows
  join logistics_core.assets asset on asset.asset_key = source_row->>'asset_id'
  join logistics_core.tenants tenant on tenant.tenant_key = source_row->>'tenant_id'
  where nullif(source_row->>'lease_id', '') is not null
  on conflict (contract_key) do update set
    contract_code = excluded.contract_code,
    asset_id = excluded.asset_id,
    tenant_id = excluded.tenant_id,
    signed_date = excluded.signed_date,
    commencement_date = excluded.commencement_date,
    expiry_date = excluded.expiry_date,
    status = excluded.status,
    deposit_amount = excluded.deposit_amount,
    renewal_terms = excluded.renewal_terms,
    termination_terms = excluded.termination_terms,
    special_terms = excluded.special_terms,
    deleted_at = null,
    deleted_by = null;

  insert into logistics_core.spaces (
    space_key, asset_id, floor_label, zone_label, use_type, occupancy_status,
    use_category, leasable_area_sqm, exclusive_area_sqm, common_area_sqm,
    leased_area_sqm, efficiency_ratio
  )
  select
    source_row->>'lease_space_id',
    asset.id,
    coalesce(source_row->>'floor_label', source_row->>'floor'),
    coalesce(source_row->>'zone_label', source_row->>'zone'),
    coalesce(source_row->>'use_type', source_row->>'use_category'),
    case when nullif(source_row->>'lease_id', '') is null then 'vacant' else 'occupied' end,
    coalesce(source_row->>'use_category', source_row->>'use_type'),
    nullif(coalesce(source_row->>'leasable_area_sqm', source_row->>'leased_area_sqm'), '')::numeric,
    nullif(source_row->>'exclusive_area_sqm', '')::numeric,
    nullif(source_row->>'common_area_sqm', '')::numeric,
    nullif(coalesce(source_row->>'leased_area_sqm', source_row->>'leasable_area_sqm'), '')::numeric,
    nullif(source_row->>'efficiency_ratio', '')::numeric
  from (select to_jsonb(source) source_row from public.ll_lease_spaces source) source_rows
  join logistics_core.assets asset on asset.asset_key = source_row->>'asset_id'
  where nullif(source_row->>'lease_space_id', '') is not null
  on conflict (space_key) do update set
    asset_id = excluded.asset_id,
    floor_label = excluded.floor_label,
    zone_label = excluded.zone_label,
    use_type = excluded.use_type,
    occupancy_status = excluded.occupancy_status,
    use_category = excluded.use_category,
    leasable_area_sqm = excluded.leasable_area_sqm,
    exclusive_area_sqm = excluded.exclusive_area_sqm,
    common_area_sqm = excluded.common_area_sqm,
    leased_area_sqm = excluded.leased_area_sqm,
    efficiency_ratio = excluded.efficiency_ratio,
    deleted_at = null,
    deleted_by = null;

  insert into logistics_core.contract_spaces (
    contract_space_key, contract_id, space_id, allocated_leasable_area_sqm,
    allocated_exclusive_area_sqm, effective_from, effective_to
  )
  select
    'contract_space_' || (source_row->>'lease_space_id'),
    contract.id,
    space.id,
    nullif(coalesce(source_row->>'leased_area_sqm', source_row->>'leasable_area_sqm'), '')::numeric,
    nullif(source_row->>'exclusive_area_sqm', '')::numeric,
    contract.commencement_date,
    contract.expiry_date
  from (select to_jsonb(source) source_row from public.ll_lease_spaces source) source_rows
  join logistics_core.lease_contracts contract on contract.contract_key = source_row->>'lease_id'
  join logistics_core.spaces space on space.space_key = source_row->>'lease_space_id'
  on conflict (contract_space_key) do update set
    contract_id = excluded.contract_id,
    space_id = excluded.space_id,
    allocated_leasable_area_sqm = excluded.allocated_leasable_area_sqm,
    allocated_exclusive_area_sqm = excluded.allocated_exclusive_area_sqm,
    effective_from = excluded.effective_from,
    effective_to = excluded.effective_to,
    deleted_at = null,
    deleted_by = null;

  insert into logistics_core.rent_terms (
    rent_term_key, contract_space_id, effective_from_month, effective_to_month,
    base_monthly_rent, base_monthly_management_fee, rent_per_pyeong,
    management_fee_per_pyeong, rent_free_months, calculation_method
  )
  select
    coalesce(nullif(source_row->>'rent_history_id', ''), 'rent_' || substr(md5(source_row::text), 1, 24)),
    allocation.id,
    date_trunc('month', nullif(coalesce(source_row->>'effective_date', source_row->>'period_start'), '')::date)::date,
    case when nullif(coalesce(source_row->>'effective_end_date', source_row->>'period_end'), '') is null then null
      else date_trunc('month', nullif(coalesce(source_row->>'effective_end_date', source_row->>'period_end'), '')::date)::date end,
    nullif(coalesce(source_row->>'monthly_rent_total', source_row->>'monthly_rent_total_krw'), '')::numeric,
    nullif(coalesce(source_row->>'monthly_mf_total', source_row->>'monthly_cam_total_krw'), '')::numeric,
    nullif(coalesce(source_row->>'rent_per_py', source_row->>'rent_per_py_krw'), '')::numeric,
    nullif(coalesce(source_row->>'mf_per_py', source_row->>'cam_per_py_krw'), '')::numeric,
    coalesce(nullif(source_row->>'rent_free_months', '')::numeric, 0),
    'fixed_monthly'
  from (select to_jsonb(source) source_row from public.ll_rent_history source) source_rows
  join logistics_core.contract_spaces allocation
    on allocation.contract_space_key = 'contract_space_' || (source_row->>'lease_space_id')
  on conflict (rent_term_key) do update set
    contract_space_id = excluded.contract_space_id,
    effective_from_month = excluded.effective_from_month,
    effective_to_month = excluded.effective_to_month,
    base_monthly_rent = excluded.base_monthly_rent,
    base_monthly_management_fee = excluded.base_monthly_management_fee,
    rent_per_pyeong = excluded.rent_per_pyeong,
    management_fee_per_pyeong = excluded.management_fee_per_pyeong,
    rent_free_months = excluded.rent_free_months,
    calculation_method = excluded.calculation_method,
    deleted_at = null,
    deleted_by = null;

  insert into logistics_core.lease_attributes (
    source_attribute_id, attribute_type, asset_id, tenant_id, contract_id, space_id,
    attribute_key, attribute_label, value_text, value_numeric, value_sqm, value_py,
    unit_label, basis, provenance, source_payload, source_row_hash,
    review_status, review_note
  )
  select
    (source_row->>'id')::uuid,
    source_row->>'attribute_type',
    asset.id,
    tenant.id,
    contract.id,
    space.id,
    coalesce(nullif(source_row->>'attribute_key', ''), 'attribute:' || (source_row->>'id')),
    source_row->>'attribute_label',
    source_row->>'value_text',
    nullif(source_row->>'value_numeric', '')::numeric,
    nullif(source_row->>'value_sqm', '')::numeric,
    nullif(source_row->>'value_py', '')::numeric,
    source_row->>'unit_label',
    source_row->>'basis',
    jsonb_strip_nulls(jsonb_build_object(
      'source_table', source_row->>'source_table',
      'source_legacy_id', source_row->>'source_legacy_id',
      'source_sheet_row_id', source_row->>'source_sheet_row_id',
      'source_cell_id', source_row->>'source_cell_id',
      'legacy_asset_id', source_row->>'asset_id',
      'legacy_tenant_id', source_row->>'tenant_id',
      'legacy_lease_id', source_row->>'lease_id',
      'legacy_lease_space_id', source_row->>'lease_space_id'
    )),
    source_row,
    encode(extensions.digest(convert_to(source_row::text, 'UTF8'), 'sha256'), 'hex'),
    source_row->>'review_status',
    source_row->>'review_note'
  from (select to_jsonb(source) source_row from public.ll_lease_attributes source) source_rows
  left join logistics_core.assets asset on asset.asset_key = source_row->>'asset_id'
  left join logistics_core.tenants tenant on tenant.tenant_key = source_row->>'tenant_id'
  left join logistics_core.lease_contracts contract on contract.contract_key = source_row->>'lease_id'
  left join logistics_core.spaces space on space.space_key = source_row->>'lease_space_id'
  where source_row->>'attribute_type' in ('area_breakdown', 'space_spec', 'special_term')
  on conflict (source_attribute_id) do update set
    attribute_type = excluded.attribute_type,
    asset_id = excluded.asset_id,
    tenant_id = excluded.tenant_id,
    contract_id = excluded.contract_id,
    space_id = excluded.space_id,
    attribute_key = excluded.attribute_key,
    attribute_label = excluded.attribute_label,
    value_text = excluded.value_text,
    value_numeric = excluded.value_numeric,
    value_sqm = excluded.value_sqm,
    value_py = excluded.value_py,
    unit_label = excluded.unit_label,
    basis = excluded.basis,
    provenance = excluded.provenance,
    source_payload = excluded.source_payload,
    source_row_hash = excluded.source_row_hash,
    review_status = excluded.review_status,
    review_note = excluded.review_note,
    deleted_at = null,
    deleted_by = null;

  insert into logistics_core.migration_exceptions (
    run_id, severity, source_table, source_pk, target_entity, reason
  )
  select
    v_run_id,
    'critical',
    'public.ll_lease_attributes',
    jsonb_build_object('id', source.id),
    'lease_attributes',
    'UNSUPPORTED_LEASE_ATTRIBUTE_TYPE:' || coalesce(source.attribute_type, '<null>')
  from public.ll_lease_attributes source
  where source.attribute_type is null
     or source.attribute_type not in ('area_breakdown', 'space_spec', 'special_term');

  insert into logistics_core.maturities (
    maturity_key, maturity_type, asset_id, lease_contract_id, target_name_ko, official_date
  )
  select
    'lease_maturity_' || contract.contract_key,
    'lease', contract.asset_id, contract.id, contract.contract_code, contract.expiry_date
  from logistics_core.lease_contracts contract
  where contract.expiry_date is not null
  on conflict (maturity_key) do update set
    maturity_type = excluded.maturity_type,
    asset_id = excluded.asset_id,
    lease_contract_id = excluded.lease_contract_id,
    fund_id = null,
    loan_id = null,
    target_name_ko = excluded.target_name_ko,
    official_date = excluded.official_date,
    status = 'active',
    deleted_at = null,
    deleted_by = null;

  insert into logistics_core.maturities (
    maturity_key, maturity_type, asset_id, fund_id, target_name_ko, official_date
  )
  select
    'fund_maturity_' || fund.fund_key,
    'fund', null, fund.id, fund.name_ko, fund.maturity_date
  from logistics_core.funds fund
  where fund.maturity_date is not null and fund.deleted_at is null
  on conflict (maturity_key) do update set
    maturity_type = excluded.maturity_type,
    asset_id = null,
    lease_contract_id = null,
    fund_id = excluded.fund_id,
    loan_id = null,
    target_name_ko = excluded.target_name_ko,
    official_date = excluded.official_date,
    status = 'active',
    deleted_at = null,
    deleted_by = null;

  insert into logistics_core.maturities (
    maturity_key, maturity_type, asset_id, fund_id, loan_id,
    target_name_ko, official_date
  )
  select
    'loan_maturity_' || loan.source_tranche_id::text,
    'loan', null, null, loan.id, loan.name_ko,
    nullif(source_row->>'maturity_date', '')::date
  from (select to_jsonb(source) source_row from public.ll_fund_capital_tranches source) source_rows
  join logistics_core.loans loan on loan.source_tranche_id = (source_row->>'id')::uuid
  where source_row->>'tranche_type' = 'loan'
    and coalesce(nullif(source_row->>'is_active', '')::boolean, true)
    and nullif(source_row->>'maturity_date', '') is not null
  on conflict (maturity_key) do update set
    maturity_type = excluded.maturity_type,
    asset_id = null,
    lease_contract_id = null,
    fund_id = null,
    loan_id = excluded.loan_id,
    target_name_ko = excluded.target_name_ko,
    official_date = excluded.official_date,
    status = 'active',
    deleted_at = null,
    deleted_by = null;

  insert into logistics_core.maturity_asset_scopes (maturity_id, asset_id)
  select distinct maturity.id, link.asset_id
  from logistics_core.maturities maturity
  join logistics_core.loans loan on loan.id = maturity.loan_id
  join logistics_core.fund_asset_links link on link.fund_id = loan.fund_id and link.deleted_at is null
  where maturity.maturity_type = 'loan' and maturity.deleted_at is null
  on conflict do nothing;

  insert into logistics_core.maturity_asset_scopes (maturity_id, asset_id)
  select distinct maturity.id, link.asset_id
  from logistics_core.maturities maturity
  join logistics_core.fund_asset_links link on link.fund_id = maturity.fund_id and link.deleted_at is null
  where maturity.maturity_type = 'fund' and maturity.deleted_at is null
  on conflict do nothing;

  insert into logistics_core.maturity_asset_scopes (maturity_id, asset_id)
  select maturity.id, maturity.asset_id
  from logistics_core.maturities maturity
  where maturity.asset_id is not null and maturity.deleted_at is null
  on conflict do nothing;

  insert into logistics_core.user_permission_profiles (
    user_id, scope_mode,
    managed_read, managed_create, managed_update, managed_delete,
    other_read, other_create, other_update, other_delete
  )
  select
    permission.user_id,
    case when permission.managed_asset_codes @> array['*']::text[] then 'all' else 'listed' end,
    coalesce((permission.managed_asset_permissions->>'read')::boolean, false),
    coalesce((permission.managed_asset_permissions->>'create')::boolean, false),
    coalesce((permission.managed_asset_permissions->>'update')::boolean, false),
    coalesce((permission.managed_asset_permissions->>'delete')::boolean, false),
    coalesce((permission.other_asset_permissions->>'read')::boolean, false),
    coalesce((permission.other_asset_permissions->>'create')::boolean, false),
    coalesce((permission.other_asset_permissions->>'update')::boolean, false),
    coalesce((permission.other_asset_permissions->>'delete')::boolean, false)
  from public.ll_user_permissions permission
  join auth.users actor on actor.id = permission.user_id
  on conflict (user_id) do update set
    scope_mode = excluded.scope_mode,
    managed_read = excluded.managed_read,
    managed_create = excluded.managed_create,
    managed_update = excluded.managed_update,
    managed_delete = excluded.managed_delete,
    other_read = excluded.other_read,
    other_create = excluded.other_create,
    other_update = excluded.other_update,
    other_delete = excluded.other_delete,
    deleted_at = null,
    deleted_by = null;

  select count(distinct permission.user_id)
  into v_pilot_candidate_count
  from public.ll_user_permissions permission
  join auth.users actor on actor.id = permission.user_id
  where permission.account_status = 'active'
    and coalesce((permission.feature_permissions->>'permission_admin')::boolean, false)
    and coalesce((permission.managed_asset_permissions->>'read')::boolean, false)
    and coalesce((permission.managed_asset_permissions->>'create')::boolean, false)
    and coalesce((permission.managed_asset_permissions->>'update')::boolean, false)
    and coalesce((permission.managed_asset_permissions->>'delete')::boolean, false)
    and coalesce((permission.other_asset_permissions->>'read')::boolean, false)
    and coalesce((permission.other_asset_permissions->>'create')::boolean, false)
    and coalesce((permission.other_asset_permissions->>'update')::boolean, false)
    and coalesce((permission.other_asset_permissions->>'delete')::boolean, false);

  if v_pilot_candidate_count <> 3 then
    raise exception 'PILOT_CANDIDATE_COUNT expected=3 actual=%', v_pilot_candidate_count;
  end if;

  insert into logistics_core.platform_pilot_users (
    user_id, is_active, selection_source, selection_reason
  )
  select distinct
    permission.user_id,
    true,
    'public.ll_user_permissions',
    'active permission_admin principal with all eight asset CRUD permissions'
  from public.ll_user_permissions permission
  join auth.users actor on actor.id = permission.user_id
  where permission.account_status = 'active'
    and coalesce((permission.feature_permissions->>'permission_admin')::boolean, false)
    and coalesce((permission.managed_asset_permissions->>'read')::boolean, false)
    and coalesce((permission.managed_asset_permissions->>'create')::boolean, false)
    and coalesce((permission.managed_asset_permissions->>'update')::boolean, false)
    and coalesce((permission.managed_asset_permissions->>'delete')::boolean, false)
    and coalesce((permission.other_asset_permissions->>'read')::boolean, false)
    and coalesce((permission.other_asset_permissions->>'create')::boolean, false)
    and coalesce((permission.other_asset_permissions->>'update')::boolean, false)
    and coalesce((permission.other_asset_permissions->>'delete')::boolean, false)
  on conflict (user_id) do update set
    is_active = excluded.is_active,
    selection_source = excluded.selection_source,
    selection_reason = excluded.selection_reason;

  update logistics_core.platform_pilot_users pilot
  set is_active = false,
      selection_reason = 'No longer satisfies the dynamic pilot permission predicate'
  where pilot.is_active
    and not exists (
      select 1
      from public.ll_user_permissions permission
      join auth.users actor on actor.id = permission.user_id
      where permission.user_id = pilot.user_id
        and permission.account_status = 'active'
        and coalesce((permission.feature_permissions->>'permission_admin')::boolean, false)
        and coalesce((permission.managed_asset_permissions->>'read')::boolean, false)
        and coalesce((permission.managed_asset_permissions->>'create')::boolean, false)
        and coalesce((permission.managed_asset_permissions->>'update')::boolean, false)
        and coalesce((permission.managed_asset_permissions->>'delete')::boolean, false)
        and coalesce((permission.other_asset_permissions->>'read')::boolean, false)
        and coalesce((permission.other_asset_permissions->>'create')::boolean, false)
        and coalesce((permission.other_asset_permissions->>'update')::boolean, false)
        and coalesce((permission.other_asset_permissions->>'delete')::boolean, false)
    );

  insert into logistics_core.user_asset_assignments(user_id, asset_id)
  select distinct permission.user_id, asset.id
  from public.ll_user_permissions permission
  join auth.users actor on actor.id = permission.user_id
  cross join lateral unnest(permission.managed_asset_codes) managed_asset_code
  join logistics_core.assets asset
    on asset.asset_code = managed_asset_code or asset.asset_key = managed_asset_code
  where managed_asset_code <> '*'
  on conflict (user_id, asset_id) do update set
    deleted_at = null,
    deleted_by = null;

  insert into logistics_core.migration_exceptions (
    run_id, severity, source_table, source_pk, target_entity, reason
  )
  select
    v_run_id, 'warning', 'public.ll_user_permissions',
    jsonb_build_object('user_id', permission.user_id), 'user_permission_profiles',
    'Legacy principal is not linked to current auth.users and remains legacy-only'
  from public.ll_user_permissions permission
  where not exists (select 1 from auth.users actor where actor.id = permission.user_id);

  insert into logistics_core.asset_writer_routes(asset_id, writer_mode, reason)
  select asset.id, 'locked', 'Production shadow until explicit cutover'
  from logistics_core.assets asset
  on conflict (asset_id) do nothing;

  insert into logistics_core.migration_exceptions (
    run_id, severity, source_table, source_pk, target_entity, reason
  )
  select
    v_run_id, 'critical', 'public.ll_fund_capital_tranches',
    jsonb_build_object('id', source.id), 'loans',
    'Canonical loan tranche did not produce a loan projection'
  from public.ll_fund_capital_tranches source
  where source.tranche_type = 'loan'
    and not exists (
      select 1 from logistics_core.loans target where target.source_tranche_id = source.id
    );

  insert into logistics_core.migration_row_mappings (
    run_id, mapping_version, source_table, source_pk, source_row_hash,
    target_entity, target_id, target_row_hash
  )
  select
    v_run_id, v_mapping_version, 'public.ll_fund_capital_tranches',
    jsonb_build_object('id', source.id),
    encode(extensions.digest(convert_to(to_jsonb(source)::text, 'UTF8'), 'sha256'), 'hex'),
    'loans', target.id,
    encode(extensions.digest(convert_to(to_jsonb(target)::text, 'UTF8'), 'sha256'), 'hex')
  from public.ll_fund_capital_tranches source
  join logistics_core.loans target on target.source_tranche_id = source.id
  where source.tranche_type = 'loan'
  on conflict do nothing;

  insert into logistics_core.migration_row_mappings (
    run_id, mapping_version, source_table, source_pk, source_row_hash,
    target_entity, target_id, target_row_hash
  )
  select
    v_run_id, v_mapping_version, 'public.ll_leases',
    jsonb_build_object('lease_id', source.lease_id),
    encode(extensions.digest(convert_to(to_jsonb(source)::text, 'UTF8'), 'sha256'), 'hex'),
    'lease_contracts', target.id,
    encode(extensions.digest(convert_to(to_jsonb(target)::text, 'UTF8'), 'sha256'), 'hex')
  from public.ll_leases source
  join logistics_core.lease_contracts target on target.contract_key = source.lease_id
  on conflict do nothing;

  insert into logistics_core.migration_row_mappings (
    run_id, mapping_version, source_table, source_pk, source_row_hash,
    target_entity, target_id, target_row_hash
  )
  select
    v_run_id, v_mapping_version, 'public.ll_lease_attributes',
    jsonb_build_object('id', source.id),
    encode(extensions.digest(convert_to(to_jsonb(source)::text, 'UTF8'), 'sha256'), 'hex'),
    'lease_attributes', target.id,
    encode(extensions.digest(convert_to(to_jsonb(target)::text, 'UTF8'), 'sha256'), 'hex')
  from public.ll_lease_attributes source
  join logistics_core.lease_attributes target on target.source_attribute_id = source.id
  on conflict do nothing;

  insert into logistics_core.legacy_projection_state (
    target_entity, target_id, legacy_table, legacy_pk, projection_version,
    last_success_revision, target_hash, legacy_hash, readback_status, verified_at
  )
  select
    mapping.target_entity, mapping.target_id, mapping.source_table, mapping.source_pk,
    mapping.mapping_version, 1, mapping.target_row_hash, mapping.source_row_hash, 'verified', now()
  from logistics_core.migration_row_mappings mapping
  where mapping.run_id = v_run_id
  on conflict (target_entity, target_id, legacy_table, legacy_pk) do update set
    projection_version = excluded.projection_version,
    last_success_revision = excluded.last_success_revision,
    target_hash = excluded.target_hash,
    legacy_hash = excluded.legacy_hash,
    readback_status = excluded.readback_status,
    verified_at = excluded.verified_at;

  select count(*) into v_critical_exception_count
  from logistics_core.migration_exceptions exception
  where exception.run_id = v_run_id
    and exception.severity = 'critical'
    and exception.resolution_status = 'open';

  select count(*) into v_source_row_count
  from logistics_core.migration_row_mappings mapping where mapping.run_id = v_run_id;
  select count(*) into v_target_row_count
  from logistics_core.legacy_projection_state state where state.projection_version = v_mapping_version;

  select encode(extensions.digest(convert_to(coalesce(string_agg(source_row_hash, '' order by source_table, source_pk::text), ''), 'UTF8'), 'sha256'), 'hex')
  into v_source_hash
  from logistics_core.migration_row_mappings mapping where mapping.run_id = v_run_id;
  select encode(extensions.digest(convert_to(coalesce(string_agg(target_row_hash, '' order by target_entity, target_id::text), ''), 'UTF8'), 'sha256'), 'hex')
  into v_target_hash
  from logistics_core.migration_row_mappings mapping where mapping.run_id = v_run_id;

  update logistics_core.migration_runs
  set source_row_count = v_source_row_count,
      target_row_count = v_target_row_count,
      source_hash = v_source_hash,
      target_hash = v_target_hash,
      critical_exception_count = v_critical_exception_count,
      status = case when v_critical_exception_count = 0 then 'validated' else 'failed' end,
      completed_at = now()
  where run_id = v_run_id;

  if v_critical_exception_count <> 0 then
    raise exception 'Backfill blocked: critical_exception_count=%', v_critical_exception_count;
  end if;
end;
$backfill$;

commit;
