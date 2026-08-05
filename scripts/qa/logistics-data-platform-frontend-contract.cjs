const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const root = path.resolve(__dirname, '..', '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const routes = read('src/components/system/workspace/logisticsRoutes.js');
const workspace = read('src/components/system/workspace/WorkspaceLogistics.jsx');
const platformCore = read('src/components/system/PlatformCore.jsx');
const leftNav = read('src/components/system/IotaLeftNav.jsx');
const platformFeature = read('src/features/logistics-data-platform/LogisticsDataPlatform.jsx');
const rentRollSchema = read('src/features/logistics-data-platform/rentRollSchema.js');
const financeSchema = read('src/features/logistics-data-platform/financeSchema.js');
const api = read('src/features/logistics-data-platform/api.js');
const formulas = read('src/features/logistics-data-platform/formulas.js');
const pagesFallback = read('scripts/build/write-github-pages-fallback.cjs');
const feature = [platformFeature, financeSchema, rentRollSchema].join('\n');

for (const route of ['data-platform', 'data-platform/home', 'data-platform/rent-roll', 'data-platform/income-expense']) {
  assert.ok(
    routes.includes(`${route}: LOGISTICS_DATA_PLATFORM_HOME`)
      || routes.includes(`'${route}': LOGISTICS_DATA_PLATFORM_HOME`)
      || routes.includes(`${route}: \`\${LOGISTICS_INTERNAL_BASE}/${route}\``)
      || routes.includes(`'${route}': \`\${LOGISTICS_INTERNAL_BASE}/${route}\``),
    `missing public route: ${route}`,
  );
  assert.ok(pagesFallback.includes(`'${route}'`), `missing GitHub Pages deep-link fallback: ${route}`);
}
assert.match(routes, /legacy-dashboard-home/);
assert.match(workspace, /LogisticsDataPlatform/);
assert.match(workspace, /WorkspaceLogisticsExisting/);
assert.doesNotMatch(platformCore, /isLogisticsDataPlatform/);
assert.match(platformCore, /<IotaLeftNav[\s\S]*currentPath=\{currentPath\}/);

for (const nav of [
  ['data-platform-home-nav', '홈', 'data-platform/home'],
  ['data-platform-rent-roll-nav', '렌트롤', 'data-platform/rent-roll'],
  ['data-platform-income-expense-nav', '수익·비용', 'data-platform/income-expense'],
]) {
  assert.ok(
    leftNav.includes(`data-testid="${nav[0]}"`) || leftNav.includes(`testId: '${nav[0]}'`),
    `missing left navigation test id: ${nav[0]}`,
  );
  assert.ok(leftNav.includes(nav[1]), `missing left navigation label: ${nav[1]}`);
  assert.ok(
    leftNav.includes(nav[2]) || (nav[2] === 'data-platform/home' && leftNav.includes('LOGISTICS_DATA_PLATFORM_HOME')),
    `missing left navigation path: ${nav[2]}`,
  );
}

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
assert.match(api, /status\s*!==\s*['"]primary['"]/);
assert.match(api, /AbortController/);
assert.match(api, /generation/);

assert.match(platformFeature, /DATA_PLATFORM_PAGE_TITLES/);
for (const title of ['홈', '렌트롤', '수익·비용']) assert.ok(platformFeature.includes(title));
assert.match(platformFeature, /data-testid=["']data-platform-asset-select["']/u);
assert.match(platformFeature, /data-testid=["']data-platform-maturity-button["']/u);
assert.doesNotMatch(platformFeature, /data-platform-account-button|data-platform-sign-out/u);
assert.doesNotMatch(platformFeature, /Gate 6|물류센터 데이터 관리 플랫폼/u);
assert.doesNotMatch(platformFeature, /aria-label=["']데이터 관리 주요 탭["']/u);

for (const bannedCopy of [
  '아직 입력된 수익·비용·수납 자료가 없습니다',
  '계산식 승인 전에는 합계 계산만 잠겨 있습니다',
  '월별 수익·비용·수납 원장',
  '기존 대출 원장',
  '검증이 끝난 핵심 지표가 없습니다',
  '핵심 열',
  '계약 조건',
  '비용·권리',
  '부가 정보',
]) {
  assert.doesNotMatch(feature, new RegExp(bannedCopy, 'u'), `forbidden UI copy remains: ${bannedCopy}`);
}

assert.match(rentRollSchema, /export const RENT_ROLL_COLUMNS/);
for (const field of [
  'occupancy_status', 'tenant_name', 'business_registration_number', 'use_category', 'floor_label',
  'exclusive_area_sqm', 'common_area_sqm', 'leased_area_sqm', 'commencement_date', 'expiry_date',
  'deposit_total_krw', 'monthly_rent_total_krw', 'monthly_cam_total_krw', 'rent_free_schedule',
  'rent_escalation_rule', 'tenant_cost_terms', 'landlord_cost_terms', 'renewal_terms',
  'termination_terms', 'restoration_terms', 'bond_terms', 'operation_start_date', 'pallet_rack_fee', 'notes',
]) {
  assert.ok(rentRollSchema.includes(field), `missing universal rent-roll field: ${field}`);
}
assert.match(platformFeature, /data-testid=["']rent-roll-table["']/u);
assert.match(platformFeature, /aria-sort=/u);
assert.match(platformFeature, /data-testid=["']rent-roll-move-up["']/u);
assert.match(platformFeature, /data-testid=["']rent-roll-move-down["']/u);
assert.match(platformFeature, /floor_label[\s\S]{0,160}desc/u);
assert.match(platformFeature, /sticky[\s\S]{0,120}tenant_name/u);
assert.doesNotMatch(platformFeature, />\s*\{\s*row\.tenant_key\s*\}\s*</u);

for (const homeCopy of [
  '자산 개요', '투자 현황', '펀드 정보', '대출 현황', 'Coupon 금리', 'All-in 금리',
  '임대차 만기', '펀드 만기', '대출 만기',
]) {
  assert.ok(platformFeature.includes(homeCopy), `missing home information surface: ${homeCopy}`);
}

for (const financeToken of [
  'NOI_TABLE_ROWS', 'finance-comparison-asset', 'finance-aggregation', 'finance-trend',
  '순영업소득', '잠재총수입', '유효총수입', '운영비용',
]) {
  assert.ok(platformFeature.includes(financeToken), `missing NOI comparison surface: ${financeToken}`);
}
assert.match(platformFeature, /resource\.reload\(\)/u);
assert.match(feature, /sessionStorage/);
assert.doesNotMatch(feature, /(?:localStorage|sessionStorage)[\s\S]{0,120}scenario/iu);
assert.match(feature, /write_enabled/iu);
assert.match(feature, /from_month:\s*startMonth/iu);
assert.match(feature, /to_month:\s*endMonth/iu);
assert.doesNotMatch(feature, /<option value=["'](?:budget|forecast)["']/iu);
assert.doesNotMatch(feature, /resend|recipient_email|이메일 발송/iu);
assert.doesNotMatch(feature, /fallback|stale/i);

for (const label of [
  '잠재총수입', '손실', '유효총수입', '운영비용', '순영업소득', '자산 순현금흐름', '부채상환 후 현금흐름',
]) {
  assert.ok(formulas.includes(label), `missing finance waterfall label: ${label}`);
}

for (const token of [
  'logistics-data-platform', 'bg-[#1F1F1E]', 'bg-[#252524]', 'border-[#333333]', 'rounded-[20px]', 'text-[#A1A1AA]',
]) {
  assert.ok(platformFeature.includes(token), `new data platform must reuse existing Gate 6 style token: ${token}`);
}
assert.match(platformFeature, /resource\.data\?\.write_enabled\s*===\s*true/iu);
for (const testId of ['rent-roll-add', 'rent-roll-paste', 'rent-roll-save', 'rent-roll-archive']) {
  assert.match(
    platformFeature,
    new RegExp(`data-testid=["']${testId}["'][\\s\\S]{0,420}disabled=\\{[^}]*rentRollWriteEnabled`, 'iu'),
    `${testId} must be disabled by the server rent-roll write policy`,
  );
}
assert.match(
  platformFeature,
  /data-testid=["']finance-save["'][\s\S]{0,420}disabled=\{[^}]*financeWriteEnabled/iu,
  'finance save must be disabled by the server finance write policy',
);

async function verifyFinanceMutationPayloadContract() {
  const modulePath = path.resolve(root, 'src', 'features', 'logistics-data-platform', 'financeSchema.js');
  const finance = await import(`${pathToFileURL(modulePath).href}?contract=${Date.now()}`);
  const entry = finance.financeEntryForSave({
    _draft_id: 'draft-1', entry_key: 'entry-1', operation: 'update', month: '2026-08',
    account_code: 'MANUAL_REVENUE', amount: 100, scenario: 'forecast', accounting_basis: 'accrual',
    reason: 'NOI 표 직접 입력', source_ref: 'server-owned-reference', source_kind: 'manual_input',
    source_line_key: 'server-owned-line', data_status: 'verified',
  });
  for (const serverOwnedField of ['source_ref', 'source_kind', 'source_line_key', 'data_status']) {
    assert.equal(Object.hasOwn(entry, serverOwnedField), false, `finance mutation must not send ${serverOwnedField}`);
  }
  assert.equal(entry.scenario, 'actual');
}

async function verifyRootRouteContract() {
  const modulePath = path.resolve(root, 'src', 'components', 'system', 'workspace', 'logisticsRoutes.js');
  const routeModule = await import(`${pathToFileURL(modulePath).href}?contract=${Date.now()}`);
  for (const rootPath of ['', routeModule.LOGISTICS_DEPLOY_BASE, 'work-platform', routeModule.LOGISTICS_INTERNAL_BASE]) {
    assert.equal(routeModule.normalizeLogisticsPath(rootPath), routeModule.LOGISTICS_INTERNAL_BASE);
  }
  assert.equal(routeModule.normalizeLogisticsPath('home'), `${routeModule.LOGISTICS_INTERNAL_BASE}/dashboard/home`);
  assert.equal(routeModule.normalizeLogisticsPath('data-platform'), routeModule.LOGISTICS_DATA_PLATFORM_HOME);
}

Promise.all([verifyFinanceMutationPayloadContract(), verifyRootRouteContract()])
  .then(() => console.log('PASS logistics data platform frontend contract'))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
