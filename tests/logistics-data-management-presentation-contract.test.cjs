const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const EDGE_PATH = path.join(ROOT, 'supabase', 'functions', 'll-dashboard-api', 'index.ts');
const MODULE_PATH = path.join(ROOT, 'src', 'components', 'system', 'workspace', 'LogisticsSectorModules.jsx');
const SHELL_PATH = path.join(ROOT, 'src', 'components', 'system', 'workspace', 'WorkspaceLogistics.jsx');
const NAV_PATH = path.join(ROOT, 'src', 'components', 'system', 'IotaLeftNav.jsx');

const edgeSource = fs.readFileSync(EDGE_PATH, 'utf8');
const moduleSource = fs.readFileSync(MODULE_PATH, 'utf8');
const shellSource = fs.readFileSync(SHELL_PATH, 'utf8');
const navSource = fs.readFileSync(NAV_PATH, 'utf8');

function sourceBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, `Expected a bounded source section from ${startMarker} to ${endMarker}.`);
  return source.slice(start, end);
}

function fieldDefinition(source, fieldKey) {
  const match = source.match(new RegExp(`\\{[^\\n]*field_key:\\s*'${fieldKey}'[^\\n]*\\}`, 'u'));
  assert.ok(match, `Expected ${fieldKey} field metadata.`);
  return match[0];
}

function assertFieldUnit(source, fieldKey, expectedUnit) {
  const definition = fieldDefinition(source, fieldKey);
  assert.match(definition, new RegExp(`unit:\\s*'${expectedUnit}'`, 'u'), `${fieldKey} must declare the ${expectedUnit} unit metadata.`);
}

test('Data Management numeric view fields declare explicit display units', () => {
  const leaseFields = sourceBetween(
    edgeSource,
    'const DATA_MANAGEMENT_LEASE_VIEW_FIELDS_V2 = [',
    '\nconst DATA_MANAGEMENT_RENT_HISTORY_VIEW_FIELDS = [',
  );
  const assetFields = sourceBetween(
    edgeSource,
    'const DATA_MANAGEMENT_ASSET_INTEGRATED_VIEW_FIELDS_V2 = [',
    '\nconst DATA_MANAGEMENT_INVESTMENT_INTEGRATED_VIEW_FIELDS_V2 = [',
  );
  const investmentFields = sourceBetween(
    edgeSource,
    'const DATA_MANAGEMENT_INVESTMENT_INTEGRATED_VIEW_FIELDS_V2 = [',
    '\nconst DATA_MANAGEMENT_NORMALIZED_LEASE_VIEW_KEYS =',
  );

  assertFieldUnit(leaseFields, 'leased_area_sqm', '㎡');
  assertFieldUnit(leaseFields, 'exclusive_ratio', '%');
  assertFieldUnit(leaseFields, 'current_monthly_rent_total', '원');
  assertFieldUnit(leaseFields, 'current_rent_per_py', '원/평');
  assertFieldUnit(leaseFields, 'current_contract_period', '년');
  assertFieldUnit(leaseFields, 'extension_count', '회');
  assertFieldUnit(assetFields, 'gross_floor_area_sqm', '㎡');
  assertFieldUnit(assetFields, 'pm_cost_krw', '원');
  assertFieldUnit(investmentFields, 'equity_amount_krw', '원');
});

test('Data Management table headers render a column label together with its unit', () => {
  const headerStart = moduleSource.indexOf('function dataManagementColumnHeaderLabel(');
  const headerEnd = moduleSource.indexOf('\nfunction dataManagementColumnEditGuide(', headerStart);
  assert.ok(headerStart >= 0 && headerEnd > headerStart, 'Data Management must define a bounded label-plus-unit header renderer.');
  const headerLabel = moduleSource.slice(headerStart, headerEnd);

  assert.match(headerLabel, /column\?\.label/u);
  assert.match(headerLabel, /column\?\.unit/u);
  assert.match(headerLabel, /\$\{label\}.*\$\{unit\}/u);

  const renderedHeaderCount = (moduleSource.match(/dataManagementColumnHeaderLabel\(column\)/gu) || []).length;
  assert.ok(renderedHeaderCount >= 2, 'Both standard and full-screen Data Management headers must use the label-plus-unit renderer.');
});

test('the six Data Management navigation labels, routes, and dashboard titles stay aligned', () => {
  const navItems = sourceBetween(navSource, 'const logisticsDataManagementItems = [', '\nconst logisticsStandaloneItems = [');
  const tabConfigs = sourceBetween(moduleSource, 'const DATA_MANAGEMENT_TAB_CONFIGS = {', '\nfunction dataManagementViewMeta(');
  const routeMap = sourceBetween(shellSource, 'const activeDataManagementTab = ({', "})[dataManagementRoute] || 'lease';");
  const tabs = [
    { route: 'asset-data', key: 'asset', title: '자산 데이터' },
    { route: 'investment-data', key: 'investment', title: '투자 데이터' },
    { route: 'lease-contracts', key: 'lease', title: '임대차계약 데이터' },
    { route: 'managers', key: 'managers', title: '담당자 데이터' },
    { route: 'data-quality', key: 'quality', title: '데이터 품질' },
    { route: 'approval', key: 'approval', title: '승인 대기' },
  ];

  for (const tab of tabs) {
    assert.match(navItems, new RegExp(`label:\\s*'${tab.title}'[\\s\\S]{0,220}data-management/${tab.route}`, 'u'));
    assert.match(routeMap, new RegExp(`'?${tab.route}'?:\\s*'${tab.key}'`, 'u'));
    assert.match(tabConfigs, new RegExp(`${tab.key}:\\s*\\{[\\s\\S]{0,180}title:\\s*'${tab.title}'`, 'u'));
  }
});
