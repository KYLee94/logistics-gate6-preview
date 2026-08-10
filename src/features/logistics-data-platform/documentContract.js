import {
  normalizeFitOutMonths,
  normalizeRentFreePeriod,
  serializeRentRollGoodsTypes,
} from './rentRollSchema.js';

const DOCUMENT_META_FIELDS = new Set([
  'revision',
  'version',
  'meta',
  'write_enabled',
  'write_reason',
  'created_at',
  'created_by',
  'updated_at',
  'updated_by',
  'deleted_at',
  'deleted_by',
]);

const ASSET_FIELDS = Object.freeze([
  'asset_code', 'fund_code', 'name', 'address', 'zoning_text', 'land_area_sqm',
  'building_area_sqm', 'gross_area_sqm', 'leasable_area_sqm', 'primary_use',
  'building_coverage_ratio', 'floor_area_ratio', 'floor_count', 'structure_text',
  'parking_count', 'completion_date',
]);
const FUND_FIELDS = Object.freeze([
  'fund_code', 'name', 'fund_type', 'investment_strategy', 'inception_date',
  'maturity_date', 'ownership_ratio',
]);
const INVESTMENT_FIELDS = Object.freeze([
  'tranche', 'beneficiary_name', 'agreed_amount_krw', 'contributed_amount_krw',
]);
const LOAN_FIELDS = Object.freeze([
  'tranche', 'lender_name', 'committed_amount_krw', 'drawdown_date',
  'maturity_date', 'loan_type', 'interest_type', 'coupon_rate', 'all_in_rate',
  'fee_rate',
]);
const ASSET_NUMBER_FIELDS = Object.freeze([
  'land_area_sqm', 'building_area_sqm', 'gross_area_sqm', 'leasable_area_sqm',
  'building_coverage_ratio', 'floor_area_ratio', 'parking_count',
]);
const FUND_NUMBER_FIELDS = Object.freeze(['ownership_ratio']);
const RENT_ROLL_FIELDS = Object.freeze([
  'occupancy_status', 'tenant_name', 'business_registration_number',
  'temperature_type', 'goods_type', 'floor_label', 'zone_label', 'subtenant_name',
  'free_area_type', 'exclusive_area_sqm', 'common_area_sqm', 'leased_area_sqm',
  'signed_date', 'commencement_date', 'expiry_date', 'operation_start_date',
  'deposit_total_krw', 'security_type', 'security_ratio',
  'monthly_rent_total_krw', 'monthly_cam_total_krw', 'pallet_rack_fee',
  'rent_free_periods', 'fit_out_start_date', 'fit_out_end_date', 'fit_out_months', 'fit_out_amount',
  'tenant_improvement_amount', 'deposit_escalation_enabled', 'deposit_escalation_first_date',
  'deposit_escalation_interval_months', 'deposit_escalation_rate',
  'rent_escalation_first_date', 'rent_escalation_interval_months',
  'rent_escalation_rate', 'cam_escalation_first_date',
  'cam_escalation_interval_months', 'cam_escalation_rate', 'tenant_cost_terms',
  'landlord_cost_terms', 'renewal_terms', 'termination_terms',
  'restoration_terms', 'notes',
]);
const RENT_FREE_FIELDS = Object.freeze(['start_date', 'end_date', 'months', 'reason', 'notes']);
const RENT_ROLL_NUMBER_FIELDS = Object.freeze([
  'exclusive_area_sqm', 'common_area_sqm', 'leased_area_sqm', 'deposit_total_krw',
  'monthly_rent_total_krw', 'monthly_cam_total_krw', 'pallet_rack_fee',
  'fit_out_months', 'fit_out_amount', 'tenant_improvement_amount',
  'deposit_escalation_interval_months', 'rent_escalation_interval_months',
  'cam_escalation_interval_months',
]);
const RENT_ROLL_DATE_FIELDS = Object.freeze([
  'signed_date', 'commencement_date', 'expiry_date', 'operation_start_date',
  'fit_out_start_date', 'fit_out_end_date', 'deposit_escalation_first_date',
  'rent_escalation_first_date', 'cam_escalation_first_date',
]);
const INCOME_EXPENSE_SECTIONS = Object.freeze([
  'potential_income', 'income_loss', 'operating_expense', 'below_noi', 'debt_service',
]);
const FINANCE_MONTH_KEY = /^\d{4}-(0[1-9]|1[0-2])$/u;
const DOCUMENT_DATE_KEY = /^\d{4}-\d{2}-\d{2}$/u;

