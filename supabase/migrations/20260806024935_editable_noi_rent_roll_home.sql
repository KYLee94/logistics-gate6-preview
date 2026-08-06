begin;

set local lock_timeout = '5s';
set local statement_timeout = '120s';

-- GATE6_EDITABLE_RENT_ROLL_NOI_HOME_V3
-- Source values are editable; derived values remain server-calculated.

alter table logistics_core.assets
  add column if not exists land_area_sqm numeric(20, 6),
  add column if not exists sector text,
  add column if not exists floor_count text,
  add column if not exists manager_name text,
  add column if not exists manager_team text;

alter table logistics_core.funds
  add column if not exists fund_type text,
  add column if not exists legal_form text,
  add column if not exists investment_strategy text;

alter table logistics_core.fund_beneficiary_tranches
  add column if not exists agreed_amount_krw numeric(24, 4),
  add column if not exists contributed_amount_krw numeric(24, 4);

alter table logistics_core.loans
  add column if not exists maturity_date date,
  add column if not exists loan_type text,
  add column if not exists tranche_name text,
  add column if not exists interest_type text,
  add column if not exists coupon_rate text,
  add column if not exists all_in_rate text,
  add column if not exists fee_rate text;

alter table logistics_core.spaces
  add column if not exists temperature_type text,
  add column if not exists goods_type text,
  add column if not exists subtenant_name text,
  add column if not exists free_area_type text;

alter table logistics_core.lease_contracts
  add column if not exists construction_start_date date,
  add column if not exists completion_date date,
  add column if not exists security_type text,
  add column if not exists security_ratio numeric(12, 8);

alter table logistics_core.rent_terms
  add column if not exists rent_calculation_method text,
  add column if not exists rent_free_start_date date,
  add column if not exists rent_free_end_date date,
  add column if not exists deposit_escalation_first_date date,
  add column if not exists deposit_escalation_interval_months integer,
  add column if not exists deposit_escalation_rate text,
  add column if not exists rent_escalation_first_date date,
  add column if not exists rent_escalation_interval_months integer,
  add column if not exists rent_escalation_rate text,
  add column if not exists cam_escalation_first_date date,
  add column if not exists cam_escalation_interval_months integer,
  add column if not exists cam_escalation_rate text,
  add column if not exists pallet_rack_fee_per_py numeric(24, 8),
  add column if not exists e_noc numeric(24, 4);

comment on column logistics_core.rent_terms.e_noc is
  'Server-derived E.NOC = (monthly rent + monthly CAM) / (leased sqm * 0.3025). NULL when inputs are incomplete.';

update logistics_core.assets asset
set land_area_sqm = coalesce(asset.land_area_sqm, nullif(coalesce(source.row->>'land_area_sqm', source.row->>'site_area_sqm'), '')::numeric),
    sector = coalesce(asset.sector, nullif(coalesce(source.row->>'sector', source.row->>'asset_type'), '')),
    floor_count = coalesce(asset.floor_count, nullif(coalesce(source.row->>'floor_count', source.row->>'floor_summary'), '')),
    manager_name = coalesce(asset.manager_name, nullif(coalesce(source.row->>'current_manager_name', source.row->>'manager_name'), '')),
    manager_team = coalesce(asset.manager_team, nullif(coalesce(source.row->>'current_manager_department', source.row->>'manager_team'), ''))
from (select to_jsonb(source_asset) row from public.ll_assets source_asset) source
where asset.public_key = source.row->>'asset_id';

update logistics_core.funds fund
set fund_type = coalesce(fund.fund_type, nullif(source.row->>'fund_type', '')),
    legal_form = coalesce(fund.legal_form, nullif(source.row->>'legal_form', '')),
    investment_strategy = coalesce(fund.investment_strategy, nullif(source.row->>'investment_strategy', ''))
from (select to_jsonb(source_fund) row from public.ll_funds source_fund) source
where fund.fund_key = source.row->>'fund_id';

update logistics_core.fund_beneficiary_tranches
set contributed_amount_krw = coalesce(contributed_amount_krw, committed_amount_krw)
where contributed_amount_krw is null;

update logistics_core.loans loan
set maturity_date = coalesce(loan.maturity_date, nullif(source.row->>'maturity_date', '')::date),
    loan_type = coalesce(loan.loan_type, nullif(source.row->>'loan_type', '')),
    tranche_name = coalesce(loan.tranche_name, nullif(source.row->>'tranche', '')),
    interest_type = coalesce(loan.interest_type, nullif(source.row->>'interest_type', '')),
    coupon_rate = coalesce(loan.coupon_rate, nullif(coalesce(source.row->>'loan_rate', source.row->>'interest_rate'), '')),
    all_in_rate = coalesce(loan.all_in_rate, nullif(coalesce(source.row->>'all_in_rate', source.row->>'all_in'), '')),
    fee_rate = coalesce(loan.fee_rate, nullif(coalesce(source.row->>'fee_rate', source.row->>'fee'), ''))
from (select to_jsonb(source_loan) row from public.ll_fund_capital_tranches source_loan) source
where loan.source_tranche_id = (source.row->>'id')::uuid;

update logistics_core.spaces space
set temperature_type = coalesce(space.temperature_type, nullif(source.row->>'temperature_type', '')),
    goods_type = coalesce(space.goods_type, nullif(source.row->>'goods_type', '')),
    subtenant_name = coalesce(space.subtenant_name, nullif(source.row->>'subtenant_name', '')),
    free_area_type = coalesce(space.free_area_type, nullif(source.row->>'free_area_type', ''))
from (select to_jsonb(source_space) row from public.ll_lease_spaces source_space) source
where space.space_key = source.row->>'lease_space_id';

update logistics_core.rent_terms term
set rent_escalation_first_date = coalesce(term.rent_escalation_first_date,
      case when term.rent_escalation_rule->>'next_date' ~ '^\d{4}-\d{2}-\d{2}$' then (term.rent_escalation_rule->>'next_date')::date end),
    rent_escalation_interval_months = coalesce(term.rent_escalation_interval_months,
      case when term.rent_escalation_rule->>'cycle_months' ~ '^\d+$' then (term.rent_escalation_rule->>'cycle_months')::integer end),
    rent_escalation_rate = coalesce(term.rent_escalation_rate, nullif(term.rent_escalation_rule->>'raw_rate', '')),
    cam_escalation_first_date = coalesce(term.cam_escalation_first_date,
      case when term.cam_escalation_rule->>'next_date' ~ '^\d{4}-\d{2}-\d{2}$' then (term.cam_escalation_rule->>'next_date')::date end),
    cam_escalation_interval_months = coalesce(term.cam_escalation_interval_months,
      case when term.cam_escalation_rule->>'cycle_months' ~ '^\d+$' then (term.cam_escalation_rule->>'cycle_months')::integer end),
    cam_escalation_rate = coalesce(term.cam_escalation_rate, nullif(term.cam_escalation_rule->>'raw_rate', ''));

