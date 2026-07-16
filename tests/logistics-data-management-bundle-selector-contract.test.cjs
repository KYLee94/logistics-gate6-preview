const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const test = require('node:test');

const sourcePath = path.join(__dirname, '..', 'src', 'components', 'system', 'workspace', 'LogisticsSectorModules.jsx');
const source = fs.readFileSync(sourcePath, 'utf8');

function selectorSource() {
  const start = source.indexOf('function DataManagementBundleSelector(');
  const end = source.indexOf('\nexport function DataManagementDashboard', start);
  assert.ok(start >= 0 && end > start, 'Data Management bundle selector must have a bounded source section.');
  return source.slice(start, end);
}

test('Data Management bundle selector exposes the accessible two-column listbox contract', () => {
  const selector = selectorSource();

  assert.match(selector, /role="listbox"/u);
  assert.match(selector, /aria-haspopup="listbox"/u);
  assert.match(selector, /data-testid="data-management-bundle-selector"/u);
  assert.match(selector, /data-testid="data-management-bundle-trigger"/u);
  assert.match(selector, /data-testid=\{option\.isAll \? 'data-management-bundle-option-all' : `data-management-bundle-option-\$\{option\.bundle_key\}`\}/u);
  assert.match(selector, /grid-cols-2/u);
  assert.match(selector, /text-left/u);
  assert.match(selector, /firstText\(fund\?\.short_name, fund\?\.fund_name, fund\?\.fund_code/u);
  assert.match(selector, /firstText\(asset\?\.asset_name, asset\?\.asset_code/u);
});

test('Data Management bundle selector closes for outside interaction and Escape, with keyboard list navigation', () => {
  const selector = selectorSource();

  assert.match(selector, /rootRef\.current\.contains\(event\.target\)/u);
  assert.match(selector, /event\.key === 'Escape'/u);
  assert.match(selector, /event\.key === 'ArrowDown'/u);
  assert.match(selector, /event\.key === 'ArrowUp'/u);
  assert.match(selector, /event\.key === 'Home'/u);
  assert.match(selector, /event\.key === 'End'/u);
});

test('bundle selection preserves the existing page and selected-row reset behavior', () => {
  const dashboardStart = source.indexOf('export function DataManagementDashboard(');
  const selectorRender = source.indexOf('<DataManagementBundleSelector', dashboardStart);
  assert.ok(selectorRender > dashboardStart, 'Data Management must render the custom bundle selector.');
  const dashboard = source.slice(dashboardStart);

  assert.match(dashboard, /setBundleKey\(nextKey\);\s*setPage\(1\);\s*setSelectedRowKey\(''\);/u);
  assert.match(dashboard, /value=\{bundleKey\}/u);
  assert.match(dashboard, /bundles=\{bundles\}/u);
  assert.match(dashboard, /MANAGEMENT_ALL_OPTION/u);
});
