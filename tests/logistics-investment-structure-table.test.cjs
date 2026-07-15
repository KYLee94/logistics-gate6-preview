const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const MODULE_PATH = path.join(
  ROOT,
  'src',
  'components',
  'system',
  'workspace',
  'LogisticsSectorModules.jsx',
);
const source = fs.readFileSync(MODULE_PATH, 'utf8');

function sourceBetween(sourceText, startMarker, endMarker) {
  const start = sourceText.indexOf(startMarker);
  assert.ok(start >= 0, `${startMarker} must exist`);
  const end = sourceText.indexOf(endMarker, start + startMarker.length);
  assert.ok(end >= 0, `${endMarker} must follow ${startMarker}`);
  return sourceText.slice(start, end);
}

function columnByKey(columnsSource, key) {
  const start = columnsSource.indexOf(`key: '${key}'`);
  assert.ok(start >= 0, `${key} column must exist`);
  const next = columnsSource.indexOf("key: '", start + key.length + 7);
  return columnsSource.slice(start, next >= 0 ? next : columnsSource.length);
}

function sourceFunction(sourceText, marker) {
  const start = sourceText.indexOf(marker);
  assert.ok(start >= 0, `${marker} must exist`);
  const end = sourceText.indexOf('\nfunction ', start + marker.length);
  assert.ok(end >= 0, `${marker} must be followed by another function`);
  return sourceText.slice(start, end);
}

test('investment structure table prioritizes short fund names and truncates them within their column', () => {
  const columns = sourceBetween(source, 'const tableColumns = [', 'const detailRows = useMemo');
  const fundColumn = columnByKey(columns, 'display_name');
  const assetColumn = columnByKey(columns, 'asset_names');
  const equityColumn = columnByKey(columns, 'equity_krw');
  const loanColumn = columnByKey(columns, 'loan_krw');

  assert.match(fundColumn, /width:\s*22/u);
  assert.match(fundColumn, /investmentFundShortLabel\(row\)/u);
  assert.match(fundColumn, /truncate whitespace-nowrap/u);
  assert.doesNotMatch(fundColumn, /(?:noTruncate|wrap):\s*true/u);
  assert.match(assetColumn, /width:\s*19/u);
  assert.match(equityColumn, /render:\s*\(row\)\s*=>\s*formatKrw\(row\.equity_krw\)/u);
  assert.match(equityColumn, /sortValue:\s*\(row\)\s*=>\s*number\(row\.equity_krw\)/u);
  assert.match(loanColumn, /render:\s*\(row\)\s*=>\s*formatKrw\(row\.loan_krw\)/u);
  assert.match(loanColumn, /sortValue:\s*\(row\)\s*=>\s*number\(row\.loan_krw\)/u);
});

test('investment fund labels never fall back to a long formal name when a shorter identifier exists', () => {
  const helper = sourceFunction(source, 'function investmentFundShortLabel');

  assert.match(helper, /row\?\.short_name/u);
  assert.match(helper, /fundName\.match\(\/제/u);
  assert.match(helper, /row\?\.fund_code/u);
});

test('investment structure table stays fixed to the available desktop width', () => {
  const structureTable = sourceBetween(source, 'showStructureTable ? (', '/>');
  const sortableTable = sourceFunction(source, 'function SortableTable');

  assert.match(structureTable, /minWidth=\{0\}/u);
  assert.match(structureTable, /fitWidth/u);
  assert.match(structureTable, /columns=\{tableColumns\}/u);
  assert.match(sortableTable, /fitWidth\s*\?\s*'table-fixed'/u);
  assert.match(sortableTable, /minWidth:\s*fitWidth\s*\?\s*0\s*:\s*minWidth/u);
});
