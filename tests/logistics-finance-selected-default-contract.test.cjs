'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');
const { pathToFileURL } = require('node:url');

const ROOT = path.resolve(__dirname, '..');
const FORMULAS_PATH = path.join(
  ROOT,
  'src',
  'features',
  'logistics-data-platform',
  'formulas.js',
);

const CANONICAL_SELECTED = Object.freeze({
  RENT_REVENUE: true,
  MANAGEMENT_FEE_INCOME: true,
  UTILITIES_REIMBURSEMENT_INCOME: true,
  INTEREST_INCOME: true,
  MISCELLANEOUS_INCOME: true,
  PM_FEE: true,
  FM_FEE: true,
  REPAIRS_MAINTENANCE: true,
  UTILITIES: true,
  PROPERTY_INSURANCE: true,
  BUILDING_PROPERTY_TAX: true,
  LAND_PROPERTY_TAX: true,
  COMPREHENSIVE_REAL_ESTATE_TAX: true,
  ROAD_OCCUPANCY_FEE: true,
  DEEMED_RENT_VAT: true,
  OTHER_TAXES: true,
  OTHER_PROPERTY_OPEX: true,
  AMC_FEE: true,
  CUSTODY_FEE: true,
  GENERAL_ADMIN_TRUSTEE_FEE: true,
  CAPEX: true,
  TENANT_IMPROVEMENT: true,
  LEASING_COMMISSION: true,
  INTEREST_PAID: true,
  PRINCIPAL_REPAYMENT: false,
  LOAN_FEE: false,
  OTHER_CASH_INFLOW: true,
  DIVIDEND_PAYMENT: true,
  OTHER_CASH_OUTFLOW: true,
  OPENING_CASH_BALANCE: true,
});

test('frontend NOI defaults exactly match the canonical operating selected matrix', async () => {
  const formulas = await import(`${pathToFileURL(FORMULAS_PATH).href}?selected=${Date.now()}-${Math.random()}`);
  const frontendRows = formulas.KOREAN_LOGISTICS_NOI_ACCOUNTS
    .filter((row) => Object.hasOwn(CANONICAL_SELECTED, row.code));
  const frontendByCode = new Map(frontendRows.map((row) => [row.code, row.defaultVisible]));

  assert.equal(frontendByCode.size, Object.keys(CANONICAL_SELECTED).length, 'every canonical account code must exist exactly once');
  assert.deepEqual(
    Object.fromEntries(Object.keys(CANONICAL_SELECTED).map((code) => [code, frontendByCode.get(code)])),
    CANONICAL_SELECTED,
  );

  const nonCanonicalDefaults = formulas.KOREAN_LOGISTICS_NOI_ACCOUNTS
    .filter((row) => row.defaultVisible && !Object.hasOwn(CANONICAL_SELECTED, row.code))
    .map((row) => row.code);
  assert.deepEqual(nonCanonicalDefaults, [], 'legacy-only codes must not remain default visible');
});
