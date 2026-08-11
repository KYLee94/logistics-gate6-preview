export const FINANCE_FORMULA_VERSION = 'gate6-korean-logistics-noi-v2';

const DEFAULT_VISIBLE_NOI_CODES = new Set([
  'OPERATING_REVENUE',
  'PM_FEE',
  'FM_FEE',
  'REPAIRS_MAINTENANCE',
  'UTILITIES',
  'PROPERTY_TAX_PUBLIC_DUES',
  'PROPERTY_INSURANCE',
  'GENERAL_PROPERTY_ADMIN',
  'OTHER_PROPERTY_OPEX',
  'CLEANING',
  'SECURITY',
  'LANDSCAPING_SNOW',
  'CAPEX',
  'LEASING_COMMISSION',
  'TENANT_IMPROVEMENT',
  'AMC_FEE',
  'CUSTODY_FEE',
  'GENERAL_ADMIN_TRUSTEE_FEE',
  'INTEREST_PAID',
]);

export const KOREAN_LOGISTICS_NOI_ACCOUNTS = Object.freeze([
  ['potential_income', '영업수익', 'OPERATING_REVENUE', '영업수익'],
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
  ['operating_expense', '운영비용', 'PROPERTY_INSURANCE', '보험료'],
  ['operating_expense', '운영비용', 'RECURRING_LEASING_EXPENSE', '경상 임대운영비'],
  ['operating_expense', '운영비용', 'GENERAL_PROPERTY_ADMIN', '일반관리비'],
  ['operating_expense', '운영비용', 'OTHER_PROPERTY_OPEX', '기타 운영경비'],
  ['below_noi', '자산 NCF 조정', 'CAPEX', '자본적 지출'],
  ['below_noi', '자산 NCF 조정', 'TENANT_IMPROVEMENT', '임차인 시설공사비(TI)'],
  ['below_noi', '자산 NCF 조정', 'LEASING_COMMISSION', '임대 중개수수료(LC)'],
  ['below_noi', '자산 NCF 조정', 'CAPITAL_RESERVE', '자본적립금'],
  ['below_noi', '자산 NCF 조정', 'AMC_FEE', 'AMC 수수료'],
  ['below_noi', '자산 NCF 조정', 'CUSTODY_FEE', '자산보관 수수료'],
  ['below_noi', '자산 NCF 조정', 'GENERAL_ADMIN_TRUSTEE_FEE', '일반사무·수탁 수수료'],
  ['below_noi', '자산 NCF 조정', 'OTHER_OWNER_COST', '기타 소유자비용'],
  ['below_noi', '자산 NCF 조정', 'NONCASH_ADDBACK', '비현금비용 가산'],
  ['debt_service', '부채상환', 'INTEREST_PAID', '이자 지급액'],
  ['debt_service', '부채상환', 'PRINCIPAL_REPAYMENT', '원금 상환액'],
  ['debt_service', '부채상환', 'LOAN_FEE', '대출 관련 수수료'],
].map(([section, sectionLabel, code, label]) => Object.freeze({
  section,
  sectionLabel,
  code,
  label,
  defaultVisible: DEFAULT_VISIBLE_NOI_CODES.has(code),
})));

export const FINANCE_SECTION_ORDER = Object.freeze([
  'potential_income',
  'income_loss',
  'operating_expense',
  'below_noi',
  'debt_service',
]);

export const FINANCE_SECTION_LABELS = Object.freeze({
  potential_income: '영업수익',
  income_loss: '수입 손실',
  operating_expense: '운영비용',
  below_noi: 'NOI 하단 조정',
  debt_service: '부채상환',
});

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
          label: definition?.label
            || account.name
            || account.name_ko
            || account.account_name
            || account.account_code,
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
  return accounts.filter((account) => selected.has(account.account_code));
}

export function calculateKoreanLogisticsNoi(input = {}) {
  const potentialGrossIncome = Number(input.potential_income) || 0;
  const incomeLoss = Math.abs(Number(input.income_loss) || 0);
  const operatingExpense = Math.abs(Number(input.operating_expense) || 0);
  const belowNoiCashCost = Math.abs(Number(input.below_noi_cash_cost) || 0);
  const noncashAddback = Number(input.noncash_addback) || 0;
  const debtService = Math.abs(Number(input.debt_service) || 0);
  const effectiveGrossIncome = potentialGrossIncome - incomeLoss;
  const netOperatingIncome = effectiveGrossIncome - operatingExpense;
  const assetNetCashFlow = netOperatingIncome - belowNoiCashCost + noncashAddback;
  return {
    potential_gross_income: potentialGrossIncome,
    total_income_loss: incomeLoss,
    effective_gross_income: effectiveGrossIncome,
    total_operating_expense: operatingExpense,
    net_operating_income: netOperatingIncome,
    asset_net_cash_flow: assetNetCashFlow,
    after_debt_service_cash_flow: assetNetCashFlow - debtService,
  };
}

export const FINANCE_WATERFALL_LABELS = Object.freeze([
  '잠재총수입', '수입손실', '유효총수입', '운영비용', '순영업소득(NOI)', '자산 순현금흐름(NCF)', '부채상환 후 현금흐름',
]);

export const FINANCE_WATERFALL_KEYS = Object.freeze([
  'potential_gross_income', 'total_income_loss', 'effective_gross_income', 'total_operating_expense',
  'net_operating_income', 'asset_net_cash_flow', 'after_debt_service_cash_flow',
]);
