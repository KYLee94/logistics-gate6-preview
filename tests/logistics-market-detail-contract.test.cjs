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

function datasetColumnKeys(sourceText, dataset, nextDataset) {
  const start = sourceText.indexOf(`${dataset}: {`);
  const end = sourceText.indexOf(`${nextDataset}: {`, start + 1);
  assert.notEqual(start, -1, `${dataset} must exist`);
  assert.notEqual(end, -1, `${nextDataset} must exist`);
  const block = sourceText.slice(start, end);
  const columnsStart = block.indexOf('columns: [');
  assert.notEqual(columnsStart, -1, `${dataset} columns must exist`);
  return [...block.slice(columnsStart).matchAll(/\{\s*key:\s*'([^']+)'/gu)].map((match) => match[1]);
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

test('detail filters treat the UI all-option as no filter instead of sending it to typed columns', () => {
  const edge = read(EDGE_PATH);
  const filterValues = functionBlock(edge, 'sectorMarketDetailFilterValues');
  assert.match(filterValues, /\['전체', 'all'\]\.includes\(item\.toLowerCase\(\)\)/u);
});

test('normalized detail data sets stay on the active workbook and can enrich public fields', () => {
  const edge = read(EDGE_PATH);
  const detailConfig = sourceWindow(edge, 'const SECTOR_MARKET_DETAIL_DATASETS', 18000);
  const reader = functionBlock(edge, 'readSectorMarketDetailPage');

  for (const dataset of ['lease_history', 'supply_new', 'supply_pipeline', 'transaction_cases', 'cap_rate']) {
    const datasetWindow = sourceWindow(detailConfig, `${dataset}: {`, 6200);
    assert.match(datasetWindow, /sourceRowColumn:\s*'source_row_id'/u, `${dataset} must retain the preserved-row join key`);
    assert.match(datasetWindow, /sourceFileColumn:\s*'source_file_id'/u, `${dataset} must be filtered to the active workbook`);
  }
  assert.match(reader, /query\.eq\(config\.sourceFileColumn,\s*activeSourceId\)/u);
  assert.match(reader, /Never remove the active-source filter/u);
  const rawReader = functionBlock(edge, 'readSectorMarketRawValues');
  assert.match(rawReader, /offset \+= 50/u);
  assert.match(rawReader, /ids\.slice\(offset,\s*offset \+ 50\)/u);
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
  const cumulativeReader = functionBlock(edge, 'callSectorMarketSourceDetailList');

  assert.match(selector, /column\.dbKey\s*\|\|\s*!column\.sourcePatterns\?\.length/u);
  assert.match(cumulativeHeader, /workbookSchemaColumnsForSheet\(source,\s*sheetName\)/u);
  assert.match(cumulativeHeader, /column\.normalized_header/u);
  assert.match(cumulativeHeader, /column\.column_index/u);
  assert.match(cumulativeReader, /sectorMarketSupplyCumulativeHeaderScore/u);
  assert.match(cumulativeReader, /Number\(row\.row_number\s*\|\|\s*0\)\s*>\s*headerRowNumber/u);
});

test('all nine detail datasets keep source order, postpone empty columns, and recover supply addresses from preserved rows', () => {
  const edge = read(EDGE_PATH);
  const detailConfig = sourceWindow(edge, 'const SECTOR_MARKET_DETAIL_DATASETS', 18000);
  const normalized = functionBlock(edge, 'callSectorMarketDetailList');
  const sourceDetail = functionBlock(edge, 'callSectorMarketSourceDetailList');
  const publicColumns = functionBlock(edge, 'sectorMarketDetailPublicColumns');
  const cumulativeHeader = functionBlock(edge, 'sectorMarketSourceDetailFieldSchemaFromHeaderRow');
  const rawAddress = functionBlock(edge, 'sectorMarketRawAddress');
  const detailValue = functionBlock(edge, 'sectorMarketDetailValue');

  assert.match(detailConfig, /supply_new:\s*\{[\s\S]*?key:\s*'legal_address'[\s\S]*?sourcePatterns:/u,
    'new supply locations must recover a non-empty preserved source address');
  assert.match(detailConfig, /(?:소재지|주소)/u, 'address recovery must recognise original workbook address headers');
  assert.match(rawAddress, /province/u);
  assert.match(rawAddress, /city/u);
  assert.match(rawAddress, /district/u);
  assert.match(rawAddress, /dong/u);
  assert.match(rawAddress, /mainLot/u);
  assert.match(detailValue, /column\.key === 'legal_address' \? sectorMarketRawAddress\(rawValues\)/u);
  assert.match(publicColumns, /rows:\s*Array<Record<string, unknown>>/u);
  assert.match(publicColumns, /hasValue/u);
  assert.match(publicColumns, /left\.hasValue === right\.hasValue/u);
  assert.match(normalized, /sectorMarketDetailPublicColumns\(config,\s*rows\)/u);
  assert.match(sourceDetail, /sectorMarketSourceDetailPublicColumns\(schema,\s*(?:filtered|sorted|mapped)\)/u);
  assert.match(cumulativeHeader, /headerValues\[fallbackRawKey\]/u,
    'cumulative headers must fall back to positional raw keys when normalized keys differ');
  assert.match(cumulativeHeader, /column\.header_label/u,
    'cumulative headers must retain the workbook label when a merged header cell is blank');
});

test('normalized supply popup columns follow the original workbook business order', () => {
  const edge = read(EDGE_PATH);
  assert.deepEqual(datasetColumnKeys(edge, 'supply_new', 'supply_pipeline'), [
    'warehouse_name',
    'region',
    'region_group',
    'legal_address',
    'construction_type',
    'site_area_sqm',
    'site_area_py',
    'building_area_sqm',
    'gross_area_sqm',
    'gross_area_py',
    'building_coverage_ratio',
    'floor_area_ratio',
    'above_ground_floors',
    'below_ground_floors',
    'main_use',
    'structure',
    'permit_date',
    'start_date',
    'completion_date',
    'owner_name',
    'temperature_type',
    'construction_company',
    'note',
  ]);
  assert.deepEqual(datasetColumnKeys(edge, 'supply_pipeline', 'transaction_cases'), [
    'expected_year',
    'expected_quarter',
    'initial_expected_year',
    'initial_expected_quarter',
    'warehouse_name',
    'legal_address',
    'region',
    'site_area_py',
    'building_area_py',
    'gross_area_py',
    'main_use',
    'temperature_type',
    'permit_number',
    'permit_date',
    'start_date',
    'construction_delay_date',
    'construction_company',
    'owner_name',
    'owner_type',
    'progress_status',
    'schedule_confidence',
    'note',
  ]);
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
  assert.match(paginationState, /const hasDetailRows = rows\.length > 0/u);
  assert.match(paginationState, /rows:\s*hasDetailRows\s*\?\s*rows\s*:\s*null/u);
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
  assert.match(ui, /const detailDataset = dataset === 'supply_cumulative' \? 'supply_new' : dataset/u);
  assert.match(ui, /dataset:\s*detailDataset/u);
});

test('all market detail popup columns use bounded semantic widths without header overlap', () => {
  const ui = read(MARKET_UI_PATH);
  const popupColumns = functionBlock(ui, 'marketDetailPopupColumns');

  assert.match(popupColumns, /isAddress/u);
  assert.match(popupColumns, /isNarrative/u);
  assert.match(popupColumns, /isName/u);
  assert.match(popupColumns, /isDate/u);
  assert.match(popupColumns, /isMetric/u);
  assert.match(popupColumns, /Math\.min\(420,\s*Math\.max\(sourceWidth,\s*preferredWidth\)\)/u);
  assert.match(ui, /const popupColumns = marketDetailPopupColumns/u);
  assert.match(ui, /const popupMinWidth = Math\.max/u);
});

test('transaction statistics workbook rows are reachable from the transactions tab', () => {
  const ui = read(MARKET_UI_PATH);

  assert.match(ui, /title:\s*'매매통계 전체 상세'/u);
  assert.match(ui, /dataset:\s*'transaction_statistics'/u);
});

test('Cap Rate detail reads every workbook method and publishes percentage units', () => {
  const edge = read(EDGE_PATH);
  const sourceConfig = sourceWindow(edge, 'const SECTOR_MARKET_SOURCE_DETAIL_DATASETS', 2400);
  const parser = functionBlock(edge, 'parseSectorMarketCapRateDetailRows');
  const sourceDetail = functionBlock(edge, 'callSectorMarketSourceDetailList');

  assert.match(sourceConfig, /cap_rate:\s*\{[\s\S]*?mode:\s*'cap_rate'/u);
  for (const method of ['베이지안', '일반', '가중평균']) {
    assert.match(parser, new RegExp(method, 'u'), `${method} Cap Rate must be parsed from the workbook`);
  }
  assert.match(parser, /fallbackTitleRowNumber:\s*4/u, 'Bayesian rows must remain reachable when the preserved source omits its title row');
  assert.match(parser, /capital_area_cap_rate/u);
  assert.match(parser, /national_cap_rate/u);
  assert.match(sourceDetail, /config\.mode === 'cap_rate'/u);
  assert.match(sourceDetail, /unit:\s*'%'/u);
});

test('Supply Pipeline and transaction case popups pin only asset name and address first', () => {
  const ui = read(MARKET_UI_PATH);
  const popupOrder = functionBlock(ui, 'marketDetailPinnedColumns');
  const supplyModal = sourceWindow(ui, 'const openSupplyAssetModal', 1300);
  const transactionModal = sourceWindow(ui, 'const openTransactionDetailModal', 1300);

  assert.match(popupOrder, /pinnedColumnLabels/u);
  assert.match(popupOrder, /자산명|물류센터명/u);
  assert.match(popupOrder, /소재지|주소/u);
  assert.match(supplyModal, /dataset === 'supply_pipeline'\s*\?\s*\['자산명',\s*'소재지'\]\s*:\s*\[\]/u);
  assert.match(transactionModal, /pinnedColumnLabels:\s*\['자산명',\s*'소재지'\]/u);
  assert.match(ui, /stickyCount=\{2\}/u);
});

test('Market popup percentage columns use the shared two-decimal formatter', () => {
  const ui = read(MARKET_UI_PATH);
  const popupColumns = functionBlock(ui, 'marketDetailPopupColumns');
  const rateFormatter = functionBlock(ui, 'formatRate');

  assert.match(popupColumns, /column\?\.unit\s*===\s*'%'/u);
  assert.match(popupColumns, /formatRate/u);
  assert.match(rateFormatter, /formatNumber\(normalized,\s*2\)/u);
});
