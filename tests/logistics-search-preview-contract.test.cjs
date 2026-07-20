const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { pathToFileURL } = require('node:url');

const ROOT = path.resolve(__dirname, '..');
const WORKSPACE_PATH = path.join(ROOT, 'src', 'components', 'system', 'workspace', 'WorkspaceLogistics.jsx');
const UTILS_PATH = path.join(ROOT, 'src', 'components', 'system', 'workspace', 'searchPreviewUtils.js');

async function loadUtils() {
  return import(`${pathToFileURL(UTILS_PATH).href}?t=${Date.now()}`);
}

test('company search preview derives every requested KPI from the primary response', async () => {
  const { deriveCompanySearchPreviewMetrics } = await loadUtils();
  const metrics = deriveCompanySearchPreviewMetrics({
    summary: {
      asset_count: 2,
      leased_area_sqm: 3305.785,
      current_monthly_rent_total: 100,
      current_monthly_mf_total: 20,
      current_monthly_cost_total: 120,
    },
    profile: {},
    rows: [],
    financials: { openDart: { corp_code: '00123456', corp_name: '테스트 기업' } },
  });

  assert.deepEqual(metrics, {
    assetCount: 2,
    leasedAreaSqm: 3305.785,
    monthlyRentTotal: 100,
    monthlyMfTotal: 20,
    monthlyCostTotal: 120,
    dartLinked: true,
  });
});

test('company search preview falls back to lease rows without losing valid zero amounts', async () => {
  const { deriveCompanySearchPreviewMetrics } = await loadUtils();
  const metrics = deriveCompanySearchPreviewMetrics({
    rows: [
      { assetId: 'asset-b', leasedAreaSqm: 20, monthlyRentTotal: 0, monthlyMfTotal: 3, monthlyCostTotal: 3 },
      { assetId: 'asset-a', leasedAreaSqm: 10, monthlyRentTotal: 7, monthlyMfTotal: 0, monthlyCostTotal: 7 },
      { assetId: 'asset-a', leasedAreaSqm: 5, monthlyRentTotal: 2, monthlyMfTotal: 1, monthlyCostTotal: 3 },
    ],
    financials: { dartLinked: false },
  });

  assert.equal(metrics.assetCount, 2);
  assert.equal(metrics.leasedAreaSqm, 35);
  assert.equal(metrics.monthlyRentTotal, 9);
  assert.equal(metrics.monthlyMfTotal, 4);
  assert.equal(metrics.monthlyCostTotal, 13);
  assert.equal(metrics.dartLinked, false);
});

test('company search preview rows default to asset ascending and zone descending', async () => {
  const { sortCompanySearchPreviewRows } = await loadUtils();
  const rows = sortCompanySearchPreviewRows([
    { assetName: '나 자산', floorLabel: '2' },
    { assetName: '가 자산', floorLabel: '2' },
    { assetName: '가 자산', floorLabel: '10' },
    { assetName: '가 자산', floorLabel: 'B1' },
  ]);

  assert.deepEqual(rows.map((row) => `${row.assetName}:${row.floorLabel}`), [
    '가 자산:B1',
    '가 자산:10',
    '가 자산:2',
    '나 자산:2',
  ]);
});

test('integrated search preview uses the shared fullscreen overlay and Korean tab labels', () => {
  const source = fs.readFileSync(WORKSPACE_PATH, 'utf8');
  const previewOverlay = source.slice(source.indexOf('{selectedSearchResult && ('), source.indexOf('{pendingTaskAction && ('));

  assert.match(previewOverlay, /<MainOverlay[\s\S]*\bfullScreen\b/u);
  assert.match(source, />자산 탭에서 전체 보기<\/button>/u);
  assert.match(source, />기업 탭에서 전체 보기<\/button>/u);
  assert.doesNotMatch(source, />Asset 탭에서 전체 보기<\/button>/u);
  assert.doesNotMatch(source, />Company 탭에서 전체 보기<\/button>/u);
});
