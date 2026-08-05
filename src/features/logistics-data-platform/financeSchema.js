const MONTH_PATTERN = /^\d{4}-\d{2}$/u;

export function emptyManualFinanceEntry({ draftId, month, accountingBasis = 'accrual' }) {
  return {
    _draft_id: draftId,
    operation: 'create',
    month,
    account_code: '',
    amount: '',
    scenario: 'actual',
    accounting_basis: accountingBasis,
    reason: '',
  };
}

const SERVER_OWNED_FINANCE_FIELDS = new Set([
  '_draft_id',
  'source_kind',
  'source_ref',
  'source_line_key',
  'data_status',
]);

export function financeEntryForSave(row) {
  return {
    ...Object.fromEntries(Object.entries(row).filter(([key]) => !SERVER_OWNED_FINANCE_FIELDS.has(key))),
    scenario: 'actual',
  };
}

export function validateManualFinanceEntries(rows, accounts = []) {
  const errors = [];
  const accountByCode = new Map(accounts.map((account) => [account.account_code, account]));
  rows.forEach((row, index) => {
    if (row.operation === 'delete') return;
    const label = `${index + 1}행`;
    if (!MONTH_PATTERN.test(String(row.month || ''))) errors.push(`${label}: 월을 선택해 주세요.`);
    if (!String(row.account_code || '').trim()) errors.push(`${label}: 계정을 선택해 주세요.`);
    const account = accountByCode.get(row.account_code);
    if (account && account.manual_entry_allowed === false) errors.push(`${label}: 이 계정은 기존 원장 또는 승인된 계산에서만 가져올 수 있습니다.`);
    if (row.amount === '' || row.amount === null || row.amount === undefined) {
      errors.push(`${label}: 금액을 입력해 주세요. 입력하지 않은 값과 0은 구분됩니다.`);
    } else if (!Number.isFinite(Number(String(row.amount).replaceAll(',', '')))) {
      errors.push(`${label}: 금액은 숫자여야 합니다.`);
    }
    if (row.scenario !== 'actual') errors.push(`${label}: 1단계에서는 실적만 입력할 수 있습니다.`);
    if (!['accrual', 'cash'].includes(row.accounting_basis)) errors.push(`${label}: 발생 또는 현금 기준을 선택해 주세요.`);
    if (!String(row.reason || '').trim()) errors.push(`${label}: 입력 근거 또는 메모를 작성해 주세요.`);
  });
  return errors;
}
