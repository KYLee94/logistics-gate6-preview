-- LOGISTICS_FINANCE_CANONICAL_HIERARCHY_V2
-- Replaces the stored OPERATING_REVENUE subtotal with five editable revenue
-- accounts.  Derived subtotal rows remain read-time calculations only.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '90s';
select pg_advisory_xact_lock(hashtextextended('logistics-finance-canonical-hierarchy-v2', 0));

create temporary table finance_hierarchy_catalog (
  section_name text not null,
  display_order integer not null,
  account_code text not null,
  label text not null,
  normal_sign integer not null,
  selected boolean not null,
  primary key (account_code)
) on commit drop;

insert into finance_hierarchy_catalog values
  ('potential_income', 10, 'RENT_REVENUE', '임대수익', 1, true),
  ('potential_income', 20, 'MANAGEMENT_FEE_INCOME', '관리비수익', 1, true),
  ('potential_income', 30, 'UTILITIES_REIMBURSEMENT_INCOME', '수도광열비 회수수익', 1, true),
  ('potential_income', 40, 'INTEREST_INCOME', '이자수익', 1, true),
  ('potential_income', 50, 'MISCELLANEOUS_INCOME', '기타수익', 1, true),
  ('operating_expense', 10, 'PM_FEE', 'PM 수수료', -1, true),
  ('operating_expense', 20, 'FM_FEE', 'FM 수수료', -1, true),
  ('operating_expense', 30, 'REPAIRS_MAINTENANCE', '수선유지비', -1, true),
  ('operating_expense', 40, 'UTILITIES', '수도광열비', -1, true),
  ('operating_expense', 50, 'PROPERTY_INSURANCE', '보험료', -1, true),
  ('operating_expense', 60, 'BUILDING_PROPERTY_TAX', '건물 재산세', -1, true),
  ('operating_expense', 70, 'LAND_PROPERTY_TAX', '토지 재산세', -1, true),
  ('operating_expense', 80, 'COMPREHENSIVE_REAL_ESTATE_TAX', '종합부동산세', -1, true),
  ('operating_expense', 90, 'ROAD_OCCUPANCY_FEE', '도로점용료', -1, true),
  ('operating_expense', 100, 'DEEMED_RENT_VAT', '간주임대료 부가세', -1, true),
  ('operating_expense', 110, 'OTHER_TAXES', '기타 세금', -1, true),
  ('operating_expense', 120, 'OTHER_PROPERTY_OPEX', '기타 운영비', -1, true),
  ('below_noi', 10, 'AMC_FEE', 'AMC 수수료', -1, true),
  ('below_noi', 20, 'CUSTODY_FEE', '자산보관 수수료', -1, true),
  ('below_noi', 30, 'GENERAL_ADMIN_TRUSTEE_FEE', '일반사무·수탁 수수료', -1, true),
  ('below_noi', 40, 'CAPEX', '자본적 지출', -1, true),
  ('below_noi', 50, 'TENANT_IMPROVEMENT', '임차인 시설공사비(TI)', -1, true),
  ('below_noi', 60, 'LEASING_COMMISSION', '임대 중개수수료(LC)', -1, true),
  ('debt_service', 10, 'INTEREST_PAID', '이자 지급액', -1, true),
  ('debt_service', 20, 'PRINCIPAL_REPAYMENT', '원금 상환액', -1, false),
  ('debt_service', 30, 'LOAN_FEE', '대출 관련 수수료', -1, false),
  ('cash_flow', 10, 'OTHER_CASH_INFLOW', '기타 현금유입', 1, true),
  ('cash_flow', 20, 'OTHER_CASH_OUTFLOW', '기타 현금유출', -1, true),
  ('cash_balance', 10, 'OPENING_CASH_BALANCE', '기초 현금잔액', 1, true);

create or replace function logistics_core.is_legacy_finance_standard(p_row jsonb)
returns boolean
language sql
immutable
set search_path = pg_catalog
as $function$
  select coalesce(p_row->>'account_code', '') = any(array[
    'OPERATING_REVENUE',
    'PM_FEE', 'FM_FEE', 'REPAIRS_MAINTENANCE', 'UTILITIES',
    'PROPERTY_TAX_PUBLIC_DUES', 'PROPERTY_INSURANCE', 'GENERAL_PROPERTY_ADMIN', 'OTHER_PROPERTY_OPEX',
    'CAPEX', 'TENANT_IMPROVEMENT', 'LEASING_COMMISSION', 'CAPITAL_RESERVE',
    'AMC_FEE', 'CUSTODY_FEE', 'GENERAL_ADMIN_TRUSTEE_FEE', 'OTHER_OWNER_COST', 'NONCASH_ADDBACK',
    'INTEREST_PAID', 'PRINCIPAL_REPAYMENT', 'LOAN_FEE',
    'OTHER_CASH_INFLOW', 'OTHER_CASH_OUTFLOW', 'OPENING_CASH_BALANCE'
  ]::text[]);
