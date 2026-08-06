const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { pathToFileURL } = require('node:url');

const ROOT = path.resolve(__dirname, '..');

async function importFresh(relativePath) {
  const target = path.join(ROOT, relativePath);
  return import(`${pathToFileURL(target).href}?test=${Date.now()}-${Math.random()}`);
}

test('렌트롤은 한 셀 한 값의 평면 컬럼과 직접 입력 임차인을 사용한다', async () => {
  const schema = await importFresh('src/features/logistics-data-platform/rentRollSchema.js');
  const columns = schema.RENT_ROLL_COLUMNS;
  const keys = columns.map((column) => column.key);
  const byKey = new Map(columns.map((column) => [column.key, column]));

  assert.equal(new Set(keys).size, keys.length, '렌트롤 컬럼 키가 중복되면 안 됩니다.');
  assert.equal(byKey.get('tenant_name')?.kind, 'text', '임차인명은 선택 목록이 아니라 직접 입력이어야 합니다.');
  assert.equal(columns.some((column) => ['area', 'moneyPair', 'period', 'summary', 'tenant'].includes(column.kind)), false);
  assert.equal(keys.includes('temperature_type'), true);
  assert.equal(keys.includes('goods_type'), true);
  assert.equal(keys.includes('subtenant_name'), true);
  assert.equal(keys.includes('free_area_type'), true);
  assert.equal(keys.includes('signed_date'), true);
  assert.equal(keys.includes('construction_start_date'), true);
  assert.equal(keys.includes('completion_date'), true);
  assert.equal(keys.includes('rent_escalation_rate'), true);
  assert.equal(keys.includes('rent_escalation_interval_months'), true);
  assert.equal(keys.includes('rent_escalation_first_date'), true);
  assert.equal(keys.includes('cam_escalation_rate'), true);
  assert.equal(keys.includes('current_total_cost_per_py_krw'), true);
});

test('E.NOC는 기존 Supabase 0.3025 공식과 결측 계약을 따른다', async () => {
  const schema = await importFresh('src/features/logistics-data-platform/rentRollSchema.js');
  assert.equal(schema.calculateRentRollENoc({
    leased_area_sqm: 1000,
    monthly_rent_total_krw: 10_000_000,
    monthly_cam_total_krw: 2_000_000,
  }), 39669.42);
  assert.equal(schema.calculateRentRollENoc({
    leased_area_sqm: 0,
    monthly_rent_total_krw: 10_000_000,
    monthly_cam_total_krw: 2_000_000,
  }), null);
  assert.equal(schema.calculateRentRollENoc({ leased_area_sqm: 1000 }), null);
});

test('한국 물류센터 NOI는 PGI, EGI, NOI, NCF, 부채상환 후 현금흐름을 분리한다', async () => {
  const formulas = await importFresh('src/features/logistics-data-platform/formulas.js');
  assert.equal(formulas.FINANCE_FORMULA_VERSION, 'gate6-korean-logistics-noi-v2');
  const result = formulas.calculateKoreanLogisticsNoi({
    potential_income: 1_000,
    income_loss: 100,
    operating_expense: 300,
    below_noi_cash_cost: 50,
    noncash_addback: 10,
    debt_service: 200,
  });
  assert.deepEqual(result, {
    potential_gross_income: 1_000,
    total_income_loss: 100,
    effective_gross_income: 900,
    total_operating_expense: 300,
    net_operating_income: 600,
    asset_net_cash_flow: 560,
    after_debt_service_cash_flow: 360,
  });
  assert.equal(formulas.KOREAN_LOGISTICS_NOI_ACCOUNTS.some((row) => row.code === 'DEPRECIATION'), false);
  assert.equal(formulas.KOREAN_LOGISTICS_NOI_ACCOUNTS.some((row) => row.code === 'PROPERTY_TAX_PUBLIC_DUES'), true);
  assert.equal(formulas.KOREAN_LOGISTICS_NOI_ACCOUNTS.some((row) => row.code === 'FM_FEE'), true);
});

test('data-platform UI는 자동저장 필드, 기존 표 스크롤, 내부 세로 스크롤 금지를 선언한다', () => {
  const source = fs.readFileSync(path.join(ROOT, 'src/features/logistics-data-platform/LogisticsDataPlatform.jsx'), 'utf8');
  assert.match(source, /data-autosave-field/u);
  assert.match(source, /data-save-state/u);
  assert.match(source, /custom-scrollbar/u);
  assert.match(source, /tenant_name[\s\S]{0,400}<input/iu);
  assert.doesNotMatch(source, /tenant_name[\s\S]{0,400}<select/iu);
  assert.doesNotMatch(source, /finance-statement-scroll[\s\S]{0,160}max-h/iu);
});

test('v2 API는 홈 저장을 공개 write action으로 라우팅한다', async () => {
  const contracts = await importFresh('supabase/functions/ll-dashboard-api/v2/contracts.ts');
  const router = await importFresh('supabase/functions/ll-dashboard-api/v2/router.ts');
  assert.equal(contracts.V2_PUBLIC_ACTIONS.includes('v2/home/batch-save'), true);
  assert.equal(router.rpcNameForAction('v2/home/batch-save'), 'home_batch_save');
  assert.throws(() => router.buildRpcArguments('v2/home/batch-save', {
    asset_key: 'asset', payload: { operations: [] },
  }), /CLIENT_REQUEST_ID_REQUIRED/u);
});

test('신규 DB 계약은 직접입력 임차인, eNOC readback, NOI 상세계정을 포함한다', () => {
  const migrationDir = path.join(ROOT, 'supabase/migrations');
  const migrationName = fs.readdirSync(migrationDir).find((name) => /editable.*noi.*rent|rent.*noi.*editable/iu.test(name));
  assert.ok(migrationName, '편집·NOI·렌트롤 migration이 필요합니다.');
  const sql = fs.readFileSync(path.join(migrationDir, migrationName), 'utf8');
  assert.match(sql, /create or replace function logistics_api\.home_batch_save/iu);
  assert.match(sql, /tenant_name/iu);
  assert.match(sql, /business_registration_number/iu);
  assert.match(sql, /0\.3025/iu);
  assert.match(sql, /current_monthly_cost_total/iu);
  assert.match(sql, /e_noc/iu);
  assert.match(sql, /PROPERTY_TAX_PUBLIC_DUES/iu);
  assert.match(sql, /RENT_FREE_CONCESSION_LOSS/iu);
  assert.match(sql, /FINANCE_DERIVED_ACCOUNT_FORBIDDEN/iu);
});
