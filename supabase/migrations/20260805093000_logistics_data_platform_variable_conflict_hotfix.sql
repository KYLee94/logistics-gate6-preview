begin;

set local lock_timeout = '5s';
set local statement_timeout = '120s';

-- RENT_ROLL_VARIABLE_CONFLICT_POLICY_HOTFIX
-- PL/pgSQL supports a function-local conflict policy. Data expressions in this
-- function intentionally use local variables, while the one colliding upsert
-- target is fixed to its concrete unique constraint name.
do $rent_roll_variable_conflict_hotfix$
declare
  v_function regprocedure := to_regprocedure(
    'logistics_core.rent_roll_batch_save_entry(uuid,text,jsonb,jsonb)'
  );
  v_definition text;
begin
  if v_function is null then
    raise exception 'Rent-roll variable conflict hotfix blocked: target function is missing';
  end if;

  select pg_get_functiondef(v_function::oid)
  into v_definition;

  if position('#variable_conflict use_variable' in v_definition) = 0 then
    if position(E'\ndeclare\n' in v_definition) = 0 then
      raise exception 'Rent-roll variable conflict hotfix blocked: declaration boundary is missing';
    end if;
    v_definition := replace(
      v_definition,
      E'\ndeclare\n',
      E'\n#variable_conflict use_variable\ndeclare\n'
    );
  end if;

  if position('on conflict (contract_key) do update' in v_definition) = 0 then
    raise exception 'Rent-roll variable conflict hotfix blocked: contract conflict target is missing';
  end if;

  v_definition := replace(
    v_definition,
    'on conflict (contract_key) do update',
    'on conflict on constraint lease_contracts_contract_key_key do update'
  );

  execute v_definition;
end;
$rent_roll_variable_conflict_hotfix$;

commit;