$function$;

create temporary table finance_hierarchy_before on commit drop as
select document.asset_code, document.statement
from logistics_core.income_expense document;

create temporary table finance_hierarchy_custom_before on commit drop as
select snapshot.asset_code, section.section_name, item.ordinality,
  coalesce(nullif(btrim(item.value->>'label'), ''), nullif(btrim(item.value->>'name'), '')) as label,
  item.value->'selected' as selected,
  item.value->'amounts' as amounts
from finance_hierarchy_before snapshot
cross join lateral unnest(array[
  'potential_income', 'income_loss', 'operating_expense', 'below_noi',
  'debt_service', 'cash_flow', 'cash_balance'
]::text[]) section(section_name)
cross join lateral jsonb_array_elements(snapshot.statement->section.section_name)
  with ordinality item(value, ordinality)
where not logistics_core.is_legacy_finance_standard(item.value);

do $preflight$
declare
  v_document_count bigint;
  v_total_row_count bigint;
  v_standard_count bigint;
  v_operating_revenue_count bigint;
  v_custom_count bigint;
  v_amount_cell_count bigint;
  v_period_count bigint;
begin
  select count(*), coalesce(sum(jsonb_array_length(statement->'periods')), 0)
  into v_document_count, v_period_count
  from pg_temp.finance_hierarchy_before;
  if v_document_count <> 19 then
    raise exception using errcode = 'PT422', message = 'FINANCE_CANONICAL_HIERARCHY_DOCUMENT_COUNT_MISMATCH';
  end if;
  if v_period_count <> 0 then
    raise exception using errcode = 'PT422', message = 'FINANCE_CANONICAL_HIERARCHY_PERIOD_DATA_PRESENT';
  end if;

  select count(*),
    count(*) filter (where logistics_core.is_legacy_finance_standard(item.value)),
    count(*) filter (where item.value->>'account_code' = 'OPERATING_REVENUE')
  into v_total_row_count, v_standard_count, v_operating_revenue_count
  from pg_temp.finance_hierarchy_before snapshot
  cross join lateral unnest(array[
    'potential_income', 'income_loss', 'operating_expense', 'below_noi',
    'debt_service', 'cash_flow', 'cash_balance'
  ]::text[]) section(section_name)
  cross join lateral jsonb_array_elements(snapshot.statement->section.section_name) item(value);

  select count(*) into v_custom_count from pg_temp.finance_hierarchy_custom_before;
  if v_total_row_count <> 457 or v_standard_count <> 456
     or v_operating_revenue_count <> 19 or v_custom_count <> 1 then
    raise exception using errcode = 'PT422', message = 'FINANCE_CANONICAL_HIERARCHY_SOURCE_SIGNATURE_MISMATCH';
  end if;
  if not exists (
    select 1 from pg_temp.finance_hierarchy_custom_before
    where section_name = 'debt_service' and label = '가나다'
      and selected = 'true'::jsonb and amounts = '{}'::jsonb
  ) then
    raise exception using errcode = 'PT422', message = 'FINANCE_CANONICAL_HIERARCHY_SOURCE_SIGNATURE_MISMATCH';
  end if;

  select count(*) into v_amount_cell_count
  from pg_temp.finance_hierarchy_before snapshot
  cross join lateral unnest(array[
    'potential_income', 'income_loss', 'operating_expense', 'below_noi',
    'debt_service', 'cash_flow', 'cash_balance'
  ]::text[]) section(section_name)
  cross join lateral jsonb_array_elements(snapshot.statement->section.section_name) item(value)
  cross join lateral jsonb_each(coalesce(item.value->'amounts', '{}'::jsonb)) amount(key, value);
  if v_amount_cell_count <> 0 then
    raise exception using errcode = 'PT422', message = 'FINANCE_CANONICAL_HIERARCHY_AMOUNT_DATA_PRESENT';
  end if;