insert into logistics_core.cashflow_accounts (
  account_code, name_ko, account_kind, statement_section, normal_sign, display_order
) values
  ('POTENTIAL_BASE_RENT', '잠재 임대료', 'atomic', 'potential_income', 1, 10),
  ('POTENTIAL_CAM_INCOME', '잠재 관리비', 'atomic', 'potential_income', 1, 20),
  ('EXPENSE_REIMBURSEMENT_INCOME', '실비·공과금 회수수익', 'atomic', 'potential_income', 1, 30),
  ('DEPOSIT_OPERATING_INCOME', '보증금 운용수익', 'atomic', 'potential_income', 1, 40),
  ('PARKING_YARD_INCOME', '주차·야드 수익', 'atomic', 'potential_income', 1, 50),
  ('ROOF_SOLAR_ANTENNA_INCOME', '지붕태양광·안테나 수익', 'atomic', 'potential_income', 1, 60),
  ('OTHER_PROPERTY_INCOME', '기타 부동산수익', 'atomic', 'potential_income', 1, 70),
  ('VACANCY_LOSS', '공실손실', 'atomic', 'income_loss', -1, 110),
  ('RENT_FREE_CONCESSION_LOSS', '렌트프리·인센티브', 'atomic', 'income_loss', -1, 120),
  ('BAD_DEBT_LOSS', '미수·대손', 'atomic', 'income_loss', -1, 130),
  ('OTHER_INCOME_LOSS', '기타 수입손실', 'atomic', 'income_loss', -1, 140),
  ('PM_FEE', 'PM 수수료', 'atomic', 'operating_expense', -1, 210),
  ('FM_FEE', 'FM 수수료', 'atomic', 'operating_expense', -1, 220),
  ('REPAIRS_MAINTENANCE', '수선유지비', 'atomic', 'operating_expense', -1, 230),
  ('UTILITIES', '수도광열비', 'atomic', 'operating_expense', -1, 240),
  ('CLEANING', '청소비', 'atomic', 'operating_expense', -1, 250),
  ('SECURITY', '보안경비', 'atomic', 'operating_expense', -1, 260),
  ('LANDSCAPING_SNOW', '조경·제설비', 'atomic', 'operating_expense', -1, 270),
  ('PARKING_YARD_MANAGEMENT', '주차·야드 관리비', 'atomic', 'operating_expense', -1, 280),
  ('PROPERTY_TAX_PUBLIC_DUES', '재산세·제세공과', 'atomic', 'operating_expense', -1, 290),
  ('PROPERTY_INSURANCE', '보험료', 'atomic', 'operating_expense', -1, 300),
  ('RECURRING_LEASING_EXPENSE', '경상 임대운영비', 'atomic', 'operating_expense', -1, 310),
  ('GENERAL_PROPERTY_ADMIN', '일반관리비', 'atomic', 'operating_expense', -1, 320),
  ('OTHER_PROPERTY_OPEX', '기타 운영경비', 'atomic', 'operating_expense', -1, 330),
  ('CAPEX', '자본적 지출', 'atomic', 'below_noi', -1, 410),
  ('TENANT_IMPROVEMENT', '임차인 시설공사비(TI)', 'atomic', 'below_noi', -1, 420),
  ('LEASING_COMMISSION', '임대중개수수료(LC)', 'atomic', 'below_noi', -1, 430),
  ('CAPITAL_RESERVE', '자본유보금', 'atomic', 'below_noi', -1, 440),
  ('AMC_FEE', 'AMC 수수료', 'atomic', 'below_noi', -1, 450),
  ('CUSTODY_FEE', '자산보관수수료', 'atomic', 'below_noi', -1, 460),
  ('GENERAL_ADMIN_TRUSTEE_FEE', '일반사무·수탁수수료', 'atomic', 'below_noi', -1, 470),
  ('OTHER_OWNER_COST', '기타 소유자비용', 'atomic', 'below_noi', -1, 480),
  ('NONCASH_ADDBACK', '비현금비용 가산', 'atomic', 'below_noi', 1, 490),
  ('INTEREST_PAID', '이자 지급액', 'atomic', 'debt_service', -1, 510),
  ('PRINCIPAL_REPAYMENT', '원금 상환액', 'atomic', 'debt_service', -1, 520),
  ('LOAN_FEE', '대출 관련 수수료', 'atomic', 'debt_service', -1, 530)
on conflict (account_code) do update set
  name_ko = excluded.name_ko,
  account_kind = excluded.account_kind,
  statement_section = excluded.statement_section,
  normal_sign = excluded.normal_sign,
  display_order = excluded.display_order,
  deleted_at = null,
  deleted_by = null;

update logistics_core.cashflow_accounts account
set deleted_at = now()
where account.account_code in ('MANUAL_REVENUE', 'MANUAL_COST', 'MANUAL_RECEIPT')
  and not exists (
    select 1 from logistics_core.monthly_ledger_entries entry
    where entry.account_id = account.id and entry.deleted_at is null
  );

insert into logistics_core.formula_definitions (
  formula_key, version, name_ko, description_ko, effective_from, input_contract,
  expression_ast, result_unit, authority_reference, status, approved_at, test_vector_hash
) values
  ('effective_gross_income', 2, '유효조소득', '잠재총수입에서 공실·렌트프리·미수 등 수입손실을 차감', date '2026-08-06', '{}'::jsonb, '{"op":"subtract","left":"potential_gross_income","right":"total_income_loss"}'::jsonb, 'KRW', '한국부동산원 상업용부동산 임대동향조사', 'approved', now(), 'gate6-korean-logistics-noi-v2-egi'),
  ('net_operating_income', 2, '순영업소득', '유효조소득에서 자산 운영경비를 차감', date '2026-08-06', '{}'::jsonb, '{"op":"subtract","left":"effective_gross_income","right":"total_operating_expense"}'::jsonb, 'KRW', '한국부동산원 상업용부동산 임대동향조사', 'approved', now(), 'gate6-korean-logistics-noi-v2-noi'),
  ('asset_net_cash_flow', 2, '자산 순현금흐름', 'NOI에서 CAPEX·TI·LC·소유자비용을 차감하고 비현금비용을 가산', date '2026-08-06', '{}'::jsonb, '{"op":"asset_ncf","formula":"noi-below_noi_cash_cost+noncash_addback"}'::jsonb, 'KRW', '한국신용평가 CMBS 평가방법론', 'approved', now(), 'gate6-korean-logistics-noi-v2-ncf'),
  ('post_debt_cash_flow', 2, '부채상환 후 현금흐름', '자산 NCF에서 이자·원금·대출수수료를 차감', date '2026-08-06', '{}'::jsonb, '{"op":"subtract","left":"asset_net_cash_flow","right":"debt_service"}'::jsonb, 'KRW', '한국신용평가 CMBS 평가방법론', 'approved', now(), 'gate6-korean-logistics-noi-v2-post-debt')
on conflict (formula_key, version) do nothing;

