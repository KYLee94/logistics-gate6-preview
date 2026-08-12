const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { pathToFileURL } = require('node:url');

const ROOT = path.resolve(__dirname, '..');

async function formulas() {
  const target = path.join(ROOT, 'src/features/logistics-data-platform/formulas.js');
  return import(`${pathToFileURL(target).href}?finance-cash=${Date.now()}-${Math.random()}`);
}

test('NOI 아래 현금흐름은 부채상환 전·후와 기타 현금유입·유출을 순서대로 계산한다', async () => {
  const { calculateKoreanLogisticsNoi } = await formulas();
  assert.deepEqual(calculateKoreanLogisticsNoi({
    potential_income: 1000,
    operating_expense: 200,
    below_noi_cash_cost: 50,
    noncash_addback: 10,
    debt_service: 100,
    dividend_payment: 0,
    other_cash_inflow: 20,
    other_cash_outflow: 5,
  }), {
    potential_gross_income: 1000,
    total_income_loss: 0,
    effective_gross_income: 1000,
    total_operating_expense: 200,
    net_operating_income: 800,
    asset_net_cash_flow: 760,
    pre_debt_cash_flow: 760,
    after_debt_service_cash_flow: 660,
    dividend_payment: 0,
    other_cash_inflow: 20,
    other_cash_outflow: 5,
    net_cash_flow: 675,
  });
});

test('기초 현금잔액은 명시 월에 재조정하고 누적 순현금흐름은 조회 범위 처음부터 독립 누적한다', async () => {
  const { applyFinanceCashBalances } = await formulas();
  assert.deepEqual(applyFinanceCashBalances([
    { period: '2026-07', net_cash_flow: 100, opening_cash_balance: null },
    { period: '2026-08', net_cash_flow: -20, opening_cash_balance: 1000 },
    { period: '2026-09', net_cash_flow: 30, opening_cash_balance: null },
    { period: '2026-10', net_cash_flow: 10, opening_cash_balance: 1200 },
  ]), [
    { period: '2026-07', net_cash_flow: 100, opening_cash_balance: null, cumulative_net_cash_flow: 100, closing_cash_balance: null },
    { period: '2026-08', net_cash_flow: -20, opening_cash_balance: 1000, cumulative_net_cash_flow: 80, closing_cash_balance: 980 },
    { period: '2026-09', net_cash_flow: 30, opening_cash_balance: 980, cumulative_net_cash_flow: 110, closing_cash_balance: 1010 },
    { period: '2026-10', net_cash_flow: 10, opening_cash_balance: 1200, cumulative_net_cash_flow: 120, closing_cash_balance: 1210 },
  ]);
});

test('현금 입력 계정과 계산 설명은 저장 계정과 계산 행을 분리한다', async () => {
  const {
    FINANCE_FORMULA_EXPLANATIONS,
    FINANCE_SECTION_ORDER,
    FINANCE_WATERFALL_KEYS,
    FINANCE_WATERFALL_LABELS,
    KOREAN_LOGISTICS_NOI_ACCOUNTS,
  } = await formulas();
  assert.deepEqual(FINANCE_SECTION_ORDER.slice(-2), ['cash_flow', 'cash_balance']);
  assert.deepEqual(
    KOREAN_LOGISTICS_NOI_ACCOUNTS
      .filter((account) => ['cash_flow', 'cash_balance'].includes(account.section))
      .map(({ code, section, normalSign, defaultVisible }) => ({ code, section, normalSign, defaultVisible })),
    [
      { code: 'OTHER_CASH_INFLOW', section: 'cash_flow', normalSign: 1, defaultVisible: true },
      { code: 'DIVIDEND_PAYMENT', section: 'cash_flow', normalSign: -1, defaultVisible: true },
      { code: 'OTHER_CASH_OUTFLOW', section: 'cash_flow', normalSign: -1, defaultVisible: true },
      { code: 'OPENING_CASH_BALANCE', section: 'cash_balance', normalSign: 1, defaultVisible: true },
    ],
  );
  for (const key of [
    'net_operating_income', 'asset_net_cash_flow', 'pre_debt_cash_flow', 'after_debt_service_cash_flow',
    'net_cash_flow', 'cumulative_net_cash_flow', 'closing_cash_balance',
  ]) assert.equal(typeof FINANCE_FORMULA_EXPLANATIONS[key], 'string', `계산 설명 누락: ${key}`);
  assert.equal(FINANCE_WATERFALL_LABELS.includes('자산 순현금흐름(NCF)'), false);
  assert.deepEqual(FINANCE_WATERFALL_KEYS.slice(-5), [
    'after_debt_service_cash_flow',
    'net_cash_flow',
    'cumulative_net_cash_flow',
    'opening_cash_balance',
    'closing_cash_balance',
  ]);
});

test('FinancePanel은 입력 현금계정을 월별 계산에 연결하고 derived 잔액은 저장하지 않는다', () => {
  const source = fs.readFileSync(
    path.join(ROOT, 'src/features/logistics-data-platform/LogisticsDataPlatform.jsx'),
    'utf8',
  );
  assert.match(source, /applyFinanceCashBalances/u);
  assert.match(source, /OTHER_CASH_INFLOW/u);
  assert.match(source, /OTHER_CASH_OUTFLOW/u);
  assert.match(source, /OPENING_CASH_BALANCE/u);
  assert.doesNotMatch(source, /FINANCE_FORMULA_EXPLANATIONS\[row\.key\]/u);
  assert.match(source, /data-testid=["']finance-section-toggle["']/u);
  assert.match(source, /closing_cash_balance/u);
  const statementBuilder = source.slice(
    source.indexOf('const saveFinanceDocument'),
    source.indexOf('const toggleFinanceAccount'),
  );
  assert.doesNotMatch(
    statementBuilder,
    /cumulative_net_cash_flow|closing_cash_balance|net_cash_flow/u,
    '계산값은 statement 문서에 저장하면 안 됩니다.',
  );
});
