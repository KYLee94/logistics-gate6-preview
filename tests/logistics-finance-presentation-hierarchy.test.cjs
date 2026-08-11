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

test('finance presentation exposes five canonical revenue inputs and one operating revenue subtotal', async () => {
  const { buildFinanceStatementPresentationRows } = await presentation();
  const rows = buildFinanceStatementPresentationRows([
    { key: 'potential_income', label: '영업수익', accounts: [
      { account_code: 'OPERATING_REVENUE', label: '영업수익', active: true },
      { account_code: 'RENT_REVENUE', label: '임대수익', active: true },
      { account_code: 'MANAGEMENT_FEE_INCOME', label: '관리비수익', active: true },
      { account_code: 'UTILITIES_REIMBURSEMENT_INCOME', label: '수도광열비 회수수익', active: true },
      { account_code: 'INTEREST_INCOME', label: '이자수익', active: true },
      { account_code: 'MISCELLANEOUS_INCOME', label: '기타수익', active: true },
    ] },
    { key: 'income_loss', label: '수입 손실', accounts: [{ account_code: 'VACANCY_LOSS', label: '공실 손실', active: true }] },
    { key: 'operating_expense', label: '운영비용', accounts: [] },
    { key: 'below_noi', label: 'NOI 하단 조정', accounts: [] },
    { key: 'debt_service', label: '부채상환', accounts: [] },
    { key: 'cash_flow', label: '기타 현금흐름', accounts: [
      { account_code: 'OTHER_CASH_INFLOW', label: '기타 현금유입', active: true },
      { account_code: 'OTHER_CASH_OUTFLOW', label: '기타 현금유출', active: true },
    ] },
    { key: 'cash_balance', label: '현금잔액', accounts: [
      { account_code: 'OPENING_CASH_BALANCE', label: '기초 현금잔액', active: true },
    ] },
  ]);

  assert.deepEqual(
    rows.filter((row) => ['section', 'subsection', 'account', 'metric'].includes(row.kind))
      .map(({ kind, key, label }) => ({ kind, key, label })),
    [
      { kind: 'section', key: 'operating_revenue', label: '영업수익' },
      { kind: 'account', key: 'RENT_REVENUE', label: '임대수익' },
      { kind: 'account', key: 'MANAGEMENT_FEE_INCOME', label: '관리비수익' },
      { kind: 'account', key: 'UTILITIES_REIMBURSEMENT_INCOME', label: '수도광열비 회수수익' },
      { kind: 'account', key: 'INTEREST_INCOME', label: '이자수익' },
      { kind: 'account', key: 'MISCELLANEOUS_INCOME', label: '기타수익' },
      { kind: 'metric', key: 'effective_gross_income', label: '영업수익 소계' },
      { kind: 'section', key: 'operating_expense', label: '운영비용' },
      { kind: 'metric', key: 'total_operating_expense', label: '운영비용 소계' },
      { kind: 'metric', key: 'net_operating_income', label: '순영업소득(NOI)' },
      { kind: 'section', key: 'below_noi', label: 'NOI 하단 조정' },
      { kind: 'metric', key: 'asset_net_cash_flow', label: '부채상환 전 현금흐름' },
      { kind: 'section', key: 'debt_service', label: '부채상환' },
      { kind: 'metric', key: 'after_debt_service_cash_flow', label: '부채상환 후 현금흐름' },
      { kind: 'section', key: 'cash_flow', label: '기타 현금흐름' },
      { kind: 'account', key: 'OTHER_CASH_INFLOW', label: '기타 현금유입' },
      { kind: 'account', key: 'OTHER_CASH_OUTFLOW', label: '기타 현금유출' },
      { kind: 'metric', key: 'net_cash_flow', label: '월 순현금흐름' },
      { kind: 'metric', key: 'cumulative_net_cash_flow', label: '누적 순현금흐름' },
      { kind: 'section', key: 'cash_balance', label: '현금잔액' },
      { kind: 'account', key: 'OPENING_CASH_BALANCE', label: '기초 현금잔액' },
      { kind: 'metric', key: 'closing_cash_balance', label: '기말 현금잔액' },
    ],
  );
  assert.equal(rows.filter((row) => row.key === 'OPERATING_REVENUE').length, 0);
  assert.equal(rows.filter((row) => row.kind === 'account' && [
    'RENT_REVENUE', 'MANAGEMENT_FEE_INCOME', 'UTILITIES_REIMBURSEMENT_INCOME',
    'INTEREST_INCOME', 'MISCELLANEOUS_INCOME',
  ].includes(row.key)).length, 5);
  assert.equal(rows.some((row) => row.key === 'VACANCY_LOSS'), false);
  assert.equal(rows.filter((row) => row.key === 'effective_gross_income').length, 1);
  assert.equal(rows.some((row) => row.key === 'potential_gross_income'), false);
  assert.equal(rows.some((row) => row.key === 'total_income_loss'), false);
});

test('legacy aggregate-only read still exposes an editable revenue row until backend canonical migration completes', async () => {
  const { buildFinanceStatementPresentationRows } = await presentation();
  const rows = buildFinanceStatementPresentationRows([{
    key: 'potential_income', label: '영업수익', accounts: [
      { account_code: 'OPERATING_REVENUE', label: '영업수익', active: true },
    ],
  }]);
  assert.equal(rows.filter((row) => row.key === 'OPERATING_REVENUE').length, 1);
  assert.equal(rows.filter((row) => row.key === 'effective_gross_income').length, 1);
});

test('finance comparison presents operating revenue once and keeps downstream results', async () => {
  const { financeComparisonValue, FINANCE_COMPARISON_PRESENTATION_KEYS } = await presentation();

  assert.deepEqual(FINANCE_COMPARISON_PRESENTATION_KEYS, [
    'effective_gross_income',
    'total_operating_expense',
    'net_operating_income',
    'after_debt_service_cash_flow',
    'net_cash_flow',
    'cumulative_net_cash_flow',
    'closing_cash_balance',
  ]);

  const source = fs.readFileSync(
    path.join(ROOT, 'src/features/logistics-data-platform/LogisticsDataPlatform.jsx'),
    'utf8',
  );
  assert.match(source, /FINANCE_COMPARISON_PRESENTATION_KEYS\.map/u);
  assert.doesNotMatch(source, /FINANCE_WATERFALL_KEYS\.map/u);
  assert.match(source, /effective_gross_income:\s*"영업수익"/u);

  const series = [
    { net_operating_income: 100, cumulative_net_cash_flow: 80, closing_cash_balance: 1000 },
    { net_operating_income: 120, cumulative_net_cash_flow: 150, closing_cash_balance: 1070 },
  ];
  assert.equal(financeComparisonValue(series, 'net_operating_income'), 220);
  assert.equal(financeComparisonValue(series, 'cumulative_net_cash_flow'), 150);
  assert.equal(financeComparisonValue(series, 'closing_cash_balance'), 1070);
  assert.equal(financeComparisonValue([], 'closing_cash_balance'), null);
});
