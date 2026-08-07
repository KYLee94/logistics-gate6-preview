-- Gate 6 data platform v12
-- Keep source rent-roll areas unchanged while constraining the public
-- occupancy-rate projection to its valid presentation range.

begin;

do $patch_home_occupancy_rate_cap_v12$
declare
  v_function regprocedure := to_regprocedure(
    'logistics_core.home_read_entry(uuid,text,jsonb,jsonb)'
  );
  v_definition text;
  v_old_rate text := $old_fragment$
    'occupancy_rate', case when v_space_denominator > 0 then round(v_occupied_area / v_space_denominator * 100, 2) end
$old_fragment$;
  v_new_rate text := $new_fragment$
    -- HOME_OCCUPANCY_RATE_CAP_V12: source areas remain visible; the ratio is bounded.
    'occupancy_rate', case when v_space_denominator > 0 then
      least(100::numeric, greatest(0::numeric, round(v_occupied_area / v_space_denominator * 100, 2)))
    end
$new_fragment$;
begin
  if v_function is null then
    raise exception 'HOME_OCCUPANCY_RATE_CAP_V12_FAILED: home reader is missing';
  end if;

  v_definition := pg_get_functiondef(v_function);
  if position('HOME_OCCUPANCY_RATE_CAP_V12' in v_definition) > 0 then
    return;
  end if;
  if position(v_old_rate in v_definition) = 0 then
    raise exception 'HOME_OCCUPANCY_RATE_CAP_V12_FAILED: raw rate fragment is missing';
  end if;

  v_definition := replace(v_definition, v_old_rate, v_new_rate);
  execute v_definition;
  v_definition := pg_get_functiondef(v_function);
  if position('HOME_OCCUPANCY_RATE_CAP_V12' in v_definition) = 0
     or position(v_old_rate in v_definition) > 0 then
    raise exception 'HOME_OCCUPANCY_RATE_CAP_V12_FAILED: patched definition did not persist';
  end if;
end;
$patch_home_occupancy_rate_cap_v12$;

notify pgrst, 'reload schema';

commit;
