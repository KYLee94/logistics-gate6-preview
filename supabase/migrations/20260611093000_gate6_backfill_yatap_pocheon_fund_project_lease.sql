-- Backfill missing fund/project links for the two newly added assets and record
-- Bundang Yatap as fully occupied by Coupang. Uses existing ll_* tables only.

insert into public.ll_funds (
  fund_id,
  fund_code,
  fund_name,
  short_name,
  legal_form,
  investment_sector,
  fund_type,
  investment_strategy,
  initial_setup_date,
  maturity_date,
  source_type,
  source_name,
  source_sheet_name,
  source_row_number,
  source_payload,
  updated_at
)
values
  (
    'fund_190002',
    '190002',
    '이지스부동산일반사모투자회사제543호',
    '543호',
    '투자회사',
    '물류',
    '실물형',
    'Core+',
    date '2024-05-24',
    date '2027-08-25',
    'xlsx',
    '260520_물류센터 펀드 정보.xlsx',
    '펀드 정보',
    20,
    '{"source_row_number":20,"values":{"자산코드":"A190002001","자산명":"분당야탑물류센터","펀드코드":"190002","펀드명":"이지스부동산일반사모투자회사제543호","약칭":"543호","법적형태":"투자회사","투자섹터":"물류","펀드유형":"실물형","투자전략":"Core+","최초설정일":"2024-05-24","만기일":"2027-08-25"}}'::jsonb,
    now()
  ),
  (
    'fund_190013',
    '190013',
    '이지스제560호부동산일반사모투자회사',
    '560호',
    '투자회사',
    '물류',
    '개발(펀드)형',
    'Opportunistic',
    date '2025-02-27',
    date '2030-02-07',
    'xlsx',
    '260520_물류센터 펀드 정보.xlsx',
    '펀드 정보',
    21,
    '{"source_row_number":21,"values":{"자산코드":"A190013001","자산명":"포천정교리물류센터","펀드코드":"190013","펀드명":"이지스제560호부동산일반사모투자회사","약칭":"560호","법적형태":"투자회사","투자섹터":"물류","펀드유형":"개발(펀드)형","투자전략":"Opportunistic","최초설정일":"2025-02-27","만기일":"2030-02-07"}}'::jsonb,
    now()
  )
on conflict (fund_id) do update
set fund_code = excluded.fund_code,
    fund_name = excluded.fund_name,
    short_name = excluded.short_name,
    legal_form = excluded.legal_form,
    investment_sector = excluded.investment_sector,
    fund_type = excluded.fund_type,
    investment_strategy = excluded.investment_strategy,
    initial_setup_date = excluded.initial_setup_date,
    maturity_date = excluded.maturity_date,
    source_type = excluded.source_type,
    source_name = excluded.source_name,
    source_sheet_name = excluded.source_sheet_name,
    source_row_number = excluded.source_row_number,
    source_payload = excluded.source_payload,
    updated_at = now();

with target_links as (
  select
    v.fund_id,
    a.asset_id,
    v.asset_code,
    v.asset_name,
    v.source_row_number,
    v.source_payload
  from (
    values
      ('fund_190002', 'A190002001', '분당야탑물류센터', 20, '{"source_row_number":20,"values":{"자산코드":"A190002001","자산명":"분당야탑물류센터","펀드코드":"190002","펀드명":"이지스부동산일반사모투자회사제543호"}}'::jsonb),
      ('fund_190013', 'A190013001', '포천정교리물류센터', 21, '{"source_row_number":21,"values":{"자산코드":"A190013001","자산명":"포천정교리물류센터","펀드코드":"190013","펀드명":"이지스제560호부동산일반사모투자회사"}}'::jsonb)
  ) as v(fund_id, asset_code, asset_name, source_row_number, source_payload)
  join public.ll_assets a
    on lower(coalesce(a.asset_code, '')) = lower(v.asset_code)
    or replace(lower(coalesce(a.asset_name, '')), ' ', '') = replace(lower(v.asset_name), ' ', '')
)
insert into public.ll_fund_asset_links (
  fund_id,
  asset_id,
  asset_code,
  asset_name,
  link_type,
  source_type,
  source_name,
  source_sheet_name,
  source_row_number,
  source_payload,
  updated_at
)
select
  fund_id,
  asset_id,
  asset_code,
  asset_name,
  'primary',
  'xlsx',
  '260520_물류센터 펀드 정보.xlsx',
  '펀드 정보',
  source_row_number,
  source_payload,
  now()
