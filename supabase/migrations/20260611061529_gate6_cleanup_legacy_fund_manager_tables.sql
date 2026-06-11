-- Gate 6 cleanup: remove duplicate legacy fund/manager tables.
--
-- qveg preflight on 2026-06-11:
--   - public.ll_fund_beneficiaries: table, 4 rows
--   - public.ll_fund_lenders: table, 4 rows
--   - public.ll_asset_managers: table, 19 rows
--   - public.ll_fund_capital_tranches: table, 111 rows
--   - No dependent views/functions were found for the three legacy tables.
--
-- Strategy:
--   1. Preserve legacy rows in ll_audit_events.
--   2. Insert only missing beneficiary/loan rows into ll_fund_capital_tranches.
--   3. Ensure ll_assets.current_manager_* has manager data before dropping ll_asset_managers.
--   4. Drop duplicate legacy physical tables without cascade.

begin;

do $$
begin
  if to_regclass('public.ll_fund_capital_tranches') is null then
    raise exception 'stop: public.ll_fund_capital_tranches is missing';
  end if;

  if to_regclass('public.ll_assets') is null then
    raise exception 'stop: public.ll_assets is missing';
  end if;
end $$;

insert into public.ll_audit_events (event_type, legacy_table, legacy_id, event_payload, created_at, updated_at)
select 'legacy_row_archive',
       'public.ll_fund_beneficiaries',
       b.beneficiary_id,
       to_jsonb(b),
       now(),
       now()
from public.ll_fund_beneficiaries b
where to_regclass('public.ll_fund_beneficiaries') is not null
  and not exists (
    select 1
    from public.ll_audit_events e
    where e.event_type = 'legacy_row_archive'
      and e.legacy_table = 'public.ll_fund_beneficiaries'
      and e.legacy_id = b.beneficiary_id
  );

insert into public.ll_audit_events (event_type, legacy_table, legacy_id, event_payload, created_at, updated_at)
select 'legacy_row_archive',
       'public.ll_fund_lenders',
       l.lender_id,
       to_jsonb(l),
       now(),
       now()
from public.ll_fund_lenders l
where to_regclass('public.ll_fund_lenders') is not null
  and not exists (
    select 1
    from public.ll_audit_events e
    where e.event_type = 'legacy_row_archive'
      and e.legacy_table = 'public.ll_fund_lenders'
      and e.legacy_id = l.lender_id
  );

insert into public.ll_audit_events (event_type, legacy_table, legacy_id, event_payload, created_at, updated_at)
select 'legacy_row_archive',
       'public.ll_asset_managers',
       m.asset_manager_id,
       to_jsonb(m),
       now(),
       now()
from public.ll_asset_managers m
where to_regclass('public.ll_asset_managers') is not null
  and not exists (
    select 1
    from public.ll_audit_events e
    where e.event_type = 'legacy_row_archive'
      and e.legacy_table = 'public.ll_asset_managers'
      and e.legacy_id = m.asset_manager_id
  );

insert into public.ll_fund_capital_tranches (
  fund_id,
  tranche_type,
  row_key,
  tranche,
  party_name,
  committed_amount_krw,
  display_order,
  is_active,
  source_type,
  source_name,
  source_sheet_name,
  source_row_number,
  source_payload,
  created_at,
  updated_at
)
select b.fund_id,
       'beneficiary',
       'legacy-beneficiary:' || coalesce(nullif(b.source_pk, ''), b.beneficiary_id),
       coalesce(nullif(b.tranche, ''), '수익자'),
       b.beneficiary_name,
       b.investment_amount_krw,
       row_number() over (partition by b.fund_id order by b.source_ref, b.beneficiary_id),
       true,
       coalesce(nullif(b.source_system, ''), 'legacy_table'),
       coalesce(nullif(b.source_payload->>'source', ''), nullif(b.source_table, ''), 'll_fund_beneficiaries'),
       coalesce(nullif(b.source_payload->>'sheetName', ''), '수익자 정보'),
       nullif(b.source_payload->>'sourceRow', '')::integer,
       coalesce(b.source_payload, '{}'::jsonb) || jsonb_build_object(
         'legacyTable', 'll_fund_beneficiaries',
         'legacyId', b.beneficiary_id,
         'legacySourcePk', b.source_pk
       ),
       now(),
       now()
from public.ll_fund_beneficiaries b
where to_regclass('public.ll_fund_beneficiaries') is not null
  and not exists (
    select 1
    from public.ll_fund_capital_tranches c
    where c.fund_id = b.fund_id
      and c.tranche_type = 'beneficiary'
      and c.is_active is true
      and coalesce(c.party_name, '') = coalesce(b.beneficiary_name, '')
      and coalesce(c.committed_amount_krw, 0) = coalesce(b.investment_amount_krw, 0)
  )
on conflict (fund_id, tranche_type, row_key) do update
set tranche = excluded.tranche,
    party_name = excluded.party_name,
    committed_amount_krw = excluded.committed_amount_krw,
    source_payload = public.ll_fund_capital_tranches.source_payload || excluded.source_payload,
    updated_at = now();

