begin;

set local lock_timeout = '5s';
set local statement_timeout = '120s';

-- Keep the private maturity projection aligned with its three canonical sources.
-- lease_contracts.expiry_date is the established Gate 6 lease-end field.
create or replace function logistics_core.sync_maturity_projection(
  p_maturity_type text,
  p_source_id uuid
)
returns void
language plpgsql
security invoker
set search_path = pg_catalog
as $body$
declare
  v_actor_id uuid := auth.uid();
  v_asset_id uuid;
  v_fund_id uuid;
  v_loan_source_tranche_id uuid;
  v_maturity_id uuid;
  v_maturity_key text;
  v_official_date date;
  v_source_deleted_at timestamptz;
  v_source_deleted_by uuid;
  v_source_is_active boolean := true;
  v_source_key text;
  v_target_name text;
  v_source_found boolean := false;
begin
  if p_source_id is null then
    raise exception using errcode = '22023', message = 'MATURITY_SOURCE_ID_REQUIRED';
  end if;

  if p_maturity_type = 'lease' then
    select
      contract.asset_id,
      contract.contract_key,
      contract.expiry_date,
      contract.deleted_at,
      contract.deleted_by,
      coalesce(nullif(btrim(tenant.legal_name_ko), ''), contract.contract_code)
    into
      v_asset_id,
      v_source_key,
      v_official_date,
      v_source_deleted_at,
      v_source_deleted_by,
      v_target_name
    from logistics_core.lease_contracts contract
    left join logistics_core.tenants tenant
      on tenant.id = contract.tenant_id
     and tenant.deleted_at is null
    where contract.id = p_source_id;

    v_source_found := found;
    v_maturity_key := 'lease_maturity_' || v_source_key;
  elsif p_maturity_type = 'fund' then
    select
      fund.fund_key,
      fund.maturity_date,
      fund.deleted_at,
      fund.deleted_by,
      fund.name_ko
    into
      v_source_key,
      v_official_date,
      v_source_deleted_at,
      v_source_deleted_by,
      v_target_name
    from logistics_core.funds fund
    where fund.id = p_source_id;

    v_source_found := found;
    v_fund_id := p_source_id;
    v_maturity_key := 'fund_maturity_' || v_source_key;
  elsif p_maturity_type = 'loan' then
    select
      loan.asset_id,
      loan.fund_id,
      loan.source_tranche_id,
      loan.maturity_date,
      loan.deleted_at,
      loan.deleted_by,
      loan.source_is_active,
      coalesce(nullif(btrim(loan.tranche_name), ''), nullif(btrim(loan.name_ko), ''), loan.loan_code)
    into
      v_asset_id,
      v_fund_id,
      v_loan_source_tranche_id,
      v_official_date,
      v_source_deleted_at,
      v_source_deleted_by,
      v_source_is_active,
      v_target_name
    from logistics_core.loans loan
    where loan.id = p_source_id;

    v_source_found := found;
    v_maturity_key := 'loan_maturity_' || v_loan_source_tranche_id::text;
  else
    raise exception using errcode = '22023', message = 'UNSUPPORTED_MATURITY_SOURCE_TYPE';
  end if;

  if not v_source_found then
    v_source_deleted_at := clock_timestamp();
    v_source_is_active := false;
  end if;

  if not v_source_found
     or v_source_deleted_at is not null
     or v_official_date is null
     or v_source_is_active is false then
    update logistics_core.maturities maturity
    set status = 'cancelled',
        deleted_at = coalesce(v_source_deleted_at, clock_timestamp()),
        deleted_by = coalesce(v_source_deleted_by, v_actor_id, maturity.deleted_by)
    where (
        (p_maturity_type = 'lease' and maturity.lease_contract_id = p_source_id)
        or (p_maturity_type = 'fund' and maturity.fund_id = p_source_id)
        or (p_maturity_type = 'loan' and maturity.loan_id = p_source_id)
      )
      and (
        maturity.status is distinct from 'cancelled'
        or maturity.deleted_at is null
        or (
          v_source_deleted_at is not null
          and maturity.deleted_at is distinct from v_source_deleted_at
        )
      )
    returning maturity.id into v_maturity_id;

    if v_maturity_id is null then
      select maturity.id
      into v_maturity_id
      from logistics_core.maturities maturity
      where (p_maturity_type = 'lease' and maturity.lease_contract_id = p_source_id)
         or (p_maturity_type = 'fund' and maturity.fund_id = p_source_id)
         or (p_maturity_type = 'loan' and maturity.loan_id = p_source_id)
      limit 1;
    end if;

    if v_maturity_id is not null then
      update logistics_core.maturity_asset_scopes scope
      set retired_at = clock_timestamp(),
          scope_revision = scope.scope_revision + 1
      where scope.maturity_id = v_maturity_id
        and scope.retired_at is null;
    end if;

    return;
  end if;

  insert into logistics_core.maturities as current_maturity (
    maturity_key,
    maturity_type,
    asset_id,
    lease_contract_id,
    fund_id,
    loan_id,
    target_name_ko,
    official_date,
    status,
    created_by,
    updated_by,
    deleted_at,
    deleted_by
  )
  values (
    v_maturity_key,
    p_maturity_type,
    case when p_maturity_type = 'lease' then v_asset_id else null end,
    case when p_maturity_type = 'lease' then p_source_id else null end,
    case when p_maturity_type = 'fund' then p_source_id else null end,
    case when p_maturity_type = 'loan' then p_source_id else null end,
    v_target_name,
    v_official_date,
    'active',
    v_actor_id,
    v_actor_id,
    null,
    null
  )
  on conflict (maturity_key) do update set
    maturity_type = excluded.maturity_type,
    asset_id = excluded.asset_id,
    lease_contract_id = excluded.lease_contract_id,
    fund_id = excluded.fund_id,
    loan_id = excluded.loan_id,
    target_name_ko = excluded.target_name_ko,
    official_date = excluded.official_date,
    status = 'active',
    updated_by = excluded.updated_by,
    deleted_at = null,
    deleted_by = null
  where (
    current_maturity.maturity_type,
    current_maturity.asset_id,
    current_maturity.lease_contract_id,
    current_maturity.fund_id,
    current_maturity.loan_id,
    current_maturity.target_name_ko,
    current_maturity.official_date,
    current_maturity.status,
    current_maturity.deleted_at,
    current_maturity.deleted_by
  ) is distinct from (
    excluded.maturity_type,
    excluded.asset_id,
    excluded.lease_contract_id,
    excluded.fund_id,
    excluded.loan_id,
    excluded.target_name_ko,
    excluded.official_date,
    'active',
    null::timestamptz,
    null::uuid
  )
  returning id into v_maturity_id;

  if v_maturity_id is null then
    select maturity.id
    into strict v_maturity_id
    from logistics_core.maturities maturity
    where maturity.maturity_key = v_maturity_key;
  end if;

  if p_maturity_type = 'lease' then
    update logistics_core.maturity_asset_scopes scope
    set retired_at = clock_timestamp(),
        scope_revision = scope.scope_revision + 1
    where scope.maturity_id = v_maturity_id
      and scope.retired_at is null
      and scope.asset_id is distinct from v_asset_id;

    insert into logistics_core.maturity_asset_scopes (maturity_id, asset_id)
    values (v_maturity_id, v_asset_id)
    on conflict (maturity_id, asset_id) where retired_at is null do nothing;
  elsif p_maturity_type = 'fund' then
    update logistics_core.maturity_asset_scopes scope
    set retired_at = clock_timestamp(),
        scope_revision = scope.scope_revision + 1
    where scope.maturity_id = v_maturity_id
      and scope.retired_at is null
      and not exists (
        select 1
        from logistics_core.fund_asset_links link
        where link.fund_id = p_source_id
          and link.asset_id = scope.asset_id
          and link.deleted_at is null
      );

    insert into logistics_core.maturity_asset_scopes (maturity_id, asset_id)
    select v_maturity_id, link.asset_id
    from logistics_core.fund_asset_links link
    where link.fund_id = p_source_id
      and link.deleted_at is null
    on conflict (maturity_id, asset_id) where retired_at is null do nothing;
  else
    update logistics_core.maturity_asset_scopes scope
    set retired_at = clock_timestamp(),
        scope_revision = scope.scope_revision + 1
    where scope.maturity_id = v_maturity_id
      and scope.retired_at is null
      and not (
        (v_asset_id is not null and scope.asset_id = v_asset_id)
        or exists (
          select 1
          from logistics_core.fund_asset_links link
          where link.fund_id = v_fund_id
            and link.asset_id = scope.asset_id
            and link.deleted_at is null
        )
      );

    insert into logistics_core.maturity_asset_scopes (maturity_id, asset_id)
    select v_maturity_id, desired.asset_id
    from (
      select v_asset_id as asset_id
      where v_asset_id is not null
      union
      select link.asset_id
      from logistics_core.fund_asset_links link
      where link.fund_id = v_fund_id
        and link.deleted_at is null
    ) desired
    on conflict (maturity_id, asset_id) where retired_at is null do nothing;
  end if;
