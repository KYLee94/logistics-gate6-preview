-- Resolve operational database lint errors caused by PL/pgSQL variables that
-- shared names with table columns. This migration replaces only the two
-- deployed function bodies; their signatures and grants remain unchanged.

begin;

create or replace function logistics_core.finance_batch_save_entry(
  p_request_id uuid,
  p_asset_key text,
  p_payload jsonb,
  p_expected_revisions jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, logistics_core
as $body$
declare
  v_actor_id uuid := logistics_core.request_actor();
  v_resolved_asset_id uuid := logistics_core.resolve_asset_id(p_asset_key);
  v_request_digest text := logistics_core.request_hash('v2/finance/batch-save', p_asset_key, p_payload, p_expected_revisions);
  v_cached_response jsonb;
  v_operation jsonb;
  v_operation_name text;
  v_entry_key text;
  v_account_code text;
  v_account_id uuid;
  v_account_kind text;
  v_entity_id uuid;
  v_current_revision bigint;
  v_expected_revision bigint;
  v_before_row jsonb;
  v_after_row jsonb;
  v_changed_count integer := 0;
  v_final_revision bigint := 0;
  v_response jsonb;
begin
  perform logistics_core.assert_v2_writer_route(v_resolved_asset_id);
  v_cached_response := logistics_core.claim_idempotency(
    v_actor_id,
    'v2/finance/batch-save',
    p_request_id,
    v_request_digest
  );
  if v_cached_response is not null then return v_cached_response; end if;
  if jsonb_typeof(p_payload->'operations') <> 'array' then
    raise exception using errcode = 'PT422', message = 'OPERATIONS_ARRAY_REQUIRED';
  end if;
  if jsonb_array_length(p_payload->'operations') > 1000 then
    raise exception using errcode = 'PT422', message = 'BATCH_LIMIT_EXCEEDED';
  end if;

  for v_operation in select value from jsonb_array_elements(p_payload->'operations') loop
    v_operation_name := nullif(v_operation->>'operation', '');
    v_entry_key := nullif(v_operation->>'entry_key', '');
    if v_operation_name not in ('create', 'update', 'delete') or v_entry_key is null then
      raise exception using errcode = 'PT422', message = 'INVALID_FINANCE_OPERATION';
    end if;
    perform logistics_core.assert_asset_permission(v_actor_id, v_resolved_asset_id, v_operation_name);
    v_before_row := null;

    if v_operation_name in ('create', 'update') then
      v_account_code := nullif(v_operation->'record'->>'account_code', '');
      select account.id, account.account_kind
      into v_account_id, v_account_kind
      from logistics_core.cashflow_accounts account
      where account.account_code = v_account_code
        and account.deleted_at is null;
      if v_account_id is null then
        raise exception using errcode = 'PT422', message = 'FINANCE_ACCOUNT_NOT_FOUND';
      end if;
      if v_account_kind <> 'atomic' then
        raise exception using errcode = 'PT422', message = 'FINANCE_DERIVED_ACCOUNT_FORBIDDEN';
      end if;
      if nullif(v_operation->'record'->>'scenario', '') not in ('actual', 'budget', 'forecast') then
        raise exception using errcode = 'PT422', message = 'INVALID_FINANCE_SCENARIO';
      end if;
      if nullif(v_operation->'record'->>'accounting_basis', '') not in ('accrual', 'cash') then
        raise exception using errcode = 'PT422', message = 'INVALID_ACCOUNTING_BASIS';
      end if;
      if nullif(v_operation->'record'->>'amount', '') is null
         or v_operation->'record'->>'amount' !~ '^[+-]?([0-9]+([.][0-9]*)?|[.][0-9]+)$' then
        raise exception using errcode = 'PT422', message = 'FINITE_NUMERIC_AMOUNT_REQUIRED';
      end if;
    end if;

    if v_operation_name = 'create' then
      insert into logistics_core.monthly_ledger_entries (
        entry_key, asset_id, month, account_id, scenario, accounting_basis, amount,
        currency_code, source_kind, source_ref, source_line_key, data_status, created_by, updated_by
      ) values (
        v_entry_key,
        v_resolved_asset_id,
        logistics_core.normalize_month(v_operation->'record'->>'month'),
        v_account_id,
        v_operation->'record'->>'scenario',
        v_operation->'record'->>'accounting_basis',
        (v_operation->'record'->>'amount')::numeric,
        coalesce(nullif(v_operation->'record'->>'currency_code', ''), 'KRW'),
        'manual_input',
        'v2/finance/batch-save:' || p_request_id::text,
        v_entry_key,
        'provided',
        v_actor_id,
        v_actor_id
      ) returning id, revision into v_entity_id, v_current_revision;
    else
      select entry.id, entry.revision, to_jsonb(entry)
      into v_entity_id, v_current_revision, v_before_row
      from logistics_core.monthly_ledger_entries entry
      where entry.entry_key = v_entry_key
        and entry.asset_id = v_resolved_asset_id
      for update;
      if v_entity_id is null then
        raise exception using errcode = 'PT404', message = 'NOT_FOUND';
      end if;
      v_expected_revision := coalesce(
        nullif(v_operation->>'expected_revision', '')::bigint,
        nullif(p_expected_revisions->>v_entry_key, '')::bigint
      );
      if v_expected_revision is null or v_expected_revision <> v_current_revision then
        raise exception using errcode = 'PT409', message = 'REVISION_CONFLICT';
      end if;
      if v_before_row->>'source_kind' <> 'manual_input' then
        raise exception using errcode = 'PT422', message = 'FINANCE_DERIVED_ACCOUNT_FORBIDDEN';
      end if;
      if v_operation_name = 'delete' then
        update logistics_core.monthly_ledger_entries
        set deleted_at = now(), deleted_by = v_actor_id, updated_by = v_actor_id
        where id = v_entity_id
        returning revision into v_current_revision;
      else
        update logistics_core.monthly_ledger_entries
        set month = logistics_core.normalize_month(v_operation->'record'->>'month'),
            account_id = v_account_id,
            scenario = v_operation->'record'->>'scenario',
            accounting_basis = v_operation->'record'->>'accounting_basis',
            amount = (v_operation->'record'->>'amount')::numeric,
            source_ref = 'v2/finance/batch-save:' || p_request_id::text,
            deleted_at = null,
            deleted_by = null,
            updated_by = v_actor_id
        where id = v_entity_id
        returning revision into v_current_revision;
      end if;
    end if;

    select to_jsonb(entry)
    into v_after_row
    from logistics_core.monthly_ledger_entries entry
    where entry.id = v_entity_id;
    if v_after_row is null then
      raise exception using errcode = 'PT500', message = 'READBACK_MISMATCH';
    end if;

    insert into logistics_core.audit_events (
      actor_user_id, action, entity_type, entity_id, asset_id, entity_revision,
      before_hash, after_hash, change_payload, reason, client_request_id, mapping_version, correlation_id
    ) values (
      v_actor_id,
      v_operation_name,
      'monthly_ledger_entry',
      v_entity_id,
      v_resolved_asset_id,
      v_current_revision,
      case when v_before_row is null then null else logistics_core.json_sha256(v_before_row) end,
      logistics_core.json_sha256(v_after_row),
      jsonb_build_object('entry_key', v_entry_key, 'account_code', v_account_code),
      coalesce(nullif(v_operation->>'reason', ''), 'NOI 손익 직접 수정'),
      p_request_id,
      'gate6-data-platform-3',
      p_request_id
    );
    v_changed_count := v_changed_count + 1;
    v_final_revision := greatest(v_final_revision, v_current_revision);
  end loop;

  v_response := logistics_core.primary_response(
    p_request_id,
    v_final_revision,
    jsonb_build_object(
      'changed_count', v_changed_count,
      'readback', 'verified',
      'derived_subtotals_stored', false
    )
  );
  perform logistics_core.complete_idempotency(
    v_actor_id,
    'v2/finance/batch-save',
    p_request_id,
    v_response
  );
  return v_response;
end;
$body$;

create or replace function logistics_core.rent_roll_batch_save_entry_v4(
  p_request_id uuid,
  p_asset_key text,
  p_payload jsonb,
  p_expected_revisions jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, logistics_core, public, extensions
as $body$
declare
  v_actor_id uuid := logistics_core.request_actor();
  v_resolved_asset_id uuid := logistics_core.resolve_asset_id(p_asset_key);
  v_transformed_payload jsonb := p_payload;
  v_row_record jsonb;
  v_row_index integer := 0;
  v_tenant_id uuid;
  v_tenant_key text;
  v_term_revision bigint;
  v_base_response jsonb;
  v_finance_rows integer;
begin
  if jsonb_typeof(p_payload->'rows') = 'array' then
    for v_row_record in select value from jsonb_array_elements(p_payload->'rows') loop
      if coalesce(v_row_record->>'operation', 'update') <> 'delete'
         and coalesce(nullif(v_row_record->>'occupancy_status', ''), 'occupied') <> 'vacant' then
        if nullif(btrim(v_row_record->>'tenant_name'), '') is null then
          raise exception using errcode = 'PT422', message = 'TENANT_NAME_REQUIRED';
        end if;
        v_tenant_id := null;
        v_tenant_key := nullif(v_row_record->>'tenant_key', '');
        select tenant.id, tenant.tenant_key
        into v_tenant_id, v_tenant_key
        from logistics_core.tenants tenant
        where tenant.deleted_at is null
          and (
            (v_tenant_key is not null and tenant.tenant_key = v_tenant_key)
            or (
              lower(btrim(tenant.legal_name_ko)) = lower(btrim(v_row_record->>'tenant_name'))
              and coalesce(tenant.business_registration_number, '') = coalesce(v_row_record->>'business_registration_number', '')
            )
          )
        order by (tenant.tenant_key = v_tenant_key) desc
        limit 1
        for update;

        if v_tenant_id is null then
          v_tenant_key := 'tenant-manual-' || substr(encode(digest(
            lower(btrim(v_row_record->>'tenant_name')) || '|'
              || coalesce(v_row_record->>'business_registration_number', '') || '|'
              || gen_random_uuid()::text,
            'sha256'
          ), 'hex'), 1, 32);
          insert into logistics_core.tenants (
            tenant_key, tenant_code, legal_name_ko, business_registration_number, created_by, updated_by
          ) values (
            v_tenant_key,
            v_tenant_key,
            btrim(v_row_record->>'tenant_name'),
            nullif(btrim(v_row_record->>'business_registration_number'), ''),
            v_actor_id,
            v_actor_id
          ) returning id into v_tenant_id;
        else
          update logistics_core.tenants tenant
          set legal_name_ko = btrim(v_row_record->>'tenant_name'),
              business_registration_number = nullif(btrim(v_row_record->>'business_registration_number'), ''),
              updated_by = v_actor_id
          where tenant.id = v_tenant_id;
        end if;

        insert into public.ll_tenants (
          tenant_id, tenant_master_name, raw_tenant_name, business_registration_no,
          review_status, review_note, source_payload, updated_at
        ) values (
          v_tenant_key,
          btrim(v_row_record->>'tenant_name'),
          btrim(v_row_record->>'tenant_name'),
          nullif(btrim(v_row_record->>'business_registration_number'), ''),
          'confirmed',
          'data-platform direct input',
          jsonb_build_object('client_request_id', p_request_id),
          now()
        ) on conflict (tenant_id) do update set
          tenant_master_name = excluded.tenant_master_name,
          raw_tenant_name = excluded.raw_tenant_name,
          business_registration_no = excluded.business_registration_no,
          source_payload = coalesce(ll_tenants.source_payload, '{}'::jsonb) || excluded.source_payload,
          updated_at = now();
        v_row_record := jsonb_set(v_row_record, '{tenant_key}', to_jsonb(v_tenant_key), true);
      end if;

      v_row_record := jsonb_set(v_row_record, '{deposit_escalation_rule}', jsonb_strip_nulls(jsonb_build_object(
        'first_date', nullif(v_row_record->>'deposit_escalation_first_date', ''),
        'interval_months', nullif(v_row_record->>'deposit_escalation_interval_months', ''),
        'rate', nullif(v_row_record->>'deposit_escalation_rate', '')
      )), true);
      v_row_record := jsonb_set(v_row_record, '{rent_escalation_rule}', jsonb_strip_nulls(jsonb_build_object(
        'first_date', nullif(v_row_record->>'rent_escalation_first_date', ''),
        'interval_months', nullif(v_row_record->>'rent_escalation_interval_months', ''),
        'rate', nullif(v_row_record->>'rent_escalation_rate', '')
      )), true);
      v_row_record := jsonb_set(v_row_record, '{cam_escalation_rule}', jsonb_strip_nulls(jsonb_build_object(
        'first_date', nullif(v_row_record->>'cam_escalation_first_date', ''),
        'interval_months', nullif(v_row_record->>'cam_escalation_interval_months', ''),
        'rate', nullif(v_row_record->>'cam_escalation_rate', '')
      )), true);
      v_transformed_payload := jsonb_set(
        v_transformed_payload,
        array['rows', v_row_index::text],
        v_row_record,
        true
      );
      v_row_index := v_row_index + 1;
    end loop;
  end if;

  v_base_response := logistics_core.rent_roll_batch_save_entry_v3(
    p_request_id,
    p_asset_key,
    v_transformed_payload,
    p_expected_revisions
  );

  if jsonb_typeof(v_transformed_payload->'rows') = 'array' then
    for v_row_record in select value from jsonb_array_elements(v_transformed_payload->'rows') loop
      if coalesce(v_row_record->>'operation', 'update') <> 'delete' then
        update logistics_core.spaces space
        set temperature_type = nullif(v_row_record->>'temperature_type', ''),
            goods_type = nullif(v_row_record->>'goods_type', ''),
            subtenant_name = nullif(v_row_record->>'subtenant_name', ''),
            free_area_type = nullif(v_row_record->>'free_area_type', ''),
            updated_by = v_actor_id
        where space.asset_id = v_resolved_asset_id
          and space.space_key = coalesce(v_row_record->>'space_key', v_row_record->>'row_key');

        update logistics_core.lease_contracts contract
        set signed_date = nullif(v_row_record->>'signed_date', '')::date,
            construction_start_date = nullif(v_row_record->>'construction_start_date', '')::date,
            completion_date = nullif(v_row_record->>'completion_date', '')::date,
            security_type = nullif(v_row_record->>'security_type', ''),
            security_ratio = nullif(v_row_record->>'security_ratio', '')::numeric,
            updated_by = v_actor_id
        where contract.contract_key = v_row_record->>'contract_key'
          and contract.asset_id = v_resolved_asset_id;

        update logistics_core.rent_terms term
        set rent_calculation_method = nullif(v_row_record->>'rent_calculation_method', ''),
            rent_free_start_date = nullif(v_row_record->>'rent_free_start_date', '')::date,
            rent_free_end_date = nullif(v_row_record->>'rent_free_end_date', '')::date,
            pallet_rack_fee_per_py = nullif(v_row_record->>'pallet_rack_fee_per_py', '')::numeric,
            deposit_escalation_first_date = nullif(v_row_record->>'deposit_escalation_first_date', '')::date,
            deposit_escalation_interval_months = nullif(v_row_record->>'deposit_escalation_interval_months', '')::integer,
            deposit_escalation_rate = nullif(v_row_record->>'deposit_escalation_rate', ''),
            rent_escalation_first_date = nullif(v_row_record->>'rent_escalation_first_date', '')::date,
            rent_escalation_interval_months = nullif(v_row_record->>'rent_escalation_interval_months', '')::integer,
            rent_escalation_rate = nullif(v_row_record->>'rent_escalation_rate', ''),
            cam_escalation_first_date = nullif(v_row_record->>'cam_escalation_first_date', '')::date,
            cam_escalation_interval_months = nullif(v_row_record->>'cam_escalation_interval_months', '')::integer,
            cam_escalation_rate = nullif(v_row_record->>'cam_escalation_rate', ''),
            e_noc = case
              when nullif(v_row_record->>'leased_area_sqm', '')::numeric > 0
               and nullif(v_row_record->>'monthly_rent_total_krw', '') is not null
               and nullif(v_row_record->>'monthly_cam_total_krw', '') is not null
              then round(
                (
                  nullif(v_row_record->>'monthly_rent_total_krw', '')::numeric
                  + nullif(v_row_record->>'monthly_cam_total_krw', '')::numeric
                ) / (nullif(v_row_record->>'leased_area_sqm', '')::numeric * 0.3025),
                2
              )
              else null
            end,
            updated_by = v_actor_id
        where term.rent_term_key = v_row_record->>'rent_term_key'
        returning term.revision into v_term_revision;

        update public.ll_lease_spaces legacy
        set current_monthly_cost_total = nullif(v_row_record->>'monthly_rent_total_krw', '')::numeric
              + nullif(v_row_record->>'monthly_cam_total_krw', '')::numeric,
            e_noc = case
              when nullif(v_row_record->>'leased_area_sqm', '')::numeric > 0
               and nullif(v_row_record->>'monthly_rent_total_krw', '') is not null
               and nullif(v_row_record->>'monthly_cam_total_krw', '') is not null
              then round(
                (
                  nullif(v_row_record->>'monthly_rent_total_krw', '')::numeric
                  + nullif(v_row_record->>'monthly_cam_total_krw', '')::numeric
                ) / (nullif(v_row_record->>'leased_area_sqm', '')::numeric * 0.3025),
                2
              )
              else null
            end,
            updated_at = now()
        where legacy.lease_space_id = coalesce(v_row_record->>'space_key', v_row_record->>'row_key');
      end if;
    end loop;
  end if;

  v_finance_rows := logistics_core.sync_rent_roll_finance(v_resolved_asset_id, v_actor_id);
  v_base_response := jsonb_set(
    v_base_response,
    '{data,finance_projection_count}',
    to_jsonb(v_finance_rows),
    true
  );
  return v_base_response;
end;
$body$;

revoke all on function logistics_core.finance_batch_save_entry(uuid, text, jsonb, jsonb)
  from public, anon, authenticated;
revoke all on function logistics_core.rent_roll_batch_save_entry_v4(uuid, text, jsonb, jsonb)
  from public, anon, authenticated;

commit;
