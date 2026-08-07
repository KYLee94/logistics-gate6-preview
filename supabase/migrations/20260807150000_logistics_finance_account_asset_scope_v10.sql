-- Gate 6 data platform v10
-- FINANCE_ACCOUNT_ASSET_SCOPE_V10
-- Keep custom NOI accounts owned by exactly one resolved asset, expose an
-- explicit archive tombstone readback, and allow a revision-checked restore.
-- Applied v6-v9 migrations are immutable and are not edited by this patch.

begin;

do $patch_finance_read_asset_scope_v10$
declare
  v_function regprocedure := to_regprocedure(
    'logistics_core.finance_read_entry(uuid,text,jsonb,jsonb)'
  );
  v_definition text;
  v_old_declare text := $old_fragment$
  v_waterfall jsonb;
$old_fragment$;
  v_new_declare text := $new_fragment$
  v_waterfall jsonb;
  v_archived_accounts jsonb;
$new_fragment$;
  v_old_account_fields text := $old_fragment$
    'is_custom', account.is_custom,
    'asset_key', case when account.is_custom then p_asset_key end,
    'manual_entry_allowed', account.account_kind = 'atomic',
$old_fragment$;
  v_new_account_fields text := $new_fragment$
    'is_custom', account.is_custom,
    'asset_key', case when account.is_custom then p_asset_key end,
    'asset_id', case when account.is_custom then account.asset_id end,
    'active', true,
    'manual_entry_allowed', account.account_kind = 'atomic',
$new_fragment$;
  v_old_response text := $old_fragment$
  v_base_response := jsonb_set(v_base_response, '{data,accounts}', v_accounts, true);
  v_base_response := jsonb_set(v_base_response, '{data,waterfall}', v_waterfall, true);
$old_fragment$;
  v_new_response text := $new_fragment$
  -- FINANCE_ACCOUNT_ASSET_SCOPE_V10: archived custom accounts never cross assets.
  select coalesce(jsonb_agg(jsonb_build_object(
    'account_code', account.account_code,
    'name', account.name_ko,
    'name_ko', account.name_ko,
    'statement_section', account.statement_section,
    'display_order', account.display_order,
    'is_custom', true,
    'asset_key', p_asset_key,
    'asset_id', account.asset_id,
    'active', false,
    'revision', account.revision,
    'deleted_at', account.deleted_at
  ) order by account.statement_section, account.display_order, account.account_code), '[]'::jsonb)
  into v_archived_accounts
  from logistics_core.cashflow_accounts account
  where account.is_custom
    and account.asset_id = v_asset_id
    and account.deleted_at is not null;

  v_base_response := jsonb_set(v_base_response, '{data,accounts}', v_accounts, true);
  v_base_response := jsonb_set(v_base_response, '{data,archived_accounts}', v_archived_accounts, true);
  v_base_response := jsonb_set(v_base_response, '{data,waterfall}', v_waterfall, true);
$new_fragment$;
begin
  if v_function is null then
    raise exception 'FINANCE_ACCOUNT_ASSET_SCOPE_V10_FAILED: finance reader is missing';
  end if;
  v_definition := pg_get_functiondef(v_function);
  if position('FINANCE_ACCOUNT_ASSET_SCOPE_V10: archived custom accounts' in v_definition) > 0 then
    return;
  end if;
  if position(v_old_declare in v_definition) = 0
     or position(v_old_account_fields in v_definition) = 0
     or position(v_old_response in v_definition) = 0 then
    raise exception 'FINANCE_ACCOUNT_ASSET_SCOPE_V10_FAILED: finance reader contract changed';
  end if;
  v_definition := replace(v_definition, v_old_declare, v_new_declare);
  v_definition := replace(v_definition, v_old_account_fields, v_new_account_fields);
  v_definition := replace(v_definition, v_old_response, v_new_response);
  execute v_definition;
  v_definition := pg_get_functiondef(v_function);
  if position('FINANCE_ACCOUNT_ASSET_SCOPE_V10: archived custom accounts' in v_definition) = 0
     or position(v_old_response in v_definition) > 0 then
    raise exception 'FINANCE_ACCOUNT_ASSET_SCOPE_V10_FAILED: finance reader patch did not persist';
  end if;
end;
$patch_finance_read_asset_scope_v10$;

