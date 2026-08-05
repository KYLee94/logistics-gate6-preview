begin;

do $nonpilot_denial$
declare
  v_nonpilot_user_id uuid;
  v_asset_id uuid;
begin
  select profile.user_id
  into v_nonpilot_user_id
  from logistics_core.user_permission_profiles profile
  where profile.deleted_at is null
    and profile.managed_read
    and profile.managed_create
    and profile.managed_update
    and profile.managed_delete
    and not exists (
      select 1
      from logistics_core.platform_pilot_users pilot
      where pilot.user_id = profile.user_id and pilot.is_active = true
    )
  order by profile.user_id
  limit 1;

  if v_nonpilot_user_id is null then
    raise exception 'Non-pilot denial check blocked: no active non-pilot permission user exists';
  end if;

  select id into v_asset_id
  from logistics_core.assets
  where deleted_at is null
  order by asset_key
  limit 1;

  perform set_config('request.jwt.claim.sub', v_nonpilot_user_id::text, true);

  begin
    perform logistics_core.assert_v2_writer_route(v_asset_id);
    raise exception 'Non-pilot denial check failed: writer route was allowed';
  exception
    when sqlstate 'PT403' then
      if sqlerrm <> 'PILOT_ACCESS_REQUIRED' then
        raise exception 'Non-pilot denial check returned unexpected reason: %', sqlerrm;
      end if;
  end;
end;
$nonpilot_denial$;

select jsonb_build_object(
  'nonpilot_write_denied', true,
  'expected_sqlstate', 'PT403',
  'expected_reason', 'PILOT_ACCESS_REQUIRED'
) as nonpilot_denial;

rollback;
