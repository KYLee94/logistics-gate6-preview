-- LOGISTICS_FUND_AUM_SOURCE_BACKFILL_V1
--
-- The directly editable AUM shown by the data-management platform represents
-- invested AUM, not benchmark/committed AUM.  The operating legacy projection
-- is the only exact source currently available.  This migration deliberately
-- refuses to infer AUM from investment commitments, acquisition cost, NAV, or
-- any other aggregate.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';
select pg_advisory_xact_lock(hashtextextended('logistics-fund-aum-source-backfill-v1', 0));

create temporary table aum_expected (
  fund_code text primary key,
  expected_benchmark_aum numeric,
  expected_invested_aum numeric
) on commit drop;

insert into aum_expected (fund_code, expected_benchmark_aum, expected_invested_aum)
values
  ('120085', 189228456200, 189228456200),
  ('112527', 214359785594, 214359785594),
  ('112755', 120540000000, 120540000000),
  ('112109', 76000000000, 76000000000),
  ('190002', 265904813630, 265979505630),
  ('112299', 147705990629, 147705990629),
  ('112505', 197603918260, 197603918260),
  ('112127', 425598336160, 425598336160),
  ('P00014', 185000000000, 185000000000),
  ('112703', 177800000000, 177800000000),
  ('S00002', null, null),
  ('112606', 180901725000, 183601578000),
  ('112573', 95489000000, 95495739782),
  ('112751', 588058966310, 588058966310),
  ('112604', 137600000000, 137600000000),
  ('190013', 119660000000, 50592239000),
  ('112642', 237894893070, 237894893070);

create temporary table aum_source_snapshot on commit drop as
select
  expected.fund_code,
  expected.expected_benchmark_aum,
  expected.expected_invested_aum,
  source.fund_id as source_fund_id,
  source.aum_base_date,
  source.aum_input_date,
  source.aum_source,
  source.aum_status,
  source.equity_won,
  source.loan_won,
  source.deposit_won,
  source.benchmark_aum,
  source.invested_equity_won,
  source.invested_loan_won,
  source.invested_deposit_won,
  source.invested_aum,
  target.aum_krw as previous_aum_krw
from aum_expected expected
left join public.v_funds_enriched source
  on source.fund_id = expected.fund_code
left join logistics_core.funds target
  on target.fund_code = expected.fund_code;

do $preflight$
declare
  v_expected_count bigint;
  v_source_count bigint;
  v_present_source_count bigint;
  v_target_count bigint;
begin
  select count(*) into v_expected_count from aum_expected;
  select count(*) into v_source_count from aum_source_snapshot;
  select count(source_fund_id) into v_present_source_count from aum_source_snapshot;
  select count(*) into v_target_count
  from logistics_core.funds target
  join aum_expected expected on expected.fund_code = target.fund_code;

  if v_expected_count <> 17
     or v_source_count <> 17
     or v_present_source_count <> 17
     or v_target_count <> 17 then
    raise exception using errcode = 'PT422', message = 'AUM_SOURCE_ROW_COUNT_MISMATCH';
  end if;

  if exists (
    select source.fund_code
    from aum_source_snapshot source
    where source.benchmark_aum is distinct from source.expected_benchmark_aum
       or source.invested_aum is distinct from source.expected_invested_aum
  ) then
    raise exception using errcode = 'PT422', message = 'AUM_EXACT_SIGNATURE_MISMATCH';
  end if;

  if exists (
    select source.fund_code
    from aum_source_snapshot source
    where source.fund_code <> 'S00002'
      and (
        source.aum_source is distinct from '펀드 AUM 관리_20260713.xlsx'
        or source.aum_input_date is distinct from date '2026-06-30'
        or (
          source.fund_code <> 'P00014'
          and source.aum_base_date is distinct from date '2026-06-30'
        )
        or (
          source.fund_code = 'P00014'
          and source.aum_base_date is not null
        )
        or source.aum_status is distinct from '운용'
      )
  ) or exists (
    select 1
    from aum_source_snapshot source
    where source.fund_code = 'S00002'
      and (
        source.aum_source is distinct from '펀드 AUM 관리_20260515.xlsx'
        or source.aum_base_date is not null
        or source.benchmark_aum is not null
        or source.invested_aum is not null
        or source.equity_won is not null
        or source.loan_won is not null
        or source.deposit_won is not null
        or source.invested_equity_won is not null
        or source.invested_loan_won is not null
        or source.invested_deposit_won is not null
      )
  ) then
    raise exception using errcode = 'PT422', message = 'AUM_SOURCE_ROW_COUNT_MISMATCH';
  end if;

  if exists (
    select source.fund_code
    from aum_source_snapshot source
    where source.fund_code <> 'S00002'
      and (
        source.benchmark_aum is distinct from
          coalesce(source.equity_won, 0)
          + coalesce(source.loan_won, 0)
          + coalesce(source.deposit_won, 0)
        or source.invested_aum is distinct from
          coalesce(source.invested_equity_won, 0)
          + coalesce(source.invested_loan_won, 0)
          + coalesce(source.invested_deposit_won, 0)
      )
  ) then
    raise exception using errcode = 'PT422', message = 'AUM_SOURCE_COMPONENT_SUM_MISMATCH';
  end if;

  if exists (
    select source.fund_code
    from aum_source_snapshot source
    where source.previous_aum_krw is not null
      and source.previous_aum_krw is distinct from source.invested_aum
  ) then
    raise exception using errcode = 'PT422', message = 'AUM_TARGET_CONFLICT';
  end if;
end;
$preflight$;

do $backfill$
declare
  v_updated_count bigint;
begin
  update logistics_core.funds target
  set aum_krw = source.invested_aum
  from aum_source_snapshot source
  where target.fund_code = source.fund_code
    and source.invested_aum is not null
    and target.aum_krw is null;

  get diagnostics v_updated_count = row_count;
  if v_updated_count not in (0, 16) then
    raise exception using errcode = 'PT500', message = 'AUM_UPDATED_COUNT_MISMATCH';
  end if;
end;
$backfill$;

do $readback$
begin
  if exists (
    select source.fund_code
    from aum_source_snapshot source
    join logistics_core.funds target on target.fund_code = source.fund_code
    where source.invested_aum is not null
      and target.aum_krw is distinct from source.invested_aum
  ) then
    raise exception using errcode = 'PT500', message = 'AUM_BACKFILL_READBACK_FAILED';
  end if;

  if exists (
    select 1
    from logistics_core.funds target
    where target.fund_code = 'S00002'
      and target.aum_krw is not null
  ) then
    raise exception using errcode = 'PT500', message = 'AUM_NULL_SOURCE_CHANGED';
  end if;
end;
$readback$;

commit;
