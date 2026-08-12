export const FINANCE_FORMULA_VERSION = 'gate6-korean-logistics-noi-v3';

const DEFAULT_VISIBLE_NOI_CODES = new Set([
  'RENT_REVENUE',
  'MANAGEMENT_FEE_INCOME',
  'UTILITIES_REIMBURSEMENT_INCOME',
  'INTEREST_INCOME',
  'MISCELLANEOUS_INCOME',
  'PM_FEE',
  'FM_FEE',
  'REPAIRS_MAINTENANCE',
  'UTILITIES',
  'BUILDING_PROPERTY_TAX',
  'LAND_PROPERTY_TAX',
  'COMPREHENSIVE_REAL_ESTATE_TAX',
  'ROAD_OCCUPANCY_FEE',
  'DEEMED_RENT_VAT',
  'OTHER_TAXES',
  'PROPERTY_INSURANCE',
  'OTHER_PROPERTY_OPEX',
  'CAPEX',
  'LEASING_COMMISSION',
  'TENANT_IMPROVEMENT',
  'AMC_FEE',
  'CUSTODY_FEE',
  'GENERAL_ADMIN_TRUSTEE_FEE',
  'INTEREST_PAID',
  'OTHER_CASH_INFLOW',
  'DIVIDEND_PAYMENT',
  'OTHER_CASH_OUTFLOW',
  'OPENING_CASH_BALANCE',
]);

