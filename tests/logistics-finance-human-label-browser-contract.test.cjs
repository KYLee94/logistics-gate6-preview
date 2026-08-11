const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { pathToFileURL } = require('node:url');

const ROOT = path.resolve(__dirname, '..');
const FORMULAS_PATH = path.join(ROOT, 'src/features/logistics-data-platform/formulas.js');
const PRESENTATION_PATH = path.join(ROOT, 'src/features/logistics-data-platform/financePresentation.js');
const BROWSER_QA_PATH = path.join(ROOT, 'scripts/qa/logistics-data-platform-deeplink-browser.cjs');
const RELEASE_GATE_PATH = path.join(ROOT, 'scripts/qa/logistics-data-platform-release-gate.cjs');
const MIGRATION_DIRECTORY = path.join(ROOT, 'supabase/migrations');
const HIERARCHY_MARKER = 'LOGISTICS_FINANCE_CANONICAL_HIERARCHY_V2';

async function financeModules() {
  const nonce = `${Date.now()}-${Math.random()}`;
  return {
    formulas: await import(`${pathToFileURL(FORMULAS_PATH).href}?human-labels=${nonce}`),
    presentation: await import(`${pathToFileURL(PRESENTATION_PATH).href}?human-labels=${nonce}`),
  };
}

test('finance statement exposes five revenue children, a derived subtotal, and Korean account names', async () => {
  const { formulas, presentation } = await financeModules();
  const revenueChildCodes = [
    'RENT_REVENUE',
    'MANAGEMENT_FEE_INCOME',
    'UTILITIES_REIMBURSEMENT_INCOME',
    'INTEREST_INCOME',
    'MISCELLANEOUS_INCOME',
  ];
  const standardCodes = [
    ...revenueChildCodes,
    'PM_FEE', 'FM_FEE', 'REPAIRS_MAINTENANCE', 'UTILITIES',
    'PROPERTY_TAX_PUBLIC_DUES', 'PROPERTY_INSURANCE', 'GENERAL_PROPERTY_ADMIN', 'OTHER_PROPERTY_OPEX',
    'CAPEX', 'TENANT_IMPROVEMENT', 'LEASING_COMMISSION', 'CAPITAL_RESERVE',
    'AMC_FEE', 'CUSTODY_FEE', 'GENERAL_ADMIN_TRUSTEE_FEE', 'OTHER_OWNER_COST', 'NONCASH_ADDBACK',
    'INTEREST_PAID', 'PRINCIPAL_REPAYMENT', 'LOAN_FEE',
    'OTHER_CASH_INFLOW', 'OTHER_CASH_OUTFLOW', 'OPENING_CASH_BALANCE',
  ];
  const hierarchy = formulas.buildFinanceAccountHierarchy(
    standardCodes.map((accountCode, index) => ({
      account_code: accountCode,
      name: `DOCUMENT:${accountCode}`,
      statement_section: revenueChildCodes.includes(accountCode) ? 'potential_income' : undefined,
      display_order: index + 1,
    })),
    new Set(standardCodes),
  );
  const rows = presentation.buildFinanceStatementPresentationRows(hierarchy);
  const visibleRows = rows.filter((row) => ['section', 'account', 'metric'].includes(row.kind));
  const visibleLabels = visibleRows.map((row) => String(row.label || ''));

  assert.equal(visibleLabels.filter((label) => label.includes('DOCUMENT:')).length, 0);
  assert.equal(visibleRows.filter((row) => row.key === 'OPERATING_REVENUE').length, 0);
  assert.deepEqual(
    visibleRows
      .filter((row) => row.kind === 'account' && revenueChildCodes.includes(row.key))
      .map((row) => row.key),
    revenueChildCodes,
  );

  const indexOf = (key) => visibleRows.findIndex((row) => row.key === key);
  const requiredOrder = [
    'operating_revenue',
    ...revenueChildCodes,
    'effective_gross_income',
    'operating_expense',
    'PM_FEE',
    'total_operating_expense',
    'net_operating_income',
    'below_noi',
    'CAPEX',
    'asset_net_cash_flow',
    'debt_service',
    'INTEREST_PAID',
    'PRINCIPAL_REPAYMENT',
    'LOAN_FEE',
    'after_debt_service_cash_flow',
  ];
  requiredOrder.forEach((key) => assert.notEqual(indexOf(key), -1, `missing visible finance row: ${key}`));
  for (let index = 1; index < requiredOrder.length; index += 1) {
    assert.ok(
      indexOf(requiredOrder[index - 1]) < indexOf(requiredOrder[index]),
      `finance hierarchy order mismatch: ${requiredOrder[index - 1]} -> ${requiredOrder[index]}`,
    );
  }

  const labelsByKey = Object.fromEntries(visibleRows.map((row) => [row.key, row.label]));
  assert.equal(labelsByKey.effective_gross_income, '영업수익 소계');
  assert.equal(labelsByKey.operating_revenue, '영업수익');
  assert.equal(labelsByKey.total_operating_expense, '운영비용 소계');
  assert.equal(labelsByKey.operating_expense, '운영비용');
  assert.equal(labelsByKey.net_operating_income, '순영업소득(NOI)');
  assert.equal(labelsByKey.asset_net_cash_flow, '부채상환 전 현금흐름');
  assert.equal(labelsByKey.after_debt_service_cash_flow, '부채상환 후 현금흐름');
  for (const accountCode of revenueChildCodes) {
    assert.match(labelsByKey[accountCode], /[가-힣]/u, `${accountCode} must have a Korean label`);
    assert.doesNotMatch(labelsByKey[accountCode], /DOCUMENT:/u);
  }
  assert.equal(visibleLabels.includes('영업비용 소계'), false);
  for (const [key, label] of Object.entries({
    PM_FEE: 'PM 수수료',
    CAPEX: '자본적 지출',
    INTEREST_PAID: '이자 지급액',
    PRINCIPAL_REPAYMENT: '원금 상환액',
    LOAN_FEE: '대출 관련 수수료',
    OTHER_CASH_INFLOW: '기타 현금유입',
    OTHER_CASH_OUTFLOW: '기타 현금유출',
    OPENING_CASH_BALANCE: '기초 현금잔액',
  })) assert.equal(labelsByKey[key], label, `${key} must have a human-readable Korean label`);
});

