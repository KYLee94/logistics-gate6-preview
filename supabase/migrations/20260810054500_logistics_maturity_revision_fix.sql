-- LOGISTICS_SIMPLE_MATURITY_REVISION_FIX_V1
-- primary_response accepts one numeric revision token.  The preceding maturity
-- migration accidentally joined two xmin values with a colon, so every read
-- failed with INVALID_REVISION before a response could be returned.

begin;

set local lock_timeout = '10s';
set local statement_timeout = '60s';

select pg_advisory_xact_lock(hashtextextended('LOGISTICS_SIMPLE_MATURITY_REVISION_FIX_V1', 0));

do $revision_fix$
declare
  v_signature constant text := 'logistics_core.maturities_read_entry(uuid,text,jsonb,jsonb)';
  v_definition text;
  v_old_revision_sql constant text := $old$select concat(rent.xmin::text, ':', fund.xmin::text)
  into strict v_version$old$;
  v_new_revision_sql constant text := $new$select greatest(rent.xmin::text::bigint, fund.xmin::text::bigint)::text
  into strict v_version$new$;
  v_security_definer boolean;
begin
  if to_regprocedure(v_signature) is null then
    raise exception using errcode = 'PT500', message = 'MATURITY_REVISION_FUNCTION_MISSING';
  end if;

  select pg_get_functiondef(to_regprocedure(v_signature)), function.prosecdef
  into strict v_definition, v_security_definer
  from pg_catalog.pg_proc function
  where function.oid = to_regprocedure(v_signature);

  if position(v_new_revision_sql in v_definition) = 0 then
    if position(v_old_revision_sql in v_definition) = 0 then
      raise exception using errcode = 'PT500', message = 'MATURITY_REVISION_SOURCE_MISMATCH';
    end if;
    v_definition := replace(v_definition, v_old_revision_sql, v_new_revision_sql);
    execute v_definition;
  end if;

  select pg_get_functiondef(to_regprocedure(v_signature)), function.prosecdef
  into strict v_definition, v_security_definer
  from pg_catalog.pg_proc function
  where function.oid = to_regprocedure(v_signature);

  if position(v_new_revision_sql in v_definition) = 0
     or not v_security_definer then
    raise exception using errcode = 'PT500', message = 'MATURITY_REVISION_FIX_NOT_APPLIED';
  end if;
end;
$revision_fix$;

revoke all on function logistics_core.maturities_read_entry(uuid, text, jsonb, jsonb)
from public, anon, authenticated;

commit;
