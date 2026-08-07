with defs as (
  select
    pg_get_functiondef('logistics_core.finance_read_entry(uuid,text,jsonb,jsonb)'::regprocedure) as read_def,
    pg_get_functiondef('logistics_core.finance_batch_save_entry(uuid,text,jsonb,jsonb)'::regprocedure) as write_def
)
select
  position($frag$  v_waterfall jsonb;
$frag$ in read_def) > 0 as read_declare,
  position($frag$    'is_custom', account.is_custom,
    'asset_key', case when account.is_custom then p_asset_key end,
    'manual_entry_allowed', account.account_kind = 'atomic',
$frag$ in read_def) > 0 as read_fields,
  position($frag$  v_base_response := jsonb_set(v_base_response, '{data,accounts}', v_accounts, true);
  v_base_response := jsonb_set(v_base_response, '{data,waterfall}', v_waterfall, true);
$frag$ in read_def) > 0 as read_response,
  position($frag$  v_accounts_readback jsonb;
  v_response jsonb;
$frag$ in write_def) > 0 as write_declare,
  position($frag$    if v_operation_name not in ('create', 'update', 'delete')
       or v_account_code !~* '^CUSTOM:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
      raise exception using errcode = 'PT422', message = 'INVALID_FINANCE_ACCOUNT_OPERATION';
    end if;
    perform logistics_core.assert_asset_permission(v_actor_id, v_asset_id, v_operation_name);
$frag$ in write_def) > 0 as write_validation,
  position($frag$    select to_jsonb(account) into v_after_row
    from logistics_core.cashflow_accounts account where account.id = v_account_id;
    insert into logistics_core.audit_events (
$frag$ in write_def) > 0 as write_after,
  position($frag$      if v_operation_name = 'delete' then
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
$frag$ in write_def) > 0 as write_mutation,
  position($frag$    'statement_section', account.statement_section,
    'is_custom', account.is_custom,
    'selected', coalesce(selection.selected, false),
$frag$ in write_def) > 0 as write_readback_fields,
  position($frag$      'accounts_readback', v_accounts_readback,
      'selection_readback', 'verified',
$frag$ in write_def) > 0 as write_response,
  position($frag$      if v_expected_revision is null or v_expected_revision <> v_current_revision then
        raise exception using errcode = 'PT409', message = 'REVISION_CONFLICT';
      end if;
$frag$ in write_def) > 0 as revision_guard,
  position($frag$  v_cached_response := logistics_core.claim_idempotency(
    v_actor_id, 'v2/finance/batch-save', p_request_id, v_request_digest
  );
$frag$ in write_def) > 0 as idempotency_claim,
  position($frag$  perform logistics_core.complete_idempotency(
    v_actor_id, 'v2/finance/batch-save', p_request_id, v_response
  );
$frag$ in write_def) > 0 as idempotency_complete
from defs;
