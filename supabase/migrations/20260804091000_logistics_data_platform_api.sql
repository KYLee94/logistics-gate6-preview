begin;

set local lock_timeout = '5s';
set local statement_timeout = '120s';

create or replace function logistics_core.json_sha256(p_value jsonb)
returns text
language sql
immutable
security invoker
set search_path = pg_catalog, extensions
as $body$
  select encode(
    extensions.digest(convert_to(coalesce(p_value, 'null'::jsonb)::text, 'UTF8'), 'sha256'),
    'hex'
  );
$body$;

create or replace function logistics_core.expected_revision(
  p_operation jsonb,
  p_expected_revisions jsonb,
  p_entity_key text
)
returns bigint
language plpgsql
immutable
security invoker
set search_path = pg_catalog
as $body$
declare
  raw_revision text;
begin
  raw_revision := coalesce(
    nullif(p_operation->>'expected_revision', ''),
    nullif(coalesce(p_expected_revisions, '{}'::jsonb)->>p_entity_key, '')
  );
  if raw_revision is null or raw_revision !~ '^[1-9][0-9]*$' then
    raise exception using errcode = 'PT409', message = 'REVISION_CONFLICT';
  end if;
  return raw_revision::bigint;
end;
$body$;

create or replace function logistics_core.normalize_month(p_value text)
returns date
language plpgsql
immutable
security invoker
set search_path = pg_catalog
as $body$
begin
  if nullif(btrim(p_value), '') is null then return null; end if;
  if p_value ~ '^[0-9]{4}-(0[1-9]|1[0-2])$' then
    return (p_value || '-01')::date;
  end if;
  if p_value ~ '^[0-9]{4}-(0[1-9]|1[0-2])-01$' then
    return p_value::date;
  end if;
  raise exception using errcode = 'PT422', message = 'MONTH_MUST_BE_YYYY_MM';
end;
$body$;