end;
$preflight$;

create or replace function logistics_core.build_finance_hierarchy_section(
  p_statement jsonb,
  p_section text
)
returns jsonb
language sql
stable
set search_path = pg_catalog, logistics_core, pg_temp
as $function$
  with standard_rows as (
    select jsonb_build_object(
      'account_code', catalog.account_code,
      'statement_section', catalog.section_name,
      'label', catalog.label,
      'normal_sign', catalog.normal_sign,
      'selected', catalog.selected,
      'amounts', '{}'::jsonb
    ) as row_value, catalog.display_order::bigint as row_order
    from pg_temp.finance_hierarchy_catalog catalog
    where catalog.section_name = p_section
  ), custom_rows as (
    select jsonb_build_object(
      'account_code', case
        when nullif(btrim(item.value->>'account_code'), '') is null
          or item.value->>'account_code' like 'DOCUMENT:%'
          then 'CUSTOM:' || upper(p_section) || ':' ||
            coalesce(nullif(btrim(item.value->>'label'), ''), nullif(btrim(item.value->>'name'), ''))
        else item.value->>'account_code'
      end,
      'statement_section', p_section,
      'label', coalesce(nullif(btrim(item.value->>'label'), ''), nullif(btrim(item.value->>'name'), '')),
      'normal_sign', coalesce((item.value->>'normal_sign')::integer,
        case when p_section in ('potential_income', 'cash_balance') then 1 else -1 end),
      'selected', item.value->'selected',
      'amounts', item.value->'amounts'
    ) as row_value, (100000 + item.ordinality)::bigint as row_order
    from jsonb_array_elements(p_statement->p_section) with ordinality item(value, ordinality)
    where not logistics_core.is_legacy_finance_standard(item.value)
  )
  select coalesce(jsonb_agg(row_value order by row_order), '[]'::jsonb)
  from (select * from standard_rows union all select * from custom_rows) rows;
$function$;

create or replace function logistics_core.canonicalize_finance_hierarchy(p_statement jsonb)
returns jsonb
language sql
stable
set search_path = pg_catalog, logistics_core
as $function$
  select jsonb_build_object(
    'periods', p_statement->'periods',
    'potential_income', logistics_core.build_finance_hierarchy_section(p_statement, 'potential_income'),
    'income_loss', logistics_core.build_finance_hierarchy_section(p_statement, 'income_loss'),
    'operating_expense', logistics_core.build_finance_hierarchy_section(p_statement, 'operating_expense'),
    'below_noi', logistics_core.build_finance_hierarchy_section(p_statement, 'below_noi'),
    'debt_service', logistics_core.build_finance_hierarchy_section(p_statement, 'debt_service'),
    'cash_flow', logistics_core.build_finance_hierarchy_section(p_statement, 'cash_flow'),
    'cash_balance', logistics_core.build_finance_hierarchy_section(p_statement, 'cash_balance')
  );
$function$;

update logistics_core.income_expense document
set statement = logistics_core.canonicalize_finance_hierarchy(document.statement);

do $backfill_readback$
declare
  v_revenue_canonical_count bigint;