from target_links
on conflict (asset_id, fund_id) do update
set asset_code = excluded.asset_code,
    asset_name = excluded.asset_name,
    link_type = excluded.link_type,
    source_type = excluded.source_type,
    source_name = excluded.source_name,
    source_sheet_name = excluded.source_sheet_name,
    source_row_number = excluded.source_row_number,
    source_payload = excluded.source_payload,
    updated_at = now();

with primary_asset_funds as (
  select distinct on (l.asset_id)
    l.asset_id,
    f.fund_code,
    f.fund_name
  from public.ll_fund_asset_links l
  join public.ll_funds f on f.fund_id = l.fund_id
  where l.fund_id in ('fund_190002', 'fund_190013')
  order by l.asset_id, case when l.link_type = 'primary' then 0 else 1 end, l.updated_at desc nulls last
)
update public.ll_assets a
set fund_code = p.fund_code,
    fund_name = p.fund_name,
    updated_at = now()
from primary_asset_funds p
where a.asset_id = p.asset_id;

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
values
  ('fund_190002', 'beneficiary', 'xlsx-260520-beneficiary-55', '', '쿠팡', 99574318540, 55, true, 'xlsx', '260520_물류센터 펀드 정보.xlsx', '수익자 정보', 55, '{"source_row_number":55,"values":{"자산코드":"A190002001","자산명":"분당야탑물류센터","수익자":"쿠팡","투입금액(원)":"99574318540"}}'::jsonb, now(), now()),
  ('fund_190002', 'beneficiary', 'xlsx-260520-beneficiary-56', '', '쿠팡로지스틱스', 500373460, 56, true, 'xlsx', '260520_물류센터 펀드 정보.xlsx', '수익자 정보', 56, '{"source_row_number":56,"values":{"자산코드":"A190002001","자산명":"분당야탑물류센터","수익자":"쿠팡로지스틱스","투입금액(원)":"500373460"}}'::jsonb, now(), now()),
  ('fund_190013', 'beneficiary', 'xlsx-260520-beneficiary-57', '', '비공개(쿠팡 계열)', 33847096725, 57, true, 'xlsx', '260520_물류센터 펀드 정보.xlsx', '수익자 정보', 57, '{"source_row_number":57,"values":{"자산코드":"A190013001","자산명":"포천정교리물류센터","수익자":"비공개(쿠팡 계열)","투입금액(원)":"33847096725"}}'::jsonb, now(), now()),
  ('fund_190013', 'beneficiary', 'xlsx-260520-beneficiary-58', '', '비공개(쿠팡 계열)', 867874275, 58, true, 'xlsx', '260520_물류센터 펀드 정보.xlsx', '수익자 정보', 58, '{"source_row_number":58,"values":{"자산코드":"A190013001","자산명":"포천정교리물류센터","수익자":"비공개(쿠팡 계열)","투입금액(원)":"867874275"}}'::jsonb, now(), now())
on conflict (fund_id, tranche_type, row_key) do update
set tranche = excluded.tranche,
    party_name = excluded.party_name,
    committed_amount_krw = excluded.committed_amount_krw,
    display_order = excluded.display_order,
    is_active = excluded.is_active,
    source_payload = excluded.source_payload,
    updated_at = now();

