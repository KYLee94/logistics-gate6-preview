begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- A source row marked missing_master_placeholder has no verified human name.
-- Keep it for audit/recovery, but make status = 'inactive' so it cannot appear
-- in the rent-roll tenant selector. Never invent a replacement name.
update logistics_core.tenants tenant
set status = 'inactive'
from (
  select to_jsonb(legacy_tenant) as source_row
  from public.ll_tenants legacy_tenant
) source
where tenant.tenant_key = source.source_row->>'tenant_id'
  and source.source_row->>'match_status' = 'missing_master_placeholder'
  and tenant.deleted_at is null
  and not exists (
    select 1
    from logistics_core.lease_contracts contract
    where contract.tenant_id = tenant.id and contract.deleted_at is null
  );

notify pgrst, 'reload schema';

commit;