begin
  if exists (
    select 1
    from pg_temp.finance_hierarchy_before before_document
    join logistics_core.income_expense after_document using (asset_code)
    where before_document.statement->'periods' is distinct from after_document.statement->'periods'
  ) then
    raise exception using errcode = 'PT500', message = 'FINANCE_CANONICAL_HIERARCHY_READBACK_FAILED';
  end if;

  select min(canonical_count) into v_revenue_canonical_count
  from (
    select document.asset_code, count(*) as canonical_count
    from logistics_core.income_expense document
    cross join lateral jsonb_array_elements(document.statement->'potential_income') item(value)
    where item.value->>'account_code' = any(array[
      'RENT_REVENUE', 'MANAGEMENT_FEE_INCOME', 'UTILITIES_REIMBURSEMENT_INCOME',
      'INTEREST_INCOME', 'MISCELLANEOUS_INCOME'
    ]::text[])
    group by document.asset_code
  ) counts;
  if v_revenue_canonical_count <> 5 then
    raise exception using errcode = 'PT500', message = 'FINANCE_CANONICAL_HIERARCHY_READBACK_FAILED';
  end if;

  if exists (
    select 1 from logistics_core.income_expense document
    cross join lateral unnest(array[
      'potential_income', 'income_loss', 'operating_expense', 'below_noi',
      'debt_service', 'cash_flow', 'cash_balance'
    ]::text[]) section(section_name)
    cross join lateral jsonb_array_elements(document.statement->section.section_name) item(value)
    where item.value->>'account_code' = 'OPERATING_REVENUE'
       or item.value->>'account_code' like 'DOCUMENT:%'
  ) then
    raise exception using errcode = 'PT500', message = 'FINANCE_CANONICAL_HIERARCHY_READBACK_FAILED';
  end if;

  if exists (
    with after_custom as (
      select document.asset_code, section.section_name, item.ordinality,
        item.value->>'label' as label, item.value->'selected' as selected,
        item.value->'amounts' as amounts
      from logistics_core.income_expense document
      cross join lateral unnest(array[
        'potential_income', 'income_loss', 'operating_expense', 'below_noi',
        'debt_service', 'cash_flow', 'cash_balance'
      ]::text[]) section(section_name)
      cross join lateral jsonb_array_elements(document.statement->section.section_name)
        with ordinality item(value, ordinality)
      where item.value->>'account_code' like 'CUSTOM:%'
    )
    (select asset_code, section_name, label, selected, amounts
       from pg_temp.finance_hierarchy_custom_before
     except select asset_code, section_name, label, selected, amounts from after_custom)
    union all
    (select asset_code, section_name, label, selected, amounts from after_custom
     except select asset_code, section_name, label, selected, amounts
       from pg_temp.finance_hierarchy_custom_before)
  ) then
    raise exception using errcode = 'PT500', message = 'FINANCE_CANONICAL_HIERARCHY_CUSTOM_CHANGED';
  end if;
end;
$backfill_readback$;

create or replace function logistics_core.finance_account_code(p_section text, p_row jsonb)
returns text
language plpgsql
immutable
set search_path = pg_catalog
as $body$
declare
  v_code text := nullif(btrim(p_row->>'account_code'), '');
  v_label text := regexp_replace(btrim(coalesce(p_row->>'label', p_row->>'name', '')), '[[:space:]]+', '', 'g');
begin
  if v_code like 'DOCUMENT:%' then
    raise exception using errcode = 'PT422', message = 'FINANCE_DOCUMENT_ACCOUNT_CODE_FORBIDDEN';
  end if;
  if v_code = any(array[
    'OPERATING_REVENUE', 'NET_OPERATING_INCOME', 'PRE_DEBT_CASH_FLOW',
    'AFTER_DEBT_SERVICE_CASH_FLOW', 'NET_CASH_FLOW', 'CUMULATIVE_NET_CASH_FLOW',
    'CLOSING_CASH_BALANCE'
  ]::text[]) then
    raise exception using errcode = 'PT422', message = 'FINANCE_DERIVED_ROW_STORAGE_FORBIDDEN';
  end if;
  if v_code = any(array[
    'RENT_REVENUE', 'MANAGEMENT_FEE_INCOME', 'UTILITIES_REIMBURSEMENT_INCOME',
    'INTEREST_INCOME', 'MISCELLANEOUS_INCOME',
    'PM_FEE', 'FM_FEE', 'REPAIRS_MAINTENANCE', 'UTILITIES', 'PROPERTY_INSURANCE',
    'BUILDING_PROPERTY_TAX', 'LAND_PROPERTY_TAX', 'COMPREHENSIVE_REAL_ESTATE_TAX',
    'ROAD_OCCUPANCY_FEE', 'DEEMED_RENT_VAT', 'OTHER_TAXES', 'OTHER_PROPERTY_OPEX',
    'AMC_FEE', 'CUSTODY_FEE', 'GENERAL_ADMIN_TRUSTEE_FEE', 'CAPEX',
    'TENANT_IMPROVEMENT', 'LEASING_COMMISSION',
    'INTEREST_PAID', 'PRINCIPAL_REPAYMENT', 'LOAN_FEE',
    'OTHER_CASH_INFLOW', 'OTHER_CASH_OUTFLOW', 'OPENING_CASH_BALANCE'
  ]::text[]) then return v_code; end if;
  if v_code is not null then return null; end if;
  return case p_section || ':' || v_label
    when 'potential_income:임대수익' then 'RENT_REVENUE'
    when 'potential_income:관리비수익' then 'MANAGEMENT_FEE_INCOME'
    when 'potential_income:수도광열비회수수익' then 'UTILITIES_REIMBURSEMENT_INCOME'
    when 'potential_income:이자수익' then 'INTEREST_INCOME'
    when 'potential_income:기타수익' then 'MISCELLANEOUS_INCOME'
    when 'operating_expense:PM수수료' then 'PM_FEE'
    when 'operating_expense:FM수수료' then 'FM_FEE'
    when 'operating_expense:수선유지비' then 'REPAIRS_MAINTENANCE'
    when 'operating_expense:수도광열비' then 'UTILITIES'
    when 'operating_expense:보험료' then 'PROPERTY_INSURANCE'
    when 'operating_expense:건물재산세' then 'BUILDING_PROPERTY_TAX'
    when 'operating_expense:토지재산세' then 'LAND_PROPERTY_TAX'
    when 'operating_expense:종합부동산세' then 'COMPREHENSIVE_REAL_ESTATE_TAX'
    when 'operating_expense:도로점용료' then 'ROAD_OCCUPANCY_FEE'
    when 'operating_expense:간주임대료부가세' then 'DEEMED_RENT_VAT'
    when 'operating_expense:기타세금' then 'OTHER_TAXES'
    when 'operating_expense:기타운영비' then 'OTHER_PROPERTY_OPEX'
    when 'below_noi:AMC수수료' then 'AMC_FEE'
    when 'below_noi:자산보관수수료' then 'CUSTODY_FEE'
    when 'below_noi:일반사무·수탁수수료' then 'GENERAL_ADMIN_TRUSTEE_FEE'
    when 'below_noi:자본적지출' then 'CAPEX'
    when 'below_noi:임차인시설공사비(TI)' then 'TENANT_IMPROVEMENT'
    when 'below_noi:임대중개수수료(LC)' then 'LEASING_COMMISSION'
    when 'debt_service:이자지급액' then 'INTEREST_PAID'
    when 'debt_service:원금상환액' then 'PRINCIPAL_REPAYMENT'
    when 'debt_service:대출관련수수료' then 'LOAN_FEE'
    when 'cash_flow:기타현금유입' then 'OTHER_CASH_INFLOW'
    when 'cash_flow:기타현금유출' then 'OTHER_CASH_OUTFLOW'
    when 'cash_balance:기초현금잔액' then 'OPENING_CASH_BALANCE'
    else null
  end;
