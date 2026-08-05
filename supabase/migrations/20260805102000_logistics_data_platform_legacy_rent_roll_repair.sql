begin;

set local lock_timeout = '5s';
set local statement_timeout = '120s';

-- LOGISTICS_DATA_PLATFORM_LEGACY_RENT_ROLL_REPAIR
-- Repair only fields that are present in public.ll_* but were missed because
-- the first normalized backfill referenced non-existent legacy column names.
-- Existing user-entered values win; no dates, commitments, or lease terms are
-- synthesized.

update logistics_core.tenants tenant
set legal_name_ko = coalesce(
      nullif(legacy_tenant.tenant_master_name, ''),
      nullif(legacy_tenant.raw_tenant_name, ''),
      tenant.legal_name_ko
    ),
    business_registration_number = coalesce(
      tenant.business_registration_number,
      nullif(legacy_tenant.business_registration_no, '')
    )
from public.ll_tenants legacy_tenant
where tenant.tenant_key = legacy_tenant.tenant_id
  and tenant.deleted_at is null
  and (
    tenant.legal_name_ko is distinct from coalesce(
      nullif(legacy_tenant.tenant_master_name, ''),
      nullif(legacy_tenant.raw_tenant_name, ''),
      tenant.legal_name_ko
    )
    or tenant.business_registration_number is distinct from coalesce(
      tenant.business_registration_number,
      nullif(legacy_tenant.business_registration_no, '')
    )
  );

update logistics_core.lease_contracts contract
set signed_date = coalesce(
      contract.signed_date,
      legacy_lease.recent_contract_date,
      legacy_lease.first_contract_date
    ),
    operation_start_date = coalesce(contract.operation_start_date, legacy_lease.first_operation_date),
    renewal_terms = coalesce(nullif(contract.renewal_terms, ''), nullif(legacy_lease.renewal_option, '')),
    termination_terms = coalesce(nullif(contract.termination_terms, ''), nullif(legacy_lease.early_termination_right, ''))
from public.ll_leases legacy_lease
where contract.contract_key = legacy_lease.lease_id
  and contract.deleted_at is null
  and (
    contract.signed_date is distinct from coalesce(contract.signed_date, legacy_lease.recent_contract_date, legacy_lease.first_contract_date)
    or contract.operation_start_date is distinct from coalesce(contract.operation_start_date, legacy_lease.first_operation_date)
    or contract.renewal_terms is distinct from coalesce(nullif(contract.renewal_terms, ''), nullif(legacy_lease.renewal_option, ''))
    or contract.termination_terms is distinct from coalesce(nullif(contract.termination_terms, ''), nullif(legacy_lease.early_termination_right, ''))
  );

update logistics_core.spaces space
set floor_label = coalesce(nullif(space.floor_label, ''), nullif(legacy_space.floor_label, '')),
    zone_label = coalesce(nullif(space.zone_label, ''), nullif(legacy_space.detail_area_label, '')),
    use_type = coalesce(
      nullif(space.use_type, ''),
      nullif(legacy_space.temperature_type, ''),
      nullif(legacy_space.goods_type, '')
    ),
    use_category = coalesce(
      nullif(space.use_category, ''),
      nullif(concat_ws(' · ', nullif(legacy_space.temperature_type, ''), nullif(legacy_space.goods_type, '')), '')
    ),
    leased_area_sqm = coalesce(space.leased_area_sqm, legacy_space.leased_area_sqm),
    exclusive_area_sqm = coalesce(space.exclusive_area_sqm, legacy_space.exclusive_area_sqm),
    efficiency_ratio = coalesce(space.efficiency_ratio, legacy_space.exclusive_ratio),
    occupancy_status = case
      when lower(coalesce(legacy_lease.lease_status, '')) = 'vacant'
        or lower(coalesce(legacy_space.contract_status, '')) = 'vacant'
        then 'vacant'
      else space.occupancy_status
    end