end;
$body$;

create or replace function logistics_core.sync_maturity_projection_trigger()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $body$
declare
  v_source_id uuid;
  v_maturity_type text;
begin
  if tg_table_schema <> 'logistics_core' then
    raise exception using errcode = '22023', message = 'UNSUPPORTED_MATURITY_SOURCE_SCHEMA';
  end if;

  if tg_op = 'DELETE' then
    v_source_id := old.id;
  else
    v_source_id := new.id;
  end if;

  v_maturity_type := case tg_table_name
    when 'lease_contracts' then 'lease'
    when 'funds' then 'fund'
    when 'loans' then 'loan'
    else null
  end;

  if v_maturity_type is null then
    raise exception using errcode = '22023', message = 'UNSUPPORTED_MATURITY_SOURCE_TABLE';
  end if;

  perform logistics_core.sync_maturity_projection(v_maturity_type, v_source_id);

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$body$;

revoke execute on function logistics_core.sync_maturity_projection(text, uuid) from public, anon, authenticated;
revoke execute on function logistics_core.sync_maturity_projection_trigger() from public, anon, authenticated;

drop trigger if exists lease_contracts_sync_maturity_projection on logistics_core.lease_contracts;
create trigger lease_contracts_sync_maturity_projection
after insert or update or delete on logistics_core.lease_contracts
for each row execute function logistics_core.sync_maturity_projection_trigger();