end;
$body$;

create or replace function logistics_core.finance_account_spec(p_code text)
returns jsonb
language sql
immutable
set search_path = pg_catalog
as $function$
  select case p_code
    when 'RENT_REVENUE' then jsonb_build_object('section','potential_income','label','임대수익','sign',1)
    when 'MANAGEMENT_FEE_INCOME' then jsonb_build_object('section','potential_income','label','관리비수익','sign',1)
    when 'UTILITIES_REIMBURSEMENT_INCOME' then jsonb_build_object('section','potential_income','label','수도광열비 회수수익','sign',1)
    when 'INTEREST_INCOME' then jsonb_build_object('section','potential_income','label','이자수익','sign',1)
    when 'MISCELLANEOUS_INCOME' then jsonb_build_object('section','potential_income','label','기타수익','sign',1)
    when 'PM_FEE' then jsonb_build_object('section','operating_expense','label','PM 수수료','sign',-1)
    when 'FM_FEE' then jsonb_build_object('section','operating_expense','label','FM 수수료','sign',-1)
    when 'REPAIRS_MAINTENANCE' then jsonb_build_object('section','operating_expense','label','수선유지비','sign',-1)
    when 'UTILITIES' then jsonb_build_object('section','operating_expense','label','수도광열비','sign',-1)
    when 'PROPERTY_INSURANCE' then jsonb_build_object('section','operating_expense','label','보험료','sign',-1)
    when 'BUILDING_PROPERTY_TAX' then jsonb_build_object('section','operating_expense','label','건물 재산세','sign',-1)
    when 'LAND_PROPERTY_TAX' then jsonb_build_object('section','operating_expense','label','토지 재산세','sign',-1)
    when 'COMPREHENSIVE_REAL_ESTATE_TAX' then jsonb_build_object('section','operating_expense','label','종합부동산세','sign',-1)
    when 'ROAD_OCCUPANCY_FEE' then jsonb_build_object('section','operating_expense','label','도로점용료','sign',-1)
    when 'DEEMED_RENT_VAT' then jsonb_build_object('section','operating_expense','label','간주임대료 부가세','sign',-1)
    when 'OTHER_TAXES' then jsonb_build_object('section','operating_expense','label','기타 세금','sign',-1)
    when 'OTHER_PROPERTY_OPEX' then jsonb_build_object('section','operating_expense','label','기타 운영비','sign',-1)
    when 'AMC_FEE' then jsonb_build_object('section','below_noi','label','AMC 수수료','sign',-1)
    when 'CUSTODY_FEE' then jsonb_build_object('section','below_noi','label','자산보관 수수료','sign',-1)
    when 'GENERAL_ADMIN_TRUSTEE_FEE' then jsonb_build_object('section','below_noi','label','일반사무·수탁 수수료','sign',-1)
    when 'CAPEX' then jsonb_build_object('section','below_noi','label','자본적 지출','sign',-1)
    when 'TENANT_IMPROVEMENT' then jsonb_build_object('section','below_noi','label','임차인 시설공사비(TI)','sign',-1)
    when 'LEASING_COMMISSION' then jsonb_build_object('section','below_noi','label','임대 중개수수료(LC)','sign',-1)
    when 'INTEREST_PAID' then jsonb_build_object('section','debt_service','label','이자 지급액','sign',-1)
    when 'PRINCIPAL_REPAYMENT' then jsonb_build_object('section','debt_service','label','원금 상환액','sign',-1)
    when 'LOAN_FEE' then jsonb_build_object('section','debt_service','label','대출 관련 수수료','sign',-1)
    when 'OTHER_CASH_INFLOW' then jsonb_build_object('section','cash_flow','label','기타 현금유입','sign',1)
    when 'OTHER_CASH_OUTFLOW' then jsonb_build_object('section','cash_flow','label','기타 현금유출','sign',-1)
    when 'OPENING_CASH_BALANCE' then jsonb_build_object('section','cash_balance','label','기초 현금잔액','sign',1)
    else null
  end;