insert into public.ll_fund_capital_tranches (
  fund_id,
  tranche_type,
  row_key,
  tranche,
  party_name,
  committed_amount_krw,
  drawdown_date,
  maturity_date,
  loan_type,
  interest_type,
  base_rate,
  spread_rate,
  loan_rate,
  interest_rate,
  fee_rate,
  all_in_rate,
  display_order,
  is_active,
  source_type,
  source_name,
  source_sheet_name,
  source_row_number,
  source_payload,
  created_at,
  updated_at
)
select l.fund_id,
       'loan',
       'legacy-loan:' || coalesce(nullif(l.source_pk, ''), l.lender_id),
       l.tranche,
       l.lender_name,
       l.drawn_amount_krw,
       l.drawn_at,
       l.maturity_at,
       l.loan_type,
       l.interest_type,
       nullif(l.base_rate_pct::text, ''),
       nullif(l.spread_rate_pct::text, ''),
       nullif(l.loan_rate_pct::text, ''),
       nullif(l.loan_rate_pct::text, ''),
       nullif(l.fee_rate_pct::text, ''),
       nullif(l.all_in_pct::text, ''),
       100 + row_number() over (partition by l.fund_id order by l.source_ref, l.lender_id),
       true,
       coalesce(nullif(l.source_system, ''), 'legacy_table'),
       coalesce(nullif(l.source_payload->>'source', ''), nullif(l.source_table, ''), 'll_fund_lenders'),
       coalesce(nullif(l.source_payload->>'sheetName', ''), '대주 정보'),
       nullif(l.source_payload->>'sourceRow', '')::integer,
       coalesce(l.source_payload, '{}'::jsonb) || jsonb_build_object(
         'legacyTable', 'll_fund_lenders',
         'legacyId', l.lender_id,
         'legacySourcePk', l.source_pk
       ),
       now(),
       now()
from public.ll_fund_lenders l
where to_regclass('public.ll_fund_lenders') is not null
  and not exists (
    select 1
    from public.ll_fund_capital_tranches c
    where c.fund_id = l.fund_id
      and c.tranche_type = 'loan'
      and c.is_active is true
      and coalesce(c.party_name, '') = coalesce(l.lender_name, '')
      and coalesce(c.tranche, '') = coalesce(l.tranche, '')
      and coalesce(c.committed_amount_krw, 0) = coalesce(l.drawn_amount_krw, 0)
      and coalesce(c.drawdown_date, date '0001-01-01') = coalesce(l.drawn_at, date '0001-01-01')
      and coalesce(c.maturity_date, date '0001-01-01') = coalesce(l.maturity_at, date '0001-01-01')
  )
on conflict (fund_id, tranche_type, row_key) do update
set tranche = excluded.tranche,
    party_name = excluded.party_name,
    committed_amount_krw = excluded.committed_amount_krw,
    drawdown_date = excluded.drawdown_date,
    maturity_date = excluded.maturity_date,
    loan_type = excluded.loan_type,
    interest_type = excluded.interest_type,
    base_rate = excluded.base_rate,
    spread_rate = excluded.spread_rate,
    loan_rate = excluded.loan_rate,
    interest_rate = excluded.interest_rate,
    fee_rate = excluded.fee_rate,
    all_in_rate = excluded.all_in_rate,
    source_payload = public.ll_fund_capital_tranches.source_payload || excluded.source_payload,
    updated_at = now();

update public.ll_assets a
set current_manager_name = coalesce(nullif(a.current_manager_name, ''), nullif(m.manager_name, '')),
    current_manager_team = coalesce(nullif(a.current_manager_team, ''), nullif(m.organization, '')),
    current_manager_email = coalesce(nullif(a.current_manager_email, ''), nullif(m.email, '')),
    updated_at = now()
from public.ll_asset_managers m
where to_regclass('public.ll_asset_managers') is not null
  and a.asset_id = m.asset_id
  and (
    nullif(a.current_manager_name, '') is null
    or nullif(a.current_manager_team, '') is null
    or nullif(a.current_manager_email, '') is null
  );

drop table if exists public.ll_fund_beneficiaries;
drop table if exists public.ll_fund_lenders;
drop table if exists public.ll_asset_managers;

update public.ll_schema_metadata
set is_active = false,
    role_category = 'dropped_legacy_table',
    description = concat_ws(' ', nullif(description, ''), 'Dropped by 20260611061529 cleanup after data was preserved in ll_fund_capital_tranches, ll_assets, and ll_audit_events.'),
    updated_at = now()
where table_schema = 'public'
  and table_name in ('ll_fund_beneficiaries', 'll_fund_lenders', 'll_asset_managers');

insert into public.ll_schema_metadata (
  metadata_key,
  object_type,
  table_schema,
  table_name,
  domain_group,
  role_category,
  description,
  is_active,
  created_at,
  updated_at
)
values
  ('public.ll_fund_beneficiaries', 'table', 'public', 'll_fund_beneficiaries', 'Fund', 'dropped_legacy_table', 'Legacy beneficiary table dropped after consolidation into ll_fund_capital_tranches.', false, now(), now()),
  ('public.ll_fund_lenders', 'table', 'public', 'll_fund_lenders', 'Fund', 'dropped_legacy_table', 'Legacy lender table dropped after consolidation into ll_fund_capital_tranches.', false, now(), now()),
  ('public.ll_asset_managers', 'table', 'public', 'll_asset_managers', 'Asset', 'dropped_legacy_table', 'Legacy asset manager table dropped after manager fields were retained on ll_assets.', false, now(), now())
on conflict (metadata_key) do update
set object_type = excluded.object_type,
    domain_group = excluded.domain_group,
    role_category = excluded.role_category,
    description = excluded.description,
    is_active = false,
    updated_at = now();

commit;
