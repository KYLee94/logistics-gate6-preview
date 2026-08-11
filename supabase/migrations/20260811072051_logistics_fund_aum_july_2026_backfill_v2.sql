-- LOGISTICS_FUND_AUM_JULY_2026_BACKFILL_V2
--
-- Authoritative source: C:/Users/10524/Downloads/펀드 AUM 관리_20260811.xlsx
-- source_sheet: sheet
-- source_sha256: 7E208A0BF0FEE7702DAC06EE808E7B2A93AF30165A96C6767FD327B370E2EB3C
-- source_columns: A=fund_code, M=input_date, R=invested_equity, S=invested_loan, T=invested_deposit, U=invested_aum
--
-- The visible AUM remains the source workbook's invested-AUM total.  This
-- migration does not infer AUM from commitment, benchmark AUM, NAV, or any
-- other amount.  The workbook has no S00002 row, so that fund remains null.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';
select pg_advisory_xact_lock(hashtextextended('logistics-fund-aum-july-2026-backfill-v2', 0));

create temporary table aum_july_2026_source (
  fund_code text primary key,
  source_excel_row integer not null,
  source_input_date date not null,
  invested_equity numeric not null,
  invested_loan numeric not null,
  invested_deposit numeric not null,
  invested_aum numeric not null,
  expected_previous_aum numeric not null
) on commit drop;

insert into aum_july_2026_source (
  fund_code,
  source_excel_row,
  source_input_date,
  invested_equity,
  invested_loan,
  invested_deposit,
  invested_aum,
  expected_previous_aum
)
values
  ('112109', 40, date '2026-07-31', 28000000000, 48000000000, 0, 76000000000, 76000000000),
  ('112127', 43, date '2026-07-31', 208174063584, 210500000000, 6924272576, 425598336160, 425598336160),
  ('112299', 85, date '2026-07-31', 72970776710, 71852000000, 2671790940, 147494567650, 147705990629),
  ('112505', 131, date '2026-07-31', 54449350000, 140597938000, 2556630260, 197603918260, 197603918260),
  ('112527', 137, date '2026-07-31', 211600000000, 0, 2759785594, 214359785594, 214359785594),
  ('112573', 147, date '2026-07-31', 44506739782, 46500000000, 4489000000, 95495739782, 95495739782),
  ('112604', 167, date '2026-07-31', 66100000000, 71500000000, 0, 137600000000, 137600000000),
  ('112606', 168, date '2026-07-31', 57799853000, 122500000000, 3301725000, 183601578000, 183601578000),
  ('112642', 182, date '2026-07-31', 61500000000, 169500000000, 6894893070, 237894893070, 237894893070),
  ('112703', 209, date '2026-07-31', 111000000000, 56800000000, 10000000000, 177800000000, 177800000000),
  ('112751', 218, date '2026-07-31', 237120581000, 342600000000, 8338385310, 588058966310, 588058966310),
  ('112755', 219, date '2026-07-31', 60590000000, 59950000000, 0, 120540000000, 120540000000),
  ('120085', 241, date '2026-07-31', 53500000000, 130000000000, 5728456200, 189228456200, 189228456200),
  ('190002', 251, date '2026-07-31', 100074692000, 162400000000, 3504813630, 265979505630, 265979505630),
  ('190013', 256, date '2026-07-31', 50592239000, 0, 0, 50592239000, 50592239000),
  ('P00014', 337, date '2026-07-31', 10000000000, 175000000000, 0, 185000000000, 185000000000);

create temporary table aum_july_2026_target_set (
  fund_code text primary key
) on commit drop;

insert into aum_july_2026_target_set (fund_code)
values
  ('112109'),
  ('112127'),
  ('112299'),
  ('112505'),
  ('112527'),
  ('112573'),
  ('112604'),
  ('112606'),
  ('112642'),
  ('112703'),
  ('112751'),
  ('112755'),
  ('120085'),
  ('190002'),
  ('190013'),
  ('P00014'),
  ('S00002');

