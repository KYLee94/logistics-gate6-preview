const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const source = fs.readFileSync(
  path.resolve(__dirname, '../src/features/logistics-data-platform/LogisticsDataPlatform.jsx'),
  'utf8',
);

function region(startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.ok(start >= 0 && end > start, `${startMarker} region missing`);
  return source.slice(start, end);
}

test('finance trend charts NOI and after-debt cash flow without asset NCF', () => {
  const trend = region('function FinanceTrend', 'function FinanceComparisonLoader');

  assert.match(trend, /row\.after_debt_service_cash_flow/u);
  assert.match(trend, /\["부채상환 후 현금흐름",\s*"after_debt_service_cash_flow"\]/u);
  assert.match(trend, />순영업소득<\/span>/u);
  assert.match(trend, />부채상환 후 현금흐름<\/span>/u);
  assert.doesNotMatch(trend, /asset_net_cash_flow|자산 NCF|>NCF</u);
  assert.match(source, /title="NOI·부채상환 후 현금흐름 시계열"/u);
});

test('period comparison highlights only NOI and after-debt cash flow', () => {
  const finance = region('function FinancePanel', 'export default function LogisticsDataPlatform');

  assert.match(
    finance,
    /const\s+isKeyResult\s*=\s*key\s*===\s*"net_operating_income"\s*\|\|\s*key\s*===\s*"after_debt_service_cash_flow"/u,
  );
  assert.doesNotMatch(
    finance,
    /const\s+isKeyResult\s*=\s*[^;]*asset_net_cash_flow/u,
  );
});