function isLegacyField(field) {
  return field === 'id'
    || field.endsWith('_id')
    || field.endsWith('_key')
    || field.startsWith('source_')
    || field.endsWith('_revision');
}

function cleanDocumentValue(value, omittedFields = new Set()) {
  if (Array.isArray(value)) return value.map((item) => cleanDocumentValue(item, omittedFields));
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).flatMap(([field, nested]) => {
    if (
      field.startsWith('_')
      || DOCUMENT_META_FIELDS.has(field)
      || omittedFields.has(field)
      || isLegacyField(field)
    ) return [];
    return [[field, cleanDocumentValue(nested, omittedFields)]];
  }));
}

function pickFields(value, fields, { emptyAsNull = false } = {}) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return Object.fromEntries(fields.flatMap((field) => {
    if (!Object.prototype.hasOwnProperty.call(source, field)) return [];
    const next = emptyAsNull && source[field] === '' ? null : source[field];
    return [[field, cleanDocumentValue(next)]];
  }));
}

function canonicalHomeNumber(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const text = String(value).trim();
  if (!text) return null;
  const numeric = Number(text.replaceAll(',', '').replace(/%$/u, '').trim());
  return Number.isFinite(numeric) ? numeric : value;
}

function canonicalHomeScalarDocument(value, fields, numberFields, { omitEmpty = false } = {}) {
  const document = pickFields(value, fields, { emptyAsNull: true });
  numberFields.forEach((field) => {
    if (!Object.prototype.hasOwnProperty.call(document, field)) return;
    const numeric = canonicalHomeNumber(document[field]);
    if (omitEmpty && numeric === null) delete document[field];
    else document[field] = numeric;
  });
  return document;
}

function preferredHomeValue(value, field, aliases = []) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  if (source[field] !== null && source[field] !== undefined) return source[field];
  for (const alias of aliases) {
    if (source[alias] !== null && source[alias] !== undefined) return source[alias];
  }
  return null;
}

function canonicalInvestment(value) {
  const row = pickFields(value, INVESTMENT_FIELDS);
  const amountFields = [
    ['agreed_amount_krw', ['commitment_amount_krw', 'committed_amount_krw']],
    ['contributed_amount_krw', ['invested_amount_krw']],
  ];
  amountFields.forEach(([field, aliases]) => {
    const numeric = canonicalHomeNumber(preferredHomeValue(value, field, aliases));
    if (numeric === null) delete row[field];
    else row[field] = numeric;
  });
  return row;
}

function canonicalLoan(value) {
  const row = pickFields(value, LOAN_FIELDS);
  for (const field of ['drawdown_date', 'maturity_date']) {
    const date = preferredHomeValue(value, field);
    if (date !== null && String(date).trim()) row[field] = date;
    else delete row[field];
  }
  const numberFields = [
    ['committed_amount_krw', ['commitment_amount_krw', 'commitment_amount']],
    ['coupon_rate', ['loan_rate', 'interest_rate']],
    ['all_in_rate', ['all_in']],
    ['fee_rate', ['fee']],
  ];
  numberFields.forEach(([field, aliases]) => {
    const numeric = canonicalHomeNumber(preferredHomeValue(value, field, aliases));
    if (numeric === null) delete row[field];
    else row[field] = numeric;
  });
  return row;
}

function canonicalPercent(value) {
  if (value === null || value === undefined || value === '') return value;
  const text = String(value).trim();
  const hasPercent = text.endsWith('%');
  const numeric = Number(hasPercent ? text.slice(0, -1).trim() : text);
  if (!Number.isFinite(numeric)) return value;
  const percent = !hasPercent && numeric > 0 && numeric < 1 ? numeric * 100 : numeric;
  return `${Number(percent.toPrecision(12))}%`;
}

function canonicalTextItems(value) {
  let source = value;
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    source = value.items ?? value.selected_items ?? value.selected ?? value.values;
    if (!Array.isArray(source)) source = value.raw_text ?? value.text ?? '';
  }
  const items = Array.isArray(source) ? source : String(source ?? '').split(/[\n,]/u);
  return [...new Set(items.map((item) => String(item ?? '').trim()).filter(Boolean))];
}

