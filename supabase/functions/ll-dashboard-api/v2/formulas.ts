export const FORMULA_REGISTRY_VERSION = 'gate6-logistics-core-1';
export const SCENARIO_CALCULATION_AUTHORITY = 'v2/calculations/explain';

export const LEDGER_SCENARIOS = Object.freeze(['actual', 'budget', 'forecast'] as const);
export const ACCOUNTING_BASES = Object.freeze(['accrual', 'cash'] as const);

type FormulaApproval = {
  version: number;
  unit: string;
  round: number;
  status: 'draft' | 'approved';
  approvedBy: string | null;
  testVectorHash: string;
};

const approved = (unit: string, testVectorHash: string): FormulaApproval => Object.freeze({
  version: 1,
  unit,
  round: 2,
  status: 'approved',
  approvedBy: 'Gate 6 SDD approved vector',
  testVectorHash,
});

const draft = (unit: string, testVectorHash: string): FormulaApproval => Object.freeze({
  version: 1,
  unit,
  round: 2,
  status: 'draft',
  approvedBy: null,
  testVectorHash,
});

export const FORMULA_REGISTRY = Object.freeze({
  contractual_rent_monthly: draft('currency/month', 'a4bc22dcb84215fc24f2e392d88b2dca4db68f167e44f6a3cfa3b872b2660011'),
  potential_gross_income: approved('currency', '261a5c8d4d4abcae3a9a4779cc9bb168df0d80a7134f212721d184b21e882022'),
  income_loss: approved('currency', '032d4a3f5bb7992cd45ddce690fecc4f1e42d5342bbec60729dfbcc80a1e3033'),
  effective_gross_income: approved('currency', '5f21a65d70935958b14410718173aace393208678a433c84b5bc7b83b36c4044'),
  operating_expense: approved('currency', 'ea75cb6482dc8786c471e97f647a9754760d31b62a2ee7af6b7f0b1b0f615055'),
  net_operating_income: approved('currency', 'b43146a86b6f1f7407a77fba716289841855695301c42920279c517a2add6066'),
  asset_net_cash_flow: approved('currency', '780195180135cf470e9fc288d6df98ecee30e42e888419affd9ba90b3da87077'),
  post_debt_cash_flow: draft('currency', 'f26c9e12f86890926ed79b9946266059ec2375feb73304013175461aa6068088'),
});

export function assertFormulaApproved(formulaKey: string): FormulaApproval {
  const row = FORMULA_REGISTRY[formulaKey as keyof typeof FORMULA_REGISTRY];
  if (!row) throw new Error('FORMULA_NOT_FOUND');
  if (row.status !== 'approved') throw new Error(`FORMULA_NOT_APPROVED:${formulaKey}`);
  return row;
}

export const LOAN_REPAYMENT_SCHEDULE_STATUS = 'not_provided' as const;

export function projectLoanRepaymentSchedule(_sourceTerms: Record<string, unknown> = {}) {
  return {
    status: LOAN_REPAYMENT_SCHEDULE_STATUS,
    rows: [] as readonly never[],
    reason: 'SOURCE_HAS_NO_MONTHLY_REPAYMENT_SCHEDULE',
  };
}

type NumberMap = Record<string, number | null | undefined>;

export type IncomeStatementInput = {
  contractualRent?: number;
  recoverableCharges?: number;
  depositIncome?: number;
  otherPotentialIncome?: number;
  vacancyLoss?: number;
  rentFreeLoss?: number;
  badDebtLoss?: number;
  contractAdjustmentLoss?: number;
  otherOperatingIncome?: number;
  operatingExpenses?: NumberMap;
  belowNoi?: NumberMap & { nonCashAdjustment?: number };
  debtService?: NumberMap;
};

function finite(value: number | null | undefined): number {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed)) throw new Error('INVALID_NUMERIC_INPUT');
  return parsed;
}

function sum(values: Iterable<number | null | undefined>): number {
  let total = 0;
  for (const value of values) total += finite(value);
  return total;
}

