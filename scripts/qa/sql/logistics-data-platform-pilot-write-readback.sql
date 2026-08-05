with validation_event as (
  select event.*
  from logistics_core.audit_events event
  where event.reason = 'release_validation_no_business_value_change'
  order by event.occurred_at desc
  limit 1
)
select jsonb_build_object(
  'audit', (
    select jsonb_build_object(
      'event_id', event.event_id,
      'occurred_at', event.occurred_at,
      'action', event.action,
      'entity_type', event.entity_type,
      'entity_revision', event.entity_revision,
      'client_request_id', event.client_request_id
    )
    from validation_event event
  ),
  'space_projection', (
    select jsonb_build_object(
      'space_key', space.space_key,
      'core_revision', space.revision,
      'legacy_core_revision', nullif(legacy.source_payload->>'core_revision', '')::bigint,
      'legacy_v2_projection', coalesce((legacy.source_payload->>'v2_projection')::boolean, false),
      'projection_status', projection.readback_status,
      'projection_revision', projection.last_success_revision,
      'hashes_match', projection.target_hash = projection.legacy_hash
    )
    from validation_event event
    join logistics_core.spaces space on space.id = event.entity_id
    join public.ll_lease_spaces legacy on legacy.lease_space_id = space.space_key
    join logistics_core.legacy_projection_state projection
      on projection.target_entity = 'spaces'
     and projection.target_id = space.id
     and projection.legacy_table = 'public.ll_lease_spaces'
  ),
  'active_finance_rows', (
    select count(*)
    from logistics_core.monthly_ledger_entries
    where deleted_at is null
  ),
  'failed_projection_count', (
    select count(*)
    from logistics_core.legacy_projection_state
    where readback_status <> 'verified'
  )
) as pilot_write_readback;
