-- LOGISTICS_FUND_AUM_TRANCHE_NOI_V1
-- Evidence contract (2026-08-11, production read-only + source manifest):
--   * ownership_ratio is NULL for all 19 operating funds.
--   * no direct AUM field exists in the operating home projection or the
--     260520 fund workbook manifest.  AUM is therefore direct-entry only.
--   * all 52 populated beneficiary rows in the 260520 workbook have a blank
--     Tranche cell.  Only Yatap/Pocheon retained the synthetic fallback
--     `수익자`, introduced by 20260611061529 and preferred by 20260611095000.
--   * NOI presentation is now also the canonical editable document: one
--     OPERATING_REVENUE row stores potential income less income loss.

begin;

do $fund_schema_preflight$
declare
  v_non_null_count bigint;
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'logistics_core'
      and table_name = 'funds'
      and column_name = 'ownership_ratio'
  ) then
    select count(*) into v_non_null_count
    from logistics_core.funds fund
    where fund.ownership_ratio is not null;
    if v_non_null_count <> 0 then
      raise exception using
        errcode = 'PT422',
        message = 'FUND_OWNERSHIP_RATIO_NON_NULL_PRECONDITION';
    end if;
  end if;
end;
$fund_schema_preflight$;

alter table logistics_core.funds
  add column if not exists aum_krw numeric;

do $aum_constraint$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'logistics_core.funds'::regclass
      and conname = 'funds_aum_krw_nonnegative'
  ) then
    alter table logistics_core.funds
      add constraint funds_aum_krw_nonnegative
      check (aum_krw is null or aum_krw >= 0);
  end if;
end;
$aum_constraint$;

-- AUM_DIRECT_ENTRY_ONLY_NO_BACKFILL
-- Investment sums, acquisition cost, NAV, gross asset value, and fund AUM are
-- different measures.  No inferred UPDATE of aum_krw is permitted here.

create or replace function logistics_core.assert_home_fund_document_valid(p_document jsonb)
returns void
language plpgsql
immutable
set search_path = pg_catalog, logistics_core
as $body$
declare
  v_field text;
  v_normalized jsonb;
begin
  if jsonb_typeof(p_document) <> 'object' then
    raise exception using errcode = 'PT422', message = 'HOME_FUND_DOCUMENT_INVALID';
  end if;
  if p_document ? 'ownership_ratio' then
    raise exception using errcode = 'PT422', message = 'HOME_FUND_OWNERSHIP_RATIO_REMOVED';
  end if;
  foreach v_field in array array['name', 'fund_type', 'investment_strategy'] loop
    if p_document ? v_field and jsonb_typeof(p_document->v_field) not in ('string', 'null') then
      raise exception using errcode = 'PT422', message = 'HOME_FUND_TEXT_INVALID';
    end if;
  end loop;
  if p_document ? 'aum_krw' then
    begin
      v_normalized := logistics_core.normalize_home_optional_number(p_document->'aum_krw');
    exception when sqlstate 'PT422' then
      raise exception using errcode = 'PT422', message = 'HOME_FUND_NUMBER_INVALID';
    end;
    if jsonb_typeof(v_normalized) <> 'null'
       and (v_normalized #>> '{}')::numeric < 0 then
      raise exception using errcode = 'PT422', message = 'HOME_FUND_NUMBER_INVALID';
    end if;
  end if;
  foreach v_field in array array['inception_date', 'maturity_date'] loop
    if p_document ? v_field then
      begin
        perform logistics_core.normalize_home_optional_date(p_document->v_field);
      exception when sqlstate 'PT422' then
        raise exception using errcode = 'PT422', message = 'HOME_FUND_DATE_INVALID';
      end;
    end if;
  end loop;
end;
$body$;

-- TRANCHE_ARBITRARY_USER_TEXT_PRESERVED: the database intentionally does not
-- impose an enum.  The UI offers 보통주/1종/2종/3종 종류주 and may persist any
-- additional non-blank user string without taxonomy guessing.
create or replace function logistics_core.assert_investments_valid(p_rows jsonb)
returns void
language plpgsql
immutable
set search_path = pg_catalog, logistics_core
as $body$
declare
  v_row jsonb;
  v_field text;
  v_normalized jsonb;
begin
  if jsonb_typeof(p_rows) <> 'array' then
    raise exception using errcode = 'PT422', message = 'INVESTMENTS_ARRAY_REQUIRED';
  end if;
  for v_row in select value from jsonb_array_elements(p_rows) loop
    if jsonb_typeof(v_row) <> 'object' then
      raise exception using errcode = 'PT422', message = 'INVESTMENT_ROW_OBJECT_REQUIRED';
    end if;
    foreach v_field in array array['tranche', 'beneficiary_name'] loop
      if v_row ? v_field and jsonb_typeof(v_row->v_field) not in ('string', 'null') then
        raise exception using errcode = 'PT422', message = 'INVESTMENT_TEXT_INVALID';
      end if;
    end loop;
    foreach v_field in array array['agreed_amount_krw', 'contributed_amount_krw'] loop
      if v_row ? v_field then
        begin
          v_normalized := logistics_core.normalize_home_optional_number(v_row->v_field);
        exception when sqlstate 'PT422' then
          raise exception using errcode = 'PT422', message = 'INVESTMENT_AMOUNT_INVALID';
        end;
        if jsonb_typeof(v_normalized) <> 'null'
           and (v_normalized #>> '{}')::numeric < 0 then
          raise exception using errcode = 'PT422', message = 'INVESTMENT_AMOUNT_INVALID';
        end if;
      end if;
    end loop;
  end loop;
end;
$body$;

create or replace function logistics_core.sanitize_investments(p_rows jsonb)
returns jsonb
language sql
immutable
set search_path = pg_catalog, logistics_core
as $function$
  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
    'tranche', case
      when jsonb_typeof(item.value->'tranche') = 'string'
        then to_jsonb(nullif(btrim(item.value->>'tranche'), ''))
      else item.value->'tranche'
    end,
    'beneficiary_name', item.value->'beneficiary_name',
    'agreed_amount_krw', logistics_core.normalize_home_optional_number(item.value->'agreed_amount_krw'),
    'contributed_amount_krw', logistics_core.normalize_home_optional_number(item.value->'contributed_amount_krw')
  )) order by item.ordinality), '[]'::jsonb)
  from jsonb_array_elements(case when jsonb_typeof(p_rows) = 'array' then p_rows else '[]'::jsonb end)
    with ordinality item(value, ordinality);
