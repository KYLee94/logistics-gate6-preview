#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const ROOT = path.resolve(__dirname, '..', '..');
const DEFAULT_ENV_ROOT = path.resolve(ROOT, '..', 'IGIS-Fund-Production-DP');
const TARGET_ASSET_CODE = 'A112527001';
const INVESTMENT_NUMBER_FIELDS = Object.freeze([
  'agreed_amount_krw',
  'contributed_amount_krw',
]);
const LOAN_NUMBER_FIELDS = Object.freeze([
  'committed_amount_krw',
  'coupon_rate',
  'all_in_rate',
  'fee_rate',
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

function flagValue(name, fallback = '') {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : (process.argv[index + 1] || fallback);
}

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  return Object.fromEntries(fs.readFileSync(filePath, 'utf8')
    .split(/\r?\n/gu)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => {
      const separator = line.indexOf('=');
      return [
        line.slice(0, separator).trim(),
        line.slice(separator + 1).trim().replace(/^['"]|['"]$/gu, ''),
      ];
    }));
}

function deepClone(value) {
  if (Array.isArray(value)) return value.map(deepClone);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, deepClone(nested)]));
  }
  return value;
}

// Mirrors the relevant production cloneHomeData path. It performs no I/O.
function browserCloneHomeData(data) {
  const cloned = deepClone(data || {});
  return {
    ...cloned,
    asset: cloned?.asset ? { ...cloned.asset } : null,
    funds: (Array.isArray(cloned?.funds) ? cloned.funds : []).map((row) => ({ ...row })),
    investments: (Array.isArray(cloned?.investments) ? cloned.investments : []).map((row) => ({
      ...row,
      agreed_amount_krw: row.agreed_amount_krw ?? row.commitment_amount_krw ?? '',
      contributed_amount_krw: row.contributed_amount_krw ?? row.invested_amount_krw ?? '',
    })),
    loans: (Array.isArray(cloned?.loans) ? cloned.loans : []).map((row) => ({
      ...row,
      coupon_rate: row.coupon_rate ?? row.loan_rate ?? row.interest_rate ?? '',
      all_in_rate: row.all_in_rate ?? row.all_in ?? '',
    })),
  };
}

function pickIncidentFields(value, fields, { emptyAsNull = false } = {}) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return Object.fromEntries(fields.flatMap((field) => {
    if (!Object.hasOwn(source, field)) return [];
    return [[field, emptyAsNull && source[field] === '' ? null : deepClone(source[field])]];
  }));
}

// Mirrors the document builder at the time of the 422 incident. Nested rows did
// not use emptyAsNull and did not coerce number-input strings to JSON numbers.
function buildIncidentHomeDocumentPayload(data = {}) {
  const asset = pickIncidentFields(data.asset, ASSET_FIELDS, { emptyAsNull: true });
  const sourceFunds = Array.isArray(data.funds) ? data.funds : [];
  const rowsForFund = (rows, fundCode) => (Array.isArray(rows) ? rows : []).filter((row) => (
    row?.fund_code ? row.fund_code === fundCode : sourceFunds.length === 1
  ));
  const funds = sourceFunds.map((fund) => {
    const investments = Array.isArray(fund?.investments)
      ? fund.investments
      : rowsForFund(data.investments, fund?.fund_code);
    const loans = Array.isArray(fund?.loans)
      ? fund.loans
      : rowsForFund(data.loans, fund?.fund_code);
    return {
      ...pickIncidentFields(fund, FUND_FIELDS, { emptyAsNull: true }),
      investments: investments.map((row) => pickIncidentFields(row, INVESTMENT_FIELDS)),
      loans: loans.map((row) => pickIncidentFields(row, LOAN_FIELDS)),
    };
  });
  return { asset, funds };
}