do $patch_finance_writer_asset_scope_v10$
declare
  v_function regprocedure := to_regprocedure(
    'logistics_core.finance_batch_save_entry(uuid,text,jsonb,jsonb)'
  );
  v_definition text;
  v_old_declare text := $old_fragment$
  v_accounts_readback jsonb;
  v_response jsonb;
$old_fragment$;
  v_new_declare text := $new_fragment$
  v_accounts_readback jsonb;
  v_account_mutations_readback jsonb := '[]'::jsonb;
  v_response jsonb;
$new_fragment$;
  v_old_validation text := $old_fragment$
    if v_operation_name not in ('create', 'update', 'delete')
       or v_account_code !~* '^CUSTOM:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
      raise exception using errcode = 'PT422', message = 'INVALID_FINANCE_ACCOUNT_OPERATION';
    end if;
    perform logistics_core.assert_asset_permission(v_actor_id, v_asset_id, v_operation_name);
$old_fragment$;
  v_new_validation text := $new_fragment$
    if v_operation_name not in ('create', 'update', 'delete', 'restore')
       or v_account_code !~* '^CUSTOM:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
      raise exception using errcode = 'PT422', message = 'INVALID_FINANCE_ACCOUNT_OPERATION';
    end if;
    perform logistics_core.assert_asset_permission(
      v_actor_id,
      v_asset_id,
      case when v_operation_name = 'restore' then 'update' else v_operation_name end
    );
$new_fragment$;
  v_old_mutation text := $old_fragment$
      if v_operation_name = 'delete' then
        if exists (
          select 1 from logistics_core.monthly_ledger_entries entry
          where entry.account_id = v_account_id and entry.deleted_at is null
        ) then
          raise exception using errcode = 'PT422', message = 'FINANCE_ACCOUNT_HAS_LEDGER_ENTRIES';
        end if;
        update logistics_core.cashflow_accounts
        set deleted_at = now(), deleted_by = v_actor_id, updated_by = v_actor_id
        where id = v_account_id returning revision into v_current_revision;
        update logistics_core.finance_account_selections
        set deleted_at = now(), deleted_by = v_actor_id, updated_by = v_actor_id
        where asset_id = v_asset_id and account_id = v_account_id and deleted_at is null;
      else
        v_account_name := nullif(btrim(coalesce(v_record->>'name_ko', v_operation->>'name_ko')), '');
$old_fragment$;
  v_new_mutation text := $new_fragment$
      if v_operation_name = 'delete' then
        if exists (
          select 1 from logistics_core.monthly_ledger_entries entry
          where entry.account_id = v_account_id and entry.deleted_at is null
        ) then
          raise exception using errcode = 'PT422', message = 'FINANCE_ACCOUNT_HAS_LEDGER_ENTRIES';
        end if;
        update logistics_core.cashflow_accounts
        set deleted_at = now(), deleted_by = v_actor_id, updated_by = v_actor_id
        where id = v_account_id returning revision into v_current_revision;
        update logistics_core.finance_account_selections
        set deleted_at = now(), deleted_by = v_actor_id, updated_by = v_actor_id
        where asset_id = v_asset_id and account_id = v_account_id and deleted_at is null;
      elsif v_operation_name = 'restore' then
        if v_before_row->>'deleted_at' is null then
          raise exception using errcode = 'PT422', message = 'FINANCE_ACCOUNT_ALREADY_ACTIVE';
        end if;
        update logistics_core.cashflow_accounts
        set deleted_at = null, deleted_by = null, updated_by = v_actor_id
        where id = v_account_id returning revision into v_current_revision;
      else
        if v_before_row->>'deleted_at' is not null then
          raise exception using errcode = 'PT422', message = 'FINANCE_ACCOUNT_ARCHIVED';
        end if;
        v_account_name := nullif(btrim(coalesce(v_record->>'name_ko', v_operation->>'name_ko')), '');
