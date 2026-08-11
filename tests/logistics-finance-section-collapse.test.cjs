const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { pathToFileURL } = require('node:url');

const featureDir = path.resolve(__dirname, '../src/features/logistics-data-platform');
const platformSource = fs.readFileSync(path.join(featureDir, 'LogisticsDataPlatform.jsx'), 'utf8');

test('finance presentation assigns every editable detail row to its independent section', async () => {
  const {
    buildFinanceStatementPresentationRows,
    financeSectionControlIds,
    isFinanceStatementDetailRow,
  } = await import(pathToFileURL(path.join(featureDir, 'financePresentation.js')).href);
  const hierarchy = [
    { key: 'potential_income', label: '영업수익', accounts: [{ account_code: 'RENT_REVENUE', label: '임대수익', active: true }] },
    { key: 'operating_expense', label: '운영비용', accounts: [{ account_code: 'PM_FEE', label: 'PM 수수료', active: true }] },
    { key: 'below_noi', label: 'NOI 하단 조정', accounts: [] },
    { key: 'debt_service', label: '부채상환', accounts: [] },
    { key: 'cash_flow', label: '기타 현금흐름', accounts: [] },
    { key: 'cash_balance', label: '현금잔액', accounts: [] },
  ];
  const rows = buildFinanceStatementPresentationRows(hierarchy);
  const sectionKeys = rows.filter((row) => row.kind === 'section').map((row) => row.sectionKey);

  assert.deepEqual(sectionKeys, [
    'potential_income',
    'operating_expense',
    'below_noi',
    'debt_service',
    'cash_flow',
    'cash_balance',
  ]);
  assert.ok(rows.filter(isFinanceStatementDetailRow).every((row) => row.section));
  assert.ok(financeSectionControlIds(rows, 'potential_income').length > 0);
  assert.ok(financeSectionControlIds(rows, 'operating_expense').length > 0);
  assert.equal(rows.filter((row) => row.kind === 'metric').some(isFinanceStatementDetailRow), false);
  assert.deepEqual(rows.filter((row) => row.kind === 'metric').map((row) => row.key), [
    'effective_gross_income',
    'total_operating_expense',
    'net_operating_income',
    'asset_net_cash_flow',
    'after_debt_service_cash_flow',
    'net_cash_flow',
    'cumulative_net_cash_flow',
    'closing_cash_balance',
  ], 'all subtotal and derived metric rows must remain outside collapsible detail rows');
});

test('finance sections are expanded by default and hide only detail rows when toggled', () => {
  assert.match(platformSource, /const \[collapsedFinanceSections, setCollapsedFinanceSections\] = useState\(\(\) => new Set\(\)\)/u);
  assert.match(platformSource, /aria-expanded=\{!collapsedFinanceSections\.has\(row\.sectionKey\)\}/u);
  assert.match(platformSource, /aria-controls=\{financeSectionControlIds\(rows, row\.sectionKey\)\.join\(["'] ["']\)\}/u);
  assert.match(platformSource, /onClick=\{\(\) => toggleFinanceSection\(row\.sectionKey\)\}/u);
  assert.match(
    platformSource,
    /isFinanceStatementDetailRow\(row\)\s*&&\s*collapsedFinanceSections\.has\(row\.section\)[\s\S]{0,40}\?\s*true\s*:\s*undefined/u,
  );
  assert.match(platformSource, /row\.kind === ["']section["'][\s\S]*?aria-hidden=["']true["']/u);
  assert.match(
    platformSource,
    /aria-hidden=["']true["'] className=["'][^"']*h-5[^"']*w-5[^"']*text-\[15px\][^"']*["']/u,
    'section disclosure triangle must be large enough to scan and click',
  );
});

test('formula info icons and tooltips are absent from the finance statement', () => {
  const statementSource = platformSource.slice(
    platformSource.indexOf('const rows = buildFinanceStatementPresentationRows'),
    platformSource.indexOf('function LogisticsDataPlatform'),
  );

  assert.doesNotMatch(statementSource, /FINANCE_FORMULA_EXPLANATIONS\[row\.key\]/u);
  assert.doesNotMatch(statementSource, /role=["']tooltip["']/u);
  assert.doesNotMatch(statementSource, /계산식 설명/u);
});

test('finance section disclosure changes presentation only and leaves the Supabase payload immutable', async () => {
  const documentModule = await import(
    `${pathToFileURL(path.join(featureDir, 'documentContract.js')).href}?collapse-payload=${Date.now()}-${Math.random()}`
  );
  const presentationModule = await import(
    `${pathToFileURL(path.join(featureDir, 'financePresentation.js')).href}?collapse-presentation=${Date.now()}-${Math.random()}`
  );
  const statement = {
    periods: ['2026-08'],
    potential_income: [{ account_code: 'RENT_REVENUE', statement_section: 'potential_income', label: '임대수익', normal_sign: 1, selected: true, amounts: { '2026-08': 3.5 } }],
    income_loss: [],
    operating_expense: [{ account_code: 'PM_FEE', statement_section: 'operating_expense', label: 'PM 수수료', normal_sign: -1, selected: true, amounts: { '2026-08': 1 } }],
    below_noi: [],
    debt_service: [],
    cash_flow: [],
    cash_balance: [],
  };
  const before = documentModule.buildIncomeExpenseDocumentPayload(statement);
  const rows = presentationModule.buildFinanceStatementPresentationRows([
    { key: 'potential_income', label: '영업수익', accounts: statement.potential_income.map((row) => ({ ...row, active: row.selected })) },
    { key: 'operating_expense', label: '운영비용', accounts: statement.operating_expense.map((row) => ({ ...row, active: row.selected })) },
  ]);
  presentationModule.financeSectionControlIds(rows, 'potential_income');
  const after = documentModule.buildIncomeExpenseDocumentPayload(statement);

  assert.deepEqual(after, before);
});