drop trigger if exists funds_sync_maturity_projection on logistics_core.funds;
create trigger funds_sync_maturity_projection
after insert or update or delete on logistics_core.funds
for each row execute function logistics_core.sync_maturity_projection_trigger();

drop trigger if exists loans_sync_maturity_projection on logistics_core.loans;
create trigger loans_sync_maturity_projection
after insert or update or delete on logistics_core.loans
for each row execute function logistics_core.sync_maturity_projection_trigger();

-- Repair any pre-existing drift before the triggers begin handling later writes.
do $body$
declare
  source_row record;
begin
  for source_row in select contract.id from logistics_core.lease_contracts contract loop
    perform logistics_core.sync_maturity_projection('lease', source_row.id);
  end loop;

  for source_row in select fund.id from logistics_core.funds fund loop
    perform logistics_core.sync_maturity_projection('fund', source_row.id);
  end loop;

  for source_row in select loan.id from logistics_core.loans loan loop
    perform logistics_core.sync_maturity_projection('loan', source_row.id);
  end loop;
end;
$body$;

-- Abort the migration if an active source still differs from its projection, or
-- if an inactive source remains visible through an active projection.
do $body$
begin
  if exists (
    select 1
    from logistics_core.lease_contracts contract
    left join logistics_core.maturities maturity
      on maturity.lease_contract_id = contract.id
     and maturity.maturity_type = 'lease'
    where contract.deleted_at is null
      and contract.expiry_date is not null
      and (
        maturity.id is null
        or maturity.official_date is distinct from contract.expiry_date
        or maturity.asset_id is distinct from contract.asset_id
        or maturity.status is distinct from 'active'
        or maturity.deleted_at is not null
      )
  ) or exists (
    select 1
    from logistics_core.funds fund
    left join logistics_core.maturities maturity
      on maturity.fund_id = fund.id
     and maturity.maturity_type = 'fund'
    where fund.deleted_at is null
      and fund.maturity_date is not null
      and (
        maturity.id is null
        or maturity.official_date is distinct from fund.maturity_date
        or maturity.status is distinct from 'active'
        or maturity.deleted_at is not null
      )
  ) or exists (
    select 1
    from logistics_core.loans loan
    left join logistics_core.maturities maturity
      on maturity.loan_id = loan.id
     and maturity.maturity_type = 'loan'
    where loan.deleted_at is null
      and loan.source_is_active
      and loan.maturity_date is not null
      and (
        maturity.id is null
        or maturity.official_date is distinct from loan.maturity_date
        or maturity.status is distinct from 'active'
        or maturity.deleted_at is not null
      )
  ) or exists (
    select 1
    from logistics_core.maturities maturity
    left join logistics_core.lease_contracts contract on contract.id = maturity.lease_contract_id
    left join logistics_core.funds fund on fund.id = maturity.fund_id
    left join logistics_core.loans loan on loan.id = maturity.loan_id
    where maturity.deleted_at is null
      and maturity.status = 'active'
      and (
        (maturity.maturity_type = 'lease' and (contract.id is null or contract.deleted_at is not null or contract.expiry_date is null))
        or (maturity.maturity_type = 'fund' and (fund.id is null or fund.deleted_at is not null or fund.maturity_date is null))
        or (maturity.maturity_type = 'loan' and (loan.id is null or loan.deleted_at is not null or not loan.source_is_active or loan.maturity_date is null))
      )
  ) then
    raise exception using errcode = '23514', message = 'MATURITY_SOURCE_SYNC_VALIDATION_FAILED';
  end if;
end;
$body$;

commit;