create or replace function logistics_core.set_legacy_field(
  p_table regclass,
  p_pk_column text,
  p_pk_value text,
  p_column text,
  p_value text,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $body$
declare
  target_type text;
  has_source_payload boolean;
  has_updated_at boolean;
begin
  select pg_catalog.format_type(attribute.atttypid, attribute.atttypmod)
  into target_type
  from pg_catalog.pg_attribute attribute
  where attribute.attrelid = p_table
    and attribute.attname = p_column
    and attribute.attnum > 0
    and not attribute.attisdropped;

  select exists (
    select 1 from pg_catalog.pg_attribute attribute
    where attribute.attrelid = p_table and attribute.attname = 'source_payload'
      and attribute.attnum > 0 and not attribute.attisdropped
  ), exists (
    select 1 from pg_catalog.pg_attribute attribute
    where attribute.attrelid = p_table and attribute.attname = 'updated_at'
      and attribute.attnum > 0 and not attribute.attisdropped
  ) into has_source_payload, has_updated_at;

  if target_type is not null then
    execute pg_catalog.format(
      'update %s set %I = nullif($1, '''')::%s%s where %I::text = $2',
      p_table, p_column, target_type,
      case when has_updated_at then ', updated_at = now()' else '' end,
      p_pk_column
    ) using p_value, p_pk_value;
  end if;

  if has_source_payload then
    execute pg_catalog.format(
      'update %s set source_payload = coalesce(source_payload, ''{}''::jsonb) || $1%s where %I::text = $2',
      p_table,
      case when has_updated_at then ', updated_at = now()' else '' end,
      p_pk_column
    ) using jsonb_build_object(
      'data_platform_overrides', jsonb_build_object(p_column, p_value),
      'data_platform_metadata', p_metadata
    ), p_pk_value;
  end if;
end;
$body$;

revoke all on function logistics_core.set_legacy_field(regclass, text, text, text, text, jsonb)
  from public, anon, authenticated;

create or replace function logistics_core.set_core_field(
  p_table regclass,
  p_id uuid,
  p_column text,
  p_value text,
  p_actor uuid
)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $body$
declare
  target_type text;
begin
  select pg_catalog.format_type(attribute.atttypid, attribute.atttypmod)
  into target_type
  from pg_catalog.pg_attribute attribute
  where attribute.attrelid = p_table
    and attribute.attname = p_column
    and attribute.attnum > 0
    and not attribute.attisdropped;
  if target_type is null then
    raise exception using errcode = 'PT422', message = 'HOME_FIELD_NOT_FOUND';
  end if;
  execute pg_catalog.format(
    'update %s set %I = nullif($1, '''')::%s, updated_at = now(), updated_by = $2 where id = $3',
    p_table, p_column, target_type
  ) using p_value, p_actor, p_id;
end;
$body$;

revoke all on function logistics_core.set_core_field(regclass, uuid, text, text, uuid)
  from public, anon, authenticated;

do $rename_editable_v3$
begin
  if to_regprocedure('logistics_core.home_read_entry_v3(uuid,text,jsonb,jsonb)') is null then
    execute 'alter function logistics_core.home_read_entry(uuid, text, jsonb, jsonb) rename to home_read_entry_v3';
  end if;
  if to_regprocedure('logistics_core.rent_roll_read_entry_v3(uuid,text,jsonb,jsonb)') is null then
    execute 'alter function logistics_core.rent_roll_read_entry(uuid, text, jsonb, jsonb) rename to rent_roll_read_entry_v3';
  end if;
  if to_regprocedure('logistics_core.rent_roll_batch_save_entry_v3(uuid,text,jsonb,jsonb)') is null then
    execute 'alter function logistics_core.rent_roll_batch_save_entry(uuid, text, jsonb, jsonb) rename to rent_roll_batch_save_entry_v3';
  end if;
  if to_regprocedure('logistics_core.finance_batch_save_entry_v1(uuid,text,jsonb,jsonb)') is null then
    execute 'alter function logistics_core.finance_batch_save_entry(uuid, text, jsonb, jsonb) rename to finance_batch_save_entry_v1';
  end if;
end;
$rename_editable_v3$;

create or replace function logistics_core.home_read_entry(
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
  base_response jsonb;
  actor_id uuid := logistics_core.request_actor();
  resolved_asset_id uuid;
  asset_payload jsonb;
  fund_rows jsonb;
  investment_rows jsonb;
  loan_rows jsonb;
  write_status jsonb;
begin
  base_response := logistics_core.home_read_entry_v3(p_request_id, p_asset_key, p_payload, p_expected_revisions);
  if nullif(btrim(p_asset_key), '') is null then return base_response; end if;
  resolved_asset_id := logistics_core.resolve_asset_id(p_asset_key);
  perform logistics_core.assert_asset_permission(actor_id, resolved_asset_id, 'read');
  write_status := logistics_core.actor_write_status(actor_id, resolved_asset_id);

  select jsonb_strip_nulls(jsonb_build_object(
    'asset_key', asset.asset_key, 'asset_code', asset.asset_code, 'name', asset.name_ko,
    'address', asset.address_ko, 'sector', asset.sector, 'land_area_sqm', asset.land_area_sqm,
    'gross_area_sqm', asset.gross_area_sqm, 'leasable_area_sqm', asset.leasable_area_sqm,
    'floor_count', asset.floor_count, 'manager_name', asset.manager_name,
    'manager_team', asset.manager_team, 'acquisition_cost', asset.acquisition_cost,
    'current_valuation', asset.current_valuation, 'currency_code', asset.currency_code,
    'revision', asset.revision
  )) into asset_payload
  from logistics_core.assets asset where asset.id = resolved_asset_id and asset.deleted_at is null;

  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
    'fund_key', fund.fund_key, 'fund_code', fund.fund_code, 'name', fund.name_ko,
    'status', fund.status, 'fund_type', fund.fund_type, 'legal_form', fund.legal_form,
    'investment_strategy', fund.investment_strategy, 'inception_date', fund.inception_date,
    'maturity_date', fund.maturity_date, 'effective_from', link.effective_from,
    'effective_to', link.effective_to, 'ownership_ratio', link.ownership_ratio,
    'revision', greatest(fund.revision, link.revision)
  )) order by fund.name_ko), '[]'::jsonb) into fund_rows
  from logistics_core.fund_asset_links link
  join logistics_core.funds fund on fund.id = link.fund_id and fund.deleted_at is null
  where link.asset_id = resolved_asset_id and link.deleted_at is null;

  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
    'beneficiary_key', tranche.beneficiary_key, 'fund_key', fund.fund_key,
    'fund_name', fund.name_ko, 'tranche', tranche.tranche_code,
    'beneficiary_name', tranche.beneficiary_name,
    'agreed_amount_krw', coalesce(tranche.agreed_amount_krw, tranche.committed_amount_krw),
    'contributed_amount_krw', tranche.contributed_amount_krw,
    'revision', tranche.revision
  )) order by fund.name_ko, tranche.tranche_code), '[]'::jsonb) into investment_rows
  from logistics_core.fund_asset_links link
  join logistics_core.funds fund on fund.id = link.fund_id and fund.deleted_at is null
  join logistics_core.fund_beneficiary_tranches tranche
    on tranche.fund_id = fund.id and tranche.source_is_active and tranche.deleted_at is null
  where link.asset_id = resolved_asset_id and link.deleted_at is null;

  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
    'loan_key', loan.loan_key, 'tranche', loan.tranche_name, 'lender_name', lender.name_ko,
    'committed_amount_krw', loan.commitment_amount, 'drawdown_date', loan.drawdown_date,
    'maturity_date', loan.maturity_date, 'loan_type', loan.loan_type,
    'interest_type', loan.interest_type, 'coupon_rate', loan.coupon_rate,
    'all_in_rate', loan.all_in_rate, 'fee_rate', loan.fee_rate, 'revision', loan.revision
  )) order by loan.tranche_name, lender.name_ko), '[]'::jsonb) into loan_rows
  from logistics_core.loans loan
  left join logistics_core.loan_lenders loan_lender on loan_lender.loan_id = loan.id and loan_lender.deleted_at is null
  left join logistics_core.lenders lender on lender.id = loan_lender.lender_id and lender.deleted_at is null
  where loan.deleted_at is null and (
    loan.asset_id = resolved_asset_id or exists (
      select 1 from logistics_core.fund_asset_links link
      where link.asset_id = resolved_asset_id and link.fund_id = loan.fund_id and link.deleted_at is null
    )
  );

  base_response := jsonb_set(base_response, '{data,asset}', asset_payload, true);
  base_response := jsonb_set(base_response, '{data,funds}', fund_rows, true);
  base_response := jsonb_set(base_response, '{data,investments}', investment_rows, true);
  base_response := jsonb_set(base_response, '{data,loans}', loan_rows, true);
  base_response := jsonb_set(base_response, '{data,write_enabled}', to_jsonb(coalesce((write_status->>'write_enabled')::boolean, false)), true);
  base_response := jsonb_set(base_response, '{data,write_reason}', to_jsonb(write_status->>'write_reason'), true);
  return base_response;
