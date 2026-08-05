begin;

set local lock_timeout = '5s';
set local statement_timeout = '120s';

do $rent_source_exceptions$
declare
  v_run_id uuid;
  v_actionable_source_count bigint;
  v_migrated_actionable_count bigint;
  v_quarantined_source_count bigint;
  v_manifest_count bigint;
begin
  select run_id
  into v_run_id
  from logistics_core.migration_runs
  where mapping_version = 'gate6-data-platform-1'
    and status = 'validated'
    and critical_exception_count = 0
  order by created_at desc
  limit 1;

  if v_run_id is null then
    raise exception 'Rent source exception manifest blocked: validated migration run is missing';
  end if;

  select count(*)
  into v_actionable_source_count
  from public.ll_rent_history source
  join logistics_core.contract_spaces allocation
    on allocation.contract_space_key = 'contract_space_' || (to_jsonb(source)->>'lease_space_id');

  select count(*)
  into v_migrated_actionable_count
  from public.ll_rent_history source
  join logistics_core.contract_spaces allocation
    on allocation.contract_space_key = 'contract_space_' || (to_jsonb(source)->>'lease_space_id')
  join logistics_core.rent_terms target
    on target.rent_term_key = coalesce(
      nullif(to_jsonb(source)->>'rent_history_id', ''),
      'rent_' || substr(md5(to_jsonb(source)::text), 1, 24)
    )
   and target.deleted_at is null;

  if v_actionable_source_count <> v_migrated_actionable_count then
    raise exception 'Rent actionable rent parity failed: source %, target %',
      v_actionable_source_count,
      v_migrated_actionable_count;
  end if;

  select count(*)
  into v_quarantined_source_count
  from public.ll_rent_history source
  left join logistics_core.contract_spaces allocation
    on allocation.contract_space_key = 'contract_space_' || (to_jsonb(source)->>'lease_space_id')
  where allocation.id is null;

  insert into logistics_core.migration_exceptions (
    run_id,
    severity,
    source_table,
    source_pk,
    target_entity,
    expected_hash,
    actual_hash,
    reason,
    resolution_status
  )
  select
    v_run_id,
    'warning',
    'public.ll_rent_history',
    jsonb_build_object(
      'rent_history_id', source_row->>'rent_history_id',
      'lease_space_id', source_row->>'lease_space_id',
      'source_row', source_row
    ),
    'rent_terms',
    encode(extensions.digest(source_row::text, 'sha256'), 'hex'),
    null,
    'LEGACY_RENT_ROW_QUARANTINED_MISSING_CONTRACT_SPACE',
    'open'
  from (
    select to_jsonb(source) as source_row
    from public.ll_rent_history source
  ) source_rows
  left join logistics_core.contract_spaces allocation
    on allocation.contract_space_key = 'contract_space_' || (source_row->>'lease_space_id')
  where allocation.id is null
    and not exists (
      select 1
      from logistics_core.migration_exceptions existing
      where existing.run_id = v_run_id
        and existing.source_table = 'public.ll_rent_history'
        and existing.reason = 'LEGACY_RENT_ROW_QUARANTINED_MISSING_CONTRACT_SPACE'
        and existing.source_pk->>'rent_history_id' is not distinct from source_row->>'rent_history_id'
        and existing.source_pk->>'lease_space_id' is not distinct from source_row->>'lease_space_id'
    );

  select count(*)
  into v_manifest_count
  from logistics_core.migration_exceptions
  where run_id = v_run_id
    and severity = 'warning'
    and source_table = 'public.ll_rent_history'
    and target_entity = 'rent_terms'
    and reason = 'LEGACY_RENT_ROW_QUARANTINED_MISSING_CONTRACT_SPACE';

  if v_manifest_count <> v_quarantined_source_count then
    raise exception 'Rent source exception manifest parity failed: source %, manifest %',
      v_quarantined_source_count,
      v_manifest_count;
  end if;
end;
$rent_source_exceptions$;

commit;
