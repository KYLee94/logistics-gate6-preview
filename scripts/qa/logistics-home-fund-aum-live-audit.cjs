#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const DEFAULT_ENV_ROOT = path.resolve(ROOT, '..', 'IGIS-Fund-Production-DP');
const expectedAssetCount = 19;
const ALLOWED_ACTION = 'v2/home/read';
const DIRECT_AUM_FIELD_NAMES = new Set([
  'aum',
  'aum_krw',
  'assets_under_management',
  'assets_under_management_krw',
  'total_aum',
  'total_aum_krw',
  'fund_size',
  'fund_size_krw',
  'gross_asset_value',
  'gross_asset_value_krw',
  'nav',
  'nav_krw',
]);

function argValue(name, fallback = '') {
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

function runtimeConfig() {
  const envRoot = path.resolve(argValue('env-root', DEFAULT_ENV_ROOT));
  const fileEnv = {
    ...readEnvFile(path.join(envRoot, '.env')),
    ...readEnvFile(path.join(envRoot, '.env.local')),
  };
  const envValue = (...names) => names
    .map((name) => process.env[name] || fileEnv[name] || '')
    .find(Boolean) || '';
  return {
    supabaseUrl: envValue('LOGISTICS_SUPABASE_URL', 'VITE_SUPABASE_URL').replace(/\/$/u, ''),
    anonKey: envValue('LOGISTICS_SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY'),
    accessToken: envValue('LOGISTICS_SUPABASE_ACCESS_TOKEN'),
    email: envValue('LOGISTICS_SUPABASE_EMAIL', 'LOGISTICS_SUPABASE_AUTH_EMAIL'),
    password: envValue('LOGISTICS_SUPABASE_PASSWORD', 'LOGISTICS_SUPABASE_AUTH_PASSWORD'),
  };
}

function todayKst() {
  return new Date(Date.now() + (9 * 60 * 60 * 1000)).toISOString().slice(0, 10);
}

function finiteNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(String(value).replace(/,/gu, '').trim());
  return Number.isFinite(numeric) ? numeric : null;
}

function optionalSum(values) {
  const finiteValues = values.map(finiteNumber).filter((value) => value !== null);
  return finiteValues.length
    ? Number(finiteValues.reduce((sum, value) => sum + value, 0).toFixed(4))
    : null;
}

function directAumCandidates(row) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return [];
  return Object.entries(row)
    .filter(([field, value]) => DIRECT_AUM_FIELD_NAMES.has(field) && value !== null && value !== '')
    .map(([field, value]) => ({ field, value }));
}

function auditHomeFundProjection(data) {
  const funds = Array.isArray(data?.funds) ? data.funds : [];
  const investments = Array.isArray(data?.investments) ? data.investments : [];
  const fundRows = funds.map((fund, index) => ({
    index,
    fund_code: fund?.fund_code ?? null,
    fund_name: fund?.name ?? null,
    ownership_ratio: finiteNumber(fund?.ownership_ratio),
    raw_fund_keys: Object.keys(fund || {}).sort(),
    direct_aum_candidates: directAumCandidates(fund),
  }));
  const investmentRows = investments.map((investment, index) => ({
    index,
    tranche: investment?.tranche ?? null,
    beneficiary_name: investment?.beneficiary_name ?? null,
    agreed_amount_krw: finiteNumber(investment?.agreed_amount_krw),
    contributed_amount_krw: finiteNumber(investment?.contributed_amount_krw),
    raw_investment_keys: Object.keys(investment || {}).sort(),
    direct_aum_candidates: directAumCandidates(investment),
  }));
  const directFieldCount = [...fundRows, ...investmentRows]
    .reduce((sum, row) => sum + row.direct_aum_candidates.length, 0);
  const investmentTotals = {
    agreed_amount_krw: optionalSum(investmentRows.map((row) => row.agreed_amount_krw)),
    contributed_amount_krw: optionalSum(investmentRows.map((row) => row.contributed_amount_krw)),
  };
  const genericTrancheRows = investmentRows.filter((row) => (
    String(row.tranche || '').trim() === '수익자'
  ));
  const missingTrancheRows = investmentRows.filter((row) => (
    !String(row.tranche || '').trim()
  ));
  return {
    asset_code: data?.asset?.asset_code ?? null,
    asset_name: data?.asset?.name ?? null,
    fund_count: fundRows.length,
    investment_count: investmentRows.length,
    funds: fundRows,
    investments: investmentRows,
    investment_totals: investmentTotals,
    aum_candidate_evidence: {
      direct_field_count: directFieldCount,
      direct_aum_missing: directFieldCount === 0,
      derived_candidate_count: Object.values(investmentTotals)
        .filter((value) => value !== null).length,
    },
    generic_tranche_rows: genericTrancheRows.map((row) => row.index),
    missing_tranche_rows: missingTrancheRows.map((row) => row.index),
  };
}

