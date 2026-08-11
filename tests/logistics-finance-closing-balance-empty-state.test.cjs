const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { pathToFileURL } = require('node:url');

const featureDir = path.resolve(__dirname, '../src/features/logistics-data-platform');
const platformSource = fs.readFileSync(path.join(featureDir, 'LogisticsDataPlatform.jsx'), 'utf8');

test('unknown closing cash balance remains null, while an explicit zero opening produces zero', async () => {
  const [{ applyFinanceCashBalances }, { financeComparisonValue }] = await Promise.all([
    import(pathToFileURL(path.join(featureDir, 'formulas.js')).href),
    import(pathToFileURL(path.join(featureDir, 'financePresentation.js')).href),
  ]);

  const unknown = applyFinanceCashBalances([
    { period: '2026-07', net_cash_flow: 125 },
    { period: '2026-08', net_cash_flow: -25 },
  ]);
  const explicitZero = applyFinanceCashBalances([
    { period: '2026-07', net_cash_flow: 125, opening_cash_balance: 0 },
    { period: '2026-08', net_cash_flow: -25 },
  ]);

  assert.deepEqual(unknown.map((row) => row.cumulative_net_cash_flow), [125, 100]);
  assert.deepEqual(unknown.map((row) => row.closing_cash_balance), [null, null]);
  assert.equal(financeComparisonValue(unknown, 'closing_cash_balance'), null);
  assert.deepEqual(explicitZero.map((row) => row.closing_cash_balance), [125, 100]);
  assert.equal(financeComparisonValue(explicitZero, 'closing_cash_balance'), 100);
  assert.equal(financeComparisonValue(explicitZero, 'net_cash_flow'), 100);
});

test('comparison and statement deliberately render unknown closing balance as a dash, not zero', () => {
  assert.match(platformSource, /amount\(financeComparisonValue\(series, key\)\)/u);
  assert.match(platformSource, /value === "" \|\| value == null[\s\S]{0,80}\? "—"/u);
  assert.match(
    platformSource,
    /row\.key === "closing_cash_balance"[\s\S]{0,120}closing_cash_balance == null[\s\S]{0,60}\? "-"/u,
  );
});
