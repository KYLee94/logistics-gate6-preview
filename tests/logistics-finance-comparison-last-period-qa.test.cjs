const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { pathToFileURL } = require('node:url');

const target = path.resolve(
  __dirname,
  '../src/features/logistics-data-platform/financePresentation.js',
);
const releaseGatePath = path.resolve(
  __dirname,
  '../scripts/qa/logistics-data-platform-release-gate.cjs',
);

test('finance comparison sums flow metrics and uses the last period only for ending balances', async () => {
  const { financeComparisonValue, FINANCE_COMPARISON_PRESENTATION_KEYS } = await import(
    `${pathToFileURL(target).href}?last-period=${Date.now()}-${Math.random()}`
  );
  const series = [
    Object.fromEntries(FINANCE_COMPARISON_PRESENTATION_KEYS.map((key) => [key, 100])),
    Object.fromEntries(FINANCE_COMPARISON_PRESENTATION_KEYS.map((key) => [key, 25])),
  ];

  for (const key of FINANCE_COMPARISON_PRESENTATION_KEYS) {
    const expected = ['cumulative_net_cash_flow', 'closing_cash_balance'].includes(key)
      ? 25
      : 125;
    assert.equal(financeComparisonValue(series, key), expected, `${key} aggregation mismatch`);
  }
  assert.equal(financeComparisonValue([], 'net_operating_income'), 0);
  assert.equal(financeComparisonValue([], 'closing_cash_balance'), null);
});

test('release gate retains cost canonicalization and cash waterfall contracts', () => {
  const source = fs.readFileSync(releaseGatePath, 'utf8');
  for (const marker of [
    'rent-roll-cost-taxonomy',
    'tests/logistics-rent-roll-cost-taxonomy.test.cjs',
    'finance-cash-waterfall',
    'tests/logistics-finance-cash-waterfall.test.cjs',
    'finance-comparison-last-period-qa',
    'tests/logistics-finance-comparison-last-period-qa.test.cjs',
    'finance-cash-rent-cost-contract',
    'tests/logistics-finance-cash-rent-cost-contract.test.cjs',
  ]) assert.match(source, new RegExp(marker, 'u'));
});
