const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { pathToFileURL } = require('node:url');

const ROOT = path.resolve(__dirname, '..');
const PRESENTATION_PATH = path.join(
  ROOT,
  'src/features/logistics-data-platform/financePresentation.js',
);

async function presentation() {
  return import(`${pathToFileURL(PRESENTATION_PATH).href}?finance-presentation=${Date.now()}-${Math.random()}`);
}

test('finance presentation merges income and loss into one operating revenue hierarchy', async () => {
  const { buildFinanceStatementPresentationRows } = await presentation();
  const rows = buildFinanceStatementPresentationRows([
    { key: 'potential_income', label: '영업수익', accounts: [{ account_code: 'RENT', label: '임대료', active: true }] },
    { key: 'income_loss', label: '수입 손실', accounts: [{ account_code: 'VACANCY', label: '공실 손실', active: true }] },
    { key: 'operating_expense', label: '운영비용', accounts: [] },
    { key: 'below_noi', label: 'NOI 하단 조정', accounts: [] },
    { key: 'debt_service', label: '부채상환', accounts: [] },
  ]);

  assert.deepEqual(
    rows.filter((row) => ['section', 'subsection', 'account', 'metric'].includes(row.kind))
      .map(({ kind, key, label }) => ({ kind, key, label })),
    [
      { kind: 'section', key: 'operating_revenue', label: '영업수익' },
      { kind: 'account', key: 'RENT', label: '임대료' },
      { kind: 'subsection', key: 'income_loss-subsection', label: '수익 차감' },
      { kind: 'account', key: 'VACANCY', label: '공실 손실' },
      { kind: 'metric', key: 'effective_gross_income', label: '영업수익 소계' },
      { kind: 'section', key: 'operating_expense', label: '운영비용' },
      { kind: 'metric', key: 'total_operating_expense', label: '영업비용 소계' },
      { kind: 'metric', key: 'net_operating_income', label: '순영업소득(NOI)' },
      { kind: 'section', key: 'below_noi', label: 'NOI 하단 조정' },
      { kind: 'metric', key: 'asset_net_cash_flow', label: '자산 순현금흐름(NCF)' },
      { kind: 'section', key: 'debt_service', label: '부채상환' },
      { kind: 'metric', key: 'after_debt_service_cash_flow', label: '부채상환 후 현금흐름' },
    ],
  );
  assert.equal(rows.filter((row) => row.key === 'effective_gross_income').length, 1);
  assert.equal(rows.some((row) => row.key === 'potential_gross_income'), false);
  assert.equal(rows.some((row) => row.key === 'total_income_loss'), false);
});

test('finance comparison presents operating revenue once and keeps downstream results', async () => {
  const { FINANCE_COMPARISON_PRESENTATION_KEYS } = await presentation();

  assert.deepEqual(FINANCE_COMPARISON_PRESENTATION_KEYS, [
    'effective_gross_income',
    'total_operating_expense',
    'net_operating_income',
    'asset_net_cash_flow',
    'after_debt_service_cash_flow',
  ]);

  const source = fs.readFileSync(
    path.join(ROOT, 'src/features/logistics-data-platform/LogisticsDataPlatform.jsx'),
    'utf8',
  );
  assert.match(source, /FINANCE_COMPARISON_PRESENTATION_KEYS\.map/u);
  assert.doesNotMatch(source, /FINANCE_WATERFALL_KEYS\.map/u);
  assert.match(source, /effective_gross_income:\s*"영업수익"/u);
});
