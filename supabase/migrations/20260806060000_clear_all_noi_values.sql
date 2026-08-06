begin;

-- NOI 손익표는 계정 서식만 유지하고, 금액은 자산 담당자가 직접 입력한다.
-- 렌트롤 저장이 현재 월 임대료/관리비를 다시 자동 생성하지 않도록 연결을 끊는다.
create or replace function logistics_core.sync_rent_roll_finance(
  p_asset_id uuid,
  p_actor uuid
)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, logistics_core
as $body$
begin
  return 0;
end;
$body$;

revoke all on function logistics_core.sync_rent_roll_finance(uuid, uuid)
  from public, anon, authenticated;

do $reset$
declare
  reset_key constant text := 'noi-all-assets-manual-entry-reset-20260806';
  reset_id uuid := gen_random_uuid();
  reset_entry_count bigint := 0;
  reset_adjustment_count bigint := 0;
begin
  -- 재실행 시 담당자가 새로 입력한 값을 다시 지우지 않는다.
  if exists (
    select 1
    from logistics_core.audit_events event
    where event.mapping_version = reset_key
  ) then
    return;
  end if;

  update logistics_core.ledger_adjustments
  set deleted_at = clock_timestamp(),
      deleted_by = null,
      updated_by = null
  where deleted_at is null;
  get diagnostics reset_adjustment_count = row_count;

  update logistics_core.monthly_ledger_entries
  set deleted_at = clock_timestamp(),
      deleted_by = null,
      updated_by = null,
      data_status = 'not_provided'
  where deleted_at is null;
  get diagnostics reset_entry_count = row_count;

  if exists (
    select 1
    from logistics_core.monthly_ledger_entries entry
    where entry.deleted_at is null
  ) then
    raise exception using
      errcode = 'PT500',
      message = 'NOI_RESET_ACTIVE_ENTRIES_REMAIN';
  end if;

  insert into logistics_core.audit_events (
    event_id,
    actor_user_id,
    action,
    entity_type,
    entity_id,
    asset_id,
    entity_revision,
    before_hash,
    after_hash,
    change_payload,
    reason,
    client_request_id,
    mapping_version,
    correlation_id
  ) values (
    reset_id,
    null,
    'reset',
    'monthly_ledger_entries',
    null,
    null,
    null,
    null,
    null,
    jsonb_build_object(
      'scope', 'all_assets',
      'entry_count', reset_entry_count,
      'adjustment_count', reset_adjustment_count,
      'accounts_preserved', true,
      'rent_roll_auto_projection_disabled', true
    ),
    '전체 자산 NOI 손익표를 담당자 직접 입력 방식으로 초기화',
    null,
    reset_key,
    reset_id
  );
end;
$reset$;

notify pgrst, 'reload schema';

commit;
