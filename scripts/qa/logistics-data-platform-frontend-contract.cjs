const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const routes = read('src/components/system/workspace/logisticsRoutes.js');
const workspace = read('src/components/system/workspace/WorkspaceLogistics.jsx');
const feature = read('src/features/logistics-data-platform/LogisticsDataPlatform.jsx');
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
assert.match(feature, /not_provided/iu);
assert.match(feature, /FORMULA_NOT_APPROVED/iu);
assert.match(feature, /v2\/calculations\/explain/iu);

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