end;
$body$;

create or replace function logistics_core.home_batch_save_entry(
  p_request_id uuid,
  p_asset_key text,
  p_payload jsonb,
  p_expected_revisions jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, logistics_core, public
as $body$
declare
  actor_id uuid := logistics_core.request_actor();
  resolved_asset_id uuid := logistics_core.resolve_asset_id(p_asset_key);
  request_digest text := logistics_core.request_hash('v2/home/batch-save', p_asset_key, p_payload, p_expected_revisions);
  cached_response jsonb;
  operation jsonb;
  entity_name text;
  entity_key text;
  field_name text;
  target_column text;
  target_table regclass;
  entity_id uuid;
  current_revision bigint;
  expected_revision bigint;
  source_key text;
  before_row jsonb;
  after_row jsonb;
  changed_count integer := 0;
  final_revision bigint := 0;
  response jsonb;
begin
  perform logistics_core.assert_v2_writer_route(resolved_asset_id);
  cached_response := logistics_core.claim_idempotency(actor_id, 'v2/home/batch-save', p_request_id, request_digest);
  if cached_response is not null then return cached_response; end if;
  if jsonb_typeof(p_payload->'operations') <> 'array' then
    raise exception using errcode = 'PT422', message = 'HOME_OPERATIONS_ARRAY_REQUIRED';
  end if;
  if jsonb_array_length(p_payload->'operations') > 200 then
    raise exception using errcode = 'PT422', message = 'BATCH_LIMIT_EXCEEDED';
  end if;

  for operation in select value from jsonb_array_elements(p_payload->'operations') loop
    entity_name := nullif(operation->>'entity', '');
    entity_key := nullif(operation->>'entity_key', '');
    field_name := nullif(operation->>'field', '');
    if entity_name is null or entity_key is null or field_name is null then
      raise exception using errcode = 'PT422', message = 'INVALID_HOME_OPERATION';
    end if;
    perform logistics_core.assert_asset_permission(actor_id, resolved_asset_id, 'update');

    if entity_name = 'asset' and field_name = any(array[
      'name','address','asset_code','sector','land_area_sqm','gross_area_sqm','leasable_area_sqm',
      'floor_count','manager_name','manager_team','acquisition_cost','current_valuation','currency_code'
    ]) then
      target_table := 'logistics_core.assets'::regclass;
      target_column := case field_name when 'name' then 'name_ko' when 'address' then 'address_ko' else field_name end;
      select asset.id, asset.revision, asset.public_key, to_jsonb(asset)
      into entity_id, current_revision, source_key, before_row
      from logistics_core.assets asset where asset.asset_key = entity_key and asset.id = resolved_asset_id for update;
    elsif entity_name = 'fund' and field_name = any(array[
      'name','fund_type','legal_form','investment_strategy','inception_date','maturity_date','status'
    ]) then
      target_table := 'logistics_core.funds'::regclass;
      target_column := case when field_name = 'name' then 'name_ko' else field_name end;
      select fund.id, fund.revision, fund.fund_key, to_jsonb(fund)
      into entity_id, current_revision, source_key, before_row
      from logistics_core.funds fund where fund.fund_key = entity_key and exists (
        select 1 from logistics_core.fund_asset_links link where link.fund_id = fund.id and link.asset_id = resolved_asset_id and link.deleted_at is null
      ) for update;
    elsif entity_name = 'beneficiary' and field_name = any(array[
      'tranche','beneficiary_name','agreed_amount_krw','contributed_amount_krw'
    ]) then
      target_table := 'logistics_core.fund_beneficiary_tranches'::regclass;
      target_column := case when field_name = 'tranche' then 'tranche_code' else field_name end;
      select tranche.id, tranche.revision, tranche.source_tranche_id::text, to_jsonb(tranche)
      into entity_id, current_revision, source_key, before_row
      from logistics_core.fund_beneficiary_tranches tranche where tranche.beneficiary_key = entity_key and exists (
        select 1 from logistics_core.fund_asset_links link where link.fund_id = tranche.fund_id and link.asset_id = resolved_asset_id and link.deleted_at is null
      ) for update;
    elsif entity_name = 'loan' and field_name = any(array[
      'tranche','committed_amount_krw','drawdown_date','maturity_date','loan_type','interest_type','coupon_rate','all_in_rate','fee_rate'
    ]) then
      target_table := 'logistics_core.loans'::regclass;
      target_column := case field_name when 'tranche' then 'tranche_name' when 'committed_amount_krw' then 'commitment_amount' else field_name end;
      select loan.id, loan.revision, loan.source_tranche_id::text, to_jsonb(loan)
      into entity_id, current_revision, source_key, before_row
      from logistics_core.loans loan where loan.loan_key = entity_key and (
        loan.asset_id = resolved_asset_id or exists (
          select 1 from logistics_core.fund_asset_links link where link.fund_id = loan.fund_id and link.asset_id = resolved_asset_id and link.deleted_at is null
        )
      ) for update;
    elsif entity_name = 'loan' and field_name = 'lender_name' then
      select lender.id, lender.revision, loan.source_tranche_id::text, to_jsonb(lender)
      into entity_id, current_revision, source_key, before_row
      from logistics_core.loans loan
      join logistics_core.loan_lenders loan_lender on loan_lender.loan_id = loan.id and loan_lender.deleted_at is null
      join logistics_core.lenders lender on lender.id = loan_lender.lender_id and lender.deleted_at is null
      where loan.loan_key = entity_key and (
        loan.asset_id = resolved_asset_id or exists (
          select 1 from logistics_core.fund_asset_links link where link.fund_id = loan.fund_id and link.asset_id = resolved_asset_id and link.deleted_at is null
        )
      ) order by loan_lender.seniority limit 1 for update of lender;
      target_table := 'logistics_core.lenders'::regclass;
      target_column := 'name_ko';
    else
      raise exception using errcode = 'PT422', message = 'HOME_FIELD_NOT_ALLOWED';
    end if;
    if entity_id is null then raise exception using errcode = 'PT404', message = 'NOT_FOUND'; end if;
    expected_revision := coalesce(nullif(operation->>'expected_revision', '')::bigint, nullif(p_expected_revisions->>entity_key, '')::bigint);
    if expected_revision is not null and expected_revision <> current_revision then
      raise exception using errcode = 'PT409', message = 'REVISION_CONFLICT';
    end if;

    perform logistics_core.set_core_field(target_table, entity_id, target_column, operation->>'value', actor_id);
    execute pg_catalog.format('select to_jsonb(row), revision from %s row where id = $1', target_table)
      into after_row, current_revision using entity_id;

    if entity_name = 'asset' then
      perform logistics_core.set_legacy_field('public.ll_assets'::regclass, 'asset_id', source_key,
        case field_name when 'name' then 'asset_name' when 'address' then 'road_address' else field_name end,
        operation->>'value', jsonb_build_object('request_id', p_request_id));
    elsif entity_name = 'fund' then
      perform logistics_core.set_legacy_field('public.ll_funds'::regclass, 'fund_id', source_key,
        case field_name when 'name' then 'fund_name' else field_name end,
        operation->>'value', jsonb_build_object('request_id', p_request_id));
    elsif entity_name = 'beneficiary' then
      perform logistics_core.set_legacy_field('public.ll_fund_capital_tranches'::regclass, 'id', source_key,
        case field_name when 'tranche' then 'tranche' when 'beneficiary_name' then 'party_name' when 'agreed_amount_krw' then 'committed_amount_krw' else field_name end,
        operation->>'value', jsonb_build_object('request_id', p_request_id));
    else
      perform logistics_core.set_legacy_field('public.ll_fund_capital_tranches'::regclass, 'id', source_key,
        case field_name when 'tranche' then 'tranche' when 'lender_name' then 'party_name' when 'committed_amount_krw' then 'committed_amount_krw' when 'coupon_rate' then 'loan_rate' else field_name end,
        operation->>'value', jsonb_build_object('request_id', p_request_id));
    end if;

    insert into logistics_core.audit_events (
      actor_user_id, action, entity_type, entity_id, asset_id, entity_revision,
      before_hash, after_hash, change_payload, reason, client_request_id, mapping_version, correlation_id
    ) values (
      actor_id, 'update', entity_name, entity_id, resolved_asset_id, current_revision,
      logistics_core.json_sha256(before_row), logistics_core.json_sha256(after_row),
      jsonb_build_object('field', field_name), coalesce(nullif(operation->>'reason', ''), '홈 화면 직접 수정'),
      p_request_id, 'gate6-data-platform-3', p_request_id
    );
    changed_count := changed_count + 1;
    final_revision := greatest(final_revision, current_revision);
  end loop;

  response := logistics_core.primary_response(p_request_id, final_revision,
    jsonb_build_object('changed_count', changed_count, 'readback', 'verified'));
  perform logistics_core.complete_idempotency(actor_id, 'v2/home/batch-save', p_request_id, response);
  return response;
end;
$body$;

create or replace function logistics_core.sync_rent_roll_finance(
  p_asset_id uuid,
  p_actor uuid
)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, logistics_core
as $body$
declare
  target_month date := date_trunc('month', current_date)::date;
  affected integer := 0;
begin
  update logistics_core.monthly_ledger_entries entry
  set deleted_at = now(), deleted_by = p_actor, updated_by = p_actor
  where entry.asset_id = p_asset_id and entry.month = target_month
    and entry.scenario = 'actual' and entry.accounting_basis = 'accrual'
    and entry.source_kind = 'rent_roll_calculation' and entry.deleted_at is null;

  insert into logistics_core.monthly_ledger_entries (
    entry_key, asset_id, month, account_id, scenario, accounting_basis, amount,
    source_kind, source_ref, source_line_key, data_status, created_by, updated_by
  )
  select
    'rentroll:' || term.rent_term_key || ':' || account.account_code || ':' || to_char(target_month, 'YYYY-MM'),
    p_asset_id, target_month, account.id, 'actual', 'accrual',
    case account.account_code
      when 'POTENTIAL_BASE_RENT' then coalesce(term.base_monthly_rent, 0)
      else coalesce(term.base_monthly_management_fee, 0)
    end,
    'rent_roll_calculation', 'rent-roll:' || p_asset_id::text,
    term.rent_term_key || ':' || account.account_code, 'provided', p_actor, p_actor
  from logistics_core.rent_terms term
  join logistics_core.contract_spaces allocation on allocation.id = term.contract_space_id and allocation.deleted_at is null
  join logistics_core.lease_contracts contract on contract.id = allocation.contract_id and contract.deleted_at is null
  cross join logistics_core.cashflow_accounts account
  where contract.asset_id = p_asset_id
    and term.deleted_at is null
    and account.account_code in ('POTENTIAL_BASE_RENT', 'POTENTIAL_CAM_INCOME')
    and account.deleted_at is null
    and contract.commencement_date <= (target_month + interval '1 month - 1 day')::date
    and (contract.expiry_date is null or contract.expiry_date >= target_month)
  on conflict (entry_key) do update set
    amount = excluded.amount, deleted_at = null, deleted_by = null,
    updated_at = now(), updated_by = excluded.updated_by;
  get diagnostics affected = row_count;
  return affected;
end;
$body$;

revoke all on function logistics_core.sync_rent_roll_finance(uuid, uuid)
  from public, anon, authenticated;

create or replace function logistics_core.rent_roll_read_entry(
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
  base_response jsonb;
  enriched_rows jsonb;
begin
  base_response := logistics_core.rent_roll_read_entry_v3(p_request_id, p_asset_key, p_payload, p_expected_revisions);
  select coalesce(jsonb_agg(
    row_item.value || jsonb_strip_nulls(jsonb_build_object(
      'tenant_name', tenant.legal_name_ko,
      'business_registration_number', tenant.business_registration_number,
      'temperature_type', space.temperature_type,
      'goods_type', space.goods_type,
      'subtenant_name', space.subtenant_name,
      'free_area_type', space.free_area_type,
      'signed_date', contract.signed_date,
      'construction_start_date', contract.construction_start_date,
      'completion_date', contract.completion_date,
      'security_type', contract.security_type,
      'security_ratio', contract.security_ratio,
      'rent_calculation_method', term.rent_calculation_method,
      'rent_free_months', term.rent_free_months,
      'rent_free_start_date', term.rent_free_start_date,
      'rent_free_end_date', term.rent_free_end_date,
      'pallet_rack_fee_per_py', term.pallet_rack_fee_per_py,
      'deposit_escalation_first_date', term.deposit_escalation_first_date,
      'deposit_escalation_interval_months', term.deposit_escalation_interval_months,
      'deposit_escalation_rate', term.deposit_escalation_rate,
      'rent_escalation_first_date', term.rent_escalation_first_date,
      'rent_escalation_interval_months', term.rent_escalation_interval_months,
      'rent_escalation_rate', term.rent_escalation_rate,
      'cam_escalation_first_date', term.cam_escalation_first_date,
      'cam_escalation_interval_months', term.cam_escalation_interval_months,
      'cam_escalation_rate', term.cam_escalation_rate,
      'current_total_cost_per_py_krw', case
        when coalesce(space.leased_area_sqm, allocation.allocated_leasable_area_sqm) > 0
         and term.base_monthly_rent is not null and term.base_monthly_management_fee is not null
        then round((term.base_monthly_rent + term.base_monthly_management_fee)
          / (coalesce(space.leased_area_sqm, allocation.allocated_leasable_area_sqm) * 0.3025), 2)
        else null end,
      'effective_rent', case
        when contract.commencement_date is not null and contract.expiry_date > contract.commencement_date
         and term.base_monthly_rent is not null then round(
           term.base_monthly_rent * greatest(0, (
             (extract(year from age(contract.expiry_date, contract.commencement_date)) * 12
              + extract(month from age(contract.expiry_date, contract.commencement_date))) - term.rent_free_months
           )) / nullif(
             extract(year from age(contract.expiry_date, contract.commencement_date)) * 12
             + extract(month from age(contract.expiry_date, contract.commencement_date)), 0
           ), 2)
        else null end
    )) order by coalesce(space.display_order, row_item.ordinality), row_item.ordinality
  ), '[]'::jsonb) into enriched_rows
  from jsonb_array_elements(coalesce(base_response #> '{data,rows}', '[]'::jsonb)) with ordinality row_item(value, ordinality)
  left join logistics_core.spaces space on space.space_key = row_item.value->>'space_key' and space.deleted_at is null
  left join logistics_core.contract_spaces allocation on allocation.contract_space_key = row_item.value->>'contract_space_key' and allocation.deleted_at is null
  left join logistics_core.lease_contracts contract on contract.id = allocation.contract_id and contract.deleted_at is null
  left join logistics_core.tenants tenant on tenant.id = contract.tenant_id and tenant.deleted_at is null
  left join logistics_core.rent_terms term on term.rent_term_key = row_item.value->>'rent_term_key' and term.deleted_at is null;
  return jsonb_set(base_response, '{data,rows}', enriched_rows, true);
end;
$body$;

create or replace function logistics_core.rent_roll_batch_save_entry(
  p_request_id uuid,
  p_asset_key text,
  p_payload jsonb,
  p_expected_revisions jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, logistics_core, public, extensions
as $body$
declare
  actor_id uuid := logistics_core.request_actor();
  resolved_asset_id uuid := logistics_core.resolve_asset_id(p_asset_key);
  transformed_payload jsonb := p_payload;
  row_record jsonb;
  row_index integer := 0;
  tenant_id uuid;
  tenant_key text;
  term_revision bigint;
  base_response jsonb;
  finance_rows integer;
begin
  if jsonb_typeof(p_payload->'rows') = 'array' then
    for row_record in select value from jsonb_array_elements(p_payload->'rows') loop
      if coalesce(row_record->>'operation', 'update') <> 'delete'
         and coalesce(nullif(row_record->>'occupancy_status', ''), 'occupied') <> 'vacant' then
        if nullif(btrim(row_record->>'tenant_name'), '') is null then
          raise exception using errcode = 'PT422', message = 'TENANT_NAME_REQUIRED';
        end if;
        tenant_key := nullif(row_record->>'tenant_key', '');
        select tenant.id, tenant.tenant_key into tenant_id, tenant_key
        from logistics_core.tenants tenant
        where tenant.deleted_at is null and (
          (tenant_key is not null and tenant.tenant_key = tenant_key) or
          (lower(btrim(tenant.legal_name_ko)) = lower(btrim(row_record->>'tenant_name'))
           and coalesce(tenant.business_registration_number, '') = coalesce(row_record->>'business_registration_number', ''))
        ) order by (tenant.tenant_key = tenant_key) desc limit 1 for update;
        if tenant_id is null then
          tenant_key := 'tenant-manual-' || substr(encode(digest(
            lower(btrim(row_record->>'tenant_name')) || '|' || coalesce(row_record->>'business_registration_number', '') || '|' || gen_random_uuid()::text,
            'sha256'), 'hex'), 1, 32);
          insert into logistics_core.tenants (
            tenant_key, tenant_code, legal_name_ko, business_registration_number, created_by, updated_by
          ) values (
            tenant_key, tenant_key, btrim(row_record->>'tenant_name'), nullif(btrim(row_record->>'business_registration_number'), ''), actor_id, actor_id
          ) returning id into tenant_id;
        else
          update logistics_core.tenants tenant set
            legal_name_ko = btrim(row_record->>'tenant_name'),
            business_registration_number = nullif(btrim(row_record->>'business_registration_number'), ''),
            updated_by = actor_id
          where tenant.id = tenant_id;
        end if;
        insert into public.ll_tenants (
          tenant_id, tenant_master_name, raw_tenant_name, business_registration_no,
          review_status, review_note, source_payload, updated_at
        ) values (
          tenant_key, btrim(row_record->>'tenant_name'), btrim(row_record->>'tenant_name'),
          nullif(btrim(row_record->>'business_registration_number'), ''), 'confirmed',
          'data-platform direct input', jsonb_build_object('client_request_id', p_request_id), now()
        ) on conflict (tenant_id) do update set
          tenant_master_name = excluded.tenant_master_name,
          raw_tenant_name = excluded.raw_tenant_name,
          business_registration_no = excluded.business_registration_no,
          source_payload = coalesce(ll_tenants.source_payload, '{}'::jsonb) || excluded.source_payload,
          updated_at = now();
        row_record := jsonb_set(row_record, '{tenant_key}', to_jsonb(tenant_key), true);
      end if;
      row_record := jsonb_set(row_record, '{deposit_escalation_rule}', jsonb_strip_nulls(jsonb_build_object(
        'first_date', nullif(row_record->>'deposit_escalation_first_date', ''),
        'interval_months', nullif(row_record->>'deposit_escalation_interval_months', ''),
        'rate', nullif(row_record->>'deposit_escalation_rate', '')
      )), true);
      row_record := jsonb_set(row_record, '{rent_escalation_rule}', jsonb_strip_nulls(jsonb_build_object(
        'first_date', nullif(row_record->>'rent_escalation_first_date', ''),
        'interval_months', nullif(row_record->>'rent_escalation_interval_months', ''),
        'rate', nullif(row_record->>'rent_escalation_rate', '')
      )), true);
      row_record := jsonb_set(row_record, '{cam_escalation_rule}', jsonb_strip_nulls(jsonb_build_object(
        'first_date', nullif(row_record->>'cam_escalation_first_date', ''),
        'interval_months', nullif(row_record->>'cam_escalation_interval_months', ''),
        'rate', nullif(row_record->>'cam_escalation_rate', '')
      )), true);
      transformed_payload := jsonb_set(transformed_payload, array['rows', row_index::text], row_record, true);
      row_index := row_index + 1;
    end loop;
  end if;

  base_response := logistics_core.rent_roll_batch_save_entry_v3(
    p_request_id, p_asset_key, transformed_payload, p_expected_revisions
  );

  if jsonb_typeof(transformed_payload->'rows') = 'array' then
    for row_record in select value from jsonb_array_elements(transformed_payload->'rows') loop
      if coalesce(row_record->>'operation', 'update') <> 'delete' then
        update logistics_core.spaces space set
          temperature_type = nullif(row_record->>'temperature_type', ''),
          goods_type = nullif(row_record->>'goods_type', ''),
          subtenant_name = nullif(row_record->>'subtenant_name', ''),
          free_area_type = nullif(row_record->>'free_area_type', ''),
          updated_by = actor_id
        where space.asset_id = resolved_asset_id
          and space.space_key = coalesce(row_record->>'space_key', row_record->>'row_key');

        update logistics_core.lease_contracts contract set
          signed_date = nullif(row_record->>'signed_date', '')::date,
          construction_start_date = nullif(row_record->>'construction_start_date', '')::date,
          completion_date = nullif(row_record->>'completion_date', '')::date,
          security_type = nullif(row_record->>'security_type', ''),
          security_ratio = nullif(row_record->>'security_ratio', '')::numeric,
          updated_by = actor_id
        where contract.contract_key = row_record->>'contract_key' and contract.asset_id = resolved_asset_id;

        update logistics_core.rent_terms term set
          rent_calculation_method = nullif(row_record->>'rent_calculation_method', ''),
          rent_free_start_date = nullif(row_record->>'rent_free_start_date', '')::date,
          rent_free_end_date = nullif(row_record->>'rent_free_end_date', '')::date,
          pallet_rack_fee_per_py = nullif(row_record->>'pallet_rack_fee_per_py', '')::numeric,
          deposit_escalation_first_date = nullif(row_record->>'deposit_escalation_first_date', '')::date,
          deposit_escalation_interval_months = nullif(row_record->>'deposit_escalation_interval_months', '')::integer,
          deposit_escalation_rate = nullif(row_record->>'deposit_escalation_rate', ''),
          rent_escalation_first_date = nullif(row_record->>'rent_escalation_first_date', '')::date,
          rent_escalation_interval_months = nullif(row_record->>'rent_escalation_interval_months', '')::integer,
          rent_escalation_rate = nullif(row_record->>'rent_escalation_rate', ''),
          cam_escalation_first_date = nullif(row_record->>'cam_escalation_first_date', '')::date,
          cam_escalation_interval_months = nullif(row_record->>'cam_escalation_interval_months', '')::integer,
          cam_escalation_rate = nullif(row_record->>'cam_escalation_rate', ''),
          e_noc = case
            when nullif(row_record->>'leased_area_sqm', '')::numeric > 0
             and nullif(row_record->>'monthly_rent_total_krw', '') is not null
             and nullif(row_record->>'monthly_cam_total_krw', '') is not null
            then round((nullif(row_record->>'monthly_rent_total_krw', '')::numeric
              + nullif(row_record->>'monthly_cam_total_krw', '')::numeric)
              / (nullif(row_record->>'leased_area_sqm', '')::numeric * 0.3025), 2)
            else null end,
          updated_by = actor_id
        where term.rent_term_key = row_record->>'rent_term_key'
        returning term.revision into term_revision;

        update public.ll_lease_spaces legacy set
          current_monthly_cost_total = nullif(row_record->>'monthly_rent_total_krw', '')::numeric
            + nullif(row_record->>'monthly_cam_total_krw', '')::numeric,
          e_noc = case
            when nullif(row_record->>'leased_area_sqm', '')::numeric > 0
             and nullif(row_record->>'monthly_rent_total_krw', '') is not null
             and nullif(row_record->>'monthly_cam_total_krw', '') is not null
            then round((nullif(row_record->>'monthly_rent_total_krw', '')::numeric
              + nullif(row_record->>'monthly_cam_total_krw', '')::numeric)
              / (nullif(row_record->>'leased_area_sqm', '')::numeric * 0.3025), 2)
            else null end,
          updated_at = now()
        where legacy.lease_space_id = coalesce(row_record->>'space_key', row_record->>'row_key');
      end if;
    end loop;
  end if;

  finance_rows := logistics_core.sync_rent_roll_finance(resolved_asset_id, actor_id);
  base_response := jsonb_set(base_response, '{data,finance_projection_count}', to_jsonb(finance_rows), true);
  return base_response;
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
  actor_id uuid := logistics_core.request_actor();
  resolved_asset_id uuid := logistics_core.resolve_asset_id(p_asset_key);
  request_digest text := logistics_core.request_hash('v2/finance/batch-save', p_asset_key, p_payload, p_expected_revisions);
  cached_response jsonb;
  operation jsonb;
  operation_name text;
  entry_key text;
  account_code text;
  account_id uuid;
  account_kind text;
  entity_id uuid;
  current_revision bigint;
  expected_revision bigint;
  before_row jsonb;
  after_row jsonb;
  changed_count integer := 0;
  final_revision bigint := 0;
  response jsonb;
begin
  perform logistics_core.assert_v2_writer_route(resolved_asset_id);
  cached_response := logistics_core.claim_idempotency(actor_id, 'v2/finance/batch-save', p_request_id, request_digest);
  if cached_response is not null then return cached_response; end if;
  if jsonb_typeof(p_payload->'operations') <> 'array' then
    raise exception using errcode = 'PT422', message = 'OPERATIONS_ARRAY_REQUIRED';
  end if;
  if jsonb_array_length(p_payload->'operations') > 1000 then
    raise exception using errcode = 'PT422', message = 'BATCH_LIMIT_EXCEEDED';
  end if;

  for operation in select value from jsonb_array_elements(p_payload->'operations') loop
    operation_name := nullif(operation->>'operation', '');
    entry_key := nullif(operation->>'entry_key', '');
    if operation_name not in ('create', 'update', 'delete') or entry_key is null then
      raise exception using errcode = 'PT422', message = 'INVALID_FINANCE_OPERATION';
    end if;
    perform logistics_core.assert_asset_permission(actor_id, resolved_asset_id, operation_name);
    before_row := null;

    if operation_name in ('create', 'update') then
      account_code := nullif(operation->'record'->>'account_code', '');
      select account.id, account.account_kind into account_id, account_kind
      from logistics_core.cashflow_accounts account
      where account.account_code = account_code and account.deleted_at is null;
      if account_id is null then raise exception using errcode = 'PT422', message = 'FINANCE_ACCOUNT_NOT_FOUND'; end if;
      if account_kind <> 'atomic' then raise exception using errcode = 'PT422', message = 'FINANCE_DERIVED_ACCOUNT_FORBIDDEN'; end if;
      if nullif(operation->'record'->>'scenario', '') not in ('actual', 'budget', 'forecast') then
        raise exception using errcode = 'PT422', message = 'INVALID_FINANCE_SCENARIO';
      end if;
      if nullif(operation->'record'->>'accounting_basis', '') not in ('accrual', 'cash') then
        raise exception using errcode = 'PT422', message = 'INVALID_ACCOUNTING_BASIS';
      end if;
      if nullif(operation->'record'->>'amount', '') is null
         or operation->'record'->>'amount' !~ '^[+-]?([0-9]+([.][0-9]*)?|[.][0-9]+)$' then
        raise exception using errcode = 'PT422', message = 'FINITE_NUMERIC_AMOUNT_REQUIRED';
      end if;
    end if;

    if operation_name = 'create' then
      insert into logistics_core.monthly_ledger_entries (
        entry_key, asset_id, month, account_id, scenario, accounting_basis, amount,
        currency_code, source_kind, source_ref, source_line_key, data_status, created_by, updated_by
      ) values (
        entry_key, resolved_asset_id, logistics_core.normalize_month(operation->'record'->>'month'),
        account_id, operation->'record'->>'scenario', operation->'record'->>'accounting_basis',
        (operation->'record'->>'amount')::numeric,
        coalesce(nullif(operation->'record'->>'currency_code', ''), 'KRW'),
        'manual_input', 'v2/finance/batch-save:' || p_request_id::text,
        entry_key, 'provided', actor_id, actor_id
      ) returning id, revision into entity_id, current_revision;
    else
      select entry.id, entry.revision, to_jsonb(entry)
      into entity_id, current_revision, before_row
      from logistics_core.monthly_ledger_entries entry
      where entry.entry_key = entry_key and entry.asset_id = resolved_asset_id for update;
      if entity_id is null then raise exception using errcode = 'PT404', message = 'NOT_FOUND'; end if;
      expected_revision := coalesce(nullif(operation->>'expected_revision', '')::bigint, nullif(p_expected_revisions->>entry_key, '')::bigint);
      if expected_revision is null or expected_revision <> current_revision then
        raise exception using errcode = 'PT409', message = 'REVISION_CONFLICT';
      end if;
      if before_row->>'source_kind' <> 'manual_input' then
        raise exception using errcode = 'PT422', message = 'FINANCE_DERIVED_ACCOUNT_FORBIDDEN';
      end if;
      if operation_name = 'delete' then
        update logistics_core.monthly_ledger_entries set deleted_at = now(), deleted_by = actor_id, updated_by = actor_id
        where id = entity_id returning revision into current_revision;
      else
        update logistics_core.monthly_ledger_entries set
          month = logistics_core.normalize_month(operation->'record'->>'month'),
          account_id = account_id,
          scenario = operation->'record'->>'scenario',
          accounting_basis = operation->'record'->>'accounting_basis',
          amount = (operation->'record'->>'amount')::numeric,
          source_ref = 'v2/finance/batch-save:' || p_request_id::text,
          deleted_at = null, deleted_by = null, updated_by = actor_id
        where id = entity_id returning revision into current_revision;
      end if;
    end if;

    select to_jsonb(entry) into after_row from logistics_core.monthly_ledger_entries entry where entry.id = entity_id;
    if after_row is null then raise exception using errcode = 'PT500', message = 'READBACK_MISMATCH'; end if;
    insert into logistics_core.audit_events (
      actor_user_id, action, entity_type, entity_id, asset_id, entity_revision,
      before_hash, after_hash, change_payload, reason, client_request_id, mapping_version, correlation_id
    ) values (
      actor_id, operation_name, 'monthly_ledger_entry', entity_id, resolved_asset_id, current_revision,
      case when before_row is null then null else logistics_core.json_sha256(before_row) end,
      logistics_core.json_sha256(after_row),
      jsonb_build_object('entry_key', entry_key, 'account_code', account_code),
      coalesce(nullif(operation->>'reason', ''), 'NOI 손익표 직접 수정'),
      p_request_id, 'gate6-data-platform-3', p_request_id
    );
    changed_count := changed_count + 1;
    final_revision := greatest(final_revision, current_revision);
  end loop;

  response := logistics_core.primary_response(p_request_id, final_revision,
    jsonb_build_object('changed_count', changed_count, 'readback', 'verified', 'derived_subtotals_stored', false));
  perform logistics_core.complete_idempotency(actor_id, 'v2/finance/batch-save', p_request_id, response);
  return response;
end;
$body$;

revoke all on function logistics_core.home_read_entry_v3(uuid, text, jsonb, jsonb) from public, anon, authenticated;
revoke all on function logistics_core.rent_roll_read_entry_v3(uuid, text, jsonb, jsonb) from public, anon, authenticated;
revoke all on function logistics_core.rent_roll_batch_save_entry_v3(uuid, text, jsonb, jsonb) from public, anon, authenticated;
revoke all on function logistics_core.finance_batch_save_entry_v1(uuid, text, jsonb, jsonb) from public, anon, authenticated;
revoke all on function logistics_core.home_read_entry(uuid, text, jsonb, jsonb) from public, anon, authenticated;
revoke all on function logistics_core.home_batch_save_entry(uuid, text, jsonb, jsonb) from public, anon, authenticated;
revoke all on function logistics_core.rent_roll_read_entry(uuid, text, jsonb, jsonb) from public, anon, authenticated;
revoke all on function logistics_core.rent_roll_batch_save_entry(uuid, text, jsonb, jsonb) from public, anon, authenticated;
revoke all on function logistics_core.finance_batch_save_entry(uuid, text, jsonb, jsonb) from public, anon, authenticated;

create or replace function logistics_api.home_batch_save(
  p_request_id uuid,
  p_asset_key text,
  p_payload jsonb,
  p_expected_revisions jsonb
)
returns jsonb
language sql
security definer
set search_path = ''
as $function$
  select logistics_core.home_batch_save_entry(p_request_id, p_asset_key, p_payload, p_expected_revisions);
$function$;

revoke all on function logistics_api.home_batch_save(uuid, text, jsonb, jsonb) from public, anon;
grant execute on function logistics_api.home_batch_save(uuid, text, jsonb, jsonb) to authenticated;
grant execute on function logistics_api.rent_roll_batch_save(uuid, text, jsonb, jsonb) to authenticated;
grant execute on function logistics_api.finance_batch_save(uuid, text, jsonb, jsonb) to authenticated;

notify pgrst, 'reload schema';

commit;