function canonicalScalarTerm(value) {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map((item) => String(item ?? '').trim()).filter(Boolean).join(', ');
  if (typeof value === 'object') {
    const scalar = value.value ?? value.text ?? value.raw_text ?? value.label ?? value.term;
    return scalar === null || scalar === undefined ? '' : String(scalar).trim();
  }
  return String(value).trim();
}

function canonicalRentRow(value) {
  const row = pickFields(value, RENT_ROLL_FIELDS);
  if (Object.prototype.hasOwnProperty.call(value || {}, 'goods_type')) {
    row.goods_type = serializeRentRollGoodsTypes(value?.goods_type);
  }
  row.deposit_escalation_enabled = value?.deposit_escalation_enabled === true
    || value?.deposit_escalation_enabled === 1
    || ['y', 'yes', 'true', '1', '있음'].includes(
      String(value?.deposit_escalation_enabled ?? '').trim().toLowerCase(),
    );
  for (const field of RENT_ROLL_NUMBER_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(row, field)) continue;
    const numeric = canonicalHomeNumber(row[field]);
    if (numeric === null) delete row[field];
    else row[field] = numeric;
  }
  for (const field of RENT_ROLL_DATE_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(row, field)) continue;
    const date = String(row[field] ?? '').trim();
    if (!date) delete row[field];
    else row[field] = date;
  }
  if (Array.isArray(row.rent_free_periods)) {
    row.rent_free_periods = row.rent_free_periods.map((period) => (
      normalizeRentFreePeriod(pickFields(period, RENT_FREE_FIELDS))
    ));
  }
  if (['fit_out_start_date', 'fit_out_end_date', 'fit_out_months'].some((field) => (
    Object.prototype.hasOwnProperty.call(value || {}, field)
  ))) {
    const fitOutMonths = normalizeFitOutMonths(
      row.fit_out_start_date,
      row.fit_out_end_date,
      row.fit_out_months,
    );
    if (fitOutMonths === null) delete row.fit_out_months;
    else row.fit_out_months = fitOutMonths;
  }
  for (const field of ['security_ratio', 'deposit_escalation_rate', 'rent_escalation_rate', 'cam_escalation_rate']) {
    if (Object.prototype.hasOwnProperty.call(row, field)) row[field] = canonicalPercent(row[field]);
  }
  for (const field of ['tenant_cost_terms', 'landlord_cost_terms']) {
    if (Object.prototype.hasOwnProperty.call(row, field)) {
      row[field] = { items: canonicalTextItems(value?.[field]) };
    }
  }
  for (const field of ['renewal_terms', 'termination_terms', 'restoration_terms']) {
    if (Object.prototype.hasOwnProperty.call(row, field)) {
      row[field] = canonicalScalarTerm(value?.[field]);
    }
  }
  return Object.fromEntries(Object.entries(row).filter(([, nested]) => nested !== null && nested !== undefined));
}

function statementRows(statement, section) {
  if (Array.isArray(statement?.[section])) return statement[section];
  const nested = Array.isArray(statement?.sections)
    ? statement.sections.find((item) => item?.section === section)?.accounts
    : null;
  return Array.isArray(nested) ? nested : [];
}

function canonicalAmounts(amounts, periods) {
  if (amounts && typeof amounts === 'object' && !Array.isArray(amounts)) {
    return Object.fromEntries(Object.entries(amounts).filter(([month, value]) => (
      FINANCE_MONTH_KEY.test(month) && typeof value === 'number' && Number.isFinite(value)
    )));
  }
  if (!Array.isArray(amounts)) return {};
  return Object.fromEntries(periods.flatMap((period, index) => (
    FINANCE_MONTH_KEY.test(period)
      && typeof amounts[index] === 'number'
      && Number.isFinite(amounts[index])
      ? [[period, amounts[index]]]
      : []
  )));
}

function canonicalStatement(statement = {}) {
  const periods = [...new Set(
    (Array.isArray(statement.periods) ? statement.periods : statement.months || [])
      .map((period) => String(period || '').slice(0, 7))
      .filter((period) => FINANCE_MONTH_KEY.test(period)),
  )].sort();
  return {
    periods,
    ...Object.fromEntries(INCOME_EXPENSE_SECTIONS.map((section) => [
      section,
      statementRows(statement, section).map((account) => ({
        name: account?.name ?? account?.name_ko ?? '',
        selected: account?.selected === true,
        amounts: canonicalAmounts(account?.amounts, periods),
      })),
    ])),
  };
}

