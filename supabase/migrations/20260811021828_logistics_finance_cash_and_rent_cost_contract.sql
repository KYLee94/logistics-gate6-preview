-- LOGISTICS_FINANCE_CASH_RENT_COST_CONTRACT_V1
--
-- Persistent storage remains the four-document logistics_core model.  This
-- migration changes only rent_roll.rows and income_expense.statement JSON.
-- Every rewrite is guarded by the read-only operating counts observed on
-- 2026-08-11 and is rolled back atomically on any mismatch.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '90s';
select pg_advisory_xact_lock(hashtextextended('logistics-finance-cash-rent-cost-v1', 0));

-- ---------------------------------------------------------------------------
-- Rent-roll cost terms
-- ---------------------------------------------------------------------------

create or replace function logistics_core.canonical_cost_term_item(p_item text)
returns text
language plpgsql
immutable
set search_path = pg_catalog, logistics_core
as $body$
declare
  v_item text := nullif(btrim(p_item), '');
begin
  if v_item is null
     or upper(regexp_replace(v_item, '[[:space:]]+', '', 'g')) in (
       'N/A', 'NA', '-', '없음', '해당없음'
     ) then
    return null;
  end if;

  return case v_item
    when '수도광열비' then '수도광열비·공과금'
    when '전기·수도·가스 등 공과금' then '수도광열비·공과금'
    when '시설 변경·설치 비용' then '임차인 시설 설치·개조비'
    when '임차인 설치시설·영업상 수선' then '임차인 시설 유지보수·귀책수선'
    when '법정검사·시설관리비' then '전용부 운영·법정검사비'
    when '화재·배상책임보험' then '보관화물·영업배상책임보험'
    when '추가 제세공과금·보험료' then '임차인 사유 추가 제세공과금·보험료'
    when '구조체·기본설비 유지보수' then '임차인 귀책 외 구조·기본설비 수선'
    when '임차인 귀책 외 수선비' then '임차인 귀책 외 구조·기본설비 수선'
    when '승강기·전기·소방 유지관리' then '공용설비 유지관리·법정검사'
    when '재산종합·화재보험' then '건물 화재·재산종합보험'
    else v_item
  end;
end;
$body$;

create or replace function logistics_core.is_standard_cost_term(p_item text)
returns boolean
language sql
immutable
set search_path = pg_catalog, logistics_core
as $function$
  select logistics_core.canonical_cost_term_item(p_item) = any(array[
    '수도광열비·공과금',
    '임차인 시설 설치·개조비',
    '임차인 시설 유지보수·귀책수선',
    '전용부 운영·법정검사비',
    '전용부 미화·보안·방역',
    '보관화물·영업배상책임보험',
    '임차인 사유 추가 제세공과금·보험료',
    '교통유발·과밀부담금',
    '임차인 귀책 외 구조·기본설비 수선',
    '공용설비 유지관리·법정검사',
    '공용부 미화·보안·조경',
    '건물 화재·재산종합보험',
    '소유 관련 제세공과금',
    '도로점용·단지관리비'
  ]::text[]);
$function$;

create or replace function logistics_core.sanitize_cost_terms(p_value jsonb)
returns jsonb
language plpgsql
immutable
set search_path = pg_catalog, logistics_core
as $body$
declare
  v_source jsonb;
  v_candidate jsonb;
  v_piece text;
  v_canonical text;
  v_seen text[] := array[]::text[];
  v_items jsonb := '[]'::jsonb;