function money(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateKoreanIncomeStatement(input: IncomeStatementInput = {}) {
  const potentialGrossIncome = sum([
    input.contractualRent,
    input.recoverableCharges,
    input.depositIncome,
    input.otherPotentialIncome,
  ]);
  const incomeLoss = sum([
    input.vacancyLoss,
    input.rentFreeLoss,
    input.badDebtLoss,
    input.contractAdjustmentLoss,
  ]);
  const effectiveGrossIncome = potentialGrossIncome - incomeLoss + finite(input.otherOperatingIncome);
  const operatingExpense = sum(Object.values(input.operatingExpenses ?? {}));
  const netOperatingIncome = effectiveGrossIncome - operatingExpense;

  const belowNoi = input.belowNoi ?? {};
  const nonCashAdjustment = finite(belowNoi.nonCashAdjustment);
  const belowNoiCashOutflow = sum(Object.entries(belowNoi)
    .filter(([key]) => key !== 'nonCashAdjustment')
    .map(([, value]) => value));
  const assetNetCashFlow = netOperatingIncome - belowNoiCashOutflow + nonCashAdjustment;
  const postDebtCashFlow = assetNetCashFlow - sum(Object.values(input.debtService ?? {}));

  return {
    potentialGrossIncome: money(potentialGrossIncome),
    incomeLoss: money(incomeLoss),
    effectiveGrossIncome: money(effectiveGrossIncome),
    operatingExpense: money(operatingExpense),
    netOperatingIncome: money(netOperatingIncome),
    assetNetCashFlow: money(assetNetCashFlow),
    postDebtCashFlow: money(postDebtCashFlow),
    formulaRegistryVersion: FORMULA_REGISTRY_VERSION,
  };
}

export type MonthlyContractRentInput = {
  baseMonthlyRent: number;
  termStartMonth: string;
  targetMonth: string;
  escalationRate?: number;
  escalationIntervalMonths?: number;
  rentFree?: boolean;
  occupiedDays?: number;
  daysInMonth?: number;
};

function parseMonth(value: string): Date {
  if (!/^\d{4}-\d{2}-01$/u.test(value)) throw new Error('MONTH_MUST_BE_FIRST_DAY');
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error('INVALID_MONTH');
  }
  return parsed;
}

function monthDistance(from: Date, to: Date): number {
  return (to.getUTCFullYear() - from.getUTCFullYear()) * 12
    + to.getUTCMonth()
    - from.getUTCMonth();
}

export function calculateMonthlyContractRent(input: MonthlyContractRentInput): number {
  const start = parseMonth(input.termStartMonth);
  const target = parseMonth(input.targetMonth);
  const elapsedMonths = monthDistance(start, target);
  if (elapsedMonths < 0) return 0;
  if (input.rentFree === true) return 0;

  const baseMonthlyRent = finite(input.baseMonthlyRent);
  if (baseMonthlyRent < 0) throw new Error('NEGATIVE_RENT_NOT_ALLOWED');
  const escalationRate = finite(input.escalationRate);
  const interval = Number(input.escalationIntervalMonths ?? 0);
  if (!Number.isInteger(interval) || interval < 0) throw new Error('INVALID_ESCALATION_INTERVAL');
  const escalationCount = interval > 0 ? Math.floor(elapsedMonths / interval) : 0;
  const escalated = baseMonthlyRent * ((1 + escalationRate) ** escalationCount);

  const daysInMonth = Number(input.daysInMonth ?? 1);
  const occupiedDays = Number(input.occupiedDays ?? daysInMonth);
  if (!Number.isInteger(daysInMonth) || daysInMonth <= 0) throw new Error('INVALID_DAYS_IN_MONTH');
  if (!Number.isInteger(occupiedDays) || occupiedDays < 0 || occupiedDays > daysInMonth) {
    throw new Error('INVALID_OCCUPIED_DAYS');
  }
  return money(escalated * (occupiedDays / daysInMonth));
}

export type MonthlyRow = { month: string; amount: number };

export function aggregateMonthlyRows(rows: readonly MonthlyRow[]) {
  const quarters: Record<string, number> = {};
  const years: Record<string, number> = {};
  for (const row of rows) {
    const month = parseMonth(row.month);
    const amount = finite(row.amount);
    const year = String(month.getUTCFullYear());
    const quarter = Math.floor(month.getUTCMonth() / 3) + 1;
    const quarterKey = `${year}-Q${quarter}`;
    quarters[quarterKey] = money((quarters[quarterKey] ?? 0) + amount);
    years[year] = money((years[year] ?? 0) + amount);
  }
  return { quarters, years };
}