$new_fragment$;
  v_old_after_row text := $old_fragment$
    select to_jsonb(account) into v_after_row
    from logistics_core.cashflow_accounts account where account.id = v_account_id;
    insert into logistics_core.audit_events (
$old_fragment$;
  v_new_after_row text := $new_fragment$
    select to_jsonb(account) into v_after_row
    from logistics_core.cashflow_accounts account where account.id = v_account_id;
    if v_after_row is null or (v_after_row->>'asset_id')::uuid <> v_asset_id then
      raise exception using errcode = 'PT500', message = 'FINANCE_ACCOUNT_READBACK_MISMATCH';
    end if;
    -- FINANCE_ACCOUNT_MUTATION_READBACK_V10 includes delete tombstones.
    v_account_mutations_readback := v_account_mutations_readback || jsonb_build_array(jsonb_build_object(
      'account_code', v_account_code,
      'asset_id', v_asset_id,
      'operation', v_operation_name,
      'active', v_after_row->>'deleted_at' is null,
      'deleted_at', v_after_row->'deleted_at',
      'revision', v_current_revision
    ));
    insert into logistics_core.audit_events (
$new_fragment$;
  v_old_readback_fields text := $old_fragment$
    'statement_section', account.statement_section,
    'is_custom', account.is_custom,
    'selected', coalesce(selection.selected, false),
$old_fragment$;
  v_new_readback_fields text := $new_fragment$
    'statement_section', account.statement_section,
    'is_custom', account.is_custom,
    'asset_id', case when account.is_custom then account.asset_id end,
    'active', true,
    'selected', coalesce(selection.selected, false),
$new_fragment$;
  v_old_response text := $old_fragment$
      'accounts_readback', v_accounts_readback,
      'selection_readback', 'verified',
$old_fragment$;
  v_new_response text := $new_fragment$
      'accounts_readback', v_accounts_readback,
      'account_mutations_readback', v_account_mutations_readback,
      'selection_readback', 'verified',
$new_fragment$;
  v_revision_guard text := $required_fragment$
      if v_expected_revision is null or v_expected_revision <> v_current_revision then
        raise exception using errcode = 'PT409', message = 'REVISION_CONFLICT';
      end if;
$required_fragment$;
  v_idempotency_claim text := $required_fragment$
  v_cached_response := logistics_core.claim_idempotency(
    v_actor_id, 'v2/finance/batch-save', p_request_id, v_request_digest
  );
$required_fragment$;
  v_idempotency_complete text := $required_fragment$
  perform logistics_core.complete_idempotency(
    v_actor_id, 'v2/finance/batch-save', p_request_id, v_response
  );
$required_fragment$;
begin
  if v_function is null then
    raise exception 'FINANCE_ACCOUNT_ASSET_SCOPE_V10_FAILED: finance writer is missing';
  end if;
  v_definition := pg_get_functiondef(v_function);
  if position('FINANCE_ACCOUNT_MUTATION_READBACK_V10' in v_definition) > 0 then
    return;
  end if;
  if position(v_old_declare in v_definition) = 0
     or position(v_old_validation in v_definition) = 0
     or position(v_old_mutation in v_definition) = 0
     or position(v_old_after_row in v_definition) = 0
     or position(v_old_readback_fields in v_definition) = 0
     or position(v_old_response in v_definition) = 0
     or position(v_revision_guard in v_definition) = 0
     or position(v_idempotency_claim in v_definition) = 0
     or position(v_idempotency_complete in v_definition) = 0 then
    raise exception 'FINANCE_ACCOUNT_ASSET_SCOPE_V10_FAILED: finance writer contract changed';
  end if;
  v_definition := replace(v_definition, v_old_declare, v_new_declare);
  v_definition := replace(v_definition, v_old_validation, v_new_validation);
  v_definition := replace(v_definition, v_old_mutation, v_new_mutation);
  v_definition := replace(v_definition, v_old_after_row, v_new_after_row);
  v_definition := replace(v_definition, v_old_readback_fields, v_new_readback_fields);
  v_definition := replace(v_definition, v_old_response, v_new_response);
  execute v_definition;
  v_definition := pg_get_functiondef(v_function);
  if position('FINANCE_ACCOUNT_MUTATION_READBACK_V10' in v_definition) = 0
     or position(v_old_validation in v_definition) > 0
     or position(v_old_response in v_definition) > 0 then
    raise exception 'FINANCE_ACCOUNT_ASSET_SCOPE_V10_FAILED: finance writer patch did not persist';
  end if;
end;
$patch_finance_writer_asset_scope_v10$;

revoke all on function logistics_core.finance_read_entry(uuid, text, jsonb, jsonb)
  from public, anon, authenticated;
revoke all on function logistics_core.finance_batch_save_entry(uuid, text, jsonb, jsonb)
  from public, anon, authenticated;

notify pgrst, 'reload schema';

commit;