begin
  if p_value is null or jsonb_typeof(p_value) = 'null' then
    return jsonb_build_object('items', v_items);
  end if;

  v_source := case
    when jsonb_typeof(p_value) = 'array' then p_value
    when jsonb_typeof(p_value) = 'object' and jsonb_typeof(p_value->'items') = 'array'
      then p_value->'items'
    when jsonb_typeof(p_value) = 'object' and jsonb_typeof(p_value->'selected_items') = 'array'
      then p_value->'selected_items'
    when jsonb_typeof(p_value) = 'object' and jsonb_typeof(p_value->'selected') = 'array'
      then p_value->'selected'
    when jsonb_typeof(p_value) = 'object' and jsonb_typeof(p_value->'values') = 'array'
      then p_value->'values'
    when jsonb_typeof(p_value) = 'object' and jsonb_typeof(p_value->'raw_text') = 'string'
      then to_jsonb(regexp_split_to_array(p_value->>'raw_text', E'[\n,;]+'))
    when jsonb_typeof(p_value) = 'object' and jsonb_typeof(p_value->'text') = 'string'
      then to_jsonb(regexp_split_to_array(p_value->>'text', E'[\n,;]+'))
    when jsonb_typeof(p_value) = 'string'
      then to_jsonb(regexp_split_to_array(p_value #>> '{}', E'[\n,;]+'))
    else null
  end;

  if v_source is null then
    raise exception using errcode = 'PT422', message = 'RENT_ROLL_COST_TERMS_INVALID';
  end if;

  for v_candidate in select value from jsonb_array_elements(v_source) loop
    if jsonb_typeof(v_candidate) <> 'string' then
      raise exception using errcode = 'PT422', message = 'RENT_ROLL_COST_TERMS_INVALID';
    end if;
    v_piece := v_candidate #>> '{}';
    v_canonical := logistics_core.canonical_cost_term_item(v_piece);
    if v_canonical is not null and not (v_canonical = any(v_seen)) then
      v_items := v_items || jsonb_build_array(v_canonical);
      v_seen := array_append(v_seen, v_canonical);
    end if;
  end loop;
  return jsonb_build_object('items', v_items);
end;
$body$;

create or replace function logistics_core.canonicalize_rent_cost_rows(p_rows jsonb)
returns jsonb
language sql
immutable
set search_path = pg_catalog, logistics_core
as $function$
  select coalesce(jsonb_agg(
    (item.value - 'tenant_cost_terms' - 'landlord_cost_terms')
    || jsonb_build_object(
      'tenant_cost_terms', logistics_core.sanitize_cost_terms(item.value->'tenant_cost_terms'),
      'landlord_cost_terms', logistics_core.sanitize_cost_terms(item.value->'landlord_cost_terms')
    ) order by item.ordinality
  ), '[]'::jsonb)
  from jsonb_array_elements(case when jsonb_typeof(p_rows) = 'array' then p_rows else '[]'::jsonb end)
    with ordinality item(value, ordinality);
$function$;

create temporary table rent_cost_before on commit drop as
select document.asset_code, document.rows
from logistics_core.rent_roll document;

create temporary table rent_cost_unknown_before on commit drop as
with terms as (
  select snapshot.asset_code, item.ordinality, role.name as role_name, term.value #>> '{}' as item_value
  from rent_cost_before snapshot
  cross join lateral jsonb_array_elements(snapshot.rows) with ordinality item(value, ordinality)
  cross join lateral (values
    ('tenant', item.value->'tenant_cost_terms'),
    ('landlord', item.value->'landlord_cost_terms')
  ) role(name, payload)
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(role.payload->'items') = 'array' then role.payload->'items' else '[]'::jsonb end
  ) term(value)
  where jsonb_typeof(term.value) = 'string'
), unknown as (
  select role_name, logistics_core.canonical_cost_term_item(item_value) as item_value
  from terms
  where logistics_core.canonical_cost_term_item(item_value) is not null
    and not logistics_core.is_standard_cost_term(item_value)
)
select role_name, item_value, count(*) as item_count
from unknown
group by role_name, item_value;

do $rent_preflight$
declare
  v_document_count bigint;
  v_row_count bigint;
  v_na_count bigint;
  v_utility_count bigint;
begin
  select count(*), coalesce(sum(jsonb_array_length(rows)), 0)
  into v_document_count, v_row_count
  from pg_temp.rent_cost_before;
  if v_document_count <> 19 then
    raise exception using errcode = 'PT422', message = 'RENT_COST_DOCUMENT_COUNT_MISMATCH';
  end if;
  if v_row_count <> 81 then
    raise exception using errcode = 'PT422', message = 'RENT_COST_ROW_COUNT_MISMATCH';
  end if;

  select count(*) filter (where upper(btrim(term.value #>> '{}')) = 'N/A'),
         count(*) filter (where btrim(term.value #>> '{}') = '수도광열비')
  into v_na_count, v_utility_count
  from pg_temp.rent_cost_before snapshot
  cross join lateral jsonb_array_elements(snapshot.rows) item(value)
  cross join lateral (values
    (item.value->'tenant_cost_terms'), (item.value->'landlord_cost_terms')
  ) role(payload)
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(role.payload->'items') = 'array' then role.payload->'items' else '[]'::jsonb end
  ) term(value);
  if v_na_count <> 21 or v_utility_count <> 14 then
    raise exception using errcode = 'PT422', message = 'RENT_COST_SOURCE_SIGNATURE_MISMATCH';
  end if;

  -- User-entered values observed in production and intentionally preserved:
  -- '주민세', 'FM관리비', '보험료', '재산세', 'N', '일상유지보수', '인건비'.
  if not exists (select 1 from pg_temp.rent_cost_unknown_before where item_value = '주민세')
     or not exists (select 1 from pg_temp.rent_cost_unknown_before where item_value = 'N') then
    raise exception using errcode = 'PT422', message = 'RENT_COST_UNKNOWN_SOURCE_MISMATCH';
  end if;
end;
$rent_preflight$;

update logistics_core.rent_roll document
set rows = logistics_core.canonicalize_rent_cost_rows(document.rows);

do $rent_readback$
begin
  if exists (
    select 1
    from pg_temp.rent_cost_before before_document
    join logistics_core.rent_roll after_document using (asset_code)
    where jsonb_array_length(before_document.rows) <> jsonb_array_length(after_document.rows)
  ) then
    raise exception using errcode = 'PT500', message = 'RENT_COST_ROW_COUNT_MISMATCH';
  end if;

  if exists (
    select 1
    from pg_temp.rent_cost_before before_document
    join logistics_core.rent_roll after_document using (asset_code)
    cross join lateral jsonb_array_elements(before_document.rows)
      with ordinality before_item(value, ordinality)
    cross join lateral jsonb_array_elements(after_document.rows)
      with ordinality after_item(value, ordinality)
    where before_item.ordinality = after_item.ordinality
      and (before_item.value - 'tenant_cost_terms' - 'landlord_cost_terms')
        is distinct from
        (after_item.value - 'tenant_cost_terms' - 'landlord_cost_terms')
  ) then
    raise exception using errcode = 'PT500', message = 'RENT_COST_NON_TARGET_FIELD_CHANGED';
  end if;

  if exists (
    select 1
    from pg_temp.rent_cost_before before_document
    join logistics_core.rent_roll after_document using (asset_code)
    where logistics_core.canonicalize_rent_cost_rows(before_document.rows)
      is distinct from after_document.rows
  ) then
    raise exception using errcode = 'PT500', message = 'RENT_COST_ROW_ORDER_CHANGED';
  end if;

  if exists (
    select 1
    from logistics_core.rent_roll document
    cross join lateral jsonb_array_elements(document.rows) item(value)
    cross join lateral (values
      (item.value->'tenant_cost_terms'), (item.value->'landlord_cost_terms')
    ) role(payload)
    where jsonb_typeof(role.payload) <> 'object'
       or exists (
         select 1 from jsonb_object_keys(role.payload) nested(key) where nested.key <> 'items'
       )
       or exists (
         select 1
         from jsonb_array_elements(coalesce(role.payload->'items', '[]'::jsonb)) term(value)
         where logistics_core.canonical_cost_term_item(term.value #>> '{}') is null
       )
  ) then
    raise exception using errcode = 'PT500', message = 'RENT_COST_SENTINEL_REMAINS';
  end if;

  if exists (
    with after_unknown as (
      select role.name as role_name,
        logistics_core.canonical_cost_term_item(term.value #>> '{}') as item_value,
        count(*) as item_count
      from logistics_core.rent_roll document
      cross join lateral jsonb_array_elements(document.rows) item(value)
      cross join lateral (values
        ('tenant', item.value->'tenant_cost_terms'),
        ('landlord', item.value->'landlord_cost_terms')
      ) role(name, payload)
      cross join lateral jsonb_array_elements(coalesce(role.payload->'items', '[]'::jsonb)) term(value)
      where logistics_core.canonical_cost_term_item(term.value #>> '{}') is not null
        and not logistics_core.is_standard_cost_term(term.value #>> '{}')
      group by role.name, logistics_core.canonical_cost_term_item(term.value #>> '{}')
    )
    (select * from pg_temp.rent_cost_unknown_before except select * from after_unknown)
    union all
    (select * from after_unknown except select * from pg_temp.rent_cost_unknown_before)
  ) then
    raise exception using errcode = 'PT500', message = 'RENT_COST_UNKNOWN_VALUE_CHANGED';
  end if;
end;
$rent_readback$;

-- ---------------------------------------------------------------------------
-- Finance document catalog and canonical migration
-- ---------------------------------------------------------------------------

create temporary table finance_account_catalog (
  section_name text not null,
  display_order integer not null,
  account_code text primary key,
  label text not null,
  normal_sign integer not null check (normal_sign in (-1, 1)),
  default_selected boolean not null
) on commit drop;

insert into finance_account_catalog values
  ('potential_income', 10, 'OPERATING_REVENUE', '영업수익', 1, true),
  ('operating_expense', 10, 'PM_FEE', 'PM 수수료', -1, true),
  ('operating_expense', 20, 'FM_FEE', 'FM 수수료', -1, true),
  ('operating_expense', 30, 'REPAIRS_MAINTENANCE', '수선유지비', -1, true),
  ('operating_expense', 40, 'UTILITIES', '수도광열비', -1, true),
  ('operating_expense', 50, 'PROPERTY_TAX_PUBLIC_DUES', '재산세·제세공과', -1, true),
  ('operating_expense', 60, 'PROPERTY_INSURANCE', '보험료', -1, true),
  ('operating_expense', 70, 'GENERAL_PROPERTY_ADMIN', '일반관리비', -1, true),
  ('operating_expense', 80, 'OTHER_PROPERTY_OPEX', '기타 운영경비', -1, true),
  ('below_noi', 10, 'CAPEX', '자본적 지출', -1, true),
  ('below_noi', 20, 'TENANT_IMPROVEMENT', '임차인 시설공사비(TI)', -1, true),
  ('below_noi', 30, 'LEASING_COMMISSION', '임대 중개수수료(LC)', -1, true),
  ('below_noi', 40, 'CAPITAL_RESERVE', '자본적립금', -1, false),
  ('below_noi', 50, 'AMC_FEE', 'AMC 수수료', -1, true),
  ('below_noi', 60, 'CUSTODY_FEE', '자산보관 수수료', -1, true),
  ('below_noi', 70, 'GENERAL_ADMIN_TRUSTEE_FEE', '일반사무·수탁 수수료', -1, true),
  ('below_noi', 80, 'OTHER_OWNER_COST', '기타 소유자비용', -1, false),
  ('below_noi', 90, 'NONCASH_ADDBACK', '비현금비용 가산', -1, false),
  ('debt_service', 10, 'INTEREST_PAID', '이자 지급액', -1, true),
  ('debt_service', 20, 'PRINCIPAL_REPAYMENT', '원금 상환액', -1, false),
  ('debt_service', 30, 'LOAN_FEE', '대출 관련 수수료', -1, false),
  ('cash_flow', 10, 'OTHER_CASH_INFLOW', '기타 현금유입', 1, true),
  ('cash_flow', 20, 'OTHER_CASH_OUTFLOW', '기타 현금유출', -1, true),
  ('cash_balance', 10, 'OPENING_CASH_BALANCE', '기초 현금잔액', 1, true);

create or replace function logistics_core.finance_account_code(p_section text, p_row jsonb)
returns text
language plpgsql
immutable
set search_path = pg_catalog
as $body$
declare
  v_code text := nullif(btrim(p_row->>'account_code'), '');
  v_label text := regexp_replace(
    btrim(coalesce(p_row->>'label', p_row->>'name', '')), '[[:space:]]+', '', 'g'
  );
begin
  if v_code is not null then
    if v_code = any(array[
      'OPERATING_REVENUE',
      'PM_FEE', 'FM_FEE', 'REPAIRS_MAINTENANCE', 'UTILITIES',
      'CLEANING', 'SECURITY', 'LANDSCAPING_SNOW', 'PARKING_YARD_MANAGEMENT',
      'PROPERTY_TAX_PUBLIC_DUES', 'PROPERTY_INSURANCE',
      'RECURRING_LEASING_EXPENSE', 'GENERAL_PROPERTY_ADMIN', 'OTHER_PROPERTY_OPEX',
      'CAPEX', 'TENANT_IMPROVEMENT', 'LEASING_COMMISSION', 'CAPITAL_RESERVE',
      'AMC_FEE', 'CUSTODY_FEE', 'GENERAL_ADMIN_TRUSTEE_FEE',
      'OTHER_OWNER_COST', 'NONCASH_ADDBACK',
      'INTEREST_PAID', 'PRINCIPAL_REPAYMENT', 'LOAN_FEE',
      'OTHER_CASH_INFLOW', 'OTHER_CASH_OUTFLOW', 'OPENING_CASH_BALANCE'
    ]::text[]) then
      return v_code;
    else return null; end if;
  end if;
  return case p_section || ':' || v_label
    when 'potential_income:영업수익' then 'OPERATING_REVENUE'
    when 'operating_expense:PM수수료' then 'PM_FEE'
    when 'operating_expense:FM수수료' then 'FM_FEE'
    when 'operating_expense:수선유지비' then 'REPAIRS_MAINTENANCE'
    when 'operating_expense:수도광열비' then 'UTILITIES'
    when 'operating_expense:청소비' then 'CLEANING'
    when 'operating_expense:보안경비' then 'SECURITY'
    when 'operating_expense:조경·제설비' then 'LANDSCAPING_SNOW'
    when 'operating_expense:주차·야드관리비' then 'PARKING_YARD_MANAGEMENT'
    when 'operating_expense:재산세·제세공과' then 'PROPERTY_TAX_PUBLIC_DUES'
    when 'operating_expense:보험료' then 'PROPERTY_INSURANCE'
    when 'operating_expense:경상임대운영비' then 'RECURRING_LEASING_EXPENSE'
    when 'operating_expense:일반관리비' then 'GENERAL_PROPERTY_ADMIN'
    when 'operating_expense:기타운영경비' then 'OTHER_PROPERTY_OPEX'
    when 'below_noi:자본적지출' then 'CAPEX'
    when 'below_noi:임차인시설공사비(TI)' then 'TENANT_IMPROVEMENT'
    when 'below_noi:임대중개수수료(LC)' then 'LEASING_COMMISSION'
    when 'below_noi:자본유보금' then 'CAPITAL_RESERVE'
    when 'below_noi:자본적립금' then 'CAPITAL_RESERVE'
    when 'below_noi:AMC수수료' then 'AMC_FEE'
    when 'below_noi:자산보관수수료' then 'CUSTODY_FEE'
    when 'below_noi:일반사무·수탁수수료' then 'GENERAL_ADMIN_TRUSTEE_FEE'
    when 'below_noi:기타소유자비용' then 'OTHER_OWNER_COST'
    when 'below_noi:비현금비용가산' then 'NONCASH_ADDBACK'
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
    when 'OPERATING_REVENUE' then jsonb_build_object('section', 'potential_income', 'label', '영업수익', 'sign', 1)
    when 'PM_FEE' then jsonb_build_object('section', 'operating_expense', 'label', 'PM 수수료', 'sign', -1)
    when 'FM_FEE' then jsonb_build_object('section', 'operating_expense', 'label', 'FM 수수료', 'sign', -1)
    when 'REPAIRS_MAINTENANCE' then jsonb_build_object('section', 'operating_expense', 'label', '수선유지비', 'sign', -1)
    when 'UTILITIES' then jsonb_build_object('section', 'operating_expense', 'label', '수도광열비', 'sign', -1)
    when 'CLEANING' then jsonb_build_object('section', 'operating_expense', 'label', '청소비', 'sign', -1)
    when 'SECURITY' then jsonb_build_object('section', 'operating_expense', 'label', '보안경비', 'sign', -1)
    when 'LANDSCAPING_SNOW' then jsonb_build_object('section', 'operating_expense', 'label', '조경·제설비', 'sign', -1)
    when 'PARKING_YARD_MANAGEMENT' then jsonb_build_object('section', 'operating_expense', 'label', '주차·야드 관리비', 'sign', -1)
    when 'PROPERTY_TAX_PUBLIC_DUES' then jsonb_build_object('section', 'operating_expense', 'label', '재산세·제세공과', 'sign', -1)
    when 'PROPERTY_INSURANCE' then jsonb_build_object('section', 'operating_expense', 'label', '보험료', 'sign', -1)
    when 'RECURRING_LEASING_EXPENSE' then jsonb_build_object('section', 'operating_expense', 'label', '경상 임대운영비', 'sign', -1)
    when 'GENERAL_PROPERTY_ADMIN' then jsonb_build_object('section', 'operating_expense', 'label', '일반관리비', 'sign', -1)
    when 'OTHER_PROPERTY_OPEX' then jsonb_build_object('section', 'operating_expense', 'label', '기타 운영경비', 'sign', -1)
    when 'CAPEX' then jsonb_build_object('section', 'below_noi', 'label', '자본적 지출', 'sign', -1)
    when 'TENANT_IMPROVEMENT' then jsonb_build_object('section', 'below_noi', 'label', '임차인 시설공사비(TI)', 'sign', -1)
    when 'LEASING_COMMISSION' then jsonb_build_object('section', 'below_noi', 'label', '임대 중개수수료(LC)', 'sign', -1)
    when 'CAPITAL_RESERVE' then jsonb_build_object('section', 'below_noi', 'label', '자본적립금', 'sign', -1)
    when 'AMC_FEE' then jsonb_build_object('section', 'below_noi', 'label', 'AMC 수수료', 'sign', -1)
    when 'CUSTODY_FEE' then jsonb_build_object('section', 'below_noi', 'label', '자산보관 수수료', 'sign', -1)
    when 'GENERAL_ADMIN_TRUSTEE_FEE' then jsonb_build_object('section', 'below_noi', 'label', '일반사무·수탁 수수료', 'sign', -1)
    when 'OTHER_OWNER_COST' then jsonb_build_object('section', 'below_noi', 'label', '기타 소유자비용', 'sign', -1)
    when 'NONCASH_ADDBACK' then jsonb_build_object('section', 'below_noi', 'label', '비현금비용 가산', 'sign', -1)
    when 'INTEREST_PAID' then jsonb_build_object('section', 'debt_service', 'label', '이자 지급액', 'sign', -1)
    when 'PRINCIPAL_REPAYMENT' then jsonb_build_object('section', 'debt_service', 'label', '원금 상환액', 'sign', -1)
    when 'LOAN_FEE' then jsonb_build_object('section', 'debt_service', 'label', '대출 관련 수수료', 'sign', -1)
    when 'OTHER_CASH_INFLOW' then jsonb_build_object('section', 'cash_flow', 'label', '기타 현금유입', 'sign', 1)
    when 'OTHER_CASH_OUTFLOW' then jsonb_build_object('section', 'cash_flow', 'label', '기타 현금유출', 'sign', -1)
    when 'OPENING_CASH_BALANCE' then jsonb_build_object('section', 'cash_balance', 'label', '기초 현금잔액', 'sign', 1)
    else null
  end;
$function$;

create or replace function logistics_core.sanitize_finance_section(
  p_rows jsonb,
  p_section text
)
returns jsonb
language plpgsql
stable
set search_path = pg_catalog, logistics_core
as $body$
declare
  v_result jsonb := '[]'::jsonb;
  v_item jsonb;
  v_code text;
  v_spec jsonb;
begin
  for v_item in
    select item.value
    from jsonb_array_elements(
      case when jsonb_typeof(p_rows) = 'array' then p_rows else '[]'::jsonb end
    ) with ordinality item(value, ordinality)
    order by item.ordinality
  loop
    v_code := logistics_core.finance_account_code(p_section, v_item);
    v_spec := logistics_core.finance_account_spec(v_code);
    if v_code is null or v_spec is null then
      v_result := v_result || logistics_core.sanitize_statement_rows(jsonb_build_array(v_item));
    else
      if v_spec->>'section' <> p_section then
        raise exception using errcode = 'PT422', message = 'FINANCE_STATEMENT_SECTION_INVALID';
      end if;
      v_result := v_result || jsonb_build_array(jsonb_build_object(
        'account_code', v_code,
        'statement_section', p_section,
        'label', v_spec->>'label',
        'normal_sign', (v_spec->>'sign')::integer,
        'selected', coalesce(v_item->'selected', 'false'::jsonb),
        'amounts', logistics_core.sanitize_amounts(v_item->'amounts')
      ));
    end if;
  end loop;
  return v_result;
end;
$body$;

create or replace function logistics_core.custom_finance_rows(p_statement jsonb)
returns jsonb
language sql
stable
set search_path = pg_catalog, logistics_core
as $function$
  select coalesce(jsonb_agg(jsonb_build_object(
    'section', section_name,
    'row', row_value
  ) order by section_order, row_order), '[]'::jsonb)
  from (
    select section_name, section_order, item.ordinality as row_order,
      logistics_core.sanitize_statement_rows(jsonb_build_array(item.value))->0 as row_value
    from unnest(array[
      'potential_income', 'income_loss', 'operating_expense', 'below_noi',
      'debt_service', 'cash_flow', 'cash_balance'
    ]::text[]) with ordinality section(section_name, section_order)
    cross join lateral jsonb_array_elements(
      case when jsonb_typeof(p_statement->section_name) = 'array'
        then p_statement->section_name else '[]'::jsonb end
    ) with ordinality item(value, ordinality)
    where logistics_core.finance_account_code(section_name, item.value) is null
  ) custom;
$function$;

create or replace function logistics_core.canonical_finance_section(
  p_statement jsonb,
  p_section text
)
returns jsonb
language plpgsql
stable
set search_path = pg_catalog, logistics_core, pg_temp
as $body$
declare
  v_result jsonb := '[]'::jsonb;
  v_catalog record;
  v_existing jsonb;
  v_custom jsonb;
begin
  for v_catalog in
    select * from pg_temp.finance_account_catalog
    where section_name = p_section order by display_order
  loop
    select item.value into v_existing
    from jsonb_array_elements(
      case when jsonb_typeof(p_statement->p_section) = 'array'
        then p_statement->p_section else '[]'::jsonb end
    ) with ordinality item(value, ordinality)
    where logistics_core.finance_account_code(p_section, item.value) = v_catalog.account_code
    order by item.ordinality limit 1;

    v_result := v_result || jsonb_build_array(jsonb_build_object(
      'account_code', v_catalog.account_code,
      'statement_section', v_catalog.section_name,
      'label', v_catalog.label,
      'normal_sign', v_catalog.normal_sign,
      'selected', coalesce(v_existing->'selected', to_jsonb(v_catalog.default_selected)),
      'amounts', logistics_core.sanitize_amounts(v_existing->'amounts')
    ));
  end loop;

  for v_custom in
    select item.value
    from jsonb_array_elements(
      case when jsonb_typeof(p_statement->p_section) = 'array'
        then p_statement->p_section else '[]'::jsonb end
    ) with ordinality item(value, ordinality)
    where logistics_core.finance_account_code(p_section, item.value) is null
    order by item.ordinality
  loop
    v_result := v_result || logistics_core.sanitize_statement_rows(jsonb_build_array(v_custom));
  end loop;
  return v_result;
end;
$body$;

create or replace function logistics_core.canonicalize_finance_statement(p_statement jsonb)
returns jsonb
language sql
stable
set search_path = pg_catalog, logistics_core
as $function$
  select jsonb_build_object(
    'periods', logistics_core.sanitize_periods(p_statement->'periods'),
    'potential_income', logistics_core.canonical_finance_section(p_statement, 'potential_income'),
    'income_loss', logistics_core.canonical_finance_section(p_statement, 'income_loss'),
    'operating_expense', logistics_core.canonical_finance_section(p_statement, 'operating_expense'),
    'below_noi', logistics_core.canonical_finance_section(p_statement, 'below_noi'),
    'debt_service', logistics_core.canonical_finance_section(p_statement, 'debt_service'),
    'cash_flow', logistics_core.canonical_finance_section(p_statement, 'cash_flow'),
    'cash_balance', logistics_core.canonical_finance_section(p_statement, 'cash_balance')
  );
$function$;

create temporary table finance_cash_before on commit drop as
select document.asset_code, document.statement,
  logistics_core.custom_finance_rows(document.statement) as custom_rows
from logistics_core.income_expense document;

do $finance_preflight$
declare
  v_document_count bigint;
  v_amount_cell_count bigint;
begin
  select count(*) into v_document_count from pg_temp.finance_cash_before;
  if v_document_count <> 19 then
    raise exception using errcode = 'PT422', message = 'FINANCE_DOCUMENT_COUNT_MISMATCH';
  end if;

  select count(*) into v_amount_cell_count
  from pg_temp.finance_cash_before snapshot
  cross join lateral unnest(array[
    'potential_income', 'income_loss', 'operating_expense', 'below_noi',
    'debt_service', 'cash_flow', 'cash_balance'
  ]::text[]) section(section_name)
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(snapshot.statement->section.section_name) = 'array'
      then snapshot.statement->section.section_name else '[]'::jsonb end
  ) row_item(value)
  cross join lateral jsonb_each(
    case when jsonb_typeof(row_item.value->'amounts') = 'object'
      then row_item.value->'amounts' else '{}'::jsonb end
  ) amount(key, value);
  if v_amount_cell_count <> 0 then
    raise exception using errcode = 'PT422', message = 'FINANCE_AMOUNT_CELL_PREFLIGHT_FAILED';
  end if;

  if exists (
    select 1 from pg_temp.finance_cash_before snapshot
    where jsonb_array_length(snapshot.statement->'potential_income') <> 1
       or jsonb_array_length(snapshot.statement->'income_loss') <> 0
       or snapshot.statement #>> '{potential_income,0,account_code}' <> 'OPERATING_REVENUE'
  ) then
    raise exception using errcode = 'PT422', message = 'FINANCE_CANONICAL_OPERATING_REVENUE_REQUIRED';
  end if;
end;
$finance_preflight$;

update logistics_core.income_expense document
set statement = logistics_core.canonicalize_finance_statement(document.statement);

do $finance_migration_readback$
begin
  if exists (
    select 1 from pg_temp.finance_cash_before before_document
    join logistics_core.income_expense after_document using (asset_code)
    where before_document.statement->'periods' is distinct from after_document.statement->'periods'
  ) then
    raise exception using errcode = 'PT500', message = 'FINANCE_PERIODS_CHANGED';
  end if;

  if exists (
    select 1 from pg_temp.finance_cash_before before_document
    join logistics_core.income_expense after_document using (asset_code)
    where before_document.custom_rows
      is distinct from logistics_core.custom_finance_rows(after_document.statement)
  ) then
    raise exception using errcode = 'PT500', message = 'FINANCE_CUSTOM_ACCOUNT_CHANGED';
  end if;

  if exists (
    select 1
    from logistics_core.income_expense document
    cross join lateral unnest(array[
      'potential_income', 'income_loss', 'operating_expense', 'below_noi',
      'debt_service', 'cash_flow', 'cash_balance'
    ]::text[]) section(section_name)
    cross join lateral jsonb_array_elements(document.statement->section.section_name) row_item(value)
    cross join lateral jsonb_each(row_item.value->'amounts') amount(key, value)
  ) then
    raise exception using errcode = 'PT500', message = 'FINANCE_AMOUNT_DATA_CHANGED';
  end if;

  if exists (
    select 1 from logistics_core.income_expense document
    where logistics_core.canonicalize_finance_statement(document.statement)
      is distinct from document.statement
  ) then
    raise exception using errcode = 'PT500', message = 'FINANCE_STANDARD_ACCOUNT_READBACK_FAILED';
  end if;
end;
$finance_migration_readback$;

-- ---------------------------------------------------------------------------
-- Runtime finance validation, sanitization, read, and write contracts
-- ---------------------------------------------------------------------------

create or replace function logistics_core.assert_statement_transition_valid(p_statement jsonb)
returns void
language plpgsql
immutable
set search_path = pg_catalog, logistics_core
as $body$
declare
  v_period jsonb;
  v_section text;
  v_row jsonb;
  v_amount record;
  v_key text;
  v_label text;
  v_code text;
begin
  if jsonb_typeof(p_statement) <> 'object' then
    raise exception using errcode = 'PT422', message = 'FINANCE_STATEMENT_OBJECT_REQUIRED';
  end if;
  if jsonb_typeof(p_statement->'periods') <> 'array' then
    raise exception using errcode = 'PT422', message = 'FINANCE_PERIODS_ARRAY_REQUIRED';
  end if;
  for v_period in select value from jsonb_array_elements(p_statement->'periods') loop
    if jsonb_typeof(v_period) <> 'string'
       or not logistics_core.is_valid_month(v_period #>> '{}') then
      raise exception using errcode = 'PT422', message = 'FINANCE_PERIOD_INVALID';
    end if;
  end loop;
  if (select count(*) from jsonb_array_elements(p_statement->'periods'))
     <> (select count(distinct value #>> '{}') from jsonb_array_elements(p_statement->'periods')) then
    raise exception using errcode = 'PT422', message = 'FINANCE_PERIOD_DUPLICATE';
  end if;

  foreach v_section in array array[
    'potential_income', 'income_loss', 'operating_expense', 'below_noi',
    'debt_service', 'cash_flow', 'cash_balance'
  ] loop
    if jsonb_typeof(p_statement->v_section) <> 'array' then
      raise exception using errcode = 'PT422', message = 'FINANCE_SECTION_ARRAY_REQUIRED';
    end if;
    if exists (
      select 1
      from jsonb_array_elements(p_statement->v_section) item(value)
      group by lower(regexp_replace(
        btrim(coalesce(item.value->>'label', item.value->>'name')), '[[:space:]]+', '', 'g'
      ))
      having count(*) > 1
    ) then
      raise exception using errcode = 'PT422', message = 'FINANCE_VISIBLE_NAME_DUPLICATE';
    end if;
    if exists (
      select 1
      from jsonb_array_elements(p_statement->v_section) item(value)
      where nullif(btrim(item.value->>'account_code'), '') is not null
      group by item.value->>'account_code'
      having count(*) > 1
    ) then
      raise exception using errcode = 'PT422', message = 'FINANCE_ACCOUNT_CODE_DUPLICATE';
    end if;

    for v_row in select value from jsonb_array_elements(p_statement->v_section) loop
      if jsonb_typeof(v_row) <> 'object' then
        raise exception using errcode = 'PT422', message = 'FINANCE_ROW_OBJECT_REQUIRED';
      end if;
      for v_key in select jsonb_object_keys(v_row) loop
        if v_key <> all(array[
          'account_code', 'statement_section', 'label', 'normal_sign',
          'name', 'selected', 'amounts'
        ]::text[]) then
          raise exception using errcode = 'PT422', message = 'FINANCE_ROW_KEY_FORBIDDEN';
        end if;
      end loop;
      v_label := coalesce(nullif(btrim(v_row->>'label'), ''), nullif(btrim(v_row->>'name'), ''));
      if v_label is null then
        raise exception using errcode = 'PT422', message = 'FINANCE_ROW_NAME_REQUIRED';
      end if;
      if v_row ? 'account_code' and (
        jsonb_typeof(v_row->'account_code') <> 'string'
        or nullif(btrim(v_row->>'account_code'), '') is null
      ) then
        raise exception using errcode = 'PT422', message = 'FINANCE_ACCOUNT_CODE_INVALID';
      end if;
      if v_row ? 'statement_section' and (
        jsonb_typeof(v_row->'statement_section') <> 'string'
        or v_row->>'statement_section' <> v_section
      ) then
        raise exception using errcode = 'PT422', message = 'FINANCE_STATEMENT_SECTION_INVALID';
      end if;
      if v_row ? 'normal_sign' and (
        not logistics_core.is_finite_json_number(v_row->'normal_sign')
        or (v_row->>'normal_sign')::numeric not in (-1, 1)
      ) then
        raise exception using errcode = 'PT422', message = 'FINANCE_NORMAL_SIGN_INVALID';
      end if;
      if jsonb_typeof(v_row->'selected') <> 'boolean' then
        raise exception using errcode = 'PT422', message = 'FINANCE_SELECTED_BOOLEAN_REQUIRED';
      end if;
      if jsonb_typeof(v_row->'amounts') <> 'object' then
        raise exception using errcode = 'PT422', message = 'FINANCE_AMOUNTS_OBJECT_REQUIRED';
      end if;

      v_code := nullif(btrim(v_row->>'account_code'), '');
      if v_code = any(array[
        'NET_OPERATING_INCOME', 'PRE_DEBT_CASH_FLOW', 'AFTER_DEBT_SERVICE_CASH_FLOW',
        'NET_CASH_FLOW', 'CUMULATIVE_NET_CASH_FLOW', 'CLOSING_CASH_BALANCE'
      ]::text[]) then
        raise exception using errcode = 'PT422', message = 'FINANCE_DERIVED_ROW_STORAGE_FORBIDDEN';
      end if;

      for v_amount in select key, value from jsonb_each(v_row->'amounts') loop
        if not logistics_core.is_valid_month(v_amount.key)
           or not (p_statement->'periods' ? v_amount.key)
           or (jsonb_typeof(v_amount.value) <> 'null'
             and not logistics_core.is_finite_json_number(v_amount.value)) then
          raise exception using errcode = 'PT422', message = 'FINANCE_AMOUNT_INVALID';
        end if;
      end loop;
    end loop;
  end loop;
end;
$body$;

create or replace function logistics_core.assert_canonical_finance_row(
  p_statement jsonb,
  p_section text,
  p_code text,
  p_label text,
  p_sign integer
)
returns void
language plpgsql
immutable
set search_path = pg_catalog
as $body$
declare
  v_count bigint;
begin
  select count(*) into v_count
  from jsonb_array_elements(p_statement->p_section) item(value)
  where logistics_core.finance_account_code(p_section, item.value) = p_code
    and coalesce(nullif(btrim(item.value->>'label'), ''), nullif(btrim(item.value->>'name'), '')) = p_label
    and (not (item.value ? 'account_code') or item.value->>'account_code' = p_code)
    and (not (item.value ? 'statement_section') or item.value->>'statement_section' = p_section)
    and (
      not (item.value ? 'normal_sign')
      or (
        jsonb_typeof(item.value->'normal_sign') = 'number'
        and (item.value->>'normal_sign')::numeric = p_sign
      )
    );
  if v_count <> 1 then
    raise exception using errcode = 'PT422', message = 'FINANCE_CANONICAL_INPUT_ROW_REQUIRED';
  end if;
end;
$body$;

create or replace function logistics_core.assert_statement_valid(p_statement jsonb)
returns void
language plpgsql
immutable
set search_path = pg_catalog, logistics_core
as $body$
begin
  perform logistics_core.assert_statement_transition_valid(p_statement);
  if jsonb_array_length(p_statement->'potential_income') <> 1
     or jsonb_array_length(p_statement->'income_loss') <> 0 then
    raise exception using errcode = 'PT422', message = 'FINANCE_CANONICAL_OPERATING_REVENUE_REQUIRED';
  end if;

  perform logistics_core.assert_canonical_finance_row(
    p_statement, 'potential_income', 'OPERATING_REVENUE', '영업수익', 1
  );
  perform logistics_core.assert_canonical_finance_row(
    p_statement, 'cash_flow', 'OTHER_CASH_INFLOW', '기타 현금유입', 1
  );
  perform logistics_core.assert_canonical_finance_row(
    p_statement, 'cash_flow', 'OTHER_CASH_OUTFLOW', '기타 현금유출', -1
  );
  perform logistics_core.assert_canonical_finance_row(
    p_statement, 'cash_balance', 'OPENING_CASH_BALANCE', '기초 현금잔액', 1
  );
end;
$body$;

create or replace function logistics_core.sanitize_statement(p_statement jsonb)
returns jsonb
language sql
stable
set search_path = pg_catalog, logistics_core
as $function$
  select jsonb_build_object(
    'periods', logistics_core.sanitize_periods(case
      when jsonb_typeof(p_statement->'periods') = 'array' then p_statement->'periods'
      when jsonb_typeof(p_statement->'months') = 'array' then p_statement->'months'
      else '[]'::jsonb
    end),
    'potential_income', logistics_core.sanitize_finance_section(
      logistics_core.statement_input_rows(p_statement, 'potential_income'), 'potential_income'
    ),
    'income_loss', logistics_core.sanitize_finance_section(
      logistics_core.statement_input_rows(p_statement, 'income_loss'), 'income_loss'
    ),
    'operating_expense', logistics_core.sanitize_finance_section(
      logistics_core.statement_input_rows(p_statement, 'operating_expense'), 'operating_expense'
    ),
    'below_noi', logistics_core.sanitize_finance_section(
      logistics_core.statement_input_rows(p_statement, 'below_noi'), 'below_noi'
    ),
    'debt_service', logistics_core.sanitize_finance_section(
      logistics_core.statement_input_rows(p_statement, 'debt_service'), 'debt_service'
    ),
    'cash_flow', logistics_core.sanitize_finance_section(
      logistics_core.statement_input_rows(p_statement, 'cash_flow'), 'cash_flow'
    ),
    'cash_balance', logistics_core.sanitize_finance_section(
      logistics_core.statement_input_rows(p_statement, 'cash_balance'), 'cash_balance'
    )
  );
$function$;

create or replace function logistics_core.finance_read_entry(
  p_request_id uuid,
  p_asset_key text,
  p_payload jsonb,
  p_expected_revisions jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, logistics_core
as $body$
declare
  v_actor uuid := logistics_core.request_actor();
  v_asset_code text := logistics_core.resolve_asset_code(p_asset_key);
  v_statement jsonb;
  v_version text;
begin
  perform logistics_core.assert_asset_permission(v_actor, v_asset_code, 'read');
  select logistics_core.sanitize_statement(document.statement), document.xmin::text
  into strict v_statement, v_version
  from logistics_core.income_expense document
  where document.asset_code = v_asset_code;
  return logistics_core.primary_response(
    p_request_id, v_version,
    jsonb_build_object(
      'statement', v_statement,
      'write_enabled', logistics_core.has_asset_permission(v_actor, v_asset_code, 'update'),
      'derived_subtotals_stored', false
    )
  );
end;
$body$;

create or replace function logistics_core.finance_batch_save_entry(
  p_request_id uuid,
  p_asset_key text,
  p_payload jsonb,
  p_expected_revisions jsonb
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
  select document.xmin::text, document.statement
  into strict v_actual, v_old_statement
  from logistics_core.income_expense document
  where document.asset_code = v_asset_code
  for update;
  v_expected := logistics_core.expected_xmin(
    p_payload, p_expected_revisions, 'income_expense'
  );
  perform logistics_core.assert_expected_xmin(v_actual, v_expected);
  v_statement := logistics_core.sanitize_statement(p_payload->'statement');
  v_old_rows := coalesce(v_old_statement->'potential_income', '[]'::jsonb)
    || coalesce(v_old_statement->'income_loss', '[]'::jsonb)
    || coalesce(v_old_statement->'operating_expense', '[]'::jsonb)
    || coalesce(v_old_statement->'below_noi', '[]'::jsonb)
    || coalesce(v_old_statement->'debt_service', '[]'::jsonb)
    || coalesce(v_old_statement->'cash_flow', '[]'::jsonb)
    || coalesce(v_old_statement->'cash_balance', '[]'::jsonb);
  v_new_rows := coalesce(v_statement->'potential_income', '[]'::jsonb)
    || coalesce(v_statement->'income_loss', '[]'::jsonb)
    || coalesce(v_statement->'operating_expense', '[]'::jsonb)
    || coalesce(v_statement->'below_noi', '[]'::jsonb)
    || coalesce(v_statement->'debt_service', '[]'::jsonb)
    || coalesce(v_statement->'cash_flow', '[]'::jsonb)
    || coalesce(v_statement->'cash_balance', '[]'::jsonb);
  perform logistics_core.assert_document_array_permissions(
    v_actor, v_asset_code, v_old_rows, v_new_rows
  );
  update logistics_core.income_expense document
  set statement = v_statement
  where document.asset_code = v_asset_code;
  select document.statement, document.xmin::text
  into strict v_statement, v_version
  from logistics_core.income_expense document
  where document.asset_code = v_asset_code;
  if v_statement is distinct from logistics_core.sanitize_statement(p_payload->'statement') then
    raise exception using errcode = 'PT500', message = 'FINANCE_READBACK_MISMATCH';
  end if;
  v_readback := logistics_core.finance_read_entry(
    p_request_id, v_asset_code, '{}'::jsonb, '{}'::jsonb
  );
  return logistics_core.primary_response(
    p_request_id, v_version,
    coalesce(v_readback->'data', '{}'::jsonb) || jsonb_build_object(
      'changed_count', 1,
      'readback', 'verified',
      'xmins', jsonb_build_object('income_expense', v_version)
    )
  );
end;
$body$;

do $final_contract_readback$
begin
  perform logistics_core.assert_statement_valid(document.statement)
  from logistics_core.income_expense document;

  if exists (
    select 1
    from logistics_core.income_expense document
    cross join lateral unnest(array[
      'potential_income', 'income_loss', 'operating_expense', 'below_noi',
      'debt_service', 'cash_flow', 'cash_balance'
    ]::text[]) section(section_name)
    cross join lateral jsonb_array_elements(document.statement->section.section_name) row_item(value)
    where row_item.value->>'account_code' = any(array[
      'NET_OPERATING_INCOME', 'PRE_DEBT_CASH_FLOW', 'AFTER_DEBT_SERVICE_CASH_FLOW',
      'NET_CASH_FLOW', 'CUMULATIVE_NET_CASH_FLOW', 'CLOSING_CASH_BALANCE'
    ]::text[])
  ) then
    raise exception using errcode = 'PT500', message = 'FINANCE_DERIVED_ROW_STORAGE_FORBIDDEN';
  end if;
end;
$final_contract_readback$;

-- Migration-only helpers refer to the transaction-local account catalog.
drop function logistics_core.canonicalize_finance_statement(jsonb);
drop function logistics_core.canonical_finance_section(jsonb, text);
drop function logistics_core.custom_finance_rows(jsonb);
drop function logistics_core.canonicalize_rent_cost_rows(jsonb);
drop function logistics_core.is_standard_cost_term(text);

revoke all on function logistics_core.canonical_cost_term_item(text)
  from public, anon, authenticated;
revoke all on function logistics_core.sanitize_cost_terms(jsonb)
  from public, anon, authenticated;
revoke all on function logistics_core.assert_statement_transition_valid(jsonb)
  from public, anon, authenticated;
revoke all on function logistics_core.finance_account_code(text, jsonb)
  from public, anon, authenticated;
revoke all on function logistics_core.finance_account_spec(text)
  from public, anon, authenticated;
revoke all on function logistics_core.sanitize_finance_section(jsonb, text)
  from public, anon, authenticated;
revoke all on function logistics_core.assert_canonical_finance_row(jsonb, text, text, text, integer)
  from public, anon, authenticated;
revoke all on function logistics_core.assert_statement_valid(jsonb)
  from public, anon, authenticated;
revoke all on function logistics_core.sanitize_statement(jsonb)
  from public, anon, authenticated;
revoke all on function logistics_core.finance_read_entry(uuid, text, jsonb, jsonb)
  from public, anon, authenticated;
revoke all on function logistics_core.finance_batch_save_entry(uuid, text, jsonb, jsonb)
  from public, anon, authenticated;

grant execute on function logistics_core.finance_read_entry(uuid, text, jsonb, jsonb)
  to authenticated;
grant execute on function logistics_core.finance_batch_save_entry(uuid, text, jsonb, jsonb)
  to authenticated;

notify pgrst, 'reload schema';

commit;