function classifyGenericTrancheCause(audit) {
  if ((audit?.generic_tranche_rows || []).length > 0) {
    return 'api_stored_generic_tranche';
  }
  if ((audit?.missing_tranche_rows || []).length > 0) {
    return 'tranche_missing_not_generic';
  }
  return 'no_generic_tranche';
}

async function acquireAuthenticatedSession(config) {
  assert.ok(config.supabaseUrl && config.anonKey, 'Supabase URL/anon key is missing');
  if (config.accessToken) {
    const response = await fetch(`${config.supabaseUrl}/auth/v1/user`, {
      headers: { apikey: config.anonKey, authorization: `Bearer ${config.accessToken}` },
    });
    const user = await response.json().catch(() => null);
    assert.equal(response.status, 200, 'Supabase access token validation failed');
    assert.ok(user?.id, 'Supabase access token user is missing');
    return config.accessToken;
  }
  assert.ok(config.email && config.password, 'Supabase QA login credentials are missing');
  const response = await fetch(`${config.supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: config.anonKey, 'content-type': 'application/json' },
    body: JSON.stringify({ email: config.email, password: config.password }),
  });
  const session = await response.json().catch(() => null);
  assert.equal(response.status, 200, 'Supabase password login failed');
  assert.ok(session?.access_token && session?.user?.id, 'Supabase auth session is incomplete');
  return session.access_token;
}

async function invokeHomeRead(config, token, payload) {
  const action = ALLOWED_ACTION;
  assert.equal(action, 'v2/home/read', `READ_ONLY_ACTION_NOT_ALLOWED:${action}`);
  const response = await fetch(`${config.supabaseUrl}/functions/v1/ll-dashboard-api`, {
    method: 'POST',
    headers: {
      apikey: config.anonKey,
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      origin: 'https://kylee94.github.io',
    },
    body: JSON.stringify({ action, payload }),
  });
  const body = await response.json().catch(() => null);
  assert.equal(response.ok, true, `${action} HTTP ${response.status}`);
  assert.equal(body?.ok, true, `${action} missing ok:true`);
  assert.equal(body?.status, 'primary', `${action} is not primary`);
  assert.ok(body?.request_id, `${action} request_id missing`);
  return body;
}

async function collectOperatingMatrix(config, token, asOfDate) {
  const bootstrap = await invokeHomeRead(config, token, { as_of_date: asOfDate });
  const directory = Array.isArray(bootstrap.data?.assets) ? bootstrap.data.assets : [];
  assert.equal(directory.length, expectedAssetCount, `EXPECTED_${expectedAssetCount}_ASSETS_GOT_${directory.length}`);
  const matrix = [];
  for (const entry of directory) {
    const assetCode = entry.asset_code || entry.asset_key;
    const response = await invokeHomeRead(config, token, {
      asset_code: assetCode,
      as_of_date: asOfDate,
    });
    const audit = auditHomeFundProjection(response.data);
    matrix.push({
      ...audit,
      asset_code: audit.asset_code || assetCode,
      asset_name: audit.asset_name || entry.name || assetCode,
      generic_tranche_cause: classifyGenericTrancheCause(audit),
      request_id_present: Boolean(response.request_id),
    });
  }
  return matrix;
}

async function main() {
  const config = runtimeConfig();
  const token = await acquireAuthenticatedSession(config);
  const asOfDate = argValue('as-of-date', todayKst());
  const matrix = await collectOperatingMatrix(config, token, asOfDate);
  const bundangYatap = matrix.find((row) => row.asset_code === 'A190002001') || null;
  const report = {
    ok: matrix.length === expectedAssetCount,
    mode: 'production_read_only_home_fund_aum_audit',
    generated_at: new Date().toISOString(),
    as_of_date: asOfDate,
    allowed_actions: [ALLOWED_ACTION],
    operating_network_used: true,
    database_write_used: false,
    expected_asset_count: expectedAssetCount,
    asset_count: matrix.length,
    fund_count: matrix.reduce((sum, row) => sum + row.fund_count, 0),
    investment_count: matrix.reduce((sum, row) => sum + row.investment_count, 0),
    assets_with_ownership_ratio: matrix.filter((row) => (
      row.funds.some((fund) => fund.ownership_ratio !== null)
    )).map((row) => row.asset_code),
    assets_with_direct_aum_fields: matrix.filter((row) => (
      row.aum_candidate_evidence.direct_field_count > 0
    )).map((row) => row.asset_code),
    assets_with_investment_amount_candidates: matrix.filter((row) => (
      row.aum_candidate_evidence.derived_candidate_count > 0
    )).map((row) => row.asset_code),
    assets_with_generic_tranche: matrix.filter((row) => (
      row.generic_tranche_cause === 'api_stored_generic_tranche'
    )).map((row) => row.asset_code),
    bundang_yatap: bundangYatap,
    matrix,
  };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (!report.ok) process.exitCode = 1;
}

module.exports = {
  auditHomeFundProjection,
  classifyGenericTrancheCause,
  directAumCandidates,
};

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`${error.stack || error.message || error}\n`);
    process.exitCode = 1;
  });
}
