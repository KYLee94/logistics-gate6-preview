'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { pathToFileURL } = require('node:url');

const ROOT = path.resolve(__dirname, '..');
const canonicalWriterSql = fs.readFileSync(
  path.join(ROOT, 'supabase/migrations/20260811042736_logistics_finance_canonical_hierarchy_v2.sql'),
  'utf8',
);
const platformSource = fs.readFileSync(
  path.join(ROOT, 'src/features/logistics-data-platform/LogisticsDataPlatform.jsx'),
  'utf8',
);

async function formulas() {
  const target = path.join(ROOT, 'src/features/logistics-data-platform/formulas.js');
  return import(`${pathToFileURL(target).href}?dividend=${Date.now()}-${Math.random()}`);
}

async function documentContract() {
  const target = path.join(ROOT, 'src/features/logistics-data-platform/documentContract.js');
  return import(`${pathToFileURL(target).href}?dividend-document=${Date.now()}-${Math.random()}`);
}

test('배당 지급은 NOI와 부채상환 후 현금흐름을 바꾸지 않고 월 순현금흐름에서 차감한다', async () => {
  const { calculateKoreanLogisticsNoi } = await formulas();
  const result = calculateKoreanLogisticsNoi({
    potential_income: 1000,
    operating_expense: 200,
    below_noi_cash_cost: 50,
    noncash_addback: 10,
    debt_service: 100,
    dividend_payment: 75,
    other_cash_inflow: 20,
    other_cash_outflow: 5,
  });
  assert.equal(result.net_operating_income, 800);
  assert.equal(result.after_debt_service_cash_flow, 660);
  assert.equal(result.dividend_payment, 75);
  assert.equal(result.net_cash_flow, 600);
});

test('배당 지급은 배당·기타 현금흐름의 기본 선택 차감 계정으로 표시된다', async () => {
  const {
    FINANCE_SECTION_LABELS,
    KOREAN_LOGISTICS_NOI_ACCOUNTS,
  } = await formulas();
  const account = KOREAN_LOGISTICS_NOI_ACCOUNTS.find(({ code }) => code === 'DIVIDEND_PAYMENT');
  assert.deepEqual(
    account && {
      section: account.section,
      label: account.label,
      normalSign: account.normalSign,
      defaultVisible: account.defaultVisible,
      materializeWhenMissing: account.materializeWhenMissing,
    },
    {
      section: 'cash_flow',
      label: '배당 지급',
      normalSign: -1,
      defaultVisible: true,
      materializeWhenMissing: true,
    },
  );
  assert.equal(FINANCE_SECTION_LABELS.cash_flow, '배당·기타 현금흐름');
  assert.match(platformSource, /dividend_payment:\s*0/u);
  assert.match(platformSource, /account\.account_code === "DIVIDEND_PAYMENT"/u);
  assert.match(platformSource, /totals\.dividend_payment \+= raw/u);
});

test('기존 문서를 읽으면 배당 행만 안전하게 보완하고 저장 문서에 canonical metadata를 유지한다', async () => {
  const { KOREAN_LOGISTICS_NOI_ACCOUNTS } = await formulas();
  const {
    buildIncomeExpenseStatement,
    projectIncomeExpenseStatement,
  } = await documentContract();
  const source = {
    periods: [],
    potential_income: [], income_loss: [], operating_expense: [], below_noi: [], debt_service: [],
    cash_flow: [
      { account_code: 'OTHER_CASH_INFLOW', statement_section: 'cash_flow', label: '기타 현금유입', normal_sign: 1, selected: true, amounts: {} },
      { account_code: 'OTHER_CASH_OUTFLOW', statement_section: 'cash_flow', label: '기타 현금유출', normal_sign: -1, selected: true, amounts: {} },
    ],
    cash_balance: [],
  };
  const projection = projectIncomeExpenseStatement(source, KOREAN_LOGISTICS_NOI_ACCOUNTS);
  assert.deepEqual(
    projection.accounts.filter(({ statement_section }) => statement_section === 'cash_flow')
      .map(({ account_code }) => account_code),
    ['OTHER_CASH_INFLOW', 'OTHER_CASH_OUTFLOW', 'DIVIDEND_PAYMENT'],
  );
  assert.ok(projection.selectedAccountCodes.includes('DIVIDEND_PAYMENT'));
  const saved = buildIncomeExpenseStatement({
    accounts: projection.accounts,
    entries: [{ account_code: 'DIVIDEND_PAYMENT', month: '2026-08', amount: 75 }],
    selectedAccountCodes: projection.selectedAccountCodes,
  });
  assert.deepEqual(saved.cash_flow.at(-1), {
    account_code: 'DIVIDEND_PAYMENT',
    statement_section: 'cash_flow',
    label: '배당 지급',
    normal_sign: -1,
    selected: true,
    amounts: { '2026-08': 75 },
  });
});

test('기존 DB writer는 명시한 배당 코드와 metadata를 custom-safe 경로로 손실 없이 보존한다', () => {
  assert.match(canonicalWriterSql, /v_explicit_code\s*:=\s*nullif\(btrim\(v_item->>'account_code'\),\s*''\)/iu);
  assert.match(canonicalWriterSql, /'account_code',\s*coalesce\(v_explicit_code,\s*'CUSTOM:'/iu);
  assert.match(canonicalWriterSql, /'statement_section',\s*p_section[\s\S]*?'label',\s*v_label/iu);
  assert.match(canonicalWriterSql, /'normal_sign',[\s\S]*?'selected',[\s\S]*?'amounts'/iu);
  assert.match(canonicalWriterSql, /FINANCE_READBACK_MISMATCH/u);
});