from public.ll_lease_spaces legacy_space
left join public.ll_leases legacy_lease on legacy_lease.lease_id = legacy_space.lease_id
where space.space_key = legacy_space.lease_space_id
  and space.deleted_at is null
  and (
    nullif(space.floor_label, '') is null
    or nullif(space.zone_label, '') is null
    or nullif(space.use_type, '') is null
    or nullif(space.use_category, '') is null
    or space.leased_area_sqm is null
    or space.exclusive_area_sqm is null
    or space.efficiency_ratio is null
    or (
      space.occupancy_status <> 'vacant'
      and (
        lower(coalesce(legacy_lease.lease_status, '')) = 'vacant'
        or lower(coalesce(legacy_space.contract_status, '')) = 'vacant'
      )
    )
  );

with latest_terms as (
  select
    rent_term.id as rent_term_id,
    rent_term.rent_free_months,
    rent_term.fit_out_months,
    rent_term.tenant_improvement_amount,
    rent_term.rent_escalation_rule,
    rent_term.cam_escalation_rule,
    rent_term.tenant_cost_terms,
    rent_term.updated_by,
    legacy_lease.rf_months,
    legacy_lease.fo_months,
    legacy_lease.ti_amount,
    legacy_lease.rent_escalation_rate,
    legacy_lease.management_fee_escalation_rate,
    legacy_lease.escalation_cycle_months,
    legacy_lease.next_escalation_date,
    legacy_lease.tenant_cost_burden,
    row_number() over (
      partition by allocation.id
      order by rent_term.effective_from_month desc nulls last, rent_term.revision desc, rent_term.id
    ) as term_rank
  from logistics_core.rent_terms rent_term
  join logistics_core.contract_spaces allocation on allocation.id = rent_term.contract_space_id
  join logistics_core.lease_contracts contract on contract.id = allocation.contract_id
  join public.ll_leases legacy_lease on legacy_lease.lease_id = contract.contract_key
  where rent_term.deleted_at is null
    and allocation.deleted_at is null
    and contract.deleted_at is null
)
update logistics_core.rent_terms rent_term
set rent_free_months = case
      when latest.updated_by is null and latest.rent_free_months = 0 and latest.rf_months is not null
        then latest.rf_months
      else rent_term.rent_free_months
    end,
    fit_out_months = coalesce(rent_term.fit_out_months, latest.fo_months),
    tenant_improvement_amount = coalesce(rent_term.tenant_improvement_amount, latest.ti_amount),
    rent_escalation_rule = case
      when rent_term.rent_escalation_rule = '{}'::jsonb
        and (
          latest.rent_escalation_rate is not null
          or latest.escalation_cycle_months is not null
          or latest.next_escalation_date is not null
        )
        then jsonb_strip_nulls(jsonb_build_object(
          'raw_rate', latest.rent_escalation_rate,
          'cycle_months', latest.escalation_cycle_months,
          'next_date', latest.next_escalation_date,
          'source_table', 'public.ll_leases',
          'source_column', 'rent_escalation_rate'
        ))
      else rent_term.rent_escalation_rule
    end,
    cam_escalation_rule = case
      when rent_term.cam_escalation_rule = '{}'::jsonb
        and (
          latest.management_fee_escalation_rate is not null
          or latest.escalation_cycle_months is not null
          or latest.next_escalation_date is not null
        )
        then jsonb_strip_nulls(jsonb_build_object(
          'raw_rate', latest.management_fee_escalation_rate,
          'cycle_months', latest.escalation_cycle_months,
          'next_date', latest.next_escalation_date,
          'source_table', 'public.ll_leases',
          'source_column', 'management_fee_escalation_rate'
        ))
      else rent_term.cam_escalation_rule
    end,
    tenant_cost_terms = case
      when rent_term.tenant_cost_terms = '{}'::jsonb and nullif(latest.tenant_cost_burden, '') is not null
        then jsonb_build_object(
          'raw_text', latest.tenant_cost_burden,
          'source_table', 'public.ll_leases',
          'source_column', 'tenant_cost_burden'
        )
      else rent_term.tenant_cost_terms
    end
