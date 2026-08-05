begin;

set local lock_timeout = '5s';
set local statement_timeout = '120s';

-- LOGISTICS_DATA_PLATFORM_UI_PROJECTION_V2
-- Keep public.ll_* canonical and unchanged. This migration only repairs the
-- private normalized projection and extends the existing RPC response shape.

alter table logistics_core.spaces
  add column if not exists display_order integer;

comment on column logistics_core.spaces.display_order is
  'Asset-scoped rent-roll row order chosen by an authorized user.';

update logistics_core.tenants tenant
set legal_name_ko = coalesce(
      nullif(source.source_row->>'tenant_master_name', ''),
      nullif(source.source_row->>'raw_tenant_name', ''),
      nullif(source.source_row->>'tenant_name', ''),
      nullif(source.source_row->>'legal_name', ''),
      tenant.legal_name_ko
    ),
    business_registration_number = coalesce(
      nullif(source.source_row->>'business_registration_number', ''),
      nullif(source.source_row->>'business_number', ''),
      tenant.business_registration_number
    )
from (
  select to_jsonb(legacy_tenant) as source_row
  from public.ll_tenants legacy_tenant
) source
where tenant.tenant_key = source.source_row->>'tenant_id'
  and tenant.deleted_at is null
  and (
    tenant.legal_name_ko is distinct from coalesce(
      nullif(source.source_row->>'tenant_master_name', ''),
      nullif(source.source_row->>'raw_tenant_name', ''),
      nullif(source.source_row->>'tenant_name', ''),
      nullif(source.source_row->>'legal_name', ''),
      tenant.legal_name_ko
    )
    or tenant.business_registration_number is distinct from coalesce(
      nullif(source.source_row->>'business_registration_number', ''),
      nullif(source.source_row->>'business_number', ''),
      tenant.business_registration_number
    )
  );

update logistics_core.spaces space
set floor_label = coalesce(
      nullif(source.source_row->>'floor_label', ''),
      nullif(source.source_row->>'floor', ''),
      space.floor_label
    ),
    zone_label = coalesce(
      nullif(source.source_row->>'detail_area_label', ''),
      nullif(source.source_row->>'zone_label', ''),
      nullif(source.source_row->>'zone', ''),
      space.zone_label
    ),
    use_type = coalesce(
      nullif(source.source_row->>'temperature_type', ''),
      nullif(source.source_row->>'goods_type', ''),
      nullif(source.source_row->>'use_type', ''),
      nullif(source.source_row->>'use_category', ''),
      space.use_type
    ),
    use_category = coalesce(
      nullif(concat_ws(
        ' · ',
        nullif(source.source_row->>'temperature_type', ''),
        nullif(source.source_row->>'goods_type', '')
      ), ''),
      nullif(source.source_row->>'use_category', ''),
      nullif(source.source_row->>'use_type', ''),
      space.use_category
    ),
    efficiency_ratio = coalesce(
      nullif(source.source_row->>'exclusive_ratio', '')::numeric,
      nullif(source.source_row->>'efficiency_ratio', '')::numeric,
      space.efficiency_ratio
    )
from (
  select to_jsonb(legacy_space) as source_row
  from public.ll_lease_spaces legacy_space
) source
where space.space_key = source.source_row->>'lease_space_id'
  and space.deleted_at is null;

update logistics_core.lease_contracts contract
set renewal_terms = coalesce(
      nullif(source.source_row->>'renewal_option', ''),
      nullif(source.source_row->>'renewal_terms', ''),
      contract.renewal_terms
    ),
    termination_terms = coalesce(
      nullif(source.source_row->>'early_termination_right', ''),
      nullif(source.source_row->>'termination_terms', ''),
      contract.termination_terms
    ),
    restoration_terms = coalesce(
      nullif(source.source_row->>'restoration_terms', ''),
      nullif(source.source_row->>'restoration_obligation', ''),
      contract.restoration_terms
    ),
    bond_terms = coalesce(
      nullif(source.source_row->>'bond_terms', ''),
      nullif(source.source_row->>'security_terms', ''),
      contract.bond_terms
    ),
    operation_start_date = coalesce(
      nullif(source.source_row->>'operation_start_date', '')::date,
      contract.operation_start_date
    )
from (
  select to_jsonb(legacy_contract) as source_row
  from public.ll_leases legacy_contract
) source
where contract.contract_key = source.source_row->>'lease_id'
  and contract.deleted_at is null;

update logistics_core.funds fund
set inception_date = coalesce(
      fund.inception_date,
      nullif(source.source_row->>'initial_setup_date', '')::date,
      nullif(source.source_row->>'establishment_date', '')::date
    ),
    maturity_date = coalesce(
      fund.maturity_date,
      nullif(source.source_row->>'fund_maturity_date', '')::date
    )