$function$;

create or replace function logistics_core.sanitize_finance_section(p_rows jsonb, p_section text)
returns jsonb
language plpgsql
stable
set search_path = pg_catalog, logistics_core
as $body$
declare
  v_result jsonb := '[]'::jsonb;
  v_item jsonb;
  v_code text;
  v_explicit_code text;
  v_label text;
  v_spec jsonb;
begin
  for v_item in select value from jsonb_array_elements(p_rows) loop
    v_explicit_code := nullif(btrim(v_item->>'account_code'), '');
    if v_explicit_code like 'DOCUMENT:%' then
      raise exception using errcode = 'PT422', message = 'FINANCE_DOCUMENT_ACCOUNT_CODE_FORBIDDEN';
    end if;
    v_code := logistics_core.finance_account_code(p_section, v_item);
    v_spec := logistics_core.finance_account_spec(v_code);
    if v_spec is not null then
      if v_spec->>'section' <> p_section then
        raise exception using errcode = 'PT422', message = 'FINANCE_STATEMENT_SECTION_INVALID';
      end if;
      v_result := v_result || jsonb_build_array(jsonb_build_object(
        'account_code', v_code, 'statement_section', p_section,
        'label', v_spec->>'label', 'normal_sign', (v_spec->>'sign')::integer,
        'selected', v_item->'selected', 'amounts', logistics_core.sanitize_amounts(v_item->'amounts')
      ));
    else
      v_label := coalesce(nullif(btrim(v_item->>'label'), ''), nullif(btrim(v_item->>'name'), ''));
      v_result := v_result || jsonb_build_array(jsonb_build_object(
        'account_code', coalesce(v_explicit_code, 'CUSTOM:' || upper(p_section) || ':' || v_label),
        'statement_section', p_section, 'label', v_label,
        'normal_sign', coalesce((v_item->>'normal_sign')::integer,
          case when p_section in ('potential_income','cash_balance') then 1 else -1 end),
        'selected', v_item->'selected', 'amounts', logistics_core.sanitize_amounts(v_item->'amounts')
      ));
    end if;
  end loop;
  return v_result;
end;
$body$;

create or replace function logistics_core.assert_statement_valid(p_statement jsonb)
returns void
language plpgsql
immutable
set search_path = pg_catalog, logistics_core
as $body$
declare
  v_required record;
  v_revenue_canonical_count bigint;