from latest_terms latest
where rent_term.id = latest.rent_term_id
  and latest.term_rank = 1
  and (
    (latest.updated_by is null and latest.rent_free_months = 0 and latest.rf_months is not null)
    or (rent_term.fit_out_months is null and latest.fo_months is not null)
    or (rent_term.tenant_improvement_amount is null and latest.ti_amount is not null)
    or (rent_term.rent_escalation_rule = '{}'::jsonb and latest.rent_escalation_rate is not null)
    or (rent_term.cam_escalation_rule = '{}'::jsonb and latest.management_fee_escalation_rate is not null)
    or (rent_term.tenant_cost_terms = '{}'::jsonb and nullif(latest.tenant_cost_burden, '') is not null)
  );

do $rename_ui_projection_v2$
begin
  if to_regprocedure('logistics_core.home_read_entry_v2(uuid,text,jsonb,jsonb)') is null then
    execute 'alter function logistics_core.home_read_entry(uuid, text, jsonb, jsonb) rename to home_read_entry_v2';
  end if;
  if to_regprocedure('logistics_core.rent_roll_read_entry_v2(uuid,text,jsonb,jsonb)') is null then
    execute 'alter function logistics_core.rent_roll_read_entry(uuid, text, jsonb, jsonb) rename to rent_roll_read_entry_v2';
  end if;
end;
$rename_ui_projection_v2$;

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
set search_path = pg_catalog, logistics_core
as $body$
declare
  base_response jsonb;
  investment_rows jsonb := '[]'::jsonb;
  resolved_asset_id uuid;
  tenant_summary jsonb := '{}'::jsonb;