from (
  select to_jsonb(legacy_fund) as source_row
  from public.ll_funds legacy_fund
) source
where fund.fund_key = source.source_row->>'fund_id'
  and fund.deleted_at is null;

with ranked as (
  select
    space.id,
    row_number() over (
      partition by space.asset_id
      order by
        case
          when upper(coalesce(space.floor_label, '')) ~ '^(B|지하)'
            then -coalesce(nullif(substring(space.floor_label from '[0-9]+'), '')::integer, 0)
          when upper(coalesce(space.floor_label, '')) ~ '(ROOF|옥탑)'
            then 1000 + coalesce(nullif(substring(space.floor_label from '[0-9]+'), '')::integer, 0)
          else coalesce(nullif(substring(space.floor_label from '[0-9]+'), '')::integer, 0)
        end desc,
        space.zone_label nulls last,
        space.space_key
    ) as row_order
  from logistics_core.spaces space
  where space.deleted_at is null
)
update logistics_core.spaces space
set display_order = ranked.row_order
from ranked
where space.id = ranked.id
  and space.display_order is null;

do $rename_entry_functions$
begin
  if to_regprocedure('logistics_core.home_read_entry_v1(uuid,text,jsonb,jsonb)') is null then
    execute 'alter function logistics_core.home_read_entry(uuid, text, jsonb, jsonb) rename to home_read_entry_v1';
  end if;
  if to_regprocedure('logistics_core.rent_roll_read_entry_v1(uuid,text,jsonb,jsonb)') is null then
    execute 'alter function logistics_core.rent_roll_read_entry(uuid, text, jsonb, jsonb) rename to rent_roll_read_entry_v1';
  end if;
  if to_regprocedure('logistics_core.rent_roll_batch_save_entry_v1(uuid,text,jsonb,jsonb)') is null then
    execute 'alter function logistics_core.rent_roll_batch_save_entry(uuid, text, jsonb, jsonb) rename to rent_roll_batch_save_entry_v1';
  end if;
end;
$rename_entry_functions$;

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
  base_response jsonb;
  resolved_asset_id uuid;
  resolved_public_key text;
  source_asset jsonb := '{}'::jsonb;
  enriched_asset jsonb;
  fund_rows jsonb := '[]'::jsonb;
  investment_rows jsonb := '[]'::jsonb;