$function$;

create temporary table fund_tranche_snapshot as
select fund.fund_code, fund.investments
from logistics_core.funds fund
where fund.fund_code in ('190002', '190013');

do $synthetic_tranche_preflight$
declare
  v_total bigint;
  v_exact bigint;
begin
  select count(*) into v_total
  from logistics_core.funds fund
  cross join lateral jsonb_array_elements(fund.investments) item(value)
  where item.value->>'tranche' = '수익자';

  with expected(fund_code, beneficiary_name, amount_krw) as (
    values
      ('190002'::text, '쿠팡'::text, 99574318540::numeric),
      ('190002'::text, '쿠팡로지스틱스'::text, 500373460::numeric),
      ('190013'::text, '비공개(쿠팡 계열)'::text, 33847096725::numeric),
      ('190013'::text, '비공개(쿠팡 계열)'::text, 867874275::numeric)
  )
  select count(*) into v_exact
  from expected
  join logistics_core.funds fund using (fund_code)
  join lateral jsonb_array_elements(fund.investments) item(value) on true
  where item.value->>'tranche' = '수익자'
    and item.value->>'beneficiary_name' = expected.beneficiary_name
    and logistics_core.is_finite_json_number(item.value->'agreed_amount_krw')
    and logistics_core.is_finite_json_number(item.value->'contributed_amount_krw')
    and (item.value->>'agreed_amount_krw')::numeric = expected.amount_krw
    and (item.value->>'contributed_amount_krw')::numeric = expected.amount_krw;

  if (select count(*) from fund_tranche_snapshot) <> 2
     or v_total <> 4
     or v_exact <> 4 then
    raise exception using
      errcode = 'PT422',
      message = 'FUND_SYNTHETIC_TRANCHE_PREFLIGHT_MISMATCH';
  end if;
end;
$synthetic_tranche_preflight$;

update logistics_core.funds fund
set investments = rewritten.investments
from (
  select
    source.fund_code,
    jsonb_agg(
      case when item.value->>'tranche' = '수익자'
        then item.value - 'tranche'
        else item.value
      end
      order by item.ordinality
    ) as investments
  from fund_tranche_snapshot source
  cross join lateral jsonb_array_elements(source.investments)
    with ordinality item(value, ordinality)
  group by source.fund_code
) rewritten
where fund.fund_code = rewritten.fund_code;