test('public income-expense browser QA records deterministic DOM label evidence without mutation', () => {
  const source = fs.readFileSync(BROWSER_QA_PATH, 'utf8');
  for (const marker of [
    'finance_statement_ui',
    'internal_document_label_count',
    'inconsistent_expense_subtotal_count',
    'legacy_operating_revenue_editable_count',
    'operating_revenue_child_editable_count',
    'missing_revenue_child_codes',
    'visible_finance_row_labels',
    'finance-statement-table',
  ]) assert.match(source, new RegExp(marker, 'u'), `missing browser evidence marker: ${marker}`);
  assert.match(source, /internal_document_label_count\s*===\s*0/u);
  assert.match(source, /inconsistent_expense_subtotal_count\s*===\s*0/u);
  assert.match(source, /legacy_operating_revenue_editable_count\s*===\s*0/u);
  assert.match(source, /operating_revenue_child_editable_count\s*===\s*5/u);
  const financeProbe = source.slice(
    source.indexOf('let financeStatementUi'),
    source.indexOf('let financeTrendHover'),
  );
  assert.ok(financeProbe.length > 0);
  assert.doesNotMatch(financeProbe, /waitForTimeout\(/u);
});

test('database migration persists exactly five revenue children and forbids legacy operating revenue', () => {
  const migrationPath = fs.readdirSync(MIGRATION_DIRECTORY)
    .filter((name) => name.endsWith('.sql'))
    .sort()
    .map((name) => path.join(MIGRATION_DIRECTORY, name))
    .find((candidate) => fs.readFileSync(candidate, 'utf8').includes(HIERARCHY_MARKER));
  assert.ok(migrationPath, `${HIERARCHY_MARKER} migration is required`);
  const sql = fs.readFileSync(migrationPath, 'utf8');
  for (const accountCode of [
    'RENT_REVENUE',
    'MANAGEMENT_FEE_INCOME',
    'UTILITIES_REIMBURSEMENT_INCOME',
    'INTEREST_INCOME',
    'MISCELLANEOUS_INCOME',
  ]) assert.match(sql, new RegExp(`'${accountCode}'`, 'u'));
  for (const marker of [
    'FINANCE_CANONICAL_HIERARCHY_DOCUMENT_COUNT_MISMATCH',
    'FINANCE_CANONICAL_HIERARCHY_SOURCE_SIGNATURE_MISMATCH',
    'FINANCE_CANONICAL_HIERARCHY_AMOUNT_DATA_PRESENT',
    'FINANCE_CANONICAL_HIERARCHY_PERIOD_DATA_PRESENT',
    'FINANCE_CANONICAL_HIERARCHY_CUSTOM_CHANGED',
    'FINANCE_CANONICAL_HIERARCHY_READBACK_FAILED',
    'FINANCE_DOCUMENT_ACCOUNT_CODE_FORBIDDEN',
    'FINANCE_CANONICAL_REVENUE_REQUIRED',
  ]) assert.match(sql, new RegExp(marker, 'u'));
  assert.match(sql, /'OPERATING_REVENUE'/u);
  assert.doesNotMatch(sql, /create\s+(?:unlogged\s+)?table\s+logistics_core\./iu);
  assert.doesNotMatch(sql, /alter\s+table\s+logistics_core\./iu);
});

test('release gate retains the finance human-label browser contract', () => {
  const source = fs.readFileSync(RELEASE_GATE_PATH, 'utf8');
  assert.match(source, /finance-human-label-browser-contract/u);
  assert.match(source, /tests\/logistics-finance-human-label-browser-contract\.test\.cjs/u);
});