function jsonType(value, present = true) {
  if (!present) return 'missing';
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

function collectTypeDiffs(readValue, browserValue, pathPrefix = '') {
  const readType = jsonType(readValue);
  const browserType = jsonType(browserValue);
  if (readType !== browserType) {
    return [{ path: pathPrefix || '$', read_type: readType, browser_type: browserType }];
  }
  if (readType === 'array') {
    const size = Math.max(readValue.length, browserValue.length);
    return Array.from({ length: size }, (_, index) => {
      const readPresent = index < readValue.length;
      const browserPresent = index < browserValue.length;
      const nextPath = `${pathPrefix}[${index}]`;
      if (!readPresent || !browserPresent) {
        return [{
          path: nextPath,
          read_type: jsonType(readValue[index], readPresent),
          browser_type: jsonType(browserValue[index], browserPresent),
        }];
      }
      return collectTypeDiffs(readValue[index], browserValue[index], nextPath);
    }).flat();
  }
  if (readType === 'object') {
    const keys = new Set([...Object.keys(readValue), ...Object.keys(browserValue)]);
    return [...keys].flatMap((key) => {
      const readPresent = Object.hasOwn(readValue, key);
      const browserPresent = Object.hasOwn(browserValue, key);
      const nextPath = pathPrefix ? `${pathPrefix}.${key}` : key;
      if (!readPresent || !browserPresent) {
        return [{
          path: nextPath,
          read_type: jsonType(readValue[key], readPresent),
          browser_type: jsonType(browserValue[key], browserPresent),
        }];
      }
      return collectTypeDiffs(readValue[key], browserValue[key], nextPath);
    });
  }
  return [];
}

function validateHomeNestedNumbers(document) {
  const violations = [];
  for (const [fundIndex, fund] of (Array.isArray(document?.funds) ? document.funds : []).entries()) {
    for (const [rowIndex, row] of (Array.isArray(fund?.investments) ? fund.investments : []).entries()) {
      for (const field of INVESTMENT_NUMBER_FIELDS) {
        if (!Object.hasOwn(row, field) || row[field] === null) continue;
        if (typeof row[field] !== 'number' || !Number.isFinite(row[field]) || row[field] < 0) {
          violations.push({
            path: `funds[${fundIndex}].investments[${rowIndex}].${field}`,
            code: 'INVESTMENT_AMOUNT_INVALID',
            actual_type: jsonType(row[field]),
          });
        }
      }
    }
    for (const [rowIndex, row] of (Array.isArray(fund?.loans) ? fund.loans : []).entries()) {
      for (const field of LOAN_NUMBER_FIELDS) {
        if (!Object.hasOwn(row, field) || row[field] === null) continue;
        if (typeof row[field] !== 'number' || !Number.isFinite(row[field])) {
          violations.push({
            path: `funds[${fundIndex}].loans[${rowIndex}].${field}`,
            code: 'LOAN_NUMBER_INVALID',
            actual_type: jsonType(row[field]),
          });
        } else if (row[field] < 0 || (field !== 'committed_amount_krw' && row[field] > 100)) {
          violations.push({
            path: `funds[${fundIndex}].loans[${rowIndex}].${field}`,
            code: 'LOAN_NUMBER_OUT_OF_RANGE',
            actual_type: jsonType(row[field]),
          });
        }
      }
    }
  }
  return violations;
}

async function acquireAuthenticatedSession() {
  const envRoot = path.resolve(flagValue('env-root', DEFAULT_ENV_ROOT));
  const fileEnv = {
    ...readEnvFile(path.join(envRoot, '.env')),
    ...readEnvFile(path.join(envRoot, '.env.local')),
  };
  const envValue = (...names) => names
    .map((name) => process.env[name] || fileEnv[name] || '')
    .find(Boolean) || '';
  const supabaseUrl = envValue('LOGISTICS_SUPABASE_URL', 'VITE_SUPABASE_URL').replace(/\/$/u, '');
  const anonKey = envValue('LOGISTICS_SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY');
  const accessToken = envValue('LOGISTICS_SUPABASE_ACCESS_TOKEN');
  const email = envValue('LOGISTICS_SUPABASE_EMAIL', 'LOGISTICS_SUPABASE_AUTH_EMAIL');
  const password = envValue('LOGISTICS_SUPABASE_PASSWORD', 'LOGISTICS_SUPABASE_AUTH_PASSWORD');
  assert.ok(supabaseUrl && anonKey, 'Supabase URL/anon key is missing');
  if (accessToken) return { supabaseUrl, anonKey, accessToken, authSource: 'access_token' };
  assert.ok(email && password, 'Supabase QA login credentials are missing');
  const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: anonKey, 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const body = await response.json().catch(() => null);
  assert.equal(response.status, 200, 'Supabase password login failed');
  assert.ok(body?.access_token, 'Supabase auth session is incomplete');
  return { supabaseUrl, anonKey, accessToken: body.access_token, authSource: 'password_grant' };
}

async function readHome({ supabaseUrl, anonKey, accessToken }, assetCode) {
  const response = await fetch(`${supabaseUrl}/functions/v1/ll-dashboard-api`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
      origin: 'https://kylee94.github.io',
    },
    body: JSON.stringify({ action: 'v2/home/read', payload: { asset_code: assetCode } }),
  });
  const body = await response.json().catch(() => null);
  assert.equal(response.status, 200, `v2/home/read HTTP ${response.status}`);
  assert.equal(body?.ok, true, 'v2/home/read did not return ok:true');
  assert.equal(body?.status, 'primary', 'v2/home/read was not primary');
  assert.ok(body?.data?.asset, 'v2/home/read asset is missing');
  return body;
}