export const KOREAN_LOGISTICS_NOI_ACCOUNTS = Object.freeze([
  ['potential_income', '영업수익', 'OPERATING_REVENUE', '영업수익'],
  ['potential_income', '영업수익', 'RENT_REVENUE', '임대수익'],
  ['potential_income', '영업수익', 'MANAGEMENT_FEE_INCOME', '관리비수익'],
  ['potential_income', '영업수익', 'UTILITIES_REIMBURSEMENT_INCOME', '수도광열비 회수수익'],
  ['potential_income', '영업수익', 'INTEREST_INCOME', '이자수익'],
  ['potential_income', '영업수익', 'MISCELLANEOUS_INCOME', '기타수익'],
  ['potential_income', '잠재총수입', 'POTENTIAL_BASE_RENT', '잠재 임대료'],
  ['potential_income', '잠재총수입', 'POTENTIAL_CAM_INCOME', '잠재 관리비'],
  ['potential_income', '잠재총수입', 'EXPENSE_REIMBURSEMENT_INCOME', '설비·공과금 회수수익'],
  ['potential_income', '잠재총수입', 'DEPOSIT_OPERATING_INCOME', '보증금 운용수익'],
  ['potential_income', '잠재총수입', 'PARKING_YARD_INCOME', '주차·야드 수익'],
  ['potential_income', '잠재총수입', 'ROOF_SOLAR_ANTENNA_INCOME', '지붕 태양광·안테나 수익'],
  ['potential_income', '잠재총수입', 'OTHER_PROPERTY_INCOME', '기타 부동산수익'],
  ['income_loss', '수입손실', 'VACANCY_LOSS', '공실 손실'],
  ['income_loss', '수입손실', 'RENT_FREE_CONCESSION_LOSS', '렌트프리·인센티브'],
  ['income_loss', '수입손실', 'BAD_DEBT_LOSS', '미수·대손'],
  ['income_loss', '수입손실', 'OTHER_INCOME_LOSS', '기타 수입손실'],
  ['operating_expense', '운영비용', 'PM_FEE', 'PM 수수료'],
  ['operating_expense', '운영비용', 'FM_FEE', 'FM 수수료'],
  ['operating_expense', '운영비용', 'REPAIRS_MAINTENANCE', '수선유지비'],
  ['operating_expense', '운영비용', 'UTILITIES', '수도광열비'],
  ['operating_expense', '운영비용', 'CLEANING', '청소비'],
  ['operating_expense', '운영비용', 'SECURITY', '보안경비'],
  ['operating_expense', '운영비용', 'LANDSCAPING_SNOW', '조경·제설비'],
  ['operating_expense', '운영비용', 'PARKING_YARD_MANAGEMENT', '주차·야드 관리비'],
  ['operating_expense', '운영비용', 'PROPERTY_TAX_PUBLIC_DUES', '재산세·제세공과'],
  ['operating_expense', '운영비용', 'BUILDING_PROPERTY_TAX', '건물 재산세'],
  ['operating_expense', '운영비용', 'LAND_PROPERTY_TAX', '토지 재산세'],
  ['operating_expense', '운영비용', 'COMPREHENSIVE_REAL_ESTATE_TAX', '종합부동산세'],
  ['operating_expense', '운영비용', 'ROAD_OCCUPANCY_FEE', '도로점용료'],
  ['operating_expense', '운영비용', 'DEEMED_RENT_VAT', '간주임대료 부가세'],
  ['operating_expense', '운영비용', 'OTHER_TAXES', '기타 세금'],
  ['operating_expense', '운영비용', 'PROPERTY_INSURANCE', '보험료'],
  ['operating_expense', '운영비용', 'RECURRING_LEASING_EXPENSE', '경상 임대운영비'],
  ['operating_expense', '운영비용', 'GENERAL_PROPERTY_ADMIN', '일반관리비'],
  ['operating_expense', '운영비용', 'OTHER_PROPERTY_OPEX', '기타 운영비'],
  ['below_noi', 'NOI 하단 조정', 'CAPEX', '자본적 지출'],
  ['below_noi', 'NOI 하단 조정', 'TENANT_IMPROVEMENT', '임차인 시설공사비(TI)'],
  ['below_noi', 'NOI 하단 조정', 'LEASING_COMMISSION', '임대 중개수수료(LC)'],
  ['below_noi', 'NOI 하단 조정', 'CAPITAL_RESERVE', '자본적립금'],
  ['below_noi', 'NOI 하단 조정', 'AMC_FEE', 'AMC 수수료'],
  ['below_noi', 'NOI 하단 조정', 'CUSTODY_FEE', '자산보관 수수료'],
  ['below_noi', 'NOI 하단 조정', 'GENERAL_ADMIN_TRUSTEE_FEE', '일반사무·수탁 수수료'],
  ['below_noi', 'NOI 하단 조정', 'OTHER_OWNER_COST', '기타 소유자비용'],
  ['below_noi', 'NOI 하단 조정', 'NONCASH_ADDBACK', '비현금비용 가산'],
  ['debt_service', '부채상환', 'INTEREST_PAID', '이자 지급액'],
  ['debt_service', '부채상환', 'PRINCIPAL_REPAYMENT', '원금 상환액'],
  ['debt_service', '부채상환', 'LOAN_FEE', '대출 관련 수수료'],
  ['cash_flow', '배당·기타 현금흐름', 'OTHER_CASH_INFLOW', '기타 현금유입', 1],
  ['cash_flow', '배당·기타 현금흐름', 'DIVIDEND_PAYMENT', '배당 지급', -1],
  ['cash_flow', '배당·기타 현금흐름', 'OTHER_CASH_OUTFLOW', '기타 현금유출', -1],
  ['cash_balance', '현금잔액', 'OPENING_CASH_BALANCE', '기초 현금잔액', 1],
].map(([section, sectionLabel, code, label, normalSign]) => Object.freeze({
  section,
  sectionLabel,
  code,
  label,
  normalSign: normalSign ?? (section === 'potential_income' ? 1 : -1),
  defaultVisible: DEFAULT_VISIBLE_NOI_CODES.has(code),
  materializeWhenMissing: code === 'DIVIDEND_PAYMENT',
})));

export const FINANCE_SECTION_ORDER = Object.freeze([
  'potential_income',
  'income_loss',
  'operating_expense',
  'below_noi',
  'debt_service',
  'cash_flow',
  'cash_balance',
]);

