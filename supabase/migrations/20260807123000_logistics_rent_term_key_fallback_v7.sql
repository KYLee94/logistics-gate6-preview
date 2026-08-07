-- Gate 6 data platform v7
-- Keep the sparse writer's rent-term identity aligned with the base writer.
-- Legacy occupied rows can legitimately have no projected rent_term_key until
-- their first write. The base writer deterministically creates
-- <contract_space_key>:current, so the outer readback layer must use the same
-- key instead of comparing against SQL NULL.

do $patch_rent_term_key_fallback_v7$
declare
  v_function regprocedure := to_regprocedure(
    'logistics_core.rent_roll_batch_save_entry(uuid,text,jsonb,jsonb)'
  );
  v_definition text;
  v_old text := $old_fragment$
      v_input_row := (v_current_row - 'migration_exceptions') || v_input_row;
      v_transformed := jsonb_set(
        v_transformed, array['rows', v_row_index::text], v_input_row, true
      );
    end if;
    v_row_index := v_row_index + 1;
$old_fragment$;
  v_new text := $new_fragment$
      v_input_row := (v_current_row - 'migration_exceptions') || v_input_row;
    end if;

    -- RENT_TERM_KEY_FALLBACK_V7: mirror the archived base writer exactly.
    if v_operation <> 'delete'
       and nullif(v_input_row->>'rent_term_key', '') is null
       and coalesce(
         nullif(v_input_row->>'contract_space_key', ''),
         case
           when nullif(v_input_row->>'contract_key', '') is not null
            and nullif(v_input_row->>'space_key', '') is not null
           then (v_input_row->>'contract_key') || ':' || (v_input_row->>'space_key')
         end
       ) is not null then
      v_input_row := jsonb_set(
        v_input_row,
        '{rent_term_key}',
        to_jsonb(
          coalesce(
            nullif(v_input_row->>'contract_space_key', ''),
            (v_input_row->>'contract_key') || ':' || (v_input_row->>'space_key')
          ) || ':current'
        ),
        true
      );
    end if;

    v_transformed := jsonb_set(
      v_transformed, array['rows', v_row_index::text], v_input_row, true
    );
    v_row_index := v_row_index + 1;
$new_fragment$;
begin
  if v_function is null then
    raise exception 'RENT_TERM_KEY_FALLBACK_PATCH_FAILED: active sparse writer is missing';
  end if;

  v_definition := pg_get_functiondef(v_function);
  if position('RENT_TERM_KEY_FALLBACK_V7' in v_definition) > 0 then
    return;
  end if;
  if position(v_old in v_definition) = 0 then
    raise exception 'RENT_TERM_KEY_FALLBACK_PATCH_FAILED: expected writer fragment is missing';
  end if;

  execute replace(v_definition, v_old, v_new);
  v_definition := pg_get_functiondef(v_function);
  if position('RENT_TERM_KEY_FALLBACK_V7' in v_definition) = 0 then
    raise exception 'RENT_TERM_KEY_FALLBACK_PATCH_FAILED: replacement did not persist';
  end if;
end;
$patch_rent_term_key_fallback_v7$;

