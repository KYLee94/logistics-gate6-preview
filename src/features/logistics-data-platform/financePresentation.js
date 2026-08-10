export const FINANCE_COMPARISON_PRESENTATION_KEYS = Object.freeze([
  'effective_gross_income',
  'total_operating_expense',
  'net_operating_income',
  'asset_net_cash_flow',
  'after_debt_service_cash_flow',
]);

function appendAccounts(rows, section, { subsectionLabel = null } = {}) {
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
      rows.push({ kind: 'custom-add', key: `${section.key}-custom-add`, section: section.key });
      rows.push({ kind: 'inactive-divider', key: `${section.key}-inactive`, label: '미사용 계정' });
    }
    rows.push({
      kind: 'account',
      key: account.account_code,
      label: account.label,
      account,
      active: account.active,
    });
  });
  if (firstInactiveIndex === -1) {
    rows.push({ kind: 'custom-add', key: `${section.key}-custom-add`, section: section.key });
  }
}

export function buildFinanceStatementPresentationRows(financeHierarchy = []) {
  const byKey = new Map((Array.isArray(financeHierarchy) ? financeHierarchy : [])
    .map((section) => [section.key, section]));
  const section = (key, label) => byKey.get(key) || { key, label, accounts: [] };
  const rows = [{ kind: 'section', key: 'operating_revenue', label: '영업수익' }];

  appendAccounts(rows, section('potential_income', '영업수익'));
  appendAccounts(rows, section('income_loss', '수입 손실'), { subsectionLabel: '수익 차감' });
  rows.push({ kind: 'metric', key: 'effective_gross_income', label: '영업수익 소계' });

  const operatingExpense = section('operating_expense', '운영비용');
  rows.push({ kind: 'section', key: operatingExpense.key, label: operatingExpense.label });
  appendAccounts(rows, operatingExpense);
  rows.push({ kind: 'metric', key: 'total_operating_expense', label: '영업비용 소계' });
  rows.push({ kind: 'metric', key: 'net_operating_income', label: '순영업소득(NOI)' });

  const belowNoi = section('below_noi', 'NOI 하단 조정');
  rows.push({ kind: 'section', key: belowNoi.key, label: belowNoi.label });
  appendAccounts(rows, belowNoi);
  rows.push({ kind: 'metric', key: 'asset_net_cash_flow', label: '자산 순현금흐름(NCF)' });

  const debtService = section('debt_service', '부채상환');
  rows.push({ kind: 'section', key: debtService.key, label: debtService.label });
  appendAccounts(rows, debtService);
  rows.push({ kind: 'metric', key: 'after_debt_service_cash_flow', label: '부채상환 후 현금흐름' });
  return rows;
}
