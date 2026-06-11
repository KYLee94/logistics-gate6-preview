-- Keep one active capital tranche per identical fund/tranche/party/amount/date tuple
-- for the newly linked Yatap and Pocheon funds. Prefer the latest explicit
-- 260520 workbook row keys added by 20260611093000.

with ranked as (
  select
    id,
    row_number() over (
      partition by
        fund_id,
        tranche_type,
        coalesce(tranche, ''),
        coalesce(party_name, ''),
        coalesce(committed_amount_krw, 0),
        coalesce(drawdown_date, date '1900-01-01'),
        coalesce(maturity_date, date '1900-01-01')
      order by
        case when row_key like 'xlsx-260520-%' then 0 else 1 end,
        updated_at desc nulls last,
        created_at desc nulls last,
        row_key desc
    ) as rn
  from public.ll_fund_capital_tranches
  where fund_id in ('fund_190002', 'fund_190013')
    and is_active is true
)
update public.ll_fund_capital_tranches t
set is_active = false,
    deleted_at = now(),
    updated_at = now(),
    source_payload = coalesce(t.source_payload, '{}'::jsonb) || jsonb_build_object(
      'dedupeMigration', '20260611094000_gate6_dedupe_yatap_pocheon_fund_tranches',
      'dedupeReason', 'duplicate active row for the same source tranche'
    )
from ranked r
where t.id = r.id
  and r.rn > 1;