export const FINANCE_SECTION_LABELS = Object.freeze({
  potential_income: '영업수익',
  income_loss: '수입 손실',
  operating_expense: '운영비용',
  below_noi: 'NOI 하단 조정',
  debt_service: '부채상환',
  cash_flow: '배당·기타 현금흐름',
  cash_balance: '현금잔액',
});

function financeAccountDisplayLabel(account, definition) {
  return [definition?.label, account?.name, account?.name_ko, account?.account_name]
    .map((value) => String(value || '').trim())
    .find((value) => value && !/^DOCUMENT:/iu.test(value)) || '사용자 계정';
}

export function buildFinanceAccountHierarchy(accounts = [], selectedAccountCodes = new Set()) {
  const selected = selectedAccountCodes instanceof Set
    ? selectedAccountCodes
    : new Set(selectedAccountCodes || []);
  const definitionsByCode = new Map(
    KOREAN_LOGISTICS_NOI_ACCOUNTS.map((definition) => [definition.code, definition]),
  );

  return FINANCE_SECTION_ORDER.map((section) => {
    const sectionAccounts = accounts
      .filter((account) => (
        account.statement_section || definitionsByCode.get(account.account_code)?.section
      ) === section)
      .map((account) => {
        const definition = definitionsByCode.get(account.account_code);
        return {
          ...account,
          label: financeAccountDisplayLabel(account, definition),
          is_custom: account.is_custom === true || !definition,
          active: selected.has(account.account_code),
        };
      })
      .sort((left, right) => (
        Number(left.display_order || 0) - Number(right.display_order || 0)
        || left.label.localeCompare(right.label, 'ko')
      ));
    return {
      key: section,
      label: FINANCE_SECTION_LABELS[section],
      accounts: [
        ...sectionAccounts.filter((account) => account.active),
        ...sectionAccounts.filter((account) => !account.active),
      ],
    };
  });
}

export function filterFinanceCalculationAccounts(accounts = [], selectedAccountCodes = new Set()) {
  const selected = selectedAccountCodes instanceof Set
    ? selectedAccountCodes
    : new Set(selectedAccountCodes || []);
  const selectedAccounts = accounts.filter((account) => selected.has(account.account_code));
  const canonicalRevenueCodes = new Set([
    'RENT_REVENUE',
    'MANAGEMENT_FEE_INCOME',
    'UTILITIES_REIMBURSEMENT_INCOME',
    'INTEREST_INCOME',
    'MISCELLANEOUS_INCOME',
  ]);
  const hasCanonicalRevenue = selectedAccounts.some((account) => (
    canonicalRevenueCodes.has(account.account_code)
  ));
  if (!hasCanonicalRevenue) return selectedAccounts;
  const legacyRevenueCodes = new Set([
    'OPERATING_REVENUE', 'POTENTIAL_BASE_RENT', 'POTENTIAL_CAM_INCOME',
    'EXPENSE_REIMBURSEMENT_INCOME', 'DEPOSIT_OPERATING_INCOME',
    'PARKING_YARD_INCOME', 'ROOF_SOLAR_ANTENNA_INCOME', 'OTHER_PROPERTY_INCOME',
  ]);
  return selectedAccounts.filter((account) => (
    !legacyRevenueCodes.has(account.account_code)
  ));
}

