-- Gate 6 data platform v8
-- Several loan rows can point to the same lender record. Revision checks must
-- therefore be grouped by the actual lender entity, not by each loan key.

do $patch_home_shared_lender_revision_v8$
declare
  v_function regprocedure := to_regprocedure(
    'logistics_core.home_batch_save_entry_v5(uuid,text,jsonb,jsonb)'
  );
  v_definition text;
  v_old text := $old_fragment$
      when entity_name = 'loan' and field_name = 'lender_name' then 'loan_lender:' || entity_key
$old_fragment$;
  v_new text := $new_fragment$
      -- HOME_SHARED_LENDER_REVISION_V8: one check per physical lender row.
      when entity_name = 'loan' and field_name = 'lender_name' then 'lender:' || entity_id::text
$new_fragment$;
begin
  if v_function is null then
    raise exception 'HOME_SHARED_LENDER_REVISION_PATCH_FAILED: archived home writer is missing';
  end if;

  v_definition := pg_get_functiondef(v_function);
  if position('HOME_SHARED_LENDER_REVISION_V8' in v_definition) > 0 then
    return;
  end if;
  if position(v_old in v_definition) = 0 then
    raise exception 'HOME_SHARED_LENDER_REVISION_PATCH_FAILED: expected revision scope is missing';
  end if;

  execute replace(v_definition, v_old, v_new);
  v_definition := pg_get_functiondef(v_function);
  if position('HOME_SHARED_LENDER_REVISION_V8' in v_definition) = 0 then
    raise exception 'HOME_SHARED_LENDER_REVISION_PATCH_FAILED: replacement did not persist';
  end if;
end;
$patch_home_shared_lender_revision_v8$;