function rowsForFund(rows, fundCode, totalFunds) {
  if (!Array.isArray(rows)) return [];
  return rows.filter((row) => {
    if (row?.fund_code) return row.fund_code === fundCode;
    return totalFunds === 1;
  });
}

export function buildHomeDocumentPayload(data = {}) {
  const asset = canonicalHomeScalarDocument(data.asset, ASSET_FIELDS, ASSET_NUMBER_FIELDS);
  const sourceFunds = Array.isArray(data.funds) ? data.funds : [];
  const funds = sourceFunds.map((fund) => {
    const investments = Array.isArray(fund?.investments)
      ? fund.investments
      : rowsForFund(data.investments, fund?.fund_code, sourceFunds.length);
    const loans = Array.isArray(fund?.loans)
      ? fund.loans
      : rowsForFund(data.loans, fund?.fund_code, sourceFunds.length);
    return {
      ...canonicalHomeScalarDocument(fund, FUND_FIELDS, FUND_NUMBER_FIELDS),
      investments: investments.map(canonicalInvestment),
      loans: loans.map(canonicalLoan),
    };
  });
  return { asset, funds };
}

export function primaryHomeDataForAsset(data, assetCode) {
  const selectedAssetCode = String(assetCode || '').trim();
  const responseAssetCode = String(data?.asset?.asset_code || '').trim();
  return selectedAssetCode && responseAssetCode === selectedAssetCode ? data : null;
}

function currentDateKst() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export function isExpiredRentRollRow(row, asOfDate = currentDateKst()) {
  const expiryDate = String(row?.expiry_date || '').trim();
  const referenceDate = String(asOfDate || '').trim();
  return /^\d{4}-\d{2}-\d{2}$/u.test(expiryDate)
    && /^\d{4}-\d{2}-\d{2}$/u.test(referenceDate)
    && expiryDate < referenceDate;
}

export function isCurrentOccupiedRentRollRow(row, asOfDate = currentDateKst()) {
  const referenceDate = String(asOfDate || '').trim();
  if (String(row?.occupancy_status || '').trim().toLowerCase() !== 'occupied') return false;
  if (!DOCUMENT_DATE_KEY.test(referenceDate)) return false;

  const commencementDate = String(row?.commencement_date || '').trim();
  const expiryDate = String(row?.expiry_date || '').trim();
  if (commencementDate && !DOCUMENT_DATE_KEY.test(commencementDate)) return false;
  if (expiryDate && !DOCUMENT_DATE_KEY.test(expiryDate)) return false;
  return (!commencementDate || commencementDate <= referenceDate)
    && (!expiryDate || expiryDate >= referenceDate);
}

export function buildRentRollDocumentPayload(rows = [], { asOfDate = currentDateKst() } = {}) {
  return {
    rows: (Array.isArray(rows) ? rows : [])
      .filter((row) => row?.operation !== 'delete' || isExpiredRentRollRow(row, asOfDate))
      .map(canonicalRentRow),
  };
}

export function buildIncomeExpenseDocumentPayload(statement = {}) {
  return { statement: canonicalStatement(statement) };
}

export function replaceFinanceCellValue(source = [], accountCode, month, value) {
  const rows = Array.isArray(source) ? source : [];
  const withoutCell = rows.filter((entry) => !(
    entry?.account_code === accountCode && String(entry?.month).slice(0, 7) === month
  ));
  if (value === '') return withoutCell;
  const amount = Number(value);
  if (!Number.isFinite(amount)) return rows;
  return [...withoutCell, {
    account_code: accountCode,
    month,
    amount,
    operation: 'update',
  }];
}

export function financePeriodsFromEntries(entries = []) {
  return [...new Set((Array.isArray(entries) ? entries : []).flatMap((entry) => {
    if (entry?.operation === 'delete' || entry?.amount === '' || entry?.amount === null
      || entry?.amount === undefined || !Number.isFinite(Number(entry.amount))) return [];
    const month = String(entry?.month || '').slice(0, 7);
    return FINANCE_MONTH_KEY.test(month) ? [month] : [];
  }))].sort();
}