begin
  base_response := logistics_core.home_read_entry_v1(
    p_request_id, p_asset_key, p_payload, p_expected_revisions
  );
  if nullif(btrim(p_asset_key), '') is null then
    return base_response;
  end if;

  resolved_asset_id := logistics_core.resolve_asset_id(p_asset_key);
  select asset.public_key
  into resolved_public_key
  from logistics_core.assets asset
  where asset.id = resolved_asset_id and asset.deleted_at is null;

  select to_jsonb(legacy_asset)
  into source_asset
  from public.ll_assets legacy_asset
  where legacy_asset.asset_id = resolved_public_key;

  enriched_asset := coalesce(base_response #> '{data,asset}', '{}'::jsonb)
    || jsonb_strip_nulls(jsonb_build_object(
      'name', coalesce(
        nullif(source_asset->>'asset_name', ''),
        nullif(source_asset->>'name', ''),
        base_response #>> '{data,asset,name}'
      ),
      'address', coalesce(
        nullif(source_asset->>'road_address', ''),
        nullif(source_asset->>'address', ''),
        base_response #>> '{data,asset,address}'
      ),
      'sector', coalesce(
        nullif(source_asset->>'sector', ''),
        nullif(source_asset->>'asset_type', ''),
        nullif(source_asset->>'type', '')
      ),
      'land_area_sqm', nullif(coalesce(
        source_asset->>'land_area_sqm',
        source_asset->>'site_area_sqm'
      ), '')::numeric,
      'gross_area_sqm', coalesce(
        nullif(coalesce(source_asset->>'gross_area_sqm', source_asset->>'gross_floor_area_sqm'), '')::numeric,
        nullif(base_response #>> '{data,asset,gross_area_sqm}', '')::numeric
      ),
      'leasable_area_sqm', coalesce(
        nullif(coalesce(source_asset->>'leasable_area_sqm', source_asset->>'lease_area_sqm'), '')::numeric,
        nullif(base_response #>> '{data,asset,leasable_area_sqm}', '')::numeric
      ),
      'floor_count', coalesce(
        nullif(source_asset->>'floor_count', ''),
        nullif(source_asset->>'total_floors', ''),
        nullif(source_asset->>'floor_summary', '')
      ),
      'manager_name', coalesce(
        nullif(source_asset->>'manager_name', ''),
        nullif(source_asset->>'asset_manager', ''),
        nullif(source_asset->>'current_manager_name', '')
      ),
      'manager_team', coalesce(
        nullif(source_asset->>'manager_team', ''),
        nullif(source_asset->>'asset_management_team', '')
      ),
      'acquisition_cost', coalesce(
        nullif(coalesce(source_asset->>'acquisition_cost', source_asset->>'acquisition_price_krw'), '')::numeric,
        nullif(base_response #>> '{data,asset,acquisition_cost}', '')::numeric
      ),
      'current_valuation', coalesce(
        nullif(coalesce(source_asset->>'current_valuation', source_asset->>'valuation_krw'), '')::numeric,
        nullif(base_response #>> '{data,asset,current_valuation}', '')::numeric
      )
    ));

  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
    'fund_key', fund.fund_key,
    'fund_code', fund.fund_code,
    'name', fund.name_ko,
    'status', fund.status,
    'fund_type', coalesce(
      nullif(source_fund.source_row->>'fund_type', ''),
      nullif(source_fund.source_row->>'legal_form', '')
    ),
    'legal_form', nullif(source_fund.source_row->>'legal_form', ''),
    'investment_strategy', coalesce(
      nullif(source_fund.source_row->>'investment_strategy', ''),
      nullif(source_fund.source_row->>'strategy', '')
    ),
    'inception_date', fund.inception_date,
    'initial_setup_date', nullif(source_fund.source_row->>'initial_setup_date', '')::date,
    'maturity_date', fund.maturity_date,
    'effective_from', link.effective_from,
    'effective_to', link.effective_to,
    'ownership_ratio', link.ownership_ratio,
    'revision', greatest(fund.revision, link.revision)
  )) order by fund.name_ko), '[]'::jsonb)
  into fund_rows
  from logistics_core.fund_asset_links link
  join logistics_core.funds fund
    on fund.id = link.fund_id and fund.deleted_at is null
  left join lateral (
    select to_jsonb(legacy_fund) as source_row
    from public.ll_funds legacy_fund
    where legacy_fund.fund_id = fund.fund_key
    limit 1
  ) source_fund on true
  where link.asset_id = resolved_asset_id and link.deleted_at is null;

  select coalesce(jsonb_agg(jsonb_build_object(
    'beneficiary_key', tranche.beneficiary_key,
    'fund_key', fund.fund_key,
    'fund_name', fund.name_ko,
    'tranche', tranche.tranche_code,
    'beneficiary_name', tranche.beneficiary_name,
    'committed_amount_krw', tranche.committed_amount_krw,
    'revision', tranche.revision
  ) order by fund.name_ko, tranche.tranche_code, tranche.beneficiary_name), '[]'::jsonb)
  into investment_rows
  from logistics_core.fund_asset_links link
  join logistics_core.funds fund
    on fund.id = link.fund_id and fund.deleted_at is null
  join logistics_core.fund_beneficiary_tranches tranche
    on tranche.fund_id = fund.id
   and tranche.source_is_active
   and tranche.deleted_at is null
  where link.asset_id = resolved_asset_id and link.deleted_at is null;

  base_response := jsonb_set(base_response, '{data,asset}', enriched_asset, true);
  base_response := jsonb_set(base_response, '{data,funds}', fund_rows, true);
  base_response := jsonb_set(base_response, '{data,investments}', investment_rows, true);
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
set search_path = pg_catalog, logistics_core
as $body$
declare
  base_response jsonb;
  enriched_rows jsonb := '[]'::jsonb;
  tenant_rows jsonb := '[]'::jsonb;
begin
  base_response := logistics_core.rent_roll_read_entry_v1(
    p_request_id, p_asset_key, p_payload, p_expected_revisions
  );

  select coalesce(jsonb_agg(
    row_item.value
      || jsonb_build_object(
        'display_order', space.display_order,
        'rent_free_months', rent_term.rent_free_months
      )
    order by space.display_order nulls last, row_item.ordinality
  ), '[]'::jsonb)
  into enriched_rows
  from jsonb_array_elements(coalesce(base_response #> '{data,rows}', '[]'::jsonb))
    with ordinality as row_item(value, ordinality)
  left join logistics_core.spaces space
    on space.space_key = row_item.value->>'space_key'
   and space.deleted_at is null
  left join logistics_core.rent_terms rent_term
    on rent_term.rent_term_key = row_item.value->>'rent_term_key'
   and rent_term.deleted_at is null;

  select coalesce(jsonb_agg(jsonb_build_object(
    'tenant_key', tenant.tenant_key,
    'tenant_name', tenant.legal_name_ko,
    'business_registration_number', tenant.business_registration_number
  ) order by tenant.legal_name_ko, tenant.tenant_key), '[]'::jsonb)
  into tenant_rows
  from logistics_core.tenants tenant
  where tenant.deleted_at is null and tenant.status = 'active';

  base_response := jsonb_set(base_response, '{data,rows}', enriched_rows, true);
  base_response := jsonb_set(base_response, '{data,tenants}', tenant_rows, true);
  return base_response;
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
  base_response jsonb;
  row_record jsonb;
  affected_space_id uuid;
  before_row jsonb;
  latest_revision bigint := 0;
  deleted_count integer := 0;
begin
  base_response := logistics_core.rent_roll_batch_save_entry_v1(
    p_request_id, p_asset_key, p_payload, p_expected_revisions
  );

  if jsonb_typeof(p_payload->'rows') = 'array' then
    for row_record in
      select value
      from jsonb_array_elements(p_payload->'rows')
    loop
      if coalesce(row_record->>'operation', 'update') = 'delete' then
        select space.id, to_jsonb(space)
        into affected_space_id, before_row
        from logistics_core.spaces space
        where space.asset_id = resolved_asset_id
          and space.space_key = coalesce(row_record->>'space_key', row_record->>'row_key')
        for update;

        if affected_space_id is not null then
          update logistics_core.rent_terms rent_term
          set deleted_at = now(), deleted_by = actor_id
          from logistics_core.contract_spaces allocation
          where rent_term.contract_space_id = allocation.id
            and allocation.space_id = affected_space_id
            and rent_term.deleted_at is null;

          update logistics_core.contract_spaces allocation
          set deleted_at = now(), deleted_by = actor_id
          where allocation.space_id = affected_space_id
            and allocation.deleted_at is null;

          update logistics_core.spaces space
          set deleted_at = now(), deleted_by = actor_id
          where space.id = affected_space_id and space.deleted_at is null;

          insert into logistics_core.audit_events (
            actor_user_id, action, entity_type, entity_id, asset_id, entity_revision,
            before_hash, after_hash, change_payload, reason, client_request_id,
            mapping_version, correlation_id
          )
          select
            actor_id, 'delete', 'rent_roll_row', saved.id, resolved_asset_id, saved.revision,
            logistics_core.json_sha256(before_row), logistics_core.json_sha256(to_jsonb(saved)),
            row_record - 'notes', coalesce(nullif(row_record->>'reason', ''), '렌트롤 행 삭제'),
            p_request_id, 'gate6-data-platform-2', p_request_id
          from logistics_core.spaces saved
          where saved.id = affected_space_id;

          deleted_count := deleted_count + 1;
        end if;
      else
        update logistics_core.spaces space
        set display_order = coalesce(
              nullif(row_record->>'display_order', '')::integer,
              space.display_order
            ),
            updated_by = actor_id
        where space.asset_id = resolved_asset_id
          and space.space_key = coalesce(row_record->>'space_key', row_record->>'row_key')
          and space.deleted_at is null
          and space.display_order is distinct from coalesce(
            nullif(row_record->>'display_order', '')::integer,
            space.display_order
          );

        update logistics_core.rent_terms rent_term
        set rent_free_months = coalesce(nullif(row_record->>'rent_free_months', '')::numeric, 0),
            updated_by = actor_id
        where rent_term.rent_term_key = row_record->>'rent_term_key'
          and rent_term.deleted_at is null
          and rent_term.rent_free_months is distinct from coalesce(
            nullif(row_record->>'rent_free_months', '')::numeric,
            0
          );
      end if;
    end loop;
  end if;

  if deleted_count > 0 then
    perform logistics_core.project_rent_roll_to_legacy(
      resolved_asset_id, actor_id, p_request_id
    );
  end if;

  select greatest(
    coalesce((select max(revision) from logistics_core.lease_contracts where asset_id = resolved_asset_id), 0),
    coalesce((select max(revision) from logistics_core.spaces where asset_id = resolved_asset_id), 0)
  ) into latest_revision;

  return jsonb_set(base_response, '{revision}', to_jsonb(latest_revision), true);
end;
$body$;

revoke all on function logistics_core.home_read_entry_v1(uuid, text, jsonb, jsonb) from public, anon, authenticated;
revoke all on function logistics_core.rent_roll_read_entry_v1(uuid, text, jsonb, jsonb) from public, anon, authenticated;
revoke all on function logistics_core.rent_roll_batch_save_entry_v1(uuid, text, jsonb, jsonb) from public, anon, authenticated;
revoke all on function logistics_core.home_read_entry(uuid, text, jsonb, jsonb) from public, anon, authenticated;
revoke all on function logistics_core.rent_roll_read_entry(uuid, text, jsonb, jsonb) from public, anon, authenticated;
revoke all on function logistics_core.rent_roll_batch_save_entry(uuid, text, jsonb, jsonb) from public, anon, authenticated;

grant execute on function logistics_api.rent_roll_batch_save(uuid, text, jsonb, jsonb) to authenticated;
grant execute on function logistics_api.finance_batch_save(uuid, text, jsonb, jsonb) to authenticated;

notify pgrst, 'reload schema';

commit;
