const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const root = path.resolve(__dirname, '..', '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const routes = read('src/components/system/workspace/logisticsRoutes.js');
const workspace = read('src/components/system/workspace/WorkspaceLogistics.jsx');
const leftNav = read('src/components/system/IotaLeftNav.jsx');
const ui = read('src/features/logistics-data-platform/LogisticsDataPlatform.jsx');
const rentSchema = read('src/features/logistics-data-platform/rentRollSchema.js');
const financeSchema = read('src/features/logistics-data-platform/financeSchema.js');
const api = read('src/features/logistics-data-platform/api.js');
const formulas = read('src/features/logistics-data-platform/formulas.js');
const fallbacks = read('scripts/build/write-github-pages-fallback.cjs');

for (const route of ['data-platform', 'data-platform/home', 'data-platform/rent-roll', 'data-platform/income-expense']) {
  assert.ok(routes.includes(route), `missing route: ${route}`);
  assert.ok(fallbacks.includes(`'${route}'`), `missing Pages fallback: ${route}`);
}
assert.match(workspace, /LogisticsDataPlatform/u);
assert.match(leftNav, /data-platform-home-nav/u);
assert.match(leftNav, /data-platform-rent-roll-nav/u);
assert.match(leftNav, /data-platform-income-expense-nav/u);
assert.match(leftNav, /data-testid=["']data-platform-only-nav["']/u);

for (const action of [
  'v2/home/read', 'v2/home/batch-save', 'v2/rent-roll/read', 'v2/rent-roll/batch-save',
  'v2/finance/read', 'v2/finance/batch-save', 'v2/maturities/read', 'v2/calculations/explain',
]) assert.ok(api.includes(action), `missing action: ${action}`);
assert.match(api, /status\s*!==\s*['"]primary['"]/u);
assert.match(api, /AbortController/u);

for (const title of ['홈', '렌트롤', '수익·비용']) assert.ok(ui.includes(title));
assert.match(ui, /data-testid=["']data-platform-asset-select["']/u);
assert.match(ui, /data-testid=["']data-platform-maturity-button["']/u);
assert.doesNotMatch(ui, /Gate 6|물류센터 데이터 관리 플랫폼/u);
assert.doesNotMatch(ui, /data-platform-account-button|data-platform-sign-out/u);

for (const token of ['data-autosave-field', 'data-save-state', 'homeBatchSave', 'rentRollBatchSave', 'financeBatchSave']) {
  assert.ok(ui.includes(token), `missing automatic save contract: ${token}`);
}
for (const token of [
  'buildHomeDocumentPayload', 'buildRentRollDocumentPayload',
  'buildIncomeExpenseDocumentPayload', 'replaceFinanceCellValue', 'documentsEqual',
  'HOME_DOCUMENT_READBACK_MISMATCH', 'RENT_ROLL_DOCUMENT_READBACK_MISMATCH',
  'FINANCE_DOCUMENT_READBACK_MISMATCH', 'expected_xmin',
]) assert.ok(ui.includes(token), `missing canonical document save contract: ${token}`);
assert.match(ui, /sessionStorage/u);

for (const field of [
  'tenant_name', 'business_registration_number', 'temperature_type', 'goods_type', 'subtenant_name',
  'exclusive_area_sqm', 'common_area_sqm', 'leased_area_sqm', 'signed_date', 'commencement_date',
  'expiry_date', 'monthly_rent_total_krw',
  'monthly_cam_total_krw', 'rent_free_start_date', 'rent_free_end_date',
  'deposit_escalation_first_date', 'deposit_escalation_interval_months', 'deposit_escalation_rate',
  'rent_escalation_first_date', 'rent_escalation_interval_months', 'rent_escalation_rate',
  'cam_escalation_first_date', 'cam_escalation_interval_months', 'cam_escalation_rate',
  'current_total_cost_per_py_krw', 'tenant_cost_terms', 'landlord_cost_terms', 'renewal_terms',
]) assert.ok(rentSchema.includes(field), `missing rent-roll field: ${field}`);
for (const removed of ['use_category', 'construction_start_date', 'completion_date', 'rent_calculation_method']) {
  assert.equal(rentSchema.includes(`column('${removed}'`), false, `removed rent-roll field returned: ${removed}`);
}
assert.match(rentSchema, /kind:\s*'text'[\s\S]{0,80}tenant_name|tenant_name[\s\S]{0,80}'text'/u);
assert.match(rentSchema, /0\.3025/u);
assert.doesNotMatch(rentSchema, /kind:\s*['"](?:area|moneyPair|period|summary|tenant)['"]/u);
assert.match(ui, /data-testid=["']rent-roll-table["']/u);
assert.match(ui, /custom-scrollbar h-\[calc\(100vh-190px\)\] overflow-auto/u);
assert.match(ui, /tenant_name[\s\S]{0,500}<input/u);
assert.match(ui, /data-testid=["']rent-roll-drag-handle["']/u);
assert.match(ui, /data-sticky-column-header=/u);
assert.match(ui, /data-testid=["']rent-roll-drag-status["']/u);
assert.match(ui, /draggable=/u);

assert.match(ui, /data-testid=["']home-asset-brief["']/u);
assert.match(ui, /data-testid=["']home-lease-operations["']/u);
for (const label of ['대지면적', '연면적', '임대가능면적', '임대 운영', '약정액', '투입액', 'Coupon', 'All-in']) {
  assert.ok(ui.includes(label), `missing home field: ${label}`);
}
for (const code of ['POTENTIAL_BASE_RENT', 'RENT_FREE_CONCESSION_LOSS', 'FM_FEE', 'PROPERTY_TAX_PUBLIC_DUES', 'CAPEX', 'TENANT_IMPROVEMENT', 'LEASING_COMMISSION', 'INTEREST_PAID']) {
  assert.ok(formulas.includes(code), `missing NOI account: ${code}`);
}
for (const label of ['잠재총수입', '유효총수입', '순영업소득(NOI)', '자산 순현금흐름(NCF)', '부채상환 후 현금흐름']) {
  assert.ok(ui.includes(label) || formulas.includes(label), `missing NOI subtotal: ${label}`);
}
assert.match(ui, /finance-comparison-asset/u);
assert.doesNotMatch(ui, /data-testid=["']finance-aggregation["']/u);
assert.match(ui, /finance-trend/u);
assert.match(ui, /finance-statement-scroll[\s\S]{0,160}custom-scrollbar overflow-x-auto/u);
assert.doesNotMatch(ui, /finance-statement-scroll[\s\S]{0,160}max-h/u);
assert.match(financeSchema, /budget/u);
assert.match(financeSchema, /forecast/u);

for (const token of ['bg-[#1F1F1E]', 'bg-[#252524]', 'border-[#333333]', 'rounded-[20px]', 'text-[#A1A1AA]']) {
  assert.ok(ui.includes(token), `missing Gate 6 visual token: ${token}`);
}

async function verifyModules() {
  const rent = await import(`${pathToFileURL(path.join(root, 'src/features/logistics-data-platform/rentRollSchema.js')).href}?qa=${Date.now()}`);
  assert.ok(rent.RENT_ROLL_COLUMNS.length >= 50);
  assert.equal(rent.RENT_ROLL_COLUMNS.find((column) => column.key === 'tenant_name').kind, 'text');
  assert.equal(rent.calculateRentRollENoc({ leased_area_sqm: 1000, monthly_rent_total_krw: 10_000_000, monthly_cam_total_krw: 2_000_000 }), 39669.42);
  const documents = await import(`${pathToFileURL(path.join(root, 'src/features/logistics-data-platform/documentContract.js')).href}?qa=${Date.now()}`);
  const rentPayload = documents.buildRentRollDocumentPayload([{
    tenant_name: '임차인',
    leased_area_sqm: 100,
    row_key: 'legacy-row',
    source_kind: 'projection',
    effective_rent: 1,
  }]);
  assert.deepEqual(rentPayload, { rows: [{ tenant_name: '임차인', leased_area_sqm: 100 }] });
  const financePayload = documents.buildIncomeExpenseDocumentPayload({
    periods: ['2026-08'],
    potential_income: [{
      name: '임대료', selected: true, amounts: { '2026-08': 1 }, entry_key: 'legacy-entry',
    }],
  });
  assert.equal(JSON.stringify(financePayload).includes('entry_key'), false);
  assert.deepEqual(Object.keys(financePayload.statement), [
    'periods', 'potential_income', 'income_loss', 'operating_expense', 'below_noi', 'debt_service',
  ]);
}

verifyModules().then(() => console.log('PASS logistics data platform frontend contract')).catch((error) => { console.error(error); process.exitCode = 1; });