create or replace function logistics_core.home_read_entry(
  p_request_id uuid,
  p_asset_key text,
  p_payload jsonb,
  p_expected_revisions jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, logistics_core, public
as $body$
declare
  actor_id uuid := logistics_core.request_actor();
  resolved_asset_id uuid;
  asset_row logistics_core.assets%rowtype;
  asset_rows jsonb;
  asset_list_revision bigint;
  fund_rows jsonb;
  loan_rows jsonb;
  maturity_rows jsonb;
  response_data jsonb;
begin
  select
    coalesce(jsonb_agg(jsonb_build_object(
      'asset_key', asset.asset_key,
      'asset_code', asset.asset_code,
      'name', asset.name_ko,
      'address', asset.address_ko,
      'revision', asset.revision
    ) order by asset.name_ko, asset.asset_key), '[]'::jsonb),
    coalesce(max(asset.revision), 0)
  into asset_rows, asset_list_revision
  from logistics_core.assets asset
  join logistics_core.user_permission_profiles permission
    on permission.user_id = actor_id and permission.deleted_at is null
  where asset.deleted_at is null
    and (
      (
        permission.scope_mode = 'all'
        or exists (
          select 1 from logistics_core.user_asset_assignments assignment
          where assignment.user_id = actor_id
            and assignment.asset_id = asset.id
            and assignment.deleted_at is null
        )
      ) and permission.managed_read
      or (
        permission.scope_mode <> 'all'
        and not exists (
          select 1 from logistics_core.user_asset_assignments assignment
          where assignment.user_id = actor_id
            and assignment.asset_id = asset.id
            and assignment.deleted_at is null
        )
        and permission.other_read
      )
    );

  if nullif(btrim(p_asset_key), '') is null then
    return logistics_core.primary_response(
      p_request_id,
      asset_list_revision,
      jsonb_build_object('assets', asset_rows, 'selected_asset', null)
    );
  end if;

  resolved_asset_id := logistics_core.resolve_asset_id(p_asset_key);
  perform logistics_core.assert_asset_permission(actor_id, resolved_asset_id, 'read');

  select asset.* into strict asset_row
  from logistics_core.assets asset
  where asset.id = resolved_asset_id and asset.deleted_at is null;

  select coalesce(jsonb_agg(jsonb_build_object(
    'fund_key', fund.fund_key,
    'fund_code', fund.fund_code,
    'name', fund.name_ko,
    'status', fund.status,
    'effective_from', link.effective_from,
    'effective_to', link.effective_to,
    'ownership_ratio', link.ownership_ratio,
    'revision', greatest(fund.revision, link.revision)
  ) order by fund.name_ko), '[]'::jsonb)
  into fund_rows
  from logistics_core.fund_asset_links link
  join logistics_core.funds fund on fund.id = link.fund_id and fund.deleted_at is null
  where link.asset_id = resolved_asset_id and link.deleted_at is null;

  select coalesce(jsonb_agg(jsonb_build_object(
    'loan_key', tranche.row_key,
    'fund_key', tranche.fund_id,
    'tranche', tranche.tranche,
    'lender_name', tranche.party_name,
    'committed_amount_krw', tranche.committed_amount_krw,
    'drawdown_date', tranche.drawdown_date,
    'maturity_date', tranche.maturity_date,
    'loan_period', tranche.loan_period,
    'loan_type', tranche.loan_type,
    'interest_type', tranche.interest_type,
    'base_rate', tranche.base_rate,
    'spread_rate', tranche.spread_rate,
    'loan_rate', tranche.loan_rate,
    'interest_rate', tranche.interest_rate,
    'fee', tranche.fee,
    'fee_rate', tranche.fee_rate,
    'all_in', tranche.all_in,
    'all_in_rate', tranche.all_in_rate,
    'source_status', 'canonical',
    'repayment_schedule', jsonb_build_object(
      'status', 'not_provided',
      'rows', '[]'::jsonb,
      'reason', 'SOURCE_HAS_NO_MONTHLY_REPAYMENT_SCHEDULE'
    ),
    'source_updated_at', tranche.updated_at
  ) order by tranche.display_order, tranche.tranche, tranche.party_name), '[]'::jsonb)
  into loan_rows
  from public.ll_fund_capital_tranches tranche
  where tranche.tranche_type = 'loan'
    and tranche.is_active = true
    and tranche.deleted_at is null
    and exists (
      select 1 from public.ll_fund_asset_links source_link
      where source_link.fund_id = tranche.fund_id
        and source_link.asset_id = asset_row.public_key
    );

  select coalesce(jsonb_agg(maturity_row.payload order by maturity_row.official_date), '[]'::jsonb)
  into maturity_rows
  from (
    select maturity.official_date, jsonb_build_object(
      'maturity_key', maturity.maturity_key,
      'type', maturity.maturity_type,
      'target_name', maturity.target_name_ko,
      'official_date', maturity.official_date,
      'days_remaining', maturity.official_date - current_date,
      'status', maturity.status,
      'revision', maturity.revision
    ) as payload
    from logistics_core.maturities maturity
    where (
        maturity.asset_id = resolved_asset_id
        or exists (
          select 1 from logistics_core.maturity_asset_scopes scope
          where scope.maturity_id = maturity.id
            and scope.asset_id = resolved_asset_id
            and scope.retired_at is null
        )
      )
      and maturity.deleted_at is null
      and maturity.status = 'active'
    order by maturity.official_date
    limit 3
  ) maturity_row;

  response_data := jsonb_build_object(
    'assets', asset_rows,
    'asset', jsonb_build_object(
      'asset_key', asset_row.asset_key,
      'asset_code', asset_row.asset_code,
      'name', asset_row.name_ko,
      'address', asset_row.address_ko,
      'gross_area_sqm', asset_row.gross_area_sqm,
      'leasable_area_sqm', asset_row.leasable_area_sqm,
      'acquisition_cost', asset_row.acquisition_cost,
      'current_valuation', asset_row.current_valuation,
      'currency_code', asset_row.currency_code
    ),
    'funds', fund_rows,
    'loans', loan_rows,
    'nearest_maturities', maturity_rows,
    'as_of_date', coalesce(nullif(p_payload->>'as_of_date', '')::date, current_date)
  );
  return logistics_core.primary_response(p_request_id, asset_row.revision, response_data);
end;
$body$;

create or replace function logistics_core.rent_roll_read_entry(
  p_request_id uuid,
  p_asset_key text,
  p_payload jsonb,
  p_expected_revisions jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, logistics_core
as $body$
declare
  actor_id uuid := logistics_core.request_actor();
  resolved_asset_id uuid := logistics_core.resolve_asset_id(p_asset_key);
  rows jsonb;
  latest_revision bigint;
  write_status jsonb;
begin
  perform logistics_core.assert_asset_permission(actor_id, resolved_asset_id, 'read');
  write_status := logistics_core.actor_write_status(actor_id, resolved_asset_id);

  select coalesce(jsonb_agg(jsonb_build_object(
    'row_key', coalesce(term.rent_term_key, allocation.contract_space_key, space.space_key),
    'space_key', space.space_key,
    'contract_key', contract.contract_key,
    'contract_space_key', allocation.contract_space_key,
    'rent_term_key', term.rent_term_key,
    'tenant_key', tenant.tenant_key,
    'tenant_name', tenant.legal_name_ko,
    'business_registration_number', tenant.business_registration_number,
    'occupancy_status', case when contract.id is null then 'vacant' else space.occupancy_status end,
    'use_category', coalesce(space.use_category, space.use_type),
    'floor_label', space.floor_label,
    'zone_label', space.zone_label,
    'exclusive_area_sqm', space.exclusive_area_sqm,
    'common_area_sqm', space.common_area_sqm,
    'leased_area_sqm', coalesce(space.leased_area_sqm, allocation.allocated_leasable_area_sqm),
    'efficiency_ratio', space.efficiency_ratio,
    'commencement_date', contract.commencement_date,
    'expiry_date', contract.expiry_date,
    'deposit_total_krw', contract.deposit_amount,
    'deposit_per_py_krw', contract.deposit_per_py_krw,
    'monthly_rent_total_krw', term.base_monthly_rent,
    'rent_per_py_krw', term.rent_per_pyeong,
    'monthly_cam_total_krw', term.base_monthly_management_fee,
    'cam_per_py_krw', term.management_fee_per_pyeong,
    'rent_free_schedule', coalesce(term.rent_free_schedule, '[]'::jsonb),
    'deposit_escalation_rule', coalesce(term.deposit_escalation_rule, '{}'::jsonb),
    'rent_escalation_rule', coalesce(term.rent_escalation_rule, '{}'::jsonb),
    'cam_escalation_rule', coalesce(term.cam_escalation_rule, '{}'::jsonb),
    'fit_out_months', term.fit_out_months,
    'fit_out_amount', term.fit_out_amount,
    'effective_rent', term.effective_rent,
    'tenant_cost_terms', coalesce(term.tenant_cost_terms, '{}'::jsonb),
    'landlord_cost_terms', coalesce(term.landlord_cost_terms, '{}'::jsonb),
    'renewal_terms', contract.renewal_terms,
    'termination_terms', contract.termination_terms,
    'restoration_terms', contract.restoration_terms,
    'bond_terms', contract.bond_terms,
    'operation_start_date', contract.operation_start_date,
    'pallet_rack_fee', term.pallet_rack_fee,
    'notes', coalesce(term.notes, contract.notes),
    'revision', greatest(space.revision, coalesce(contract.revision, 0), coalesce(allocation.revision, 0), coalesce(term.revision, 0))
  ) order by space.floor_label, space.zone_label, space.space_key), '[]'::jsonb)
  into rows
  from logistics_core.spaces space
  left join lateral (
    select candidate.*
    from logistics_core.contract_spaces candidate
    where candidate.space_id = space.id
      and candidate.deleted_at is null
      and (candidate.effective_to is null or candidate.effective_to >= current_date)
    order by candidate.effective_from desc nulls last, candidate.revision desc
    limit 1
  ) allocation on true
  left join logistics_core.lease_contracts contract
    on contract.id = allocation.contract_id
   and contract.deleted_at is null
   and (coalesce(p_payload->>'include_ended', 'false')::boolean or contract.status not in ('ended', 'terminated'))
  left join logistics_core.tenants tenant on tenant.id = contract.tenant_id and tenant.deleted_at is null
  left join lateral (
    select candidate.*
    from logistics_core.rent_terms candidate
    where candidate.contract_space_id = allocation.id
      and candidate.deleted_at is null
      and candidate.effective_from_month <= date_trunc('month', current_date)::date
      and (candidate.effective_to_month is null or candidate.effective_to_month >= date_trunc('month', current_date)::date)
    order by candidate.effective_from_month desc, candidate.revision desc
    limit 1
  ) term on true
  where space.asset_id = resolved_asset_id and space.deleted_at is null;

  select greatest(
    coalesce((select max(revision) from logistics_core.lease_contracts where asset_id = resolved_asset_id), 0),
    coalesce((select max(revision) from logistics_core.spaces where asset_id = resolved_asset_id), 0)
  ) into latest_revision;

  return logistics_core.primary_response(
    p_request_id,
    latest_revision,
    jsonb_build_object(
      'rows', rows,
      'rent_roll_write_enabled', coalesce((write_status->>'write_enabled')::boolean, false),
      'write_enabled', coalesce((write_status->>'write_enabled')::boolean, false),
      'write_reason', write_status->>'write_reason'
    )
  );
end;
$body$;

create or replace function logistics_core.project_rent_roll_to_legacy(
  p_asset_id uuid,
  p_actor_id uuid,
  p_request_id uuid
)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, logistics_core, public, extensions
as $body$
declare
  v_row record;
  v_expected jsonb;
  v_actual jsonb;
  v_count integer := 0;
begin
  -- Keep the legacy projection additive and recoverable. Soft-deleted core rows
  -- remain present with an archived marker so a frontend rollback cannot hide
  -- data written by the new platform.
  insert into public.ll_leases (
    lease_id, asset_id, tenant_id, lease_status, recent_contract_date,
    current_start_date, current_end_date, deposit_amount,
    early_termination_right, renewal_option, special_terms,
    source_payload, review_status, updated_at
  )
  select c.contract_key, a.public_key, t.tenant_key,
    case when c.deleted_at is null then c.status else 'archived' end,
    c.signed_date, c.commencement_date, c.expiry_date, c.deposit_amount,
    c.termination_terms, c.renewal_terms, c.special_terms,
    jsonb_build_object('v2_projection', true, 'core_id', c.id,
      'core_revision', c.revision, 'deleted_at', c.deleted_at,
      'client_request_id', p_request_id, 'actor_id', p_actor_id),
    'v2_projected', now()
  from logistics_core.lease_contracts c
  join logistics_core.assets a on a.id = c.asset_id
  join logistics_core.tenants t on t.id = c.tenant_id
  where c.asset_id = p_asset_id
  on conflict (lease_id) do update set
    asset_id = excluded.asset_id, tenant_id = excluded.tenant_id,
    lease_status = excluded.lease_status, recent_contract_date = excluded.recent_contract_date,
    current_start_date = excluded.current_start_date, current_end_date = excluded.current_end_date,
    deposit_amount = excluded.deposit_amount, early_termination_right = excluded.early_termination_right,
    renewal_option = excluded.renewal_option, special_terms = excluded.special_terms,
    source_payload = coalesce(public.ll_leases.source_payload, '{}'::jsonb) || excluded.source_payload,
    review_status = excluded.review_status, updated_at = excluded.updated_at;

  insert into public.ll_lease_spaces (
    lease_space_id, lease_id, asset_id, tenant_id, floor_label, detail_area_label,
    leased_area_sqm, exclusive_area_sqm, exclusive_ratio,
    current_monthly_rent_total, current_monthly_mf_total,
    contract_status, source_payload, review_status, updated_at
  )
  select s.space_key, c.contract_key, a.public_key, t.tenant_key,
    s.floor_label, s.zone_label, coalesce(s.leased_area_sqm, cs.allocated_leasable_area_sqm),
    coalesce(s.exclusive_area_sqm, cs.allocated_exclusive_area_sqm), s.efficiency_ratio,
    rt.base_monthly_rent, rt.base_monthly_management_fee,
    case when s.deleted_at is not null or cs.deleted_at is not null then 'archived'
      when c.id is null then 'vacant' else c.status end,
    jsonb_build_object('v2_projection', true, 'core_id', s.id,
      'core_revision', s.revision, 'deleted_at', s.deleted_at,
      'client_request_id', p_request_id, 'actor_id', p_actor_id),
    'v2_projected', now()
  from logistics_core.spaces s
  join logistics_core.assets a on a.id = s.asset_id
  left join lateral (select x.* from logistics_core.contract_spaces x
    where x.space_id = s.id order by (x.deleted_at is null) desc,
      x.effective_from desc nulls last, x.revision desc limit 1) cs on true
  left join logistics_core.lease_contracts c on c.id = cs.contract_id
  left join logistics_core.tenants t on t.id = c.tenant_id
  left join lateral (select x.* from logistics_core.rent_terms x
    where x.contract_space_id = cs.id order by (x.deleted_at is null) desc,
      x.effective_from_month desc nulls last, x.revision desc limit 1) rt on true
  where s.asset_id = p_asset_id
  on conflict (lease_space_id) do update set
    lease_id = excluded.lease_id, asset_id = excluded.asset_id, tenant_id = excluded.tenant_id,
    floor_label = excluded.floor_label, detail_area_label = excluded.detail_area_label,
    leased_area_sqm = excluded.leased_area_sqm, exclusive_area_sqm = excluded.exclusive_area_sqm,
    exclusive_ratio = excluded.exclusive_ratio,
    current_monthly_rent_total = excluded.current_monthly_rent_total,
    current_monthly_mf_total = excluded.current_monthly_mf_total,
    contract_status = excluded.contract_status,
    source_payload = coalesce(public.ll_lease_spaces.source_payload, '{}'::jsonb) || excluded.source_payload,
    review_status = excluded.review_status, updated_at = excluded.updated_at;

  insert into public.ll_rent_history (
    rent_history_id, lease_space_id, lease_id, asset_id, tenant_id,
    effective_date, change_reason, leased_area_sqm, exclusive_area_sqm,
    monthly_rent_total, monthly_mf_total, rent_per_py, mf_per_py, is_latest,
    match_status, source_payload, review_status, updated_at, floor_label, detail_area_label
  )
  select rt.rent_term_key, s.space_key, c.contract_key, a.public_key, t.tenant_key,
    rt.effective_from_month, 'v2 rent-roll projection',
    coalesce(s.leased_area_sqm, cs.allocated_leasable_area_sqm),
    coalesce(s.exclusive_area_sqm, cs.allocated_exclusive_area_sqm),
    rt.base_monthly_rent, rt.base_monthly_management_fee,
    rt.rent_per_pyeong, rt.management_fee_per_pyeong,
    rt.deleted_at is null and not exists (select 1 from logistics_core.rent_terms newer
      where newer.contract_space_id = rt.contract_space_id and newer.deleted_at is null
        and (coalesce(newer.effective_from_month, date '0001-01-01'), newer.revision)
          > (coalesce(rt.effective_from_month, date '0001-01-01'), rt.revision)),
    'matched', jsonb_build_object('v2_projection', true, 'core_id', rt.id,
      'core_revision', rt.revision, 'deleted_at', rt.deleted_at,
      'client_request_id', p_request_id, 'actor_id', p_actor_id),
    'v2_projected', now(), s.floor_label, s.zone_label
  from logistics_core.rent_terms rt
  join logistics_core.contract_spaces cs on cs.id = rt.contract_space_id
  join logistics_core.spaces s on s.id = cs.space_id
  join logistics_core.lease_contracts c on c.id = cs.contract_id
  join logistics_core.assets a on a.id = c.asset_id
  join logistics_core.tenants t on t.id = c.tenant_id
  where c.asset_id = p_asset_id
  on conflict (rent_history_id) do update set
    lease_space_id = excluded.lease_space_id, lease_id = excluded.lease_id,
    asset_id = excluded.asset_id, tenant_id = excluded.tenant_id,
    effective_date = excluded.effective_date, change_reason = excluded.change_reason,
    leased_area_sqm = excluded.leased_area_sqm, exclusive_area_sqm = excluded.exclusive_area_sqm,
    monthly_rent_total = excluded.monthly_rent_total, monthly_mf_total = excluded.monthly_mf_total,
    rent_per_py = excluded.rent_per_py, mf_per_py = excluded.mf_per_py,
    is_latest = excluded.is_latest, match_status = excluded.match_status,
    source_payload = coalesce(public.ll_rent_history.source_payload, '{}'::jsonb) || excluded.source_payload,
    review_status = excluded.review_status, updated_at = excluded.updated_at,
    floor_label = excluded.floor_label, detail_area_label = excluded.detail_area_label;

  for v_row in
    select c.id, c.revision, c.contract_key, a.public_key asset_key, t.tenant_key,
      case when c.deleted_at is null then c.status else 'archived' end projected_status,
      c.signed_date, c.commencement_date, c.expiry_date, c.deposit_amount
    from logistics_core.lease_contracts c
    join logistics_core.assets a on a.id = c.asset_id
    join logistics_core.tenants t on t.id = c.tenant_id
    where c.asset_id = p_asset_id
  loop
    v_expected := jsonb_build_object('lease_id', v_row.contract_key, 'asset_id', v_row.asset_key,
      'tenant_id', v_row.tenant_key, 'lease_status', v_row.projected_status,
      'recent_contract_date', v_row.signed_date, 'current_start_date', v_row.commencement_date,
      'current_end_date', v_row.expiry_date, 'deposit_amount', v_row.deposit_amount);
    select jsonb_build_object('lease_id', l.lease_id, 'asset_id', l.asset_id,
      'tenant_id', l.tenant_id, 'lease_status', l.lease_status,
      'recent_contract_date', l.recent_contract_date, 'current_start_date', l.current_start_date,
      'current_end_date', l.current_end_date, 'deposit_amount', l.deposit_amount)
    into v_actual from public.ll_leases l where l.lease_id = v_row.contract_key;
    if v_actual is null or logistics_core.json_sha256(v_actual) <> logistics_core.json_sha256(v_expected) then
      raise exception using errcode = 'PT500', message = 'READBACK_MISMATCH';
    end if;
    insert into logistics_core.legacy_projection_state (
      target_entity, target_id, legacy_table, legacy_pk, projection_version,
      last_success_revision, target_hash, legacy_hash, readback_status, verified_at
    ) values ('lease_contracts', v_row.id, 'public.ll_leases', jsonb_build_object('lease_id', v_row.contract_key),
      'gate6-data-platform-1', v_row.revision, logistics_core.json_sha256(v_expected),
      logistics_core.json_sha256(v_actual), 'verified', now())
    on conflict (target_entity, target_id, legacy_table, legacy_pk) do update set
      last_success_revision = excluded.last_success_revision, target_hash = excluded.target_hash,
      legacy_hash = excluded.legacy_hash, readback_status = excluded.readback_status,
      verified_at = excluded.verified_at;
    v_count := v_count + 1;
  end loop;

  for v_row in
    select s.id, s.revision, s.space_key, a.public_key asset_key, s.floor_label,
      s.zone_label, coalesce(s.leased_area_sqm, cs.allocated_leasable_area_sqm) leased_area_sqm,
      coalesce(s.exclusive_area_sqm, cs.allocated_exclusive_area_sqm) exclusive_area_sqm,
      c.contract_key, t.tenant_key
    from logistics_core.spaces s
    join logistics_core.assets a on a.id = s.asset_id
    left join lateral (select x.* from logistics_core.contract_spaces x where x.space_id = s.id
      order by (x.deleted_at is null) desc, x.effective_from desc nulls last, x.revision desc limit 1) cs on true
    left join logistics_core.lease_contracts c on c.id = cs.contract_id
    left join logistics_core.tenants t on t.id = c.tenant_id
    where s.asset_id = p_asset_id
  loop
    v_expected := jsonb_build_object('lease_space_id', v_row.space_key, 'lease_id', v_row.contract_key,
      'asset_id', v_row.asset_key, 'tenant_id', v_row.tenant_key, 'floor_label', v_row.floor_label,
      'detail_area_label', v_row.zone_label, 'leased_area_sqm', v_row.leased_area_sqm,
      'exclusive_area_sqm', v_row.exclusive_area_sqm);
    select jsonb_build_object('lease_space_id', s.lease_space_id, 'lease_id', s.lease_id,
      'asset_id', s.asset_id, 'tenant_id', s.tenant_id, 'floor_label', s.floor_label,
      'detail_area_label', s.detail_area_label, 'leased_area_sqm', s.leased_area_sqm,
      'exclusive_area_sqm', s.exclusive_area_sqm)
    into v_actual from public.ll_lease_spaces s where s.lease_space_id = v_row.space_key;
    if v_actual is null or logistics_core.json_sha256(v_actual) <> logistics_core.json_sha256(v_expected) then
      raise exception using errcode = 'PT500', message = 'READBACK_MISMATCH';
    end if;
    insert into logistics_core.legacy_projection_state (
      target_entity, target_id, legacy_table, legacy_pk, projection_version,
      last_success_revision, target_hash, legacy_hash, readback_status, verified_at
    ) values ('spaces', v_row.id, 'public.ll_lease_spaces', jsonb_build_object('lease_space_id', v_row.space_key),
      'gate6-data-platform-1', v_row.revision, logistics_core.json_sha256(v_expected),
      logistics_core.json_sha256(v_actual), 'verified', now())
    on conflict (target_entity, target_id, legacy_table, legacy_pk) do update set
      last_success_revision = excluded.last_success_revision, target_hash = excluded.target_hash,
      legacy_hash = excluded.legacy_hash, readback_status = excluded.readback_status,
      verified_at = excluded.verified_at;
    v_count := v_count + 1;
  end loop;

  for v_row in
    select rt.id, rt.revision, rt.rent_term_key, s.space_key, c.contract_key,
      a.public_key asset_key, t.tenant_key, rt.effective_from_month,
      rt.base_monthly_rent, rt.base_monthly_management_fee, rt.rent_per_pyeong,
      rt.management_fee_per_pyeong,
      rt.deleted_at is null and not exists (select 1 from logistics_core.rent_terms newer
        where newer.contract_space_id = rt.contract_space_id and newer.deleted_at is null
          and (coalesce(newer.effective_from_month, date '0001-01-01'), newer.revision)
            > (coalesce(rt.effective_from_month, date '0001-01-01'), rt.revision)) is_latest
    from logistics_core.rent_terms rt
    join logistics_core.contract_spaces cs on cs.id = rt.contract_space_id
    join logistics_core.spaces s on s.id = cs.space_id
    join logistics_core.lease_contracts c on c.id = cs.contract_id
    join logistics_core.assets a on a.id = c.asset_id
    join logistics_core.tenants t on t.id = c.tenant_id
    where c.asset_id = p_asset_id
  loop
    v_expected := jsonb_build_object('rent_history_id', v_row.rent_term_key,
      'lease_space_id', v_row.space_key, 'lease_id', v_row.contract_key,
      'asset_id', v_row.asset_key, 'tenant_id', v_row.tenant_key,
      'effective_date', v_row.effective_from_month, 'monthly_rent_total', v_row.base_monthly_rent,
      'monthly_mf_total', v_row.base_monthly_management_fee, 'rent_per_py', v_row.rent_per_pyeong,
      'mf_per_py', v_row.management_fee_per_pyeong, 'is_latest', v_row.is_latest);
    select jsonb_build_object('rent_history_id', r.rent_history_id,
      'lease_space_id', r.lease_space_id, 'lease_id', r.lease_id,
      'asset_id', r.asset_id, 'tenant_id', r.tenant_id,
      'effective_date', r.effective_date, 'monthly_rent_total', r.monthly_rent_total,
      'monthly_mf_total', r.monthly_mf_total, 'rent_per_py', r.rent_per_py,
      'mf_per_py', r.mf_per_py, 'is_latest', r.is_latest)
    into v_actual from public.ll_rent_history r where r.rent_history_id = v_row.rent_term_key;
    if v_actual is null or logistics_core.json_sha256(v_actual) <> logistics_core.json_sha256(v_expected) then
      raise exception using errcode = 'PT500', message = 'READBACK_MISMATCH';
    end if;
    insert into logistics_core.legacy_projection_state (
      target_entity, target_id, legacy_table, legacy_pk, projection_version,
      last_success_revision, target_hash, legacy_hash, readback_status, verified_at
    ) values ('rent_terms', v_row.id, 'public.ll_rent_history', jsonb_build_object('rent_history_id', v_row.rent_term_key),
      'gate6-data-platform-1', v_row.revision, logistics_core.json_sha256(v_expected),
      logistics_core.json_sha256(v_actual), 'verified', now())
    on conflict (target_entity, target_id, legacy_table, legacy_pk) do update set
      last_success_revision = excluded.last_success_revision, target_hash = excluded.target_hash,
      legacy_hash = excluded.legacy_hash, readback_status = excluded.readback_status,
      verified_at = excluded.verified_at;
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$body$;

create or replace function logistics_core.rent_roll_batch_save_entry(
  p_request_id uuid,
  p_asset_key text,
  p_payload jsonb,
  p_expected_revisions jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, logistics_core, extensions
as $body$
declare
  actor_id uuid := logistics_core.request_actor();
  resolved_asset_id uuid := logistics_core.resolve_asset_id(p_asset_key);
  request_digest text := logistics_core.request_hash('v2/rent-roll/batch-save', p_asset_key, p_payload, p_expected_revisions);
  cached_response jsonb;
  operation jsonb;
  row_record jsonb;
  operation_name text;
  entity_name text;
  entity_key text;
  expected bigint;
  current_revision bigint;
  entity_id uuid;
  related_id uuid;
  row_key text;
  space_key text;
  contract_key text;
  allocation_key text;
  term_key text;
  space_id uuid;
  contract_id uuid;
  allocation_id uuid;
  tenant_id uuid;
  term_id uuid;
  before_row jsonb;
  after_row jsonb;
  changed_count integer := 0;
  legacy_projection_count integer := 0;
  final_revision bigint := 0;
  response jsonb;
begin
  perform logistics_core.assert_v2_writer_route(resolved_asset_id);
  cached_response := logistics_core.claim_idempotency(actor_id, 'v2/rent-roll/batch-save', p_request_id, request_digest);
  if cached_response is not null then return cached_response; end if;

  if jsonb_typeof(p_payload->'rows') <> 'array'
     and jsonb_typeof(p_payload->'operations') <> 'array' then
    raise exception using errcode = 'PT422', message = 'ROWS_OR_OPERATIONS_ARRAY_REQUIRED';
  end if;
  if p_payload ? 'rows' and jsonb_typeof(p_payload->'rows') <> 'array' then
    raise exception using errcode = 'PT422', message = 'ROWS_ARRAY_REQUIRED';
  end if;
  if p_payload ? 'operations' and jsonb_typeof(p_payload->'operations') <> 'array' then
    raise exception using errcode = 'PT422', message = 'OPERATIONS_ARRAY_REQUIRED';
  end if;
  if coalesce(jsonb_array_length(p_payload->'rows'), 0) > 500
     or coalesce(jsonb_array_length(p_payload->'operations'), 0) > 500 then
    raise exception using errcode = 'PT422', message = 'BATCH_LIMIT_EXCEEDED';
  end if;

  if jsonb_typeof(p_payload->'rows') = 'array' then
    for row_record in select value from jsonb_array_elements(p_payload->'rows')
    loop
      row_key := nullif(row_record->>'row_key', '');
      space_key := coalesce(nullif(row_record->>'space_key', ''), row_key);
      contract_key := nullif(row_record->>'contract_key', '');
      allocation_key := coalesce(nullif(row_record->>'contract_space_key', ''),
        case when contract_key is not null then contract_key || ':' || space_key end);
      term_key := coalesce(nullif(row_record->>'rent_term_key', ''),
        case when allocation_key is not null then allocation_key || ':current' end);
      if row_key is null or space_key is null then
        raise exception using errcode = 'PT422', message = 'ROW_KEY_REQUIRED';
      end if;

      perform logistics_core.assert_asset_permission(
        actor_id,
        resolved_asset_id,
        case when exists (
          select 1 from logistics_core.spaces existing
          where existing.space_key = space_key and existing.asset_id = resolved_asset_id
        ) then 'update' else 'create' end
      );

      select existing.id, existing.revision, to_jsonb(existing)
      into space_id, current_revision, before_row
      from logistics_core.spaces existing
      where existing.space_key = space_key and existing.asset_id = resolved_asset_id
      for update;

      if space_id is not null then
        expected := coalesce(
          nullif(row_record->>'expected_revision', '')::bigint,
          nullif(p_expected_revisions->>row_key, '')::bigint
        );
        if expected is null or current_revision <> expected then
          raise exception using errcode = 'PT409', message = 'REVISION_CONFLICT';
        end if;
        update logistics_core.spaces
        set occupancy_status = coalesce(nullif(row_record->>'occupancy_status', ''), occupancy_status),
            use_category = coalesce(row_record->>'use_category', use_category),
            use_type = coalesce(row_record->>'use_category', use_type),
            floor_label = coalesce(row_record->>'floor_label', floor_label),
            zone_label = coalesce(row_record->>'zone_label', zone_label),
            exclusive_area_sqm = coalesce(nullif(row_record->>'exclusive_area_sqm', '')::numeric, exclusive_area_sqm),
            common_area_sqm = coalesce(nullif(row_record->>'common_area_sqm', '')::numeric, common_area_sqm),
            leased_area_sqm = coalesce(nullif(row_record->>'leased_area_sqm', '')::numeric, leased_area_sqm),
            efficiency_ratio = coalesce(nullif(row_record->>'efficiency_ratio', '')::numeric, efficiency_ratio),
            deleted_at = null,
            deleted_by = null
        where id = space_id
        returning revision into current_revision;
      else
        insert into logistics_core.spaces (
          space_key, asset_id, occupancy_status, use_category, use_type, floor_label, zone_label,
          exclusive_area_sqm, common_area_sqm, leased_area_sqm, leasable_area_sqm, efficiency_ratio,
          created_by, updated_by
        ) values (
          space_key, resolved_asset_id, coalesce(nullif(row_record->>'occupancy_status', ''), 'vacant'),
          row_record->>'use_category', row_record->>'use_category', row_record->>'floor_label', row_record->>'zone_label',
          nullif(row_record->>'exclusive_area_sqm', '')::numeric,
          nullif(row_record->>'common_area_sqm', '')::numeric,
          nullif(row_record->>'leased_area_sqm', '')::numeric,
          nullif(row_record->>'leased_area_sqm', '')::numeric,
          nullif(row_record->>'efficiency_ratio', '')::numeric,
          actor_id, actor_id
        ) returning id, revision into space_id, current_revision;
      end if;

      if coalesce(nullif(row_record->>'occupancy_status', ''), 'occupied') = 'vacant' then
        update logistics_core.contract_spaces allocation
        set deleted_at = now(), deleted_by = actor_id
        where allocation.space_id = space_id and allocation.deleted_at is null;
      else
        if contract_key is null
           or nullif(row_record->>'tenant_key', '') is null
           or nullif(row_record->>'commencement_date', '') is null then
          raise exception using errcode = 'PT422', message = 'OCCUPIED_ROW_REQUIRES_CONTRACT_AND_TENANT';
        end if;
        select tenant.id into tenant_id
        from logistics_core.tenants tenant
        where tenant.tenant_key = row_record->>'tenant_key' and tenant.deleted_at is null;
        if tenant_id is null then
          raise exception using errcode = 'PT422', message = 'TENANT_NOT_FOUND';
        end if;

        insert into logistics_core.lease_contracts (
          contract_key, contract_code, asset_id, tenant_id, commencement_date, expiry_date, status,
          deposit_amount, deposit_per_py_krw, operation_start_date, renewal_terms, termination_terms,
          restoration_terms, bond_terms, notes, created_by, updated_by
        ) values (
          contract_key, coalesce(nullif(row_record->>'contract_code', ''), contract_key), resolved_asset_id, tenant_id,
          (row_record->>'commencement_date')::date, nullif(row_record->>'expiry_date', '')::date, 'active',
          nullif(row_record->>'deposit_total_krw', '')::numeric, nullif(row_record->>'deposit_per_py_krw', '')::numeric,
          nullif(row_record->>'operation_start_date', '')::date, row_record->>'renewal_terms', row_record->>'termination_terms',
          row_record->>'restoration_terms', row_record->>'bond_terms', row_record->>'notes', actor_id, actor_id
        ) on conflict (contract_key) do update set
          tenant_id = excluded.tenant_id,
          commencement_date = excluded.commencement_date,
          expiry_date = excluded.expiry_date,
          deposit_amount = excluded.deposit_amount,
          deposit_per_py_krw = excluded.deposit_per_py_krw,
          operation_start_date = excluded.operation_start_date,
          renewal_terms = excluded.renewal_terms,
          termination_terms = excluded.termination_terms,
          restoration_terms = excluded.restoration_terms,
          bond_terms = excluded.bond_terms,
          notes = excluded.notes,
          deleted_at = null,
          deleted_by = null
        returning id into contract_id;

        insert into logistics_core.contract_spaces (
          contract_space_key, contract_id, space_id, allocated_leasable_area_sqm,
          allocated_exclusive_area_sqm, effective_from, effective_to, created_by, updated_by
        ) values (
          allocation_key, contract_id, space_id, nullif(row_record->>'leased_area_sqm', '')::numeric,
          nullif(row_record->>'exclusive_area_sqm', '')::numeric,
          (row_record->>'commencement_date')::date, nullif(row_record->>'expiry_date', '')::date, actor_id, actor_id
        ) on conflict (contract_space_key) do update set
          allocated_leasable_area_sqm = excluded.allocated_leasable_area_sqm,
          allocated_exclusive_area_sqm = excluded.allocated_exclusive_area_sqm,
          effective_from = excluded.effective_from,
          effective_to = excluded.effective_to,
          deleted_at = null,
          deleted_by = null
        returning id into allocation_id;

        insert into logistics_core.rent_terms (
          rent_term_key, contract_space_id, effective_from_month, effective_to_month,
          base_monthly_rent, base_monthly_management_fee, rent_per_pyeong, management_fee_per_pyeong,
          rent_free_schedule, deposit_escalation_rule, rent_escalation_rule, cam_escalation_rule,
          fit_out_months, fit_out_amount, effective_rent, tenant_cost_terms, landlord_cost_terms,
          pallet_rack_fee, notes, created_by, updated_by
        ) values (
          term_key, allocation_id, date_trunc('month', (row_record->>'commencement_date')::date)::date,
          case when nullif(row_record->>'expiry_date', '') is null then null else date_trunc('month', (row_record->>'expiry_date')::date)::date end,
          nullif(row_record->>'monthly_rent_total_krw', '')::numeric,
          nullif(row_record->>'monthly_cam_total_krw', '')::numeric,
          nullif(row_record->>'rent_per_py_krw', '')::numeric,
          nullif(row_record->>'cam_per_py_krw', '')::numeric,
          coalesce(row_record->'rent_free_schedule', '[]'::jsonb),
          coalesce(row_record->'deposit_escalation_rule', '{}'::jsonb),
          coalesce(row_record->'rent_escalation_rule', '{}'::jsonb),
          coalesce(row_record->'cam_escalation_rule', '{}'::jsonb),
          nullif(row_record->>'fit_out_months', '')::numeric,
          nullif(row_record->>'fit_out_amount', '')::numeric,
          nullif(row_record->>'effective_rent', '')::numeric,
          coalesce(row_record->'tenant_cost_terms', '{}'::jsonb),
          coalesce(row_record->'landlord_cost_terms', '{}'::jsonb),
          nullif(row_record->>'pallet_rack_fee', '')::numeric,
          row_record->>'notes', actor_id, actor_id
        ) on conflict (rent_term_key) do update set
          effective_to_month = excluded.effective_to_month,
          base_monthly_rent = excluded.base_monthly_rent,
          base_monthly_management_fee = excluded.base_monthly_management_fee,
          rent_per_pyeong = excluded.rent_per_pyeong,
          management_fee_per_pyeong = excluded.management_fee_per_pyeong,
          rent_free_schedule = excluded.rent_free_schedule,
          deposit_escalation_rule = excluded.deposit_escalation_rule,
          rent_escalation_rule = excluded.rent_escalation_rule,
          cam_escalation_rule = excluded.cam_escalation_rule,
          fit_out_months = excluded.fit_out_months,
          fit_out_amount = excluded.fit_out_amount,
          effective_rent = excluded.effective_rent,
          tenant_cost_terms = excluded.tenant_cost_terms,
          landlord_cost_terms = excluded.landlord_cost_terms,
          pallet_rack_fee = excluded.pallet_rack_fee,
          notes = excluded.notes,
          deleted_at = null,
          deleted_by = null
        returning id, revision into term_id, current_revision;
      end if;

      select to_jsonb(saved), saved.revision into after_row, current_revision
      from logistics_core.spaces saved where saved.id = space_id;
      insert into logistics_core.audit_events (
        actor_user_id, action, entity_type, entity_id, asset_id, entity_revision,
        before_hash, after_hash, change_payload, reason, client_request_id,
        mapping_version, correlation_id
      ) values (
        actor_id, 'upsert', 'rent_roll_row', space_id, resolved_asset_id, current_revision,
        case when before_row is null then null else logistics_core.json_sha256(before_row) end,
        logistics_core.json_sha256(after_row), row_record - 'notes', row_record->>'reason', p_request_id,
        'gate6-data-platform-1', p_request_id
      );
      changed_count := changed_count + 1;
      final_revision := greatest(final_revision, current_revision);
    end loop;
  end if;

  if jsonb_typeof(p_payload->'operations') = 'array' then
  for operation in select value from jsonb_array_elements(p_payload->'operations')
  loop
    entity_name := nullif(operation->>'entity', '');
    operation_name := nullif(operation->>'operation', '');
    entity_key := nullif(operation->>'entity_key', '');
    if entity_name not in ('contract', 'space', 'rent_term')
      or operation_name not in ('create', 'update', 'delete')
      or entity_key is null then
      raise exception using errcode = 'PT422', message = 'INVALID_RENT_ROLL_OPERATION';
    end if;
    perform logistics_core.assert_asset_permission(actor_id, resolved_asset_id, operation_name);
    before_row := null;
    after_row := null;

    if entity_name = 'contract' then
      if operation_name = 'create' then
        select tenant.id into related_id
        from logistics_core.tenants tenant
        where tenant.tenant_key = operation->'record'->>'tenant_key' and tenant.deleted_at is null;
        if related_id is null then raise exception using errcode = 'PT422', message = 'TENANT_NOT_FOUND'; end if;
        insert into logistics_core.lease_contracts (
          contract_key, contract_code, asset_id, tenant_id, signed_date, commencement_date,
          status, deposit_amount, renewal_terms, termination_terms, special_terms, created_by, updated_by
        ) values (
          entity_key,
          coalesce(nullif(operation->'record'->>'contract_code', ''), entity_key),
          resolved_asset_id,
          related_id,
          nullif(operation->'record'->>'signed_date', '')::date,
          (operation->'record'->>'commencement_date')::date,
          coalesce(nullif(operation->'record'->>'status', ''), 'planned'),
          nullif(operation->'record'->>'deposit_amount', '')::numeric,
          operation->'record'->>'renewal_terms',
          operation->'record'->>'termination_terms',
          operation->'record'->>'special_terms',
          actor_id,
          actor_id
        ) returning id, revision into entity_id, current_revision;
      else
        select contract.id, contract.revision, to_jsonb(contract)
        into entity_id, current_revision, before_row
        from logistics_core.lease_contracts contract
        where contract.contract_key = entity_key and contract.asset_id = resolved_asset_id
        for update;
        if entity_id is null then raise exception using errcode = 'PT404', message = 'NOT_FOUND'; end if;
        expected := logistics_core.expected_revision(operation, p_expected_revisions, entity_key);
        if current_revision <> expected then raise exception using errcode = 'PT409', message = 'REVISION_CONFLICT'; end if;
        if operation_name = 'delete' then
          update logistics_core.lease_contracts
          set deleted_at = now(), deleted_by = actor_id
          where id = entity_id returning revision into current_revision;
        else
          update logistics_core.lease_contracts
          set status = coalesce(nullif(operation->'record'->>'status', ''), status),
              deposit_amount = coalesce(nullif(operation->'record'->>'deposit_amount', '')::numeric, deposit_amount),
              renewal_terms = coalesce(operation->'record'->>'renewal_terms', renewal_terms),
              termination_terms = coalesce(operation->'record'->>'termination_terms', termination_terms),
              special_terms = coalesce(operation->'record'->>'special_terms', special_terms)
          where id = entity_id returning revision into current_revision;
        end if;
      end if;
      select to_jsonb(contract) into after_row from logistics_core.lease_contracts contract where contract.id = entity_id;

    elsif entity_name = 'space' then
      if operation_name = 'create' then
        insert into logistics_core.spaces (
          space_key, asset_id, floor_label, zone_label, use_type, leasable_area_sqm,
          exclusive_area_sqm, created_by, updated_by
        ) values (
          entity_key,
          resolved_asset_id,
          operation->'record'->>'floor',
          operation->'record'->>'zone',
          operation->'record'->>'use_type',
          nullif(operation->'record'->>'leasable_area_sqm', '')::numeric,
          nullif(operation->'record'->>'exclusive_area_sqm', '')::numeric,
          actor_id,
          actor_id
        ) returning id, revision into entity_id, current_revision;
      else
        select space.id, space.revision, to_jsonb(space)
        into entity_id, current_revision, before_row
        from logistics_core.spaces space
        where space.space_key = entity_key and space.asset_id = resolved_asset_id
        for update;
        if entity_id is null then raise exception using errcode = 'PT404', message = 'NOT_FOUND'; end if;
        expected := logistics_core.expected_revision(operation, p_expected_revisions, entity_key);
        if current_revision <> expected then raise exception using errcode = 'PT409', message = 'REVISION_CONFLICT'; end if;
        if operation_name = 'delete' then
          update logistics_core.spaces set deleted_at = now(), deleted_by = actor_id
          where id = entity_id returning revision into current_revision;
        else
          update logistics_core.spaces
          set floor_label = coalesce(operation->'record'->>'floor', floor_label),
              zone_label = coalesce(operation->'record'->>'zone', zone_label),
              use_type = coalesce(operation->'record'->>'use_type', use_type),
              leasable_area_sqm = coalesce(nullif(operation->'record'->>'leasable_area_sqm', '')::numeric, leasable_area_sqm),
              exclusive_area_sqm = coalesce(nullif(operation->'record'->>'exclusive_area_sqm', '')::numeric, exclusive_area_sqm)
          where id = entity_id returning revision into current_revision;
        end if;
      end if;
      select to_jsonb(space) into after_row from logistics_core.spaces space where space.id = entity_id;

    else
      if operation_name = 'create' then
        select allocation.id into related_id
        from logistics_core.contract_spaces allocation
        join logistics_core.lease_contracts contract on contract.id = allocation.contract_id
        where allocation.contract_space_key = operation->'record'->>'contract_space_key'
          and allocation.deleted_at is null
          and contract.asset_id = resolved_asset_id
          and contract.deleted_at is null;
        if related_id is null then raise exception using errcode = 'PT422', message = 'CONTRACT_SPACE_NOT_FOUND'; end if;
        insert into logistics_core.rent_terms (
          rent_term_key, contract_space_id, effective_from_month, effective_to_month,
          base_monthly_rent, base_monthly_management_fee, rent_per_pyeong,
          management_fee_per_pyeong, rent_free_months, tenant_improvement_amount,
          interior_support_amount, escalation_rate, escalation_interval_months,
          calculation_method, created_by, updated_by
        ) values (
          entity_key,
          related_id,
          (operation->'record'->>'effective_from_month')::date,
          nullif(operation->'record'->>'effective_to_month', '')::date,
          nullif(operation->'record'->>'base_monthly_rent', '')::numeric,
          nullif(operation->'record'->>'base_monthly_management_fee', '')::numeric,
          nullif(operation->'record'->>'rent_per_pyeong', '')::numeric,
          nullif(operation->'record'->>'management_fee_per_pyeong', '')::numeric,
          coalesce(nullif(operation->'record'->>'rent_free_months', '')::numeric, 0),
          nullif(operation->'record'->>'tenant_improvement_amount', '')::numeric,
          nullif(operation->'record'->>'interior_support_amount', '')::numeric,
          nullif(operation->'record'->>'escalation_rate', '')::numeric,
          nullif(operation->'record'->>'escalation_interval_months', '')::integer,
          coalesce(nullif(operation->'record'->>'calculation_method', ''), 'fixed_monthly'),
          actor_id,
          actor_id
        ) returning id, revision into entity_id, current_revision;
      else
        select term.id, term.revision, to_jsonb(term)
        into entity_id, current_revision, before_row
        from logistics_core.rent_terms term
        join logistics_core.contract_spaces allocation on allocation.id = term.contract_space_id
        join logistics_core.lease_contracts contract on contract.id = allocation.contract_id
        where term.rent_term_key = entity_key and contract.asset_id = resolved_asset_id
        for update of term;
        if entity_id is null then raise exception using errcode = 'PT404', message = 'NOT_FOUND'; end if;
        expected := logistics_core.expected_revision(operation, p_expected_revisions, entity_key);
        if current_revision <> expected then raise exception using errcode = 'PT409', message = 'REVISION_CONFLICT'; end if;
        if operation_name = 'delete' then
          update logistics_core.rent_terms set deleted_at = now(), deleted_by = actor_id
          where id = entity_id returning revision into current_revision;
        else
          update logistics_core.rent_terms
          set effective_to_month = coalesce(nullif(operation->'record'->>'effective_to_month', '')::date, effective_to_month),
              base_monthly_rent = coalesce(nullif(operation->'record'->>'base_monthly_rent', '')::numeric, base_monthly_rent),
              base_monthly_management_fee = coalesce(nullif(operation->'record'->>'base_monthly_management_fee', '')::numeric, base_monthly_management_fee),
              rent_free_months = coalesce(nullif(operation->'record'->>'rent_free_months', '')::numeric, rent_free_months),
              escalation_rate = coalesce(nullif(operation->'record'->>'escalation_rate', '')::numeric, escalation_rate),
              escalation_interval_months = coalesce(nullif(operation->'record'->>'escalation_interval_months', '')::integer, escalation_interval_months)
          where id = entity_id returning revision into current_revision;
        end if;
      end if;
      select to_jsonb(term) into after_row from logistics_core.rent_terms term where term.id = entity_id;
      insert into logistics_core.rent_term_history (
        rent_term_id, effective_at, change_type, before_values, after_values, reason, source_reference, created_by
      ) values (
        entity_id,
        now(),
        case when operation_name = 'create' then 'created' when operation_name = 'delete' then 'soft_deleted' else 'updated' end,
        before_row,
        after_row,
        coalesce(nullif(operation->>'reason', ''), 'v2 rent-roll batch save'),
        jsonb_build_object('client_request_id', p_request_id, 'entity_key', entity_key),
        actor_id
      );
    end if;

    if after_row is null then raise exception using errcode = 'PT500', message = 'READBACK_MISMATCH'; end if;
    insert into logistics_core.audit_events (
      actor_user_id, action, entity_type, entity_id, asset_id, entity_revision,
      before_hash, after_hash, change_payload, reason, client_request_id,
      mapping_version, correlation_id
    ) values (
      actor_id,
      operation_name,
      entity_name,
      entity_id,
      resolved_asset_id,
      current_revision,
      case when before_row is null then null else logistics_core.json_sha256(before_row) end,
      logistics_core.json_sha256(after_row),
      jsonb_build_object('entity_key', entity_key, 'operation', operation_name),
      operation->>'reason',
      p_request_id,
      'gate6-data-platform-1',
      p_request_id
    );
    changed_count := changed_count + 1;
    final_revision := greatest(final_revision, current_revision);
  end loop;
  end if;

  if changed_count <> (
    select count(*) from logistics_core.audit_events event
    where event.client_request_id = p_request_id and event.actor_user_id = actor_id
  ) then
    raise exception using errcode = 'PT500', message = 'READBACK_MISMATCH';
  end if;

  legacy_projection_count := logistics_core.project_rent_roll_to_legacy(resolved_asset_id, actor_id, p_request_id);

  response := logistics_core.primary_response(
    p_request_id,
    final_revision,
    jsonb_build_object(
      'changed_count', changed_count,
      'legacy_projection_count', legacy_projection_count,
      'readback', 'verified'
    )
  );
  perform logistics_core.complete_idempotency(actor_id, 'v2/rent-roll/batch-save', p_request_id, response);
  return response;
end;
$body$;

create or replace function logistics_core.finance_read_entry(
  p_request_id uuid,
  p_asset_key text,
  p_payload jsonb,
  p_expected_revisions jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, logistics_core, public
as $body$
declare
  actor_id uuid := logistics_core.request_actor();
  resolved_asset_id uuid := logistics_core.resolve_asset_id(p_asset_key);
  legacy_asset_id text;
  from_month date := coalesce(
    logistics_core.normalize_month(coalesce(p_payload->>'from_month', p_payload->>'start_month')),
    date_trunc('year', current_date)::date
  );
  to_month date := coalesce(
    logistics_core.normalize_month(coalesce(p_payload->>'to_month', p_payload->>'end_month')),
    date_trunc('month', current_date)::date
  );
  requested_scenario text := coalesce(nullif(p_payload->>'scenario', ''), 'actual');
  requested_basis text := coalesce(nullif(p_payload->>'accounting_basis', ''), 'accrual');
  entries jsonb;
  accounts jsonb;
  loans jsonb;
  waterfall jsonb;
  formula_status text;
  formula_version integer;
  write_status jsonb;
  entry_count bigint := 0;
  latest_revision bigint;
begin
  perform logistics_core.assert_asset_permission(actor_id, resolved_asset_id, 'read');
  write_status := logistics_core.actor_write_status(actor_id, resolved_asset_id);
  select asset.public_key into legacy_asset_id
  from logistics_core.assets asset where asset.id = resolved_asset_id;
  if extract(day from from_month) <> 1 or extract(day from to_month) <> 1 or from_month > to_month then
    raise exception using errcode = 'PT422', message = 'INVALID_MONTH_RANGE';
  end if;
  if requested_scenario not in ('actual', 'budget', 'forecast')
    or requested_basis not in ('accrual', 'cash') then
    raise exception using errcode = 'PT422', message = 'INVALID_LEDGER_DIMENSION';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'entry_key', entry.entry_key,
    'month', to_char(entry.month, 'YYYY-MM'),
    'account_code', account.account_code,
    'account_name', account.name_ko,
    'statement_section', account.statement_section,
    'scenario', entry.scenario,
    'accounting_basis', entry.accounting_basis,
    'amount', entry.amount,
    'currency_code', entry.currency_code,
    'source_kind', entry.source_kind,
    'source_ref', entry.source_ref,
    'source_line_key', entry.source_line_key,
    'data_status', entry.data_status,
    'revision', entry.revision
  ) order by entry.month, account.display_order, entry.entry_key), '[]'::jsonb),
  coalesce(max(entry.revision), 0),
  count(entry.id)
  into entries, latest_revision, entry_count
  from logistics_core.monthly_ledger_entries entry
  join logistics_core.cashflow_accounts account on account.id = entry.account_id and account.deleted_at is null
  where entry.asset_id = resolved_asset_id
    and entry.month between from_month and to_month
    and entry.scenario = requested_scenario
    and entry.accounting_basis = requested_basis
    and entry.deleted_at is null;

  select coalesce(jsonb_agg(jsonb_build_object(
    'account_code', account.account_code,
    'name', account.name_ko,
    'account_kind', account.account_kind,
    'statement_section', account.statement_section,
    'normal_sign', account.normal_sign,
    'display_order', account.display_order
  ) order by account.display_order, account.account_code), '[]'::jsonb)
  into accounts
  from logistics_core.cashflow_accounts account
  where account.deleted_at is null and account.account_kind = 'atomic';

  select coalesce(jsonb_agg(jsonb_build_object(
    'loan_key', tranche.row_key,
    'fund_key', tranche.fund_id,
    'tranche', tranche.tranche,
    'lender_name', tranche.party_name,
    'committed_amount_krw', tranche.committed_amount_krw,
    'drawdown_date', tranche.drawdown_date,
    'maturity_date', tranche.maturity_date,
    'loan_period', tranche.loan_period,
    'loan_type', tranche.loan_type,
    'interest_type', tranche.interest_type,
    'base_rate', tranche.base_rate,
    'spread_rate', tranche.spread_rate,
    'loan_rate', tranche.loan_rate,
    'interest_rate', tranche.interest_rate,
    'fee', tranche.fee,
    'fee_rate', tranche.fee_rate,
    'all_in', tranche.all_in,
    'all_in_rate', tranche.all_in_rate,
    'source_status', 'canonical',
    'repayment_schedule', jsonb_build_object(
      'status', 'not_provided',
      'rows', '[]'::jsonb,
      'reason', 'SOURCE_HAS_NO_MONTHLY_REPAYMENT_SCHEDULE'
    )
  ) order by tranche.display_order, tranche.tranche, tranche.party_name), '[]'::jsonb)
  into loans
  from public.ll_fund_capital_tranches tranche
  where tranche.tranche_type = 'loan'
    and tranche.is_active = true
    and tranche.deleted_at is null
    and exists (
      select 1 from public.ll_fund_asset_links source_link
      where source_link.fund_id = tranche.fund_id
        and source_link.asset_id = legacy_asset_id
    );

  select coalesce(jsonb_agg(jsonb_build_object(
    'statement_section', totals.statement_section,
    'amount', totals.amount
  ) order by totals.statement_section), '[]'::jsonb)
  into waterfall
  from (
    select account.statement_section, sum(entry.amount * account.normal_sign) amount
    from logistics_core.monthly_ledger_entries entry
    join logistics_core.cashflow_accounts account on account.id = entry.account_id
    where entry.asset_id = resolved_asset_id
      and entry.month between from_month and to_month
      and entry.scenario = requested_scenario
      and entry.accounting_basis = requested_basis
      and entry.deleted_at is null
      and account.deleted_at is null
    group by account.statement_section
  ) totals;

  select definition.status, definition.version
  into formula_status, formula_version
  from logistics_core.formula_definitions definition
  where definition.formula_key = 'post_debt_cash_flow'
  order by definition.version desc
  limit 1;

  return logistics_core.primary_response(
    p_request_id,
    latest_revision,
    jsonb_build_object(
      'from_month', to_char(from_month, 'YYYY-MM'),
      'to_month', to_char(to_month, 'YYYY-MM'),
      'start_month', to_char(from_month, 'YYYY-MM'),
      'end_month', to_char(to_month, 'YYYY-MM'),
      'scenario', requested_scenario,
      'accounting_basis', requested_basis,
      'accounts', accounts,
      'loans', loans,
      'entries', entries,
      'finance_write_enabled', coalesce((write_status->>'write_enabled')::boolean, false),
      'write_enabled', coalesce((write_status->>'write_enabled')::boolean, false),
      'write_reason', write_status->>'write_reason',
      'data_status', case when entry_count = 0 then 'not_entered' else 'provided' end,
      'formula_status', coalesce(formula_status, 'draft'),
      'formula_version', coalesce(formula_version, 1),
      'formula_registry_version', 'gate6-logistics-core-1',
      'waterfall', waterfall,
      'derived_subtotals_stored', false,
      'calculation_authority', 'v2/calculations/explain'
    )
  );
end;
$body$;

create or replace function logistics_core.finance_batch_save_entry(
  p_request_id uuid,
  p_asset_key text,
  p_payload jsonb,
  p_expected_revisions jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, logistics_core, extensions
as $body$
declare
  v_actor_id uuid := logistics_core.request_actor();
  v_asset_id uuid := logistics_core.resolve_asset_id(p_asset_key);
  v_request_digest text := logistics_core.request_hash('v2/finance/batch-save', p_asset_key, p_payload, p_expected_revisions);
  v_cached_response jsonb;
  v_operation jsonb;
  v_operation_name text;
  v_entry_key text;
  v_expected_revision bigint;
  v_current_revision bigint;
  v_entity_id uuid;
  v_target_account_id uuid;
  v_account_code text;
  v_existing_account_code text;
  v_scenario text;
  v_accounting_basis text;
  v_amount_text text;
  v_amount numeric;
  v_reason text;
  v_before_row jsonb;
  v_after_row jsonb;
  v_export_payload jsonb;
  v_export_readback jsonb;
  v_changed_count integer := 0;
  v_final_revision bigint := 0;
  v_response jsonb;
begin
  perform logistics_core.assert_v2_writer_route(v_asset_id);
  v_cached_response := logistics_core.claim_idempotency(v_actor_id, 'v2/finance/batch-save', p_request_id, v_request_digest);
  if v_cached_response is not null then return v_cached_response; end if;
  if jsonb_typeof(p_payload->'operations') <> 'array' then
    raise exception using errcode = 'PT422', message = 'OPERATIONS_ARRAY_REQUIRED';
  end if;
  if jsonb_array_length(p_payload->'operations') > 1000 then
    raise exception using errcode = 'PT422', message = 'BATCH_LIMIT_EXCEEDED';
  end if;

  for v_operation in select value from jsonb_array_elements(p_payload->'operations')
  loop
    v_operation_name := nullif(v_operation->>'operation', '');
    v_entry_key := nullif(v_operation->>'entry_key', '');
    if v_operation_name not in ('create', 'update', 'delete') or v_entry_key is null then
      raise exception using errcode = 'PT422', message = 'INVALID_FINANCE_OPERATION';
    end if;
    perform logistics_core.assert_asset_permission(v_actor_id, v_asset_id, v_operation_name);
    v_before_row := null;
    v_reason := nullif(btrim(v_operation->>'reason'), '');
    if v_reason is null then
      raise exception using errcode = 'PT422', message = 'FINANCE_MUTATION_REASON_REQUIRED';
    end if;

    if v_operation_name in ('create', 'update') then
      if v_operation->'record' ? 'source_ref' then
        raise exception using errcode = 'PT422', message = 'CLIENT_SOURCE_METADATA_FORBIDDEN';
      end if;
      if v_operation->'record' ? 'source_kind' then
        raise exception using errcode = 'PT422', message = 'CLIENT_SOURCE_METADATA_FORBIDDEN';
      end if;
      if v_operation->'record' ? 'data_status' then
        raise exception using errcode = 'PT422', message = 'CLIENT_SOURCE_METADATA_FORBIDDEN';
      end if;

      v_scenario := nullif(btrim(v_operation->'record'->>'scenario'), '');
      if v_scenario is distinct from 'actual' then
        raise exception using errcode = 'PT422', message = 'FINANCE_ACTUAL_SCENARIO_REQUIRED';
      end if;

      v_account_code := nullif(btrim(v_operation->'record'->>'account_code'), '');
      if v_account_code is null or v_account_code not in ('MANUAL_REVENUE', 'MANUAL_COST', 'MANUAL_RECEIPT') then
        raise exception using errcode = 'PT422', message = 'MANUAL_ACCOUNT_REQUIRED';
      end if;

      v_accounting_basis := nullif(btrim(v_operation->'record'->>'accounting_basis'), '');
      if v_accounting_basis is null or v_accounting_basis not in ('accrual', 'cash') then
        raise exception using errcode = 'PT422', message = 'INVALID_ACCOUNTING_BASIS';
      end if;
      if v_account_code = 'MANUAL_RECEIPT' and v_accounting_basis is distinct from 'cash' then
        raise exception using errcode = 'PT422', message = 'MANUAL_RECEIPT_REQUIRES_CASH_BASIS';
      end if;

      v_amount_text := nullif(btrim(v_operation->'record'->>'amount'), '');
      if v_amount_text is null
         or v_amount_text !~ '^[+-]?([0-9]+([.][0-9]*)?|[.][0-9]+)([eE][+-]?[0-9]+)?$' then
        raise exception using errcode = 'PT422', message = 'FINITE_NUMERIC_AMOUNT_REQUIRED';
      end if;
      v_amount := v_amount_text::numeric;

      select account.id into v_target_account_id
      from logistics_core.cashflow_accounts account
      where account.account_code = v_account_code
        and account.account_kind = 'atomic'
        and account.deleted_at is null;
      if v_target_account_id is null then
        raise exception using errcode = 'PT422', message = 'MANUAL_ACCOUNT_REQUIRED';
      end if;
    end if;

    if v_operation_name = 'create' then
      insert into logistics_core.monthly_ledger_entries (
        entry_key, asset_id, month, account_id, scenario, accounting_basis, amount,
        currency_code, source_kind, source_ref, source_line_key, data_status, created_by, updated_by
      ) values (
        v_entry_key,
        v_asset_id,
        logistics_core.normalize_month(v_operation->'record'->>'month'),
        v_target_account_id,
        v_scenario,
        v_accounting_basis,
        v_amount,
        coalesce(nullif(v_operation->'record'->>'currency_code', ''), 'KRW'),
        'manual_input',
        'v2/finance/batch-save:' || p_request_id::text,
        coalesce(nullif(v_operation->'record'->>'source_line_key', ''), v_entry_key),
        'provided',
        v_actor_id,
        v_actor_id
      ) returning id, revision into v_entity_id, v_current_revision;
    else
      select entry.id, entry.revision, to_jsonb(entry), account.account_code
      into v_entity_id, v_current_revision, v_before_row, v_existing_account_code
      from logistics_core.monthly_ledger_entries entry
      join logistics_core.cashflow_accounts account on account.id = entry.account_id
      where entry.entry_key = v_entry_key and entry.asset_id = v_asset_id
      for update;
      if v_entity_id is null then raise exception using errcode = 'PT404', message = 'NOT_FOUND'; end if;
      if v_before_row->>'source_kind' is distinct from 'manual_input'
         or v_before_row->>'scenario' is distinct from 'actual'
         or v_existing_account_code not in ('MANUAL_REVENUE', 'MANUAL_COST', 'MANUAL_RECEIPT') then
        raise exception using errcode = 'PT422', message = 'MANUAL_ACTUAL_ENTRY_REQUIRED';
      end if;
      if v_existing_account_code = 'MANUAL_RECEIPT'
         and v_before_row->>'accounting_basis' is distinct from 'cash' then
        raise exception using errcode = 'PT422', message = 'MANUAL_RECEIPT_REQUIRES_CASH_BASIS';
      end if;
      v_expected_revision := logistics_core.expected_revision(v_operation, p_expected_revisions, v_entry_key);
      if v_current_revision <> v_expected_revision then raise exception using errcode = 'PT409', message = 'REVISION_CONFLICT'; end if;
      if v_operation_name = 'delete' then
        update logistics_core.monthly_ledger_entries
        set deleted_at = now(), deleted_by = v_actor_id
        where id = v_entity_id returning revision into v_current_revision;
      else
        update logistics_core.monthly_ledger_entries
        set month = logistics_core.normalize_month(v_operation->'record'->>'month'),
            account_id = v_target_account_id,
            scenario = v_scenario,
            accounting_basis = v_accounting_basis,
            amount = v_amount,
            currency_code = coalesce(nullif(v_operation->'record'->>'currency_code', ''), currency_code),
            source_kind = 'manual_input',
            source_ref = 'v2/finance/batch-save:' || p_request_id::text,
            data_status = 'provided',
            updated_by = v_actor_id
        where id = v_entity_id returning revision into v_current_revision;
      end if;
    end if;

    select to_jsonb(entry) into v_after_row
    from logistics_core.monthly_ledger_entries entry where entry.id = v_entity_id;
    if v_after_row is null then raise exception using errcode = 'PT500', message = 'READBACK_MISMATCH'; end if;

    v_export_payload := jsonb_build_object(
      'rollback_mode', 'core_retained',
      'entry', v_after_row,
      'account_code', coalesce(v_account_code, v_existing_account_code),
      'client_request_id', p_request_id
    );
    insert into logistics_core.rollback_export_state (
      entity_type, entity_id, asset_id, export_key, export_payload, export_hash,
      retained_in_core, readback_status, client_request_id, verified_at,
      created_by, updated_by
    ) values (
      'monthly_ledger_entry', v_entity_id, v_asset_id, v_entry_key, v_export_payload,
      logistics_core.json_sha256(v_export_payload), true, 'verified', p_request_id, now(),
      v_actor_id, v_actor_id
    ) on conflict (entity_type, entity_id) do update set
      asset_id = excluded.asset_id,
      export_key = excluded.export_key,
      export_payload = excluded.export_payload,
      export_hash = excluded.export_hash,
      retained_in_core = excluded.retained_in_core,
      readback_status = excluded.readback_status,
      client_request_id = excluded.client_request_id,
      verified_at = excluded.verified_at,
      updated_by = excluded.updated_by;

    select state.export_payload into v_export_readback
    from logistics_core.rollback_export_state state
    where state.entity_type = 'monthly_ledger_entry' and state.entity_id = v_entity_id;
    if v_export_readback is null
       or logistics_core.json_sha256(v_export_readback) <> logistics_core.json_sha256(v_export_payload) then
      raise exception using errcode = 'PT500', message = 'READBACK_MISMATCH';
    end if;

    insert into logistics_core.audit_events (
      actor_user_id, action, entity_type, entity_id, asset_id, entity_revision,
      before_hash, after_hash, change_payload, reason, client_request_id,
      mapping_version, correlation_id
    ) values (
      v_actor_id,
      v_operation_name,
      'monthly_ledger_entry',
      v_entity_id,
      v_asset_id,
      v_current_revision,
      case when v_before_row is null then null else logistics_core.json_sha256(v_before_row) end,
      logistics_core.json_sha256(v_after_row),
      jsonb_build_object('entry_key', v_entry_key, 'operation', v_operation_name),
      v_reason,
      p_request_id,
      'gate6-data-platform-1',
      p_request_id
    );
    v_changed_count := v_changed_count + 1;
    v_final_revision := greatest(v_final_revision, v_current_revision);
  end loop;

  if v_changed_count <> (
    select count(*) from logistics_core.audit_events event
    where event.client_request_id = p_request_id and event.actor_user_id = v_actor_id
  ) then
    raise exception using errcode = 'PT500', message = 'READBACK_MISMATCH';
  end if;

  v_response := logistics_core.primary_response(
    p_request_id,
    v_final_revision,
    jsonb_build_object(
      'changed_count', v_changed_count,
      'readback', 'verified',
      'rollback_export', 'verified',
      'derived_subtotals_stored', false
    )
  );
  perform logistics_core.complete_idempotency(v_actor_id, 'v2/finance/batch-save', p_request_id, v_response);
  return v_response;
end;
$body$;

create or replace function logistics_core.maturities_read_entry(
  p_request_id uuid,
  p_asset_key text,
  p_payload jsonb,
  p_expected_revisions jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, logistics_core, public
as $body$
declare
  actor_id uuid := logistics_core.request_actor();
  resolved_asset_id uuid := logistics_core.resolve_asset_id(p_asset_key);
  actor_email text;
  legacy_asset_id text;
  from_date date := coalesce(nullif(p_payload->>'from_date', '')::date, current_date);
  to_date date := coalesce(nullif(p_payload->>'to_date', '')::date, current_date + 365);
  rows jsonb;
  alerts jsonb;
  latest_revision bigint;
begin
  perform logistics_core.assert_asset_permission(actor_id, resolved_asset_id, 'read');
  if from_date > to_date then raise exception using errcode = 'PT422', message = 'INVALID_DATE_RANGE'; end if;

  select email into actor_email from auth.users where id = actor_id;
  select asset.public_key into legacy_asset_id from logistics_core.assets asset where asset.id = resolved_asset_id;

  insert into public.ll_notifications (
    notification_type, dedupe_key, asset_id, title, body, due_date, lead_days,
    recipient_user_id, recipient_email, delivery_status, notified_at
  )
  select
    case when maturity.maturity_type = 'loan' then 'loan_maturity'
         when maturity.maturity_type = 'lease' then 'lease_maturity'
         else 'data_update' end,
    'v2:maturity:' || maturity.maturity_key || ':' || maturity.revision::text || ':' ||
      (case
        when maturity.official_date - current_date <= 0 then 0
        when maturity.official_date - current_date <= 1 then 1
        when maturity.official_date - current_date <= 3 then 3
        when maturity.official_date - current_date <= 7 then 7
        else 30
      end)::text || ':' || actor_id::text,
    legacy_asset_id,
    case when maturity.maturity_type = 'loan' then '대출 만기'
         when maturity.maturity_type = 'lease' then '임대차 만기'
         else '펀드 만기' end,
    maturity.target_name_ko || ' 만기일은 ' || maturity.official_date::text || '입니다.',
    maturity.official_date,
    case
      when maturity.official_date - current_date <= 0 then 0
      when maturity.official_date - current_date <= 1 then 1
      when maturity.official_date - current_date <= 3 then 3
      when maturity.official_date - current_date <= 7 then 7
      else 30
    end,
    actor_id,
    actor_email,
    'unread',
    now()
  from logistics_core.maturities maturity
  where maturity.deleted_at is null
    and maturity.status = 'active'
    and maturity.official_date between current_date and current_date + 30
    and (
      maturity.asset_id = resolved_asset_id
      or exists (
        select 1 from logistics_core.maturity_asset_scopes scope
        where scope.maturity_id = maturity.id
          and scope.asset_id = resolved_asset_id
          and scope.retired_at is null
      )
    )
  on conflict (dedupe_key) do nothing;

  select coalesce(jsonb_agg(jsonb_build_object(
    'maturity_key', maturity.maturity_key,
    'type', maturity.maturity_type,
    'target_name', maturity.target_name_ko,
    'official_date', maturity.official_date,
    'days_remaining', maturity.official_date - current_date,
    'status', maturity.status,
    'revision', maturity.revision
  ) order by maturity.official_date, maturity.maturity_key), '[]'::jsonb),
  coalesce(max(maturity.revision), 0)
  into rows, latest_revision
  from logistics_core.maturities maturity
  where (
      maturity.asset_id = resolved_asset_id
      or exists (
        select 1 from logistics_core.maturity_asset_scopes scope
        where scope.maturity_id = maturity.id
          and scope.asset_id = resolved_asset_id
          and scope.retired_at is null
      )
    )
    and maturity.official_date between from_date and to_date
    and maturity.deleted_at is null;

  select coalesce(jsonb_agg(jsonb_build_object(
    'notification_id', notification.notification_id,
    'type', notification.notification_type,
    'title', notification.title,
    'body', notification.body,
    'due_date', notification.due_date,
    'lead_days', notification.lead_days,
    'status', notification.delivery_status,
    'read_at', notification.read_at,
    'dismissed_at', notification.dismissed_at
  ) order by notification.due_date, notification.notification_id), '[]'::jsonb)
  into alerts
  from public.ll_notifications notification
  where notification.recipient_user_id = actor_id
    and notification.asset_id = legacy_asset_id
    and notification.delivery_status <> 'dismissed';

  return logistics_core.primary_response(
    p_request_id,
    latest_revision,
    jsonb_build_object(
      'from_date', from_date,
      'to_date', to_date,
      'maturities', rows,
      'in_app_alerts', alerts,
      'delivery_channel', 'in_app_only'
    )
  );
end;
$body$;

create or replace function logistics_core.calculations_explain_entry(
  p_request_id uuid,
  p_asset_key text,
  p_payload jsonb,
  p_expected_revisions jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, logistics_core
as $body$
declare
  actor_id uuid := logistics_core.request_actor();
  resolved_asset_id uuid := logistics_core.resolve_asset_id(p_asset_key);
  from_month date := coalesce(logistics_core.normalize_month(p_payload->>'from_month'), date_trunc('year', current_date)::date);
  to_month date := coalesce(logistics_core.normalize_month(p_payload->>'to_month'), date_trunc('month', current_date)::date);
  requested_scenario text := coalesce(nullif(p_payload->>'scenario', ''), 'actual');
  requested_basis text := coalesce(nullif(p_payload->>'accounting_basis', ''), 'accrual');
  potential numeric := 0;
  loss numeric := 0;
  other_operating numeric := 0;
  operating numeric := 0;
  below_noi numeric := 0;
  debt numeric := 0;
  effective_gross numeric := 0;
  noi numeric := 0;
  asset_ncf numeric := 0;
  post_debt numeric := 0;
  formulas jsonb;
  latest_revision bigint;
begin
  perform logistics_core.assert_asset_permission(actor_id, resolved_asset_id, 'read');
  if extract(day from from_month) <> 1 or extract(day from to_month) <> 1 or from_month > to_month then
    raise exception using errcode = 'PT422', message = 'INVALID_MONTH_RANGE';
  end if;
  if requested_scenario not in ('actual', 'budget', 'forecast')
    or requested_basis not in ('accrual', 'cash') then
    raise exception using errcode = 'PT422', message = 'INVALID_LEDGER_DIMENSION';
  end if;

  select
    coalesce(sum(entry.amount) filter (where account.statement_section = 'potential_income'), 0),
    coalesce(sum(entry.amount) filter (where account.statement_section = 'income_loss'), 0),
    coalesce(sum(entry.amount) filter (where account.statement_section = 'other_operating_income'), 0),
    coalesce(sum(entry.amount) filter (where account.statement_section = 'operating_expense'), 0),
    coalesce(sum(entry.amount) filter (where account.statement_section = 'below_noi'), 0),
    coalesce(sum(entry.amount) filter (where account.statement_section = 'debt_service'), 0),
    coalesce(max(entry.revision), 0)
  into potential, loss, other_operating, operating, below_noi, debt, latest_revision
  from logistics_core.monthly_ledger_entries entry
  join logistics_core.cashflow_accounts account on account.id = entry.account_id
  where entry.asset_id = resolved_asset_id
    and entry.month between from_month and to_month
    and entry.scenario = requested_scenario
    and entry.accounting_basis = requested_basis
    and entry.deleted_at is null
    and account.deleted_at is null
    and account.account_kind = 'atomic';

  effective_gross := potential - loss + other_operating;
  noi := effective_gross - operating;
  asset_ncf := noi - below_noi;
  if exists (
    select 1 from logistics_core.formula_definitions definition
    where definition.formula_key = 'post_debt_cash_flow'
      and definition.status = 'approved'
      and definition.effective_from <= to_month
      and (definition.effective_to is null or definition.effective_to >= from_month)
  ) then
    post_debt := asset_ncf - debt;
  else
    post_debt := null;
  end if;

  select coalesce(jsonb_object_agg(definition.formula_key, jsonb_build_object(
    'version', definition.version,
    'name', definition.name_ko,
    'description', definition.description_ko,
    'expression', definition.expression_ast,
    'rounding', definition.rounding_contract,
    'authority_reference', definition.authority_reference
  )), '{}'::jsonb)
  into formulas
  from logistics_core.formula_definitions definition
  where definition.status = 'approved'
    and definition.effective_from <= to_month
    and (definition.effective_to is null or definition.effective_to >= from_month);

  return logistics_core.primary_response(
    p_request_id,
    latest_revision,
    jsonb_build_object(
      'authority', 'v2/calculations/explain',
      'formula_registry_version', 'gate6-logistics-core-1',
      'scenario', requested_scenario,
      'accounting_basis', requested_basis,
      'from_month', to_char(from_month, 'YYYY-MM'),
      'to_month', to_char(to_month, 'YYYY-MM'),
      'results', jsonb_build_object(
        'potential_gross_income', potential,
        'income_loss', loss,
        'effective_gross_income', effective_gross,
        'operating_expense', operating,
        'net_operating_income', noi,
        'asset_net_cash_flow', asset_ncf,
        'post_debt_cash_flow', post_debt,
        'post_debt_cash_flow_status', case when post_debt is null then 'formula_not_approved' else 'provided' end
      ),
      'formulas', formulas,
      'derived_subtotals_stored', false
    )
  );
end;
$body$;

revoke all on all functions in schema logistics_core from public, anon, authenticated;

create or replace function logistics_api.home_read(
  p_request_id uuid,
  p_asset_key text,
  p_payload jsonb,
  p_expected_revisions jsonb
)
returns jsonb
language sql
security definer
set search_path = ''
as $function$
  select logistics_core.home_read_entry(p_request_id, p_asset_key, p_payload, p_expected_revisions);
$function$;

create or replace function logistics_api.rent_roll_read(
  p_request_id uuid,
  p_asset_key text,
  p_payload jsonb,
  p_expected_revisions jsonb
)
returns jsonb
language sql
security definer
set search_path = ''
as $function$
  select logistics_core.rent_roll_read_entry(p_request_id, p_asset_key, p_payload, p_expected_revisions);
$function$;

create or replace function logistics_api.rent_roll_batch_save(
  p_request_id uuid,
  p_asset_key text,
  p_payload jsonb,
  p_expected_revisions jsonb
)
returns jsonb
language sql
security definer
set search_path = ''
as $function$
  select logistics_core.rent_roll_batch_save_entry(p_request_id, p_asset_key, p_payload, p_expected_revisions);
$function$;

create or replace function logistics_api.finance_read(
  p_request_id uuid,
  p_asset_key text,
  p_payload jsonb,
  p_expected_revisions jsonb
)
returns jsonb
language sql
security definer
set search_path = ''
as $function$
  select logistics_core.finance_read_entry(p_request_id, p_asset_key, p_payload, p_expected_revisions);
$function$;

create or replace function logistics_api.finance_batch_save(
  p_request_id uuid,
  p_asset_key text,
  p_payload jsonb,
  p_expected_revisions jsonb
)
returns jsonb
language sql
security definer
set search_path = ''
as $function$
  select logistics_core.finance_batch_save_entry(p_request_id, p_asset_key, p_payload, p_expected_revisions);
$function$;

create or replace function logistics_api.maturities_read(
  p_request_id uuid,
  p_asset_key text,
  p_payload jsonb,
  p_expected_revisions jsonb
)
returns jsonb
language sql
security definer
set search_path = ''
as $function$
  select logistics_core.maturities_read_entry(p_request_id, p_asset_key, p_payload, p_expected_revisions);
$function$;

create or replace function logistics_api.calculations_explain(
  p_request_id uuid,
  p_asset_key text,
  p_payload jsonb,
  p_expected_revisions jsonb
)
returns jsonb
language sql
security definer
set search_path = ''
as $function$
  select logistics_core.calculations_explain_entry(p_request_id, p_asset_key, p_payload, p_expected_revisions);
$function$;

revoke all on function logistics_api.home_read(uuid, text, jsonb, jsonb) from public, anon;
revoke all on function logistics_api.rent_roll_read(uuid, text, jsonb, jsonb) from public, anon;
revoke all on function logistics_api.rent_roll_batch_save(uuid, text, jsonb, jsonb) from public, anon;
revoke all on function logistics_api.finance_read(uuid, text, jsonb, jsonb) from public, anon;
revoke all on function logistics_api.finance_batch_save(uuid, text, jsonb, jsonb) from public, anon;
revoke all on function logistics_api.maturities_read(uuid, text, jsonb, jsonb) from public, anon;
revoke all on function logistics_api.calculations_explain(uuid, text, jsonb, jsonb) from public, anon;

grant execute on function logistics_api.home_read(uuid, text, jsonb, jsonb) to authenticated;
grant execute on function logistics_api.rent_roll_read(uuid, text, jsonb, jsonb) to authenticated;
grant execute on function logistics_api.finance_read(uuid, text, jsonb, jsonb) to authenticated;
grant execute on function logistics_api.maturities_read(uuid, text, jsonb, jsonb) to authenticated;
grant execute on function logistics_api.calculations_explain(uuid, text, jsonb, jsonb) to authenticated;

commit;
