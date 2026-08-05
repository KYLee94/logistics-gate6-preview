begin;

update logistics_core.platform_feature_flags
set v2_write_enabled = false,
    reason = 'Emergency write lock activated',
    changed_at = now(),
    changed_by = null,
    revision = revision + 1
where flag_key = 'data_platform_v2';

update logistics_core.asset_writer_routes
set writer_mode = 'locked',
    reason = 'Emergency write lock activated',
    changed_at = now(),
    changed_by = null,
    revision = revision + 1
where writer_mode is distinct from 'locked';

revoke execute on function logistics_api.rent_roll_batch_save(uuid, text, jsonb, jsonb) from authenticated;
revoke execute on function logistics_api.finance_batch_save(uuid, text, jsonb, jsonb) from authenticated;

insert into logistics_core.audit_events (
  action,
  entity_type,
  change_payload,
  reason,
  mapping_version,
  correlation_id
) values (
  'emergency_write_lock',
  'platform_feature_flag',
  jsonb_build_object('writer_mode', 'locked'),
  'Emergency lock procedure executed',
  'gate6-data-platform-1',
  gen_random_uuid()
);

commit;