insert into public.ll_fund_capital_tranches (
  fund_id,
  tranche_type,
  row_key,
  loan_type,
  tranche,
  party_name,
  committed_amount_krw,
  drawdown_date,
  maturity_date,
  interest_type,
  loan_rate,
  interest_rate,
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
values
  ('fund_190002', 'loan', 'xlsx-260520-loan-54', '담보', 'Tr. A', '농협은행', 24400000000, date '2024-08-02', date '2027-08-02', '고정금리', '4.9', '4.9', 54, true, 'xlsx', '260520_물류센터 펀드 정보.xlsx', '대주 정보', 54, '{"source_row_number":54,"values":{"자산코드":"A190002001","자산명":"분당야탑물류센터","대출유형":"담보","Tranche":"Tr. A","대주":"농협은행","인출금액(원)":"24400000000","인출시점":"2024-08-02","만기시점":"2027-08-02","이자유형":"고정금리","대출금리(%)":"4.9"}}'::jsonb, now(), now()),
  ('fund_190002', 'loan', 'xlsx-260520-loan-55', '담보', 'Tr. A', '중소기업은행', 54000000000, date '2024-08-02', date '2027-08-02', '고정금리', '4.9', '4.9', 55, true, 'xlsx', '260520_물류센터 펀드 정보.xlsx', '대주 정보', 55, '{"source_row_number":55,"values":{"자산코드":"A190002001","자산명":"분당야탑물류센터","대출유형":"담보","Tranche":"Tr. A","대주":"중소기업은행","인출금액(원)":"54000000000","인출시점":"2024-08-02","만기시점":"2027-08-02","이자유형":"고정금리","대출금리(%)":"4.9"}}'::jsonb, now(), now()),
  ('fund_190002', 'loan', 'xlsx-260520-loan-56', '담보', 'Tr. A', '케이디비산업은행', 54000000000, date '2024-08-02', date '2027-08-02', '고정금리', '4.9', '4.9', 56, true, 'xlsx', '260520_물류센터 펀드 정보.xlsx', '대주 정보', 56, '{"source_row_number":56,"values":{"자산코드":"A190002001","자산명":"분당야탑물류센터","대출유형":"담보","Tranche":"Tr. A","대주":"케이디비산업은행","인출금액(원)":"54000000000","인출시점":"2024-08-02","만기시점":"2027-08-02","이자유형":"고정금리","대출금리(%)":"4.9"}}'::jsonb, now(), now()),
  ('fund_190002', 'loan', 'xlsx-260520-loan-57', '담보', 'Tr. A', '하나은행', 30000000000, date '2024-08-02', date '2027-08-02', '고정금리', '4.9', '4.9', 57, true, 'xlsx', '260520_물류센터 펀드 정보.xlsx', '대주 정보', 57, '{"source_row_number":57,"values":{"자산코드":"A190002001","자산명":"분당야탑물류센터","대출유형":"담보","Tranche":"Tr. A","대주":"하나은행","인출금액(원)":"30000000000","인출시점":"2024-08-02","만기시점":"2027-08-02","이자유형":"고정금리","대출금리(%)":"4.9"}}'::jsonb, now(), now())
on conflict (fund_id, tranche_type, row_key) do update
set loan_type = excluded.loan_type,
    tranche = excluded.tranche,
    party_name = excluded.party_name,
    committed_amount_krw = excluded.committed_amount_krw,
    drawdown_date = excluded.drawdown_date,
    maturity_date = excluded.maturity_date,
    interest_type = excluded.interest_type,
    loan_rate = excluded.loan_rate,
    interest_rate = excluded.interest_rate,
    display_order = excluded.display_order,
    is_active = excluded.is_active,
    source_payload = excluded.source_payload,
    updated_at = now();

insert into public.ll_tenants (
  tenant_id,
  tenant_master_name,
  raw_tenant_name,
  business_registration_no,
  review_status,
  review_note,
  source_payload,
  updated_at
)
values (
  'tenant_brn_1208800767',
  '쿠팡(주)',
  '쿠팡(주)',
  '120-88-00767',
  'backfilled_from_user_confirmation',
  '분당야탑물류센터 전체 면적 쿠팡 사용 확인',
  '{"source":"user_confirmation_2026-06-11","asset_code":"A190002001"}'::jsonb,
  now()
)
on conflict (tenant_id) do update
set tenant_master_name = coalesce(nullif(public.ll_tenants.tenant_master_name, ''), excluded.tenant_master_name),
    raw_tenant_name = coalesce(nullif(public.ll_tenants.raw_tenant_name, ''), excluded.raw_tenant_name),
    business_registration_no = coalesce(nullif(public.ll_tenants.business_registration_no, ''), excluded.business_registration_no),
    updated_at = now();

with yatap_asset as (
  select asset_id, asset_code, asset_name, gross_floor_area_sqm
  from public.ll_assets
  where lower(coalesce(asset_code, '')) = lower('A190002001')
     or replace(lower(coalesce(asset_name, '')), ' ', '') = replace(lower('분당야탑물류센터'), ' ', '')
  limit 1
),
upsert_lease as (
  insert into public.ll_leases (
    lease_id,
    asset_id,
    tenant_id,
    lease_status,
    current_start_date,
    current_end_date,
    source_payload,
    review_status,
    review_note,
    updated_at
  )
  select
    'lease|asset_a190002001|tenant_brn_1208800767|full-area',
    asset_id,
    'tenant_brn_1208800767',
    'active',
    date '2024-08-02',
    date '2027-08-02',
    '{"source":"user_confirmation_2026-06-11","note":"분당야탑물류센터 전체 면적 쿠팡 사용"}'::jsonb,
    'backfilled_from_user_confirmation',
    '분당야탑물류센터 전체 면적 쿠팡 사용 확인',
    now()
  from yatap_asset
  on conflict (lease_id) do update
  set asset_id = excluded.asset_id,
      tenant_id = excluded.tenant_id,
      lease_status = excluded.lease_status,
      current_start_date = excluded.current_start_date,
      current_end_date = excluded.current_end_date,
      source_payload = excluded.source_payload,
      review_status = excluded.review_status,
      review_note = excluded.review_note,
      updated_at = now()
  returning lease_id, asset_id, tenant_id
)
insert into public.ll_lease_spaces (
  lease_space_id,
  lease_id,
  asset_id,
  tenant_id,
  floor_label,
  detail_area_label,
  temperature_type,
  goods_type,
  leased_area_sqm,
  exclusive_area_sqm,
  exclusive_ratio,
  current_monthly_rent_total,
  current_monthly_mf_total,
  current_monthly_cost_total,
  e_noc,
  contract_status,
  formula_version,
  source_payload,
  review_status,
  review_note,
  updated_at
)
select
  'space|asset_a190002001|tenant_brn_1208800767|full-area',
  l.lease_id,
  a.asset_id,
  l.tenant_id,
  '전체',
  '전체 면적',
  null,
  null,
  a.gross_floor_area_sqm,
  a.gross_floor_area_sqm,
  1,
  0,
  0,
  0,
  0,
  'active',
  'user_confirmation_2026_06_11',
  '{"source":"user_confirmation_2026-06-11","note":"분당야탑물류센터 전체 면적 쿠팡 사용. 월 임대료/관리비는 미제공이므로 0으로 보존."}'::jsonb,
  'backfilled_from_user_confirmation',
  '분당야탑물류센터 전체 면적 쿠팡 사용 확인',
  now()
from upsert_lease l
join yatap_asset a on a.asset_id = l.asset_id
where coalesce(a.gross_floor_area_sqm, 0) > 0
on conflict (lease_space_id) do update
set lease_id = excluded.lease_id,
    asset_id = excluded.asset_id,
    tenant_id = excluded.tenant_id,
    floor_label = excluded.floor_label,
    detail_area_label = excluded.detail_area_label,
    leased_area_sqm = excluded.leased_area_sqm,
    exclusive_area_sqm = excluded.exclusive_area_sqm,
    exclusive_ratio = excluded.exclusive_ratio,
    current_monthly_rent_total = excluded.current_monthly_rent_total,
    current_monthly_mf_total = excluded.current_monthly_mf_total,
    current_monthly_cost_total = excluded.current_monthly_cost_total,
    e_noc = excluded.e_noc,
    contract_status = excluded.contract_status,
    source_payload = excluded.source_payload,
    review_status = excluded.review_status,
    review_note = excluded.review_note,
    updated_at = now();

insert into public.ll_rent_history (
  rent_history_id,
  lease_space_id,
  source_contract_lease_space_id,
  lease_id,
  asset_id,
  tenant_id,
  effective_date,
  change_reason,
  leased_area_sqm,
  exclusive_area_sqm,
  monthly_rent_total,
  monthly_mf_total,
  rent_per_py,
  mf_per_py,
  is_latest,
  floor_label,
  detail_area_label,
  source_payload,
  review_status,
  review_note,
  updated_at
)
select
  'rent|asset_a190002001|tenant_brn_1208800767|2024-08-02',
  'space|asset_a190002001|tenant_brn_1208800767|full-area',
  'space|asset_a190002001|tenant_brn_1208800767|full-area',
  'lease|asset_a190002001|tenant_brn_1208800767|full-area',
  a.asset_id,
  'tenant_brn_1208800767',
  date '2024-08-02',
  'user_confirmation_full_area_occupancy',
  a.gross_floor_area_sqm,
  a.gross_floor_area_sqm,
  0,
  0,
  0,
  0,
  true,
  '전체',
  '전체 면적',
  '{"source":"user_confirmation_2026-06-11","note":"분당야탑물류센터 전체 면적 쿠팡 사용. 금액 미제공."}'::jsonb,
  'backfilled_from_user_confirmation',
  '분당야탑물류센터 전체 면적 쿠팡 사용 확인',
  now()
from public.ll_assets a
where lower(coalesce(a.asset_code, '')) = lower('A190002001')
   or replace(lower(coalesce(a.asset_name, '')), ' ', '') = replace(lower('분당야탑물류센터'), ' ', '')
on conflict (rent_history_id) do update
set leased_area_sqm = excluded.leased_area_sqm,
    exclusive_area_sqm = excluded.exclusive_area_sqm,
    monthly_rent_total = excluded.monthly_rent_total,
    monthly_mf_total = excluded.monthly_mf_total,
    is_latest = true,
    source_payload = excluded.source_payload,
    review_status = excluded.review_status,
    review_note = excluded.review_note,
    updated_at = now();

with latest_report as (
  select id as report_id
  from public.ll_weekly_records
  where record_type = 'report'
  order by created_at desc
  limit 1
),
seed_rows as (
  select
    'project|asset_a190002001|investment-overview' as id,
    '분당야탑물류센터' as project_name,
    'A190002001' as asset_code,
    '분당야탑물류센터' as asset_name,
    '190002' as fund_code,
    '이지스부동산일반사모투자회사제543호' as fund_name,
    '{"assetName":"분당야탑물류센터","assetProjectRows":{"overviewRows":[["자산","섹터","물류"],["자산","주소","경기도 성남시 분당구 탄천로 257"],["면적","연면적","70,405.93㎡"],["운영","주요 임차인","쿠팡(주)"],["운영","공실률","0%"]],"investmentRows":[["투자","투자 전략","Core+"],["투자","펀드유형","실물형"],["투자","최초설정일","2024-05-24"],["만기","펀드만기","2027-08-25"],["자금","수익자 투입금액","100,074,692,000원"],["자금","대출금액","162,400,000,000원"]]}}'::jsonb as row_json
  union all
  select
    'project|asset_a190013001|investment-overview',
    '포천정교리물류센터',
    'A190013001',
    '포천정교리물류센터',
    '190013',
    '이지스제560호부동산일반사모투자회사',
    '{"assetName":"포천정교리물류센터","assetProjectRows":{"overviewRows":[["자산","섹터","물류"],["자산","주소","경기도 포천시 가산면 정교리 272-1"],["개발","상태","개발 중/자료 없음"]],"investmentRows":[["투자","투자 전략","Opportunistic"],["투자","펀드유형","개발(펀드)형"],["투자","최초설정일","2025-02-27"],["만기","펀드만기","2030-02-07"],["자금","수익자 투입금액","34,715,971,000원"],["기타","주요 이슈","쿠팡 M/L(예정) 및 출자"]]}}'::jsonb
)
insert into public.ll_weekly_records (
  record_type,
  report_id,
  project_type,
  project_name,
  asset_code,
  asset_name,
  fund_code,
  fund_name,
  row_json,
  status,
  issue,
  plan,
  updated_at
)
select
  'project',
  latest_report.report_id,
  'managementProjects',
  seed_rows.project_name,
  seed_rows.asset_code,
  seed_rows.asset_name,
  seed_rows.fund_code,
  seed_rows.fund_name,
  seed_rows.row_json,
  'active',
  case when seed_rows.asset_code = 'A190013001' then '쿠팡 M/L(예정) 및 출자' else '쿠팡 전체 면적 사용' end,
  '',
  now()
from latest_report
cross join seed_rows
where not exists (
  select 1
  from public.ll_weekly_records r
  where r.record_type = 'project'
    and r.report_id = latest_report.report_id
    and r.project_type = 'managementProjects'
    and replace(lower(coalesce(r.project_name, '')), ' ', '') = replace(lower(seed_rows.project_name), ' ', '')
);
