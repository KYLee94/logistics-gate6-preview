-- Gate 6 rent-history latest repair.
-- Purpose:
--   DB_히스토리 누적 can split one DB_일반 lease-space row into several physical
--   rent components. The old latest key collapsed those rows by tenant/floor/zone
--   only, which under-counted assets such as Skybox1/Skybox2.
-- Strategy:
--   1. Re-rank latest rent-history rows by physical component, including rounded
--      leased/exclusive area in the component key.
--   2. For exact same-date/same-component duplicates, keep the row with the larger
--      monthly amount. This avoids the known Skybox 봄날창고 duplicate low-value row
--      replacing the main rent component.
--   3. Recompute ll_lease_spaces current monthly amounts from latest components.

begin;

create temp table gate6_latest_rent_history_component_ranked on commit drop as
select
  rent_history_id,
  (row_number() over (
    partition by
      asset_id,
      tenant_id,
      coalesce(source_contract_lease_space_id, lease_space_id, ''),
      coalesce(floor_label, ''),
      coalesce(detail_area_label, ''),
      coalesce(temperature_type, ''),
      round(coalesce(leased_area_sqm, 0)::numeric, 0),
      round(coalesce(exclusive_area_sqm, 0)::numeric, 0)
    order by
      effective_date desc nulls last,
      (coalesce(monthly_rent_total, 0) + coalesce(monthly_mf_total, 0)) desc,
      source_excel_visible_row desc nulls last,
      source_sheet_row_id desc
  ) = 1) as next_is_latest
from public.ll_rent_history
where source_sheet_row_id like 'sheet_db_history:r%';

with updated_history as (
  update public.ll_rent_history rh
  set
    is_latest = ranked.next_is_latest,
    review_note = concat_ws(
      ' / ',
      nullif(rh.review_note, ''),
      case
        when rh.is_latest is distinct from ranked.next_is_latest
          then 'latest recalculated by physical rent component key'
        else null
      end
    ),
    updated_at = now()
  from gate6_latest_rent_history_component_ranked ranked
  where rh.rent_history_id = ranked.rent_history_id
    and rh.is_latest is distinct from ranked.next_is_latest
  returning rh.rent_history_id
),
latest_amounts as (
  select
    rh.source_contract_lease_space_id as lease_space_id,
    sum(coalesce(rh.monthly_rent_total, 0)) as monthly_rent_total,
    sum(coalesce(rh.monthly_mf_total, 0)) as monthly_mf_total
  from public.ll_rent_history rh
  join gate6_latest_rent_history_component_ranked ranked
    on ranked.rent_history_id = rh.rent_history_id
  where ranked.next_is_latest = true
    and rh.source_contract_lease_space_id is not null
  group by rh.source_contract_lease_space_id
)
update public.ll_lease_spaces ls
set
  current_monthly_rent_total = latest_amounts.monthly_rent_total,
  current_monthly_mf_total = latest_amounts.monthly_mf_total,
  current_monthly_cost_total = latest_amounts.monthly_rent_total + latest_amounts.monthly_mf_total,
  e_noc = case
    when coalesce(ls.leased_area_sqm, 0) > 0
      then round(((latest_amounts.monthly_rent_total + latest_amounts.monthly_mf_total) / (ls.leased_area_sqm * 0.3025))::numeric, 2)
    else null
  end,
  review_status = coalesce(nullif(ls.review_status, ''), 'linked_from_db_history'),
  review_note = concat_ws(
    ' / ',
    nullif(ls.review_note, ''),
    'current amount recalculated from physical rent-history components'
  ),
  updated_at = now()
from latest_amounts
where ls.lease_space_id = latest_amounts.lease_space_id
  and not (
    lower(coalesce(ls.contract_status, '')) like '%superseded%'
    or lower(coalesce(ls.contract_status, '')) like '%inactive%'
    or lower(coalesce(ls.contract_status, '')) like '%expired%'
    or lower(coalesce(ls.contract_status, '')) like '%terminated%'
    or lower(coalesce(ls.contract_status, '')) like '%cancelled%'
  )
  and (
    ls.current_monthly_rent_total is distinct from latest_amounts.monthly_rent_total
    or ls.current_monthly_mf_total is distinct from latest_amounts.monthly_mf_total
    or ls.current_monthly_cost_total is distinct from latest_amounts.monthly_rent_total + latest_amounts.monthly_mf_total
  );

commit;
