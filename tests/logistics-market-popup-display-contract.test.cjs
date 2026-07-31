const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const source = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'components', 'system', 'workspace', 'LogisticsSectorModules.jsx'),
  'utf8',
);

test('Market page titles match the finalized five sidebar names without changing navigation', () => {
  assert.match(source, /const MARKET_TAB_TITLES = \{\s*overview: '시장 데이터 홈',\s*lease: '임대 시장',\s*supply: '공급 예정',\s*transactions: '거래 사례',\s*source: '업데이트',/u);
});

test('Market popup inventory has stable selectors for every tab and distinct data path', () => {
  const requiredTestIds = [
    'market-overview-lease-chart',
    'market-overview-transaction-chart',
    'market-overview-supply-chart',
    'market-lease-statistics',
    'market-lease-history-button',
    'market-lease-center-table',
    'market-supply-new',
    'market-supply-pipeline',
    'market-supply-cumulative',
    'market-transactions-cases',
    'market-transactions-period',
    'market-transactions-size-unit-price',
    'market-transactions-size-market',
    'market-transactions-cap-rate',
  ];
  for (const testId of requiredTestIds) assert.match(source, new RegExp(`data-testid="${testId}"`, 'u'));
  const qaSource = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'qa', 'logistics-market-detail-browser-contract.cjs'), 'utf8');
  assert.match(qaSource, /const POPUP_INVENTORY = \[/u);
  assert.match(qaSource, /market-overview-lease-chart/u);
  assert.match(qaSource, /market-transactions-cap-rate/u);
  assert.match(qaSource, /inventory_checks/u);
});

test('Market detail popup keeps source order except for consistently sparse optional columns', () => {
  assert.match(source, /function marketDetailPopupColumnOrder\(columns, rows\)/u);
  assert.match(source, /const sourceColumns = safeArray\(columns\)/u);
  assert.match(source, /const sourceRows = safeArray\(rows\)/u);
  assert.match(source, /return enriched\.sort\(\(left, right\) => Number\(left\.sparse\) - Number\(right\.sparse\) \|\| left\.index - right\.index\)/u);
  assert.match(source, /marketDetailPopupColumnOrder\(columns, rows\)\.map/u);
});

test('Supply new address is recognized from the business column label and receives readable popup width', () => {
  assert.match(source, /const isAddress = \/address\|location\|site\/\.test\(key\) \|\| \/소재지\|주소\|대지\\s\*위치\|위치\/\.test\(label\)/u);
  assert.match(source, /isAddress\s*\?\s*360/u);
});

test('Cumulative supply chart popup renders the calculated area values instead of an unrelated detail fallback', () => {
  assert.match(source, /const chartValueRows = seriesType === 'cumulative_supply' \? supplyAreaValueRowsForPeriod\(periodLabel, seriesType\) : \[\];/u);
  assert.match(source, /const rows = chartValueRows\.length \? chartValueRows : supplyRowsForPeriod\(periodLabel, seriesType\);/u);
  assert.match(source, /type: chartValueRows\.length \? 'supply-area-value-explorer' : 'supply-detail-explorer'/u);
  assert.match(source, /columns: chartValueRows\.length \? SUPPLY_AREA_VALUE_COLUMNS : supplyDetailColumns/u);
  assert.match(source, /detailEnabled: !chartValueRows\.length && !useFallbackRows && Boolean\(expectedYear\)/u);
});

test('Transaction period popup loads canonical detail rows when summary data omits raw cases', () => {
  assert.match(
    source,
    /data-testid="market-transactions-period-button"[\s\S]*?dataset: 'transaction_cases',[\s\S]*?rows: transactionMarketAssetRows,[\s\S]*?detailEnabled: true,/u,
  );
});
