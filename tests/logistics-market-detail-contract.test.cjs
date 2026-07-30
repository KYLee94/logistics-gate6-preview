const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const EDGE_PATH = path.join(ROOT, 'supabase', 'functions', 'll-dashboard-api', 'index.ts');
const MARKET_UI_PATH = path.join(ROOT, 'src', 'components', 'system', 'workspace', 'LogisticsSectorModules.jsx');

// The API has six normalized data sets and three preserved-source detail data sets.
const DETAIL_DATASETS = [
  'lease_current',
  'lease_history',
  'lease_statistics',
  'supply_new',
  'supply_pipeline',
  'supply_cumulative',
  'transaction_cases',
  'transaction_statistics',
  'cap_rate',
];

const FORBIDDEN_PUBLIC_FIELDS = [
  'id',
  'payload',
  'source_row_id',
  'source_file_id',
  'source_row_number',
  'pnu',
  'legal_dong_code',
  'row_hash',
  'natural_key',
];

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function functionBlock(sourceText, functionName) {
  const match = new RegExp(`\\b(?:async\\s+)?function\\s+${functionName}\\s*\\(`, 'u').exec(sourceText);
  assert.ok(match, `${functionName} must be declared`);
  const next = /\n(?:async\s+)?function\s+[A-Za-z0-9_]+\s*\(/gu;
  next.lastIndex = match.index + match[0].length;
  const nextMatch = next.exec(sourceText);
  return sourceText.slice(match.index, nextMatch ? nextMatch.index : sourceText.length);
}

function sourceWindow(sourceText, marker, length = 1800) {
  const index = sourceText.indexOf(marker);
  assert.notEqual(index, -1, `${marker} must exist`);
  return sourceText.slice(index, index + length);
}

test('market detail API allowlists exactly nine public data sets', () => {
  const edge = read(EDGE_PATH);
  const handler = functionBlock(edge, 'callSectorMarketDetailList');

  assert.match(edge, /'sector-market\/detail\/list'/u);
  assert.match(edge, /SECTOR_MARKET_DETAIL_DATASETS/u);
  assert.match(edge, /SECTOR_MARKET_SOURCE_DETAIL_DATASETS/u);
  for (const dataset of DETAIL_DATASETS) {
    assert.match(edge, new RegExp(`(?:['"]${dataset}['"]|\\b${dataset}\\s*:)`, 'u'), `${dataset} must be declared`);
  }
  assert.match(handler, /Unsupported market detail dataset/u);
  assert.match(handler, /allowed_datasets/u);
});

test('detail reads default to 100 rows and cap every data set at 500 rows', () => {
  const edge = read(EDGE_PATH);
  const normalized = functionBlock(edge, 'callSectorMarketDetailList');
  const sourceDetail = functionBlock(edge, 'callSectorMarketSourceDetailList');

  for (const block of [normalized, sourceDetail]) {
    assert.match(block, /page_size|pageSize/u);
    assert.ok(
      block.includes('const pageSize = Math.min(Math.max(Number(payload.page_size || payload.pageSize || 100), 1), 500);'),
      'page size must default to 100 and be clamped to 1..500',
    );
  }
});

test('detail list routes are read-only and cannot add duplicate market or source rows', () => {
  const edge = read(EDGE_PATH);
  const normalized = functionBlock(edge, 'callSectorMarketDetailList');
  const sourceDetail = functionBlock(edge, 'callSectorMarketSourceDetailList');

  for (const block of [normalized, sourceDetail]) {
    assert.doesNotMatch(block, /\.(?:insert|upsert|update|delete)\s*\(/u);
    assert.doesNotMatch(block, /callSectorMarketIngest|replace_existing|\.upload\s*\(/iu);
    assert.match(block, /\.select\s*\(|readSectorMarketDetailPage|readSectorMarketSourceDetailRows/u);
  }
});

test('public detail responses only return display columns and remove raw source identifiers', () => {
  const edge = read(EDGE_PATH);
  const handler = functionBlock(edge, 'callSectorMarketDetailList');
  const scrubber = functionBlock(edge, 'scrubSectorMarketInternalResponseKeys');

  assert.match(handler, /sectorMarketDetailPublicColumns/u);
  assert.match(handler, /scrubSectorMarketInternalResponseKeys/u);
  assert.match(scrubber, /SECTOR_MARKET_INTERNAL_RESPONSE_KEYS/u);
  for (const field of FORBIDDEN_PUBLIC_FIELDS.filter((field) => !['id', 'source_row_number', 'row_hash', 'natural_key'].includes(field))) {
    assert.match(edge, new RegExp(`['"]${field}['"]`, 'u'), `${field} must remain in the server-side denylist`);
  }
  assert.match(handler, /Object\.fromEntries\(config\.columns/u, 'only configured public columns may be projected');
  assert.match(edge, /internalHeader\s*=.*pnu.*source.*hash/iu, 'source-schema columns must exclude internal identifiers');
});

test('consolidated tables skip source-only columns and cumulative headers keep workbook column order', () => {
  const edge = read(EDGE_PATH);
  const selector = functionBlock(edge, 'sectorMarketDetailSelectColumns');
  const cumulativeHeader = functionBlock(edge, 'sectorMarketSourceDetailFieldSchemaFromHeaderRow');

  assert.match(selector, /column\.dbKey\s*\|\|\s*!column\.sourcePatterns\?\.length/u);
  assert.match(cumulativeHeader, /workbookSchemaColumnsForSheet\(source,\s*sheetName\)/u);
  assert.match(cumulativeHeader, /column\.normalized_header/u);
  assert.match(cumulativeHeader, /column\.column_index/u);
});

test('detail API returns business columns with groups and a single canonical pagination total', () => {
  const edge = read(EDGE_PATH);
  const handler = functionBlock(edge, 'callSectorMarketDetailList');
  const ui = read(MARKET_UI_PATH);

  assert.match(handler, /columns:\s*sectorMarketDetailPublicColumns/u);
  assert.match(handler, /total:\s*result\.count/u);
  assert.match(handler, /page_size:\s*pageSize/u);
  assert.match(edge, /group:\s*['"]/u, 'detail columns must carry a business group');

  // The Edge contract calls the exact total `total`; the popup must not silently
  // downgrade to the first page row count, otherwise the next-page control disappears.
  const paginationState = sourceWindow(ui, 'const sourceRows = Array.isArray(response?.rows)');
  assert.match(paginationState, /total_count:\s*Number\(response\?\.total\s*\?\?\s*response\?\.total_count\s*\?\?\s*rows\.length\)/u);
  assert.match(ui, /column_groups:\s*detailRequest\.columnGroups\s*\|\|\s*\[\]/u);
});

test('all Supply Pipeline table, map, and chart detail paths use the shared full-screen modal', () => {
  const ui = read(MARKET_UI_PATH);
  assert.match(ui, /const openMarketDetailModal\s*=\s*\(/u);
  assert.match(ui, /const openSupplyAssetModal\s*=\s*\(/u);
  assert.match(ui, /const openSupplyPeriodModal\s*=\s*\(/u);
  assert.match(ui, /width:\s*['"]max-w-\[calc\(100vw-32px\)\]['"]/u);
  assert.match(ui, /fullscreen:\s*true/u);
  for (const dataset of ['supply_new', 'supply_pipeline', 'supply_cumulative']) {
    assert.match(ui, new RegExp(`['"]${dataset}['"]`, 'u'), `${dataset} must enter the shared detail modal`);
  }
  assert.match(ui, /onSelect=\{\(row\) => openSupplyAssetModal\(row, 'supply_new'\)\}/u);
  assert.match(ui, /onRowClick=\{\(row\) => openSupplyAssetModal\(row, 'supply_pipeline'\)\}/u);
  assert.match(ui, /onRowClick=\{\(row\) => openSupplyAssetModal\(row, 'supply_cumulative'\)\}/u);
});