create temporary table aum_july_2026_snapshot on commit drop as
select
  expected.fund_code,
  source.source_excel_row,
  source.source_input_date,
  source.invested_equity,
  source.invested_loan,
  source.invested_deposit,
  source.invested_aum,
  source.expected_previous_aum,
  target.fund_code as target_fund_code,
  target.aum_krw as previous_aum_krw
from aum_july_2026_target_set expected
left join aum_july_2026_source source
  on source.fund_code = expected.fund_code
left join logistics_core.funds target
  on target.fund_code = expected.fund_code;

do $preflight$
declare
  v_source_count bigint;
  v_target_count bigint;
  v_matched_target_count bigint;
begin
  select count(*) into v_source_count
  from aum_july_2026_source;

  if v_source_count <> 16 then
    raise exception using errcode = 'PT422', message = 'AUM_JULY_SOURCE_ROW_COUNT_MISMATCH';
  end if;

  if exists (
    select 1
    from aum_july_2026_source source
    where source.source_input_date is distinct from date '2026-07-31'
  ) then
    raise exception using errcode = 'PT422', message = 'AUM_JULY_SOURCE_DATE_MISMATCH';
  end if;

  if exists (
    select 1
    from aum_july_2026_source source
    where source.invested_aum is distinct from
      source.invested_equity + source.invested_loan + source.invested_deposit
  ) then
    raise exception using errcode = 'PT422', message = 'AUM_JULY_COMPONENT_SUM_MISMATCH';
  end if;

  select count(*) into v_target_count
  from logistics_core.funds;

  select count(target_fund_code) into v_matched_target_count
  from aum_july_2026_snapshot;

  if v_target_count <> 17 or v_matched_target_count <> 17 then
    raise exception using errcode = 'PT422', message = 'AUM_JULY_TARGET_FUND_SET_MISMATCH';
  end if;

  if exists (
    select 1
    from aum_july_2026_snapshot source
    where source.fund_code <> 'S00002'
      and source.previous_aum_krw is distinct from source.expected_previous_aum
      and source.previous_aum_krw is distinct from source.invested_aum
  ) then
    raise exception using errcode = 'PT422', message = 'AUM_JULY_TARGET_CONFLICT';
  end if;

  if exists (
    select 1
    from aum_july_2026_snapshot source
    where source.fund_code = 'S00002'
      and (
        source.source_excel_row is not null
        or source.invested_aum is not null
        or source.previous_aum_krw is not null
      )
  ) then
    raise exception using errcode = 'PT422', message = 'AUM_JULY_NULL_SOURCE_CHANGED';
  end if;
end;
$preflight$;

do $backfill$
declare
  v_updated_count bigint;
begin
  update logistics_core.funds target
  set aum_krw = source.invested_aum
  from aum_july_2026_source source
  where target.fund_code = source.fund_code
    and target.aum_krw is distinct from source.invested_aum;

  get diagnostics v_updated_count = row_count;
  if v_updated_count not in (0, 1) then
    raise exception using errcode = 'PT500', message = 'AUM_JULY_UPDATED_COUNT_MISMATCH';
  end if;
end;
$backfill$;

do $readback$
begin
  if exists (
    select 1
    from aum_july_2026_source source
    join logistics_core.funds target
      on target.fund_code = source.fund_code
    where target.aum_krw is distinct from source.invested_aum
  ) then
    raise exception using errcode = 'PT500', message = 'AUM_JULY_BACKFILL_READBACK_FAILED';
  end if;

  if exists (
    select 1
    from logistics_core.funds target
    where target.fund_code = 'S00002'
      and target.aum_krw is not null
  ) then
    raise exception using errcode = 'PT500', message = 'AUM_JULY_NULL_SOURCE_CHANGED';
  end if;
end;
$readback$;

commit;