do $synthetic_tranche_postcheck$
begin
  if exists (
    select 1
    from logistics_core.funds fund
    cross join lateral jsonb_array_elements(fund.investments) item(value)
    where item.value->>'tranche' = '수익자'
  ) or exists (
    select 1
    from fund_tranche_snapshot source
    join logistics_core.funds fund using (fund_code)
    where fund.investments is distinct from (
      select jsonb_agg(
        case when item.value->>'tranche' = '수익자'
          then item.value - 'tranche'
          else item.value
        end
        order by item.ordinality
      )
      from jsonb_array_elements(source.investments)
        with ordinality item(value, ordinality)
    )
  ) then
    raise exception using
      errcode = 'PT500',
      message = 'FUND_SYNTHETIC_TRANCHE_POSTCHECK_FAILED';
  end if;
end;
$synthetic_tranche_postcheck$;

create or replace function logistics_core.home_batch_save_entry(
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
  v_asset_document jsonb := p_payload->'asset';
  v_fund_document jsonb;
  v_fund_code text;
  v_actual text;
  v_expected text;
  v_version text;
  v_fund_version text;
  v_old_investments jsonb;
  v_old_loans jsonb;
  v_new_investments jsonb;
  v_new_loans jsonb;
  v_readback jsonb;
  v_changed integer := 0;
begin
  perform logistics_core.assert_asset_permission(v_actor, v_asset_code, 'update');
  select asset.fund_code into strict v_fund_code
  from logistics_core.assets asset where asset.asset_code = v_asset_code;
  select item.value into v_fund_document
  from jsonb_array_elements(case when jsonb_typeof(p_payload->'funds') = 'array'
    then p_payload->'funds' else '[]'::jsonb end) item(value)
  where item.value->>'fund_code' = v_fund_code
  limit 1;

  if jsonb_typeof(v_asset_document) = 'object' then
    perform logistics_core.assert_home_asset_document_valid(v_asset_document);
    select asset.xmin::text into v_actual
    from logistics_core.assets asset where asset.asset_code = v_asset_code for update;
    v_expected := logistics_core.expected_xmin(p_payload, p_expected_revisions, 'asset');
    perform logistics_core.assert_expected_xmin(v_actual, v_expected);
    update logistics_core.assets asset set
      name = case when v_asset_document ? 'name' then nullif(v_asset_document->>'name', '') else asset.name end,
      address = case when v_asset_document ? 'address' then nullif(v_asset_document->>'address', '') else asset.address end,
      zoning_text = case when v_asset_document ? 'zoning_text' then nullif(v_asset_document->>'zoning_text', '') else asset.zoning_text end,
      land_area_sqm = case when v_asset_document ? 'land_area_sqm' then (logistics_core.normalize_home_optional_number(v_asset_document->'land_area_sqm') #>> '{}')::numeric else asset.land_area_sqm end,
      building_area_sqm = case when v_asset_document ? 'building_area_sqm' then (logistics_core.normalize_home_optional_number(v_asset_document->'building_area_sqm') #>> '{}')::numeric else asset.building_area_sqm end,
      gross_area_sqm = case when v_asset_document ? 'gross_area_sqm' then (logistics_core.normalize_home_optional_number(v_asset_document->'gross_area_sqm') #>> '{}')::numeric else asset.gross_area_sqm end,
      leasable_area_sqm = case when v_asset_document ? 'leasable_area_sqm' then (logistics_core.normalize_home_optional_number(v_asset_document->'leasable_area_sqm') #>> '{}')::numeric else asset.leasable_area_sqm end,
      primary_use = case when v_asset_document ? 'primary_use' then nullif(v_asset_document->>'primary_use', '') else asset.primary_use end,
      building_coverage_ratio = case when v_asset_document ? 'building_coverage_ratio' then (logistics_core.normalize_home_optional_number(v_asset_document->'building_coverage_ratio') #>> '{}')::numeric else asset.building_coverage_ratio end,
      floor_area_ratio = case when v_asset_document ? 'floor_area_ratio' then (logistics_core.normalize_home_optional_number(v_asset_document->'floor_area_ratio') #>> '{}')::numeric else asset.floor_area_ratio end,
      floor_count = case when v_asset_document ? 'floor_count' then nullif(v_asset_document->>'floor_count', '') else asset.floor_count end,
      structure_text = case when v_asset_document ? 'structure_text' then nullif(v_asset_document->>'structure_text', '') else asset.structure_text end,
      parking_count = case when v_asset_document ? 'parking_count' then (logistics_core.normalize_home_optional_integer(v_asset_document->'parking_count') #>> '{}')::integer else asset.parking_count end,
      completion_date = case when v_asset_document ? 'completion_date' then (logistics_core.normalize_home_optional_date(v_asset_document->'completion_date') #>> '{}')::date else asset.completion_date end
    where asset.asset_code = v_asset_code;
    v_changed := v_changed + 1;
  end if;

  if jsonb_typeof(v_fund_document) = 'object' then
    perform logistics_core.assert_home_fund_document_valid(v_fund_document);
    perform logistics_core.assert_fund_permission(v_actor, v_fund_code, 'update');
    select fund.xmin::text, fund.investments, fund.loans
    into v_actual, v_old_investments, v_old_loans
    from logistics_core.funds fund where fund.fund_code = v_fund_code for update;
    v_expected := logistics_core.expected_xmin(p_payload, p_expected_revisions, 'fund');
    perform logistics_core.assert_expected_xmin(v_actual, v_expected);
    if v_fund_document ? 'investments' then
      perform logistics_core.assert_investments_valid(v_fund_document->'investments');
      v_new_investments := logistics_core.sanitize_investments(v_fund_document->'investments');
      perform logistics_core.assert_fund_array_permissions(
        v_actor, v_fund_code, v_old_investments, v_new_investments
      );
    else
      v_new_investments := v_old_investments;
    end if;
    if v_fund_document ? 'loans' then
      perform logistics_core.assert_loans_valid(v_fund_document->'loans');
      v_new_loans := logistics_core.sanitize_loans(v_fund_document->'loans');
      perform logistics_core.assert_fund_array_permissions(
        v_actor, v_fund_code, v_old_loans, v_new_loans
      );
    else
      v_new_loans := v_old_loans;
    end if;
    update logistics_core.funds fund set
      name = case when v_fund_document ? 'name' then nullif(v_fund_document->>'name', '') else fund.name end,
      fund_type = case when v_fund_document ? 'fund_type' then nullif(v_fund_document->>'fund_type', '') else fund.fund_type end,
      investment_strategy = case when v_fund_document ? 'investment_strategy' then nullif(v_fund_document->>'investment_strategy', '') else fund.investment_strategy end,
      inception_date = case when v_fund_document ? 'inception_date' then (logistics_core.normalize_home_optional_date(v_fund_document->'inception_date') #>> '{}')::date else fund.inception_date end,
      maturity_date = case when v_fund_document ? 'maturity_date' then (logistics_core.normalize_home_optional_date(v_fund_document->'maturity_date') #>> '{}')::date else fund.maturity_date end,
      aum_krw = case when v_fund_document ? 'aum_krw' then (logistics_core.normalize_home_optional_number(v_fund_document->'aum_krw') #>> '{}')::numeric else fund.aum_krw end,
      investments = v_new_investments,
      loans = v_new_loans
    where fund.fund_code = v_fund_code;
    v_changed := v_changed + 1;
  end if;

  if v_changed = 0 then
    raise exception using errcode = 'PT422', message = 'HOME_DOCUMENT_REQUIRED';
  end if;
  select asset.xmin::text, fund.xmin::text
  into strict v_version, v_fund_version
  from logistics_core.assets asset
  join logistics_core.funds fund on fund.fund_code = asset.fund_code
  where asset.asset_code = v_asset_code;
  v_readback := logistics_core.home_read_entry(
    p_request_id, v_asset_code, '{}'::jsonb, '{}'::jsonb
  );
  return logistics_core.primary_response(
    p_request_id, v_version,
    coalesce(v_readback->'data', '{}'::jsonb) || jsonb_build_object(
      'changed_count', v_changed,
      'readback', 'verified',
      'xmins', jsonb_build_object('asset', v_version, 'fund', v_fund_version)
    )
  );
end;
$body$;

-- Replace every remaining runtime reference before the obsolete visible field
-- is removed from the four-table document schema.
create or replace function logistics_core.maturities_read_entry(
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
  v_from_text text := nullif(btrim(coalesce(p_payload->>'from_date', '')), '');
  v_to_text text := nullif(btrim(coalesce(p_payload->>'to_date', '')), '');
  v_from_date date;
  v_to_date date;
  v_version text;
  v_fund logistics_core.funds%rowtype;
  v_rows jsonb := '[]'::jsonb;
  v_lease_rows jsonb := '[]'::jsonb;
  v_loan_rows jsonb := '[]'::jsonb;
begin
  if (v_from_text is not null and v_from_text !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$')
     or (v_to_text is not null and v_to_text !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$') then
    raise exception using errcode = 'PT422', message = 'MATURITY_DATE_RANGE_INVALID';
  end if;
  begin
    v_from_date := coalesce(v_from_text::date, (statement_timestamp() at time zone 'Asia/Seoul')::date);
    v_to_date := coalesce(v_to_text::date, v_from_date + 365);
  exception when datetime_field_overflow or invalid_datetime_format then
    raise exception using errcode = 'PT422', message = 'MATURITY_DATE_RANGE_INVALID';
  end;
  if v_to_date < v_from_date then
    raise exception using errcode = 'PT422', message = 'MATURITY_DATE_RANGE_INVALID';
  end if;
  perform logistics_core.assert_asset_permission(v_actor, v_asset_code, 'read');
  select fund.* into strict v_fund
  from logistics_core.assets asset
  join logistics_core.funds fund on fund.fund_code = asset.fund_code
  where asset.asset_code = v_asset_code;
  select greatest(rent.xmin::text::bigint, fund.xmin::text::bigint)::text
  into strict v_version
  from logistics_core.rent_roll rent
  join logistics_core.assets asset on asset.asset_code = rent.asset_code
  join logistics_core.funds fund on fund.fund_code = asset.fund_code
  where rent.asset_code = v_asset_code;

  with normalized as (
    select
      coalesce(nullif(btrim(item.value->>'tenant_name'), ''),
        nullif(btrim(item.value->>'subtenant_name'), ''), '임차인 정보 확인 필요') as tenant_name,
      (item.value->>'expiry_date')::date as expiry_date,
      item.value
    from jsonb_array_elements(
      (select document.rows from logistics_core.rent_roll document where document.asset_code = v_asset_code)
    ) with ordinality item(value, ordinality)
    where item.value->>'expiry_date' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
      and (item.value->>'expiry_date')::date between v_from_date and v_to_date
  ), grouped as (
    select tenant_name, expiry_date,
      min(nullif(value->>'commencement_date', '')) as commencement_date,
      string_agg(distinct nullif(btrim(value->>'floor_label'), ''), ' · ') as floor_labels,
      string_agg(distinct nullif(btrim(value->>'zone_label'), ''), ' · ') as zone_labels,
      sum(case when logistics_core.is_finite_json_number(value->'leased_area_sqm')
        then (value->>'leased_area_sqm')::numeric else 0 end) as leased_area_sqm,
      sum(case when logistics_core.is_finite_json_number(value->'deposit_total_krw')
        then (value->>'deposit_total_krw')::numeric else 0 end) as deposit_amount,
      sum(case when logistics_core.is_finite_json_number(value->'monthly_rent_total_krw')
        then (value->>'monthly_rent_total_krw')::numeric else 0 end) as monthly_rent_total_krw,
      sum(case when logistics_core.is_finite_json_number(value->'monthly_cam_total_krw')
        then (value->>'monthly_cam_total_krw')::numeric else 0 end) as monthly_cam_total_krw,
      min(nullif(value->>'renewal_terms', '')) as renewal_terms,
      min(nullif(value->>'termination_terms', '')) as termination_terms,
      min(nullif(value->>'restoration_terms', '')) as restoration_terms
    from normalized group by tenant_name, expiry_date
  )
  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
    'maturity_type', 'lease', 'name', tenant_name, 'tenant_name', tenant_name,
    'maturity_date', expiry_date, 'official_date', expiry_date,
    'commencement_date', commencement_date, 'floor_labels', floor_labels,
    'zone_labels', zone_labels, 'leased_area_sqm', leased_area_sqm,
    'deposit_amount', deposit_amount, 'monthly_rent_total_krw', monthly_rent_total_krw,
    'monthly_cam_total_krw', monthly_cam_total_krw, 'renewal_terms', renewal_terms,
    'termination_terms', termination_terms, 'restoration_terms', restoration_terms
  )) order by expiry_date, tenant_name), '[]'::jsonb)
  into v_lease_rows from grouped;

  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
    'maturity_type', 'loan',
    'name', coalesce(nullif(item.value->>'tranche', ''), nullif(item.value->>'lender_name', ''), '대출 정보 확인 필요'),
    'tranche_name', nullif(item.value->>'tranche', ''),
    'lender_names', case when nullif(item.value->>'lender_name', '') is null
      then '[]'::jsonb else jsonb_build_array(item.value->>'lender_name') end,
    'maturity_date', item.value->>'maturity_date', 'official_date', item.value->>'maturity_date',
    'drawdown_date', nullif(item.value->>'drawdown_date', ''),
    'commitment_amount', item.value->'committed_amount_krw',
    'loan_type', nullif(item.value->>'loan_type', ''),
    'interest_type', nullif(item.value->>'interest_type', ''),
    'coupon_rate', item.value->'coupon_rate', 'all_in_rate', item.value->'all_in_rate',
    'fee_rate', item.value->'fee_rate', 'fund_name', v_fund.name
  )) order by item.value->>'maturity_date', item.value->>'tranche', item.value->>'lender_name'), '[]'::jsonb)
  into v_loan_rows
  from jsonb_array_elements(v_fund.loans) with ordinality item(value, ordinality)
  where item.value->>'maturity_date' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
    and (item.value->>'maturity_date')::date between v_from_date and v_to_date;

  if v_fund.maturity_date between v_from_date and v_to_date then
    v_rows := jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
      'maturity_type', 'fund', 'name', v_fund.name, 'fund_name', v_fund.name,
      'maturity_date', v_fund.maturity_date, 'official_date', v_fund.maturity_date,
      'inception_date', v_fund.inception_date, 'fund_type', v_fund.fund_type,
      'investment_strategy', v_fund.investment_strategy, 'aum_krw', v_fund.aum_krw
    )));
  end if;
  v_rows := v_lease_rows || v_rows || v_loan_rows;
  return logistics_core.primary_response(
    p_request_id, v_version,
    jsonb_build_object('from_date', v_from_date, 'to_date', v_to_date, 'maturities', v_rows)
  );
end;
$body$;

alter table logistics_core.funds
  drop column if exists ownership_ratio;

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
    'potential_income', 'income_loss', 'operating_expense', 'below_noi', 'debt_service'
  ] loop
    if jsonb_typeof(p_statement->v_section) <> 'array' then
      raise exception using errcode = 'PT422', message = 'FINANCE_SECTION_ARRAY_REQUIRED';
    end if;
    if exists (
      select 1
      from jsonb_array_elements(p_statement->v_section) item(value)
      group by lower(regexp_replace(btrim(coalesce(item.value->>'label', item.value->>'name')), '[[:space:]]+', '', 'g'))
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
      if v_row->>'account_code' = 'OPERATING_REVENUE' and not (
        v_section = 'potential_income'
        and v_row->>'statement_section' = 'potential_income'
        and v_row->>'label' = '영업수익'
        and logistics_core.is_finite_json_number(v_row->'normal_sign')
        and (v_row->>'normal_sign')::numeric = 1
      ) then
        raise exception using errcode = 'PT422', message = 'OPERATING_REVENUE_CANONICAL_ROW_INVALID';
      end if;
      if jsonb_typeof(v_row->'selected') <> 'boolean' then
        raise exception using errcode = 'PT422', message = 'FINANCE_SELECTED_BOOLEAN_REQUIRED';
      end if;
      if jsonb_typeof(v_row->'amounts') <> 'object' then
        raise exception using errcode = 'PT422', message = 'FINANCE_AMOUNTS_OBJECT_REQUIRED';
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

create or replace function logistics_core.sanitize_statement_rows(p_rows jsonb)
returns jsonb
language sql
immutable
set search_path = pg_catalog, logistics_core
as $function$
  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
    'account_code', item.value->'account_code',
    'statement_section', item.value->'statement_section',
    'label', item.value->'label',
    'normal_sign', item.value->'normal_sign',
    'name', item.value->'name',
    'selected', coalesce(item.value->'selected', 'false'::jsonb),
    'amounts', logistics_core.sanitize_amounts(item.value->'amounts')
  )) order by item.ordinality), '[]'::jsonb)
  from jsonb_array_elements(case when jsonb_typeof(p_rows) = 'array' then p_rows else '[]'::jsonb end)
    with ordinality item(value, ordinality);
