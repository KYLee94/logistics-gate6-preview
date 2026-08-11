export const FINANCE_COMPARISON_PRESENTATION_KEYS = Object.freeze([
  'effective_gross_income',
  'total_operating_expense',
  'net_operating_income',
  'after_debt_service_cash_flow',
  'net_cash_flow',
  'cumulative_net_cash_flow',
  'closing_cash_balance',
]);

const FINANCE_COMPARISON_ENDING_KEYS = new Set([
  'cumulative_net_cash_flow',
  'closing_cash_balance',
]);

export function financeComparisonValue(series = [], key) {
  const rows = Array.isArray(series) ? series : [];
  if (FINANCE_COMPARISON_ENDING_KEYS.has(key)) {
    return rows.length ? rows.at(-1)?.[key] ?? null : null;
  }
  return rows.reduce((sum, row) => sum + Number(row?.[key] || 0), 0);
}

function appendAccounts(rows, section, { subsectionLabel = null, allowCustom = true } = {}) {
  if (subsectionLabel) {
    rows.push({
      kind: 'subsection',
      key: `${section.key}-subsection`,
      label: subsectionLabel,
      section: section.key,
    });
  }
  const accounts = Array.isArray(section.accounts) ? section.accounts : [];
  const firstInactiveIndex = accounts.findIndex((account) => !account.active);
  accounts.forEach((account, index) => {
    if (index === firstInactiveIndex) {
      if (allowCustom) rows.push({ kind: 'custom-add', key: `${section.key}-custom-add`, section: section.key });
      rows.push({
        kind: 'inactive-divider',
        key: `${section.key}-inactive`,
        label: '미사용 계정',
        section: section.key,
      });
    }
    rows.push({
      kind: 'account',
      key: account.account_code,
      label: account.label,
      account,
      active: account.active,
      section: section.key,
    });
  });
  if (allowCustom && firstInactiveIndex === -1) {
    rows.push({ kind: 'custom-add', key: `${section.key}-custom-add`, section: section.key });
  }
}

const FINANCE_STATEMENT_DETAIL_KINDS = new Set([
  'subsection',
  'inactive-divider',
  'custom-add',
  'account',
]);

export function isFinanceStatementDetailRow(row) {
  return Boolean(row?.section) && FINANCE_STATEMENT_DETAIL_KINDS.has(row?.kind);
}

export function financeStatementRowId(row, index) {
  return isFinanceStatementDetailRow(row)
    ? `finance-section-${row.section}-row-${index}`
    : undefined;
}

export function financeSectionControlIds(rows = [], sectionKey) {
  return (Array.isArray(rows) ? rows : [])
    .map((row, index) => ({ row, id: financeStatementRowId(row, index) }))
    .filter(({ row, id }) => id && row.section === sectionKey)
    .map(({ id }) => id);
}

export function buildFinanceStatementPresentationRows(financeHierarchy = []) {
  const byKey = new Map((Array.isArray(financeHierarchy) ? financeHierarchy : [])
    .map((section) => [section.key, section]));
  const section = (key, label) => byKey.get(key) || { key, label, accounts: [] };
  const rows = [{
    kind: 'section',
    key: 'operating_revenue',
    sectionKey: 'potential_income',
    label: '영업수익',
  }];
  const potentialIncome = section('potential_income', '영업수익');
  const canonicalRevenueCodes = new Set([
    'RENT_REVENUE',
    'MANAGEMENT_FEE_INCOME',
    'UTILITIES_REIMBURSEMENT_INCOME',
    'INTEREST_INCOME',
    'MISCELLANEOUS_INCOME',
  ]);
  const canonicalRevenueAccounts = potentialIncome.accounts.filter((account) => (
    canonicalRevenueCodes.has(account.account_code) || account.is_custom === true
  ));
  const legacyAggregate = potentialIncome.accounts.find((account) => (
    account.account_code === 'OPERATING_REVENUE'
  ));
  appendAccounts(rows, {
    ...potentialIncome,
    accounts: canonicalRevenueAccounts.length
      ? canonicalRevenueAccounts
      : legacyAggregate ? [legacyAggregate] : [],
  });
  rows.push({ kind: 'metric', key: 'effective_gross_income', label: '영업수익 소계' });

  const operatingExpense = section('operating_expense', '운영비용');
  rows.push({ kind: 'section', key: operatingExpense.key, sectionKey: operatingExpense.key, label: operatingExpense.label });
  appendAccounts(rows, operatingExpense);
  rows.push({ kind: 'metric', key: 'total_operating_expense', label: '운영비용 소계' });
  rows.push({ kind: 'metric', key: 'net_operating_income', label: '순영업소득(NOI)' });

  const belowNoi = section('below_noi', 'NOI 하단 조정');
  rows.push({ kind: 'section', key: belowNoi.key, sectionKey: belowNoi.key, label: belowNoi.label });
  appendAccounts(rows, belowNoi);
  rows.push({ kind: 'metric', key: 'asset_net_cash_flow', label: '부채상환 전 현금흐름' });

  const debtService = section('debt_service', '부채상환');
  rows.push({ kind: 'section', key: debtService.key, sectionKey: debtService.key, label: debtService.label });
  appendAccounts(rows, debtService);
  rows.push({ kind: 'metric', key: 'after_debt_service_cash_flow', label: '부채상환 후 현금흐름' });

  const cashFlow = section('cash_flow', '기타 현금흐름');
  rows.push({ kind: 'section', key: cashFlow.key, sectionKey: cashFlow.key, label: cashFlow.label });
  appendAccounts(rows, cashFlow, { allowCustom: false });
  rows.push({ kind: 'metric', key: 'net_cash_flow', label: '월 순현금흐름' });
  rows.push({ kind: 'metric', key: 'cumulative_net_cash_flow', label: '누적 순현금흐름' });

  const cashBalance = section('cash_balance', '현금잔액');
  rows.push({ kind: 'section', key: cashBalance.key, sectionKey: cashBalance.key, label: cashBalance.label });
  appendAccounts(rows, cashBalance, { allowCustom: false });
  rows.push({ kind: 'metric', key: 'closing_cash_balance', label: '기말 현금잔액' });
  return rows;
}