export function calculateKoreanLogisticsNoi(input = {}) {
  const potentialGrossIncome = Number(input.potential_income) || 0;
  const incomeLoss = Math.abs(Number(input.income_loss) || 0);
  const operatingExpense = Math.abs(Number(input.operating_expense) || 0);
  const belowNoiCashCost = Math.abs(Number(input.below_noi_cash_cost) || 0);
  const noncashAddback = Number(input.noncash_addback) || 0;
  const debtService = Math.abs(Number(input.debt_service) || 0);
  const dividendPayment = Math.abs(Number(input.dividend_payment) || 0);
  const otherCashInflow = Number(input.other_cash_inflow) || 0;
  const otherCashOutflow = Math.abs(Number(input.other_cash_outflow) || 0);
  const effectiveGrossIncome = potentialGrossIncome - incomeLoss;
  const netOperatingIncome = effectiveGrossIncome - operatingExpense;
  const assetNetCashFlow = netOperatingIncome - belowNoiCashCost + noncashAddback;
  const afterDebtServiceCashFlow = assetNetCashFlow - debtService;
  return {
    potential_gross_income: potentialGrossIncome,
    total_income_loss: incomeLoss,
    effective_gross_income: effectiveGrossIncome,
    total_operating_expense: operatingExpense,
    net_operating_income: netOperatingIncome,
    asset_net_cash_flow: assetNetCashFlow,
    pre_debt_cash_flow: assetNetCashFlow,
    after_debt_service_cash_flow: afterDebtServiceCashFlow,
    dividend_payment: dividendPayment,
    other_cash_inflow: otherCashInflow,
    other_cash_outflow: otherCashOutflow,
    net_cash_flow: afterDebtServiceCashFlow - dividendPayment + otherCashInflow - otherCashOutflow,
  };
}

export function applyFinanceCashBalances(series = []) {
  let cumulativeNetCashFlow = 0;
  let previousClosingBalance = null;
  return (Array.isArray(series) ? series : []).map((row) => {
    const netCashFlow = Number(row?.net_cash_flow) || 0;
    cumulativeNetCashFlow += netCashFlow;
    const explicitOpening = row?.opening_cash_balance === ''
      || row?.opening_cash_balance === null
      || row?.opening_cash_balance === undefined
      ? null
      : Number(row.opening_cash_balance);
    const openingCashBalance = Number.isFinite(explicitOpening)
      ? explicitOpening
      : previousClosingBalance;
    const closingCashBalance = openingCashBalance == null
      ? null
      : openingCashBalance + netCashFlow;
    previousClosingBalance = closingCashBalance;
    return {
      ...row,
      opening_cash_balance: openingCashBalance,
      cumulative_net_cash_flow: cumulativeNetCashFlow,
      closing_cash_balance: closingCashBalance,
    };
  });
}

export const FINANCE_FORMULA_EXPLANATIONS = Object.freeze({
  effective_gross_income: '임대수익·관리비수익·수도광열비 회수수익·이자수익·기타수익을 합산합니다.',
  total_operating_expense: '선택한 영업비용 계정의 금액을 합산합니다.',
  net_operating_income: '영업수익에서 영업비용을 차감합니다.',
  asset_net_cash_flow: '순영업소득에서 NOI 하단 현금비용을 차감하고 비현금비용을 가산합니다.',
  pre_debt_cash_flow: '순영업소득에서 NOI 하단 현금비용을 차감하고 비현금비용을 가산합니다.',
  after_debt_service_cash_flow: '부채상환 전 현금흐름에서 이자·원금·대출수수료를 차감합니다.',
  net_cash_flow: '부채상환 후 현금흐름에서 배당 지급과 기타 현금유출을 차감하고 기타 현금유입을 더합니다.',
  cumulative_net_cash_flow: '조회 범위 첫 월부터 월 순현금흐름을 누적합니다.',
  closing_cash_balance: '해당 월 기초 현금잔액에 월 순현금흐름을 더합니다. 기초잔액이 없으면 표시하지 않습니다.',
});

export const FINANCE_WATERFALL_LABELS = Object.freeze([
  '영업수익', '운영비용', '순영업소득(NOI)', '부채상환 전 현금흐름',
  '부채상환 후 현금흐름', '월 순현금흐름', '누적 순현금흐름', '기초 현금잔액', '기말 현금잔액',
]);

export const FINANCE_WATERFALL_KEYS = Object.freeze([
  'effective_gross_income', 'total_operating_expense', 'net_operating_income', 'pre_debt_cash_flow',
  'after_debt_service_cash_flow', 'net_cash_flow', 'cumulative_net_cash_flow',
  'opening_cash_balance', 'closing_cash_balance',
]);
