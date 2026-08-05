begin;

set local lock_timeout = '5s';
set local statement_timeout = '120s';

-- RENT_ROLL_SPACE_PERMISSION_AMBIGUITY_HOTFIX
-- Preserve the already deployed function body and replace only the ambiguous
-- PL/pgSQL variable reference with the explicit operation JSON value.
do $rent_roll_lint_hotfix$
declare
  v_function regprocedure := to_regprocedure(
    'logistics_core.rent_roll_batch_save_entry(uuid,text,jsonb,jsonb)'
  );
  v_definition text;
begin
  if v_function is null then
    raise exception 'Rent-roll SQL lint hotfix blocked: target function is missing';
  end if;

  select pg_get_functiondef(v_function::oid)
  into v_definition;

  if position('existing.space_key = space_key' in v_definition) = 0 then
    raise exception 'Rent-roll SQL lint hotfix blocked: expected ambiguous expression is missing';
  end if;

  v_definition := replace(
    v_definition,
    'existing.space_key = space_key',
    'existing.space_key = (operation->>''space_key'')'
  );

  execute v_definition;
end;
$rent_roll_lint_hotfix$;

alter function logistics_core.normalize_month(text) stable;

commit;