begin
  base_response := logistics_core.home_read_entry_v2(
    p_request_id, p_asset_key, p_payload, p_expected_revisions
  );

  select coalesce(jsonb_agg(
    investment.value || jsonb_build_object(
      'invested_amount_krw', investment.value->'committed_amount_krw',
      'commitment_amount_krw', null,
      'commitment_source_status', 'not_provided'
    ) order by investment.ordinality
  ), '[]'::jsonb)
  into investment_rows
  from jsonb_array_elements(coalesce(base_response #> '{data,investments}', '[]'::jsonb))
    with ordinality as investment(value, ordinality);

  if nullif(btrim(p_asset_key), '') is not null then
    resolved_asset_id := logistics_core.resolve_asset_id(p_asset_key);
    select jsonb_build_object(
      'space_count', count(space.id),
      'occupied_space_count', count(space.id) filter (where space.occupancy_status = 'occupied'),
      'vacant_space_count', count(space.id) filter (where space.occupancy_status = 'vacant'),
      'active_tenant_count', count(distinct contract.tenant_id) filter (where space.occupancy_status = 'occupied'),
      'occupied_area_sqm', sum(coalesce(space.leased_area_sqm, allocation.allocated_leasable_area_sqm))
        filter (where space.occupancy_status = 'occupied'),
      'nearest_lease_expiry', min(contract.expiry_date)
        filter (where space.occupancy_status = 'occupied' and contract.expiry_date >= current_date),
      'data_status', 'primary'
    )
    into tenant_summary
    from logistics_core.spaces space
    left join lateral (
      select candidate.*
      from logistics_core.contract_spaces candidate
      where candidate.space_id = space.id and candidate.deleted_at is null
      order by candidate.effective_from desc nulls last, candidate.id
      limit 1
    ) allocation on true
    left join logistics_core.lease_contracts contract
      on contract.id = allocation.contract_id and contract.deleted_at is null
    where space.asset_id = resolved_asset_id and space.deleted_at is null;
  end if;

  base_response := jsonb_set(base_response, '{data,investments}', investment_rows, true);
  base_response := jsonb_set(base_response, '{data,tenant_summary}', coalesce(tenant_summary, '{}'::jsonb), true);
  return base_response;
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
set search_path = pg_catalog, logistics_core, public
as $body$
declare
  base_response jsonb;
  enriched_rows jsonb := '[]'::jsonb;
begin
  base_response := logistics_core.rent_roll_read_entry_v2(
    p_request_id, p_asset_key, p_payload, p_expected_revisions
  );

  select coalesce(jsonb_agg(
    row_item.value
      || jsonb_strip_nulls(jsonb_build_object(
        'tenant_name', coalesce(
          nullif(legacy_tenant.tenant_master_name, ''),
          nullif(legacy_tenant.raw_tenant_name, ''),
          nullif(row_item.value->>'tenant_name', '')
        ),
        'business_registration_number', coalesce(
          nullif(row_item.value->>'business_registration_number', ''),
          nullif(legacy_tenant.business_registration_no, '')
        ),
        'floor_label', coalesce(nullif(row_item.value->>'floor_label', ''), legacy_space.floor_label),
        'zone_label', coalesce(nullif(row_item.value->>'zone_label', ''), legacy_space.detail_area_label),
        'use_category', coalesce(
          nullif(row_item.value->>'use_category', ''),
          nullif(concat_ws(' · ', nullif(legacy_space.temperature_type, ''), nullif(legacy_space.goods_type, '')), '')
        ),
        'leased_area_sqm', coalesce(nullif(row_item.value->>'leased_area_sqm', '')::numeric, legacy_space.leased_area_sqm),
        'exclusive_area_sqm', coalesce(nullif(row_item.value->>'exclusive_area_sqm', '')::numeric, legacy_space.exclusive_area_sqm),
        'efficiency_ratio', coalesce(nullif(row_item.value->>'efficiency_ratio', '')::numeric, legacy_space.exclusive_ratio),
        'commencement_date', coalesce(nullif(row_item.value->>'commencement_date', '')::date, legacy_lease.current_start_date),
        'expiry_date', coalesce(nullif(row_item.value->>'expiry_date', '')::date, legacy_lease.current_end_date),
        'operation_start_date', coalesce(nullif(row_item.value->>'operation_start_date', '')::date, legacy_lease.first_operation_date),
        'monthly_rent_total_krw', coalesce(
          nullif(row_item.value->>'monthly_rent_total_krw', '')::numeric,
          legacy_space.current_monthly_rent_total
        ),
        'monthly_cam_total_krw', coalesce(
          nullif(row_item.value->>'monthly_cam_total_krw', '')::numeric,
          legacy_space.current_monthly_mf_total
        ),
        'current_total_cost_per_py_krw', legacy_space.e_noc,
        'tenant_improvement_amount', legacy_lease.ti_amount,
        'source_status', case
          when (
            nullif(row_item.value->>'monthly_rent_total_krw', '') is null
            and legacy_space.current_monthly_rent_total is not null
          ) or (
            nullif(row_item.value->>'monthly_cam_total_krw', '') is null
            and legacy_space.current_monthly_mf_total is not null
          ) then 'legacy_current_snapshot'
          else nullif(row_item.value->>'source_status', '')
        end,
        'effective_date_status', case
          when (
            nullif(row_item.value->>'monthly_rent_total_krw', '') is null
            and legacy_space.current_monthly_rent_total is not null
          ) or (
            nullif(row_item.value->>'monthly_cam_total_krw', '') is null
            and legacy_space.current_monthly_mf_total is not null
          ) then 'not_provided'
          else nullif(row_item.value->>'effective_date_status', '')
        end
      ))
    order by row_item.ordinality
  ), '[]'::jsonb)
  into enriched_rows
  from jsonb_array_elements(coalesce(base_response #> '{data,rows}', '[]'::jsonb))
    with ordinality as row_item(value, ordinality)
  left join public.ll_lease_spaces legacy_space
    on legacy_space.lease_space_id = row_item.value->>'space_key'
  left join public.ll_leases legacy_lease
    on legacy_lease.lease_id = legacy_space.lease_id
  left join public.ll_tenants legacy_tenant
    on legacy_tenant.tenant_id = legacy_space.tenant_id;

  base_response := jsonb_set(base_response, '{data,rows}', enriched_rows, true);
  return base_response;
end;
$body$;

revoke all on function logistics_core.home_read_entry_v2(uuid, text, jsonb, jsonb) from public, anon, authenticated;
revoke all on function logistics_core.rent_roll_read_entry_v2(uuid, text, jsonb, jsonb) from public, anon, authenticated;
revoke all on function logistics_core.home_read_entry(uuid, text, jsonb, jsonb) from public, anon, authenticated;
revoke all on function logistics_core.rent_roll_read_entry(uuid, text, jsonb, jsonb) from public, anon, authenticated;

notify pgrst, 'reload schema';

commit;