export function documentFingerprint(value) {
  const sortKeys = (nested) => {
    if (Array.isArray(nested)) return nested.map(sortKeys);
    if (!nested || typeof nested !== 'object') return nested;
    return Object.fromEntries(
      Object.keys(nested).sort().map((key) => [key, sortKeys(nested[key])]),
    );
  };
  return JSON.stringify(sortKeys(cleanDocumentValue(value)));
}

export function documentsEqual(left, right) {
  return documentFingerprint(left) === documentFingerprint(right);
}

export function projectIncomeExpenseStatement(statement = {}, definitions = []) {
  const canonical = canonicalStatement(statement);
  const definitionByName = new Map(
    definitions.map((definition) => [`${definition.section}\u0000${definition.label}`, definition]),
  );
  const accounts = [];
  const entries = [];
  const selectedAccountCodes = [];
  INCOME_EXPENSE_SECTIONS.forEach((section) => {
    canonical[section].forEach((row, index) => {
      const definition = definitionByName.get(`${section}\u0000${row.name}`);
      const accountCode = definition?.code || `DOCUMENT:${section}:${index}`;
      accounts.push({
        account_code: accountCode,
        name: row.name,
        name_ko: row.name,
        statement_section: section,
        display_order: (index + 1) * 10,
        normal_sign: section === 'potential_income' ? 1 : -1,
        is_custom: !definition,
        selected: row.selected,
      });
      if (row.selected) selectedAccountCodes.push(accountCode);
      Object.entries(row.amounts).forEach(([month, amount]) => {
        entries.push({ account_code: accountCode, month, amount, operation: 'update' });
      });
    });
  });
  return { periods: canonical.periods, accounts, entries, selectedAccountCodes };
}

export function buildIncomeExpenseStatement({
  accounts = [], entries = [], selectedAccountCodes = [],
} = {}) {
  const selected = selectedAccountCodes instanceof Set
    ? selectedAccountCodes
    : new Set(selectedAccountCodes);
  const normalizedPeriods = financePeriodsFromEntries(entries);
  const byAccountAndMonth = new Map();
  entries.filter((entry) => entry?.operation !== 'delete').forEach((entry) => {
    const key = `${entry.account_code}\u0000${String(entry.month).slice(0, 7)}`;
    byAccountAndMonth.set(key, (byAccountAndMonth.get(key) || 0) + Number(entry.amount || 0));
  });
  return {
    periods: normalizedPeriods,
    ...Object.fromEntries(INCOME_EXPENSE_SECTIONS.map((section) => [
      section,
      accounts.filter((account) => account.statement_section === section).map((account) => ({
        name: account.name ?? account.name_ko ?? account.account_name ?? '',
        selected: selected.has(account.account_code),
        amounts: Object.fromEntries(normalizedPeriods.flatMap((month) => {
          const key = `${account.account_code}\u0000${month}`;
          return byAccountAndMonth.has(key) ? [[month, byAccountAndMonth.get(key)]] : [];
        })),
      })),
    ])),
  };
}

export function normalizeMaturityRows(data) {
  const rows = Array.isArray(data?.maturities)
    ? data.maturities
    : Array.isArray(data?.rows) ? data.rows : [];
  return rows.map((row) => {
    const type = row.type || row.kind || row.maturity_type;
    const date = row.official_date || row.maturity_date;
    const name = row.target_name || row.name;
    return {
      ...row,
      type,
      official_date: date,
      target_name: name,
      ...(type === 'lease' && !row.tenant_name ? { tenant_name: name } : {}),
      ...(type === 'fund' && !row.fund_name ? { fund_name: name } : {}),
      ...(type === 'loan' && !row.loan_name ? { loan_name: name } : {}),
    };
  });
}

export function normalizeAssetDirectory(data) {
  const assets = Array.isArray(data?.assets) ? data.assets : [];
  const seen = new Set();
  return assets.flatMap((asset) => {
    const assetCode = String(asset?.asset_code || '').trim();
    if (!assetCode || seen.has(assetCode)) return [];
    seen.add(assetCode);
    return [{ ...asset, asset_code: assetCode }];
  });
}

export function reconcileAssetCode(assets = [], currentAssetCode = '') {
  const current = String(currentAssetCode || '').trim();
  if (!assets.length) return current;
  return assets.some((asset) => asset?.asset_code === current)
    ? current
    : assets[0].asset_code;
}