$function$;

create or replace function pg_temp.noi_net_amounts(p_statement jsonb)
returns jsonb
language plpgsql
immutable
set search_path = pg_catalog
as $body$
declare
  v_result jsonb := '{}'::jsonb;
  v_period text;
  v_potential_sum numeric;
  v_loss_sum numeric;
  v_value_count bigint;
begin
  for v_period in
    select value #>> '{}'
    from jsonb_array_elements(p_statement->'periods') period(value)
  loop
    select
      coalesce(sum((row_item.value->'amounts'->v_period #>> '{}')::numeric)
        filter (where jsonb_typeof(row_item.value->'amounts'->v_period) = 'number'), 0),
      count(*) filter (where jsonb_typeof(row_item.value->'amounts'->v_period) = 'number')
    into v_potential_sum, v_value_count
    from jsonb_array_elements(p_statement->'potential_income') row_item(value);

    select
      coalesce(sum((row_item.value->'amounts'->v_period #>> '{}')::numeric)
        filter (where jsonb_typeof(row_item.value->'amounts'->v_period) = 'number'), 0),
      v_value_count + count(*) filter (
        where jsonb_typeof(row_item.value->'amounts'->v_period) = 'number'
      )
    into v_loss_sum, v_value_count
    from jsonb_array_elements(p_statement->'income_loss') row_item(value);

    v_result := v_result || jsonb_build_object(
      v_period,
      case when v_value_count = 0 then 'null'::jsonb
        else to_jsonb(v_potential_sum - v_loss_sum)
      end
    );
  end loop;
  return v_result;
end;
$body$;

do $noi_source_validation$
declare
  v_document record;
begin
  for v_document in select * from logistics_core.income_expense loop
    perform logistics_core.assert_statement_transition_valid(v_document.statement);
  end loop;
end;
$noi_source_validation$;

create temporary table noi_merge_snapshot as
select
  document.asset_code,
  document.statement->'periods' as periods,
  document.statement->'operating_expense' as operating_expense,
  document.statement->'below_noi' as below_noi,
  document.statement->'debt_service' as debt_service,
  pg_temp.noi_net_amounts(document.statement) as expected_amounts
from logistics_core.income_expense document;

update logistics_core.income_expense document
set statement = jsonb_set(
  jsonb_set(
    document.statement,
    '{potential_income}',
    jsonb_build_array(jsonb_build_object(
      'account_code', 'OPERATING_REVENUE',
      'statement_section', 'potential_income',
      'label', '영업수익',
      'normal_sign', 1,
      'selected', true,
      'amounts', snapshot.expected_amounts
    )),
    true
  ),
  '{income_loss}',
  '[]'::jsonb,
  true
)
from noi_merge_snapshot snapshot
where document.asset_code = snapshot.asset_code;

do $noi_postcheck$
begin
  if exists (
    select 1
    from logistics_core.income_expense document
    join noi_merge_snapshot snapshot using (asset_code)
    where document.statement->'periods' is distinct from snapshot.periods
  ) then
    raise exception using errcode = 'PT500', message = 'NOI_PERIODS_CHANGED';
  end if;
  if exists (
    select 1
    from logistics_core.income_expense document
    join noi_merge_snapshot snapshot using (asset_code)
    where document.statement->'operating_expense' is distinct from snapshot.operating_expense
       or document.statement->'below_noi' is distinct from snapshot.below_noi
       or document.statement->'debt_service' is distinct from snapshot.debt_service
  ) then
    raise exception using errcode = 'PT500', message = 'NOI_OTHER_SECTION_CHANGED';
  end if;
  if exists (
    select 1
    from logistics_core.income_expense document
    join noi_merge_snapshot snapshot using (asset_code)
    where jsonb_array_length(document.statement->'potential_income') <> 1
       or jsonb_array_length(document.statement->'income_loss') <> 0
       or document.statement #>> '{potential_income,0,account_code}' <> 'OPERATING_REVENUE'
       or document.statement #>> '{potential_income,0,statement_section}' <> 'potential_income'
       or document.statement #>> '{potential_income,0,label}' <> '영업수익'
       or document.statement #>> '{potential_income,0,normal_sign}' <> '1'
       or document.statement #> '{potential_income,0,amounts}' is distinct from snapshot.expected_amounts
  ) then
    raise exception using errcode = 'PT500', message = 'NOI_OPERATING_REVENUE_NET_MISMATCH';
  end if;
  if exists (
    select 1
    from logistics_core.income_expense document
    where logistics_core.sanitize_statement(document.statement) is distinct from document.statement
  ) then
    raise exception using errcode = 'PT500', message = 'NOI_MERGE_READBACK_FAILED';
  end if;
  if exists (
    select 1
    from logistics_core.income_expense document
    where pg_temp.noi_net_amounts(document.statement)
      is distinct from document.statement #> '{potential_income,0,amounts}'
  ) then
    raise exception using errcode = 'PT500', message = 'NOI_MERGE_IDEMPOTENCY_FAILED';
  end if;
end;
$noi_postcheck$;

create or replace function logistics_core.assert_statement_valid(p_statement jsonb)
returns void
language plpgsql
immutable
set search_path = pg_catalog, logistics_core
as $body$
declare
  v_operating_revenue jsonb;
begin
  perform logistics_core.assert_statement_transition_valid(p_statement);

  if jsonb_array_length(p_statement->'potential_income') <> 1
     or jsonb_array_length(p_statement->'income_loss') <> 0 then
    raise exception using
      errcode = 'PT422',
      message = 'FINANCE_CANONICAL_OPERATING_REVENUE_REQUIRED';
  end if;

  v_operating_revenue := p_statement->'potential_income'->0;
  if v_operating_revenue->>'account_code' <> 'OPERATING_REVENUE'
     or v_operating_revenue->>'statement_section' <> 'potential_income'
     or v_operating_revenue->>'label' <> '영업수익'
     or not logistics_core.is_finite_json_number(v_operating_revenue->'normal_sign')
     or (v_operating_revenue->>'normal_sign')::numeric <> 1 then
    raise exception using
      errcode = 'PT422',
      message = 'OPERATING_REVENUE_CANONICAL_ROW_INVALID';
  end if;
end;
$body$;

-- Re-declare the writer against the extended statement row contract so every
-- save is sanitized, written, and read back in one transaction.
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
  select document.xmin::text, document.statement into strict v_actual, v_old_statement
  from logistics_core.income_expense document
  where document.asset_code = v_asset_code for update;
  v_expected := logistics_core.expected_xmin(p_payload, p_expected_revisions, 'income_expense');
  perform logistics_core.assert_expected_xmin(v_actual, v_expected);
  v_statement := logistics_core.sanitize_statement(p_payload->'statement');
  v_old_rows := coalesce(v_old_statement->'potential_income', '[]'::jsonb)
    || coalesce(v_old_statement->'income_loss', '[]'::jsonb)
    || coalesce(v_old_statement->'operating_expense', '[]'::jsonb)
    || coalesce(v_old_statement->'below_noi', '[]'::jsonb)
    || coalesce(v_old_statement->'debt_service', '[]'::jsonb);
  v_new_rows := coalesce(v_statement->'potential_income', '[]'::jsonb)
    || coalesce(v_statement->'income_loss', '[]'::jsonb)
    || coalesce(v_statement->'operating_expense', '[]'::jsonb)
    || coalesce(v_statement->'below_noi', '[]'::jsonb)
    || coalesce(v_statement->'debt_service', '[]'::jsonb);
  perform logistics_core.assert_document_array_permissions(
    v_actor, v_asset_code, v_old_rows, v_new_rows
  );
  update logistics_core.income_expense document
  set statement = v_statement where document.asset_code = v_asset_code;
  select document.statement, document.xmin::text into strict v_statement, v_version
  from logistics_core.income_expense document where document.asset_code = v_asset_code;
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

do $final_contract$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'logistics_core'
      and table_name = 'funds'
      and column_name = 'ownership_ratio'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'logistics_core'
      and table_name = 'funds'
      and column_name = 'aum_krw'
  ) then
    raise exception using errcode = 'PT500', message = 'FUND_AUM_SCHEMA_READBACK_FAILED';
  end if;
  if exists (
    select 1
    from logistics_core.funds fund
    where fund.aum_krw is not null and fund.aum_krw < 0
  ) then
    raise exception using errcode = 'PT500', message = 'FUND_AUM_VALUE_INVALID';
  end if;
  if to_regprocedure('logistics_core.home_batch_save_entry(uuid,text,jsonb,jsonb)') is null
     or to_regprocedure('logistics_core.maturities_read_entry(uuid,text,jsonb,jsonb)') is null
     or to_regprocedure('logistics_core.finance_batch_save_entry(uuid,text,jsonb,jsonb)') is null then
    raise exception using errcode = 'PT500', message = 'FUND_NOI_RPC_READBACK_FAILED';
  end if;
end;
$final_contract$;

revoke all on function logistics_core.assert_home_fund_document_valid(jsonb)
from public, anon, authenticated;
revoke all on function logistics_core.assert_investments_valid(jsonb)
from public, anon, authenticated;
revoke all on function logistics_core.sanitize_investments(jsonb)
from public, anon, authenticated;
revoke all on function logistics_core.assert_statement_valid(jsonb)
  from public, anon, authenticated;
revoke all on function logistics_core.assert_statement_transition_valid(jsonb)
  from public, anon, authenticated;
revoke all on function logistics_core.sanitize_statement_rows(jsonb)
from public, anon, authenticated;

revoke all on function logistics_core.home_batch_save_entry(uuid, text, jsonb, jsonb)
from public, anon, authenticated;
revoke all on function logistics_core.maturities_read_entry(uuid, text, jsonb, jsonb)
from public, anon, authenticated;
revoke all on function logistics_core.finance_batch_save_entry(uuid, text, jsonb, jsonb)
from public, anon, authenticated;
grant execute on function logistics_core.home_batch_save_entry(uuid, text, jsonb, jsonb)
to authenticated;
grant execute on function logistics_core.maturities_read_entry(uuid, text, jsonb, jsonb)
to authenticated;
grant execute on function logistics_core.finance_batch_save_entry(uuid, text, jsonb, jsonb)
to authenticated;

notify pgrst, 'reload schema';

commit;