begin
  perform logistics_core.assert_statement_transition_valid(p_statement);
  if exists (
    select 1 from unnest(array[
      'potential_income','income_loss','operating_expense','below_noi','debt_service','cash_flow','cash_balance'
    ]::text[]) section(section_name)
    cross join lateral jsonb_array_elements(p_statement->section.section_name) item(value)
    where item.value->>'account_code' like 'DOCUMENT:%'
  ) then
    raise exception using errcode = 'PT422', message = 'FINANCE_DOCUMENT_ACCOUNT_CODE_FORBIDDEN';
  end if;
  if exists (
    select 1 from unnest(array[
      'potential_income','income_loss','operating_expense','below_noi','debt_service','cash_flow','cash_balance'
    ]::text[]) section(section_name)
    cross join lateral jsonb_array_elements(p_statement->section.section_name) item(value)
    where item.value->>'account_code' = 'OPERATING_REVENUE'
  ) then
    raise exception using errcode = 'PT422', message = 'OPERATING_REVENUE_PERSISTED_FORBIDDEN';
  end if;
  select count(*) into v_revenue_canonical_count
  from jsonb_array_elements(p_statement->'potential_income') item(value)
  where logistics_core.finance_account_code('potential_income', item.value) = any(array[
    'RENT_REVENUE','MANAGEMENT_FEE_INCOME','UTILITIES_REIMBURSEMENT_INCOME','INTEREST_INCOME','MISCELLANEOUS_INCOME'
  ]::text[]);
  if v_revenue_canonical_count <> 5 or jsonb_array_length(p_statement->'income_loss') <> 0 then
    raise exception using errcode = 'PT422', message = 'FINANCE_CANONICAL_REVENUE_REQUIRED';
  end if;
  for v_required in select * from (values
    ('potential_income','RENT_REVENUE','임대수익',1),
    ('potential_income','MANAGEMENT_FEE_INCOME','관리비수익',1),
    ('potential_income','UTILITIES_REIMBURSEMENT_INCOME','수도광열비 회수수익',1),
    ('potential_income','INTEREST_INCOME','이자수익',1),
    ('potential_income','MISCELLANEOUS_INCOME','기타수익',1),
    ('operating_expense','PM_FEE','PM 수수료',-1), ('operating_expense','FM_FEE','FM 수수료',-1),
    ('operating_expense','REPAIRS_MAINTENANCE','수선유지비',-1), ('operating_expense','UTILITIES','수도광열비',-1),
    ('operating_expense','PROPERTY_INSURANCE','보험료',-1), ('operating_expense','BUILDING_PROPERTY_TAX','건물 재산세',-1),
    ('operating_expense','LAND_PROPERTY_TAX','토지 재산세',-1), ('operating_expense','COMPREHENSIVE_REAL_ESTATE_TAX','종합부동산세',-1),
    ('operating_expense','ROAD_OCCUPANCY_FEE','도로점용료',-1), ('operating_expense','DEEMED_RENT_VAT','간주임대료 부가세',-1),
    ('operating_expense','OTHER_TAXES','기타 세금',-1), ('operating_expense','OTHER_PROPERTY_OPEX','기타 운영비',-1),
    ('below_noi','AMC_FEE','AMC 수수료',-1), ('below_noi','CUSTODY_FEE','자산보관 수수료',-1),
    ('below_noi','GENERAL_ADMIN_TRUSTEE_FEE','일반사무·수탁 수수료',-1), ('below_noi','CAPEX','자본적 지출',-1),
    ('below_noi','TENANT_IMPROVEMENT','임차인 시설공사비(TI)',-1), ('below_noi','LEASING_COMMISSION','임대 중개수수료(LC)',-1),
    ('debt_service','INTEREST_PAID','이자 지급액',-1), ('debt_service','PRINCIPAL_REPAYMENT','원금 상환액',-1),
    ('debt_service','LOAN_FEE','대출 관련 수수료',-1), ('cash_flow','OTHER_CASH_INFLOW','기타 현금유입',1),
    ('cash_flow','OTHER_CASH_OUTFLOW','기타 현금유출',-1), ('cash_balance','OPENING_CASH_BALANCE','기초 현금잔액',1)
  ) required(section_name, account_code, label, normal_sign) loop
    perform logistics_core.assert_canonical_finance_row(
      p_statement, v_required.section_name, v_required.account_code,
      v_required.label, v_required.normal_sign
    );
  end loop;
end;
$body$;

