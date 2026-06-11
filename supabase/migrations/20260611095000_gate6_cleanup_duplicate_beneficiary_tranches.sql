-- Keep the canonical existing beneficiary tranche rows and retire duplicate
-- Excel backfill rows that have the same fund, party, and committed amount.
with ranked as (
  select
    id,
    row_key,
    row_number() over (
      partition by
        fund_id,
        tranche_type,
        coalesce(party_name, ''),
        coalesce(committed_amount_krw, 0)
      order by
        case when row_key like 'fund_%:beneficiary:%' then 0 else 1 end,
        display_order nulls last,
        updated_at desc nulls last,
        created_at desc nulls last,
        id
    ) as row_rank
  from public.ll_fund_capital_tranches
  where fund_id in ('fund_190002', 'fund_190013')
    and tranche_type = 'beneficiary'
    and is_active is true
    and deleted_at is null
)
update public.ll_fund_capital_tranches t
set
  is_active = false,
  deleted_at = now(),
  updated_at = now()
from ranked r
where t.id = r.id
  and r.row_rank > 1;
