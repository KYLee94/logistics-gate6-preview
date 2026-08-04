const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const routes = read('src/components/system/workspace/logisticsRoutes.js');
const workspace = read('src/components/system/workspace/WorkspaceLogistics.jsx');
const feature = [
  read('src/features/logistics-data-platform/LogisticsDataPlatform.jsx'),
  read('src/features/logistics-data-platform/financeSchema.js'),
  read('src/features/logistics-data-platform/rentRollSchema.js'),
].join('\n');
const api = read('src/features/logistics-data-platform/api.js');
const formulas = read('src/features/logistics-data-platform/formulas.js');
const pagesFallback = read('scripts/build/write-github-pages-fallback.cjs');

for (const route of ['home', 'rent-roll', 'income-expense']) {
  assert.ok(
    routes.includes(`${route}: \`\${LOGISTICS_INTERNAL_BASE}/data-platform/${route}\``)
      || routes.includes(`'${route}': \`\${LOGISTICS_INTERNAL_BASE}/data-platform/${route}\``),
    `missing public route: ${route}`,
  );
  assert.ok(pagesFallback.includes(`'${route}'`), `missing GitHub Pages deep-link fallback: ${route}`);
}
assert.match(routes, /legacy-dashboard-home/);
assert.match(workspace, /LogisticsDataPlatform/);
assert.match(workspace, /WorkspaceLogisticsExisting/);

for (const action of [
  'v2/home/read',
  'v2/rent-roll/read',
  'v2/rent-roll/batch-save',
  'v2/finance/read',
  'v2/finance/batch-save',
  'v2/maturities/read',
  'v2/calculations/explain',
]) {
  assert.ok(api.includes(action), `missing API action: ${action}`);
}

assert.match(api, /status\s*!==\s*['\"]primary['\"]/);
assert.match(api, /AbortController/);
assert.match(api, /generation/);
assert.match(feature, /activeTab\s*===\s*['\"]home['\"]/);
assert.match(feature, /activeTab\s*===\s*['\"]rent-roll['\"]/);
assert.match(feature, /activeTab\s*===\s*['\"]income-expense['\"]/);
assert.match(feature, /다중 붙여넣기/);
assert.match(feature, /readback/i);
assert.match(feature, /sessionStorage/);
assert.doesNotMatch(feature, /(?:localStorage|sessionStorage)[\s\S]{0,120}scenario/iu);
assert.match(feature, /finance_write_enabled/iu);
assert.match(feature, /manual_input/iu);
assert.match(feature, /from_month:\s*startMonth/iu);
assert.match(feature, /to_month:\s*endMonth/iu);
assert.doesNotMatch(feature, /(?:^|\n)\s*start_month:\s*startMonth/iu);
assert.doesNotMatch(feature, /(?:^|\n)\s*end_month:\s*endMonth/iu);
assert.match(feature, /repayment_schedule\?\.status\s*\|\|\s*loan\.repayment_schedule_status/iu);
assert.doesNotMatch(feature, /<option value=["'](?:budget|forecast)["']/iu);
assert.match(feature, /not_provided/iu);
assert.match(feature, /FORMULA_NOT_APPROVED/iu);
assert.match(feature, /v2\/calculations\/explain/iu);
assert.match(feature, /in_app_maturity_alert/iu);
assert.doesNotMatch(feature, /resend|recipient_email|이메일 발송/iu);

for (const field of [
  'occupancy_status',
  'use_category',
  'floor_label',
  'exclusive_area_sqm',
  'common_area_sqm',
  'leased_area_sqm',
  'commencement_date',
  'expiry_date',
  'deposit_total_krw',
  'monthly_rent_total_krw',
  'monthly_cam_total_krw',
  'rent_free_schedule',
  'rent_escalation_rule',
  'tenant_cost_terms',
  'landlord_cost_terms',
  'renewal_terms',
  'termination_terms',
  'restoration_terms',
  'bond_terms',
  'operation_start_date',
  'pallet_rack_fee',
  'notes',
]) {
  assert.ok(feature.includes(field), `missing universal rent-roll field: ${field}`);
}
assert.match(feature, /공실/);
assert.match(feature, /핵심 열/);
assert.match(feature, /계약 조건/);
assert.match(feature, /비용·권리/);
assert.match(feature, /기존 대출 원장/);
assert.doesNotMatch(api, /`\$\{prefix\}-\$\{globalThis\.crypto\.randomUUID\(\)\}`/u);

for (const label of [
  '잠재총수입',
  '손실',
  '유효총수입',
  '운영비용',
  '순영업소득',
  '자산 순현금흐름',
  '부채상환 후 현금흐름',
]) {
  assert.ok(formulas.includes(label), `missing finance waterfall label: ${label}`);
}
assert.doesNotMatch(feature, /fallback|stale/i);

console.log('PASS logistics data platform frontend contract');