-- Existing writer remains the authoritative full-document CAS implementation;
-- replacing it here binds the new validation/sanitizer contract explicitly.
create or replace function logistics_core.finance_batch_save_entry(
  p_request_id uuid, p_asset_key text, p_payload jsonb, p_expected_revisions jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, logistics_core
as $body$
declare
  v_actor uuid := logistics_core.request_actor();
  v_asset_code text := logistics_core.resolve_asset_code(p_asset_key);
  v_actual text;
  v_expected text;
  v_old_statement jsonb;
  v_old_rows jsonb;
  v_new_rows jsonb;
  v_statement jsonb;
  v_version text;
  v_readback jsonb;
begin
  perform logistics_core.assert_statement_valid(p_payload->'statement');
  select document.xmin::text, document.statement into strict v_actual, v_old_statement
  from logistics_core.income_expense document
  where document.asset_code = v_asset_code for update;
  v_expected := logistics_core.expected_xmin(p_payload, p_expected_revisions, 'income_expense');
  perform logistics_core.assert_expected_xmin(v_actual, v_expected);
  v_statement := logistics_core.sanitize_statement(p_payload->'statement');
  v_old_rows := coalesce(v_old_statement->'potential_income','[]'::jsonb)
    || coalesce(v_old_statement->'income_loss','[]'::jsonb)
    || coalesce(v_old_statement->'operating_expense','[]'::jsonb)
    || coalesce(v_old_statement->'below_noi','[]'::jsonb)
    || coalesce(v_old_statement->'debt_service','[]'::jsonb)
    || coalesce(v_old_statement->'cash_flow','[]'::jsonb)
    || coalesce(v_old_statement->'cash_balance','[]'::jsonb);
  v_new_rows := coalesce(v_statement->'potential_income','[]'::jsonb)
    || coalesce(v_statement->'income_loss','[]'::jsonb)
    || coalesce(v_statement->'operating_expense','[]'::jsonb)
    || coalesce(v_statement->'below_noi','[]'::jsonb)
    || coalesce(v_statement->'debt_service','[]'::jsonb)
    || coalesce(v_statement->'cash_flow','[]'::jsonb)
    || coalesce(v_statement->'cash_balance','[]'::jsonb);
  perform logistics_core.assert_document_array_permissions(v_actor, v_asset_code, v_old_rows, v_new_rows);
  update logistics_core.income_expense document set statement = v_statement
  where document.asset_code = v_asset_code;
  select document.statement, document.xmin::text into strict v_statement, v_version
  from logistics_core.income_expense document where document.asset_code = v_asset_code;
  if v_statement is distinct from logistics_core.sanitize_statement(p_payload->'statement') then
    raise exception using errcode = 'PT500', message = 'FINANCE_READBACK_MISMATCH';
  end if;
  v_readback := logistics_core.finance_read_entry(p_request_id, v_asset_code, '{}'::jsonb, '{}'::jsonb);
  return logistics_core.primary_response(p_request_id, v_version,
    coalesce(v_readback->'data','{}'::jsonb) || jsonb_build_object(
      'changed_count', 1, 'readback', 'verified',
      'xmins', jsonb_build_object('income_expense', v_version)
    ));
end;
$body$;

do $final_readback$
begin
  perform logistics_core.assert_statement_valid(document.statement)
  from logistics_core.income_expense document;
  if exists (
    select 1 from logistics_core.income_expense document
    where logistics_core.sanitize_statement(document.statement) is distinct from document.statement
  ) then
    raise exception using errcode = 'PT500', message = 'FINANCE_CANONICAL_HIERARCHY_READBACK_FAILED';
  end if;
end;
$final_readback$;

drop function logistics_core.canonicalize_finance_hierarchy(jsonb);
drop function logistics_core.build_finance_hierarchy_section(jsonb, text);
drop function logistics_core.is_legacy_finance_standard(jsonb);

revoke all on function logistics_core.finance_account_code(text, jsonb) from public, anon, authenticated;
revoke all on function logistics_core.finance_account_spec(text) from public, anon, authenticated;
revoke all on function logistics_core.sanitize_finance_section(jsonb, text) from public, anon, authenticated;
revoke all on function logistics_core.assert_statement_valid(jsonb) from public, anon, authenticated;
revoke all on function logistics_core.finance_batch_save_entry(uuid, text, jsonb, jsonb) from public, anon, authenticated;
grant execute on function logistics_core.finance_batch_save_entry(uuid, text, jsonb, jsonb) to authenticated;

notify pgrst, 'reload schema';
commit;
