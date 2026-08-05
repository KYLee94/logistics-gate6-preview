begin;

set local lock_timeout = '5s';
set local statement_timeout = '120s';

-- RENT_ROLL_ALLOCATION_SPACE_AMBIGUITY_HOTFIX
-- Resolve the archived contract-space lookup from the explicit row payload so
-- no PL/pgSQL variable can be confused with contract_spaces.space_id.
do $rent_roll_allocation_lint_hotfix$
declare
  v_function regprocedure := to_regprocedure(
    'logistics_core.rent_roll_batch_save_entry(uuid,text,jsonb,jsonb)'
  );
  v_definition text;
begin
  if v_function is null then
    raise exception 'Rent-roll allocation lint hotfix blocked: target function is missing';
  end if;

  select pg_get_functiondef(v_function::oid)
  into v_definition;

  if position('allocation.space_id = space_id' in v_definition) = 0 then
    raise exception 'Rent-roll allocation lint hotfix blocked: expected ambiguous expression is missing';
  end if;

  v_definition := replace(
    v_definition,
    'allocation.space_id = space_id',
    'allocation.space_id = (select matched_space.id
          from logistics_core.spaces matched_space
          where matched_space.space_key = coalesce(nullif(row_record->>''space_key'', ''''), row_record->>''row_key'')
            and matched_space.asset_id = resolved_asset_id)'
  );

  execute v_definition;
end;
$rent_roll_allocation_lint_hotfix$;

commit;