async function main() {
  const assetCode = flagValue('asset-code', TARGET_ASSET_CODE);
  assert.equal(assetCode, TARGET_ASSET_CODE, 'This diagnostic is scoped to A112527001');
  const auth = await acquireAuthenticatedSession();
  const home = await readHome(auth, assetCode);
  const contractPath = path.join(ROOT, 'src', 'features', 'logistics-data-platform', 'documentContract.js');
  const { buildHomeDocumentPayload } = await import(`${pathToFileURL(contractPath).href}?qa=${Date.now()}`);
  const canonicalReadDocument = buildHomeDocumentPayload(home.data);
  const browserDraft = browserCloneHomeData(home.data);
  const originalLand = Number(browserDraft.asset?.land_area_sqm);
  assert.ok(Number.isFinite(originalLand), 'Target asset land_area_sqm is not numeric');
  browserDraft.asset.land_area_sqm = String(originalLand + 1);
  const incidentBrowserDocument = buildIncidentHomeDocumentPayload(browserDraft);
  const currentBrowserDocument = buildHomeDocumentPayload(browserDraft);
  const typeDiffs = collectTypeDiffs(canonicalReadDocument, incidentBrowserDocument);
  const nestedNumericTypeDiffs = typeDiffs.filter(({ path: fieldPath }) => (
    /funds\[\d+\]\.(?:investments|loans)\[\d+\]\.(?:agreed_amount_krw|contributed_amount_krw|coupon_rate|all_in_rate)$/u
      .test(fieldPath)
  ));
  const violations = validateHomeNestedNumbers(incidentBrowserDocument);
  const currentViolations = validateHomeNestedNumbers(currentBrowserDocument);
  const firstViolation = violations[0] || null;
  const funds = Array.isArray(incidentBrowserDocument.funds) ? incidentBrowserDocument.funds : [];

  process.stdout.write(`${JSON.stringify({
    ok: true,
    mode: 'production-read-only-local-browser-payload-reconstruction',
    asset_code: assetCode,
    production_network_actions: ['auth/session', 'v2/home/read'],
    production_mutation_used: false,
    reconstructed_edit: {
      path: 'asset.land_area_sqm',
      read_type: jsonType(canonicalReadDocument.asset?.land_area_sqm),
      browser_type: jsonType(incidentBrowserDocument.asset?.land_area_sqm),
      raw_values_omitted: true,
    },
    revision_presence: {
      response_revision: Object.hasOwn(home, 'revision'),
      asset_revision: Object.hasOwn(home.data.asset, 'revision'),
      fund_revision: Object.hasOwn(home.data.funds?.[0] || {}, 'revision'),
    },
    document_counts: {
      fund_count: funds.length,
      investment_count: funds.reduce((sum, fund) => sum + (fund.investments?.length || 0), 0),
      loan_count: funds.reduce((sum, fund) => sum + (fund.loans?.length || 0), 0),
    },
    nested_numeric_type_differences: nestedNumericTypeDiffs,
    nested_numeric_type_difference_count: nestedNumericTypeDiffs.length,
    sql_contract_violations: violations,
    first_sql_rule: firstViolation?.code || null,
    current_repository_builder: {
      sql_contract_violation_count: currentViolations.length,
      nested_empty_numbers_are_omitted_or_numeric: currentViolations.length === 0,
    },
    predicted_edge_response: firstViolation ? {
      http_status: 422,
      message: 'BUSINESS_RULE_VIOLATION',
      detail_retryable: false,
      sql_rule: firstViolation.code,
      path: firstViolation.path,
    } : null,
    raw_values_omitted: true,
  }, null, 2)}\n`);
}

module.exports = {
  browserCloneHomeData,
  buildIncidentHomeDocumentPayload,
  collectTypeDiffs,
  jsonType,
  validateHomeNestedNumbers,
};

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`${error.stack || error.message}\n`);
    process.exit(1);
  });
}
