with legacy as (
  select
    to_jsonb(source) as source_row,
    coalesce(
      nullif(to_jsonb(source)->>'rent_history_id', ''),
      'rent_' || substr(md5(to_jsonb(source)::text), 1, 24)
    ) as expected_rent_term_key
  from public.ll_rent_history source
)
select
  legacy.expected_rent_term_key,
  legacy.source_row->>'rent_history_id' as rent_history_id,
  legacy.source_row->>'lease_space_id' as lease_space_id,
  legacy.source_row->>'effective_date' as effective_date,
  legacy.source_row->>'period_start' as period_start,
  legacy.source_row->>'effective_end_date' as effective_end_date,
  legacy.source_row->>'period_end' as period_end,
  allocation.contract_space_key,
  target.rent_term_key as migrated_rent_term_key
from legacy
left join logistics_core.contract_spaces allocation
  on allocation.contract_space_key = 'contract_space_' || (legacy.source_row->>'lease_space_id')
left join logistics_core.rent_terms target
  on target.rent_term_key = legacy.expected_rent_term_key
where target.id is null
order by legacy.expected_rent_term_key;
