#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const DEFAULT_ENV_ROOT = path.resolve(ROOT, '..', 'IGIS-Fund-Production-DP');
const HOME_READ_ACTION = 'v2/home/read';
const EXPECTED_ASSET_COUNT = 19;
const EXPECTED_FUND_COUNT = 17;
const EXPECTED_AUM_SOURCE = '펀드 AUM 관리_20260713.xlsx';
const EXPECTED_AUM_BASE_DATE = '2026-06-30';
const EXPECTED_NULL_FUND_ID = 'S00002';
const EXPECTED_NULL_BASE_DATE_FUND_ID = 'P00014';
const EXPECTED_NULL_AUM_SOURCE = '펀드 AUM 관리_20260515.xlsx';

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

function normalizedId(value) {
  return String(value ?? '').trim();
}

function optionalNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function auditAuthoritativeAumRows(rows, expectedFundCodes) {
  const expectedFundIds = [...new Set(expectedFundCodes.map(normalizedId).filter(Boolean))].sort();
  const normalizedRows = (Array.isArray(rows) ? rows : []).map((row) => ({
    fund_id: normalizedId(row?.fund_id),
    benchmark_aum: optionalNumber(row?.benchmark_aum),
    invested_aum: optionalNumber(row?.invested_aum),
    aum_source: row?.aum_source ?? null,
    aum_base_date: row?.aum_base_date ?? null,
  }));
  const rowsByFundId = new Map(expectedFundIds.map((fundId) => [fundId, []]));
  for (const row of normalizedRows) {
    if (rowsByFundId.has(row.fund_id)) rowsByFundId.get(row.fund_id).push(row);
  }
  const missingFundIds = expectedFundIds.filter((fundId) => rowsByFundId.get(fundId).length === 0);
  const duplicateFundIds = expectedFundIds.filter((fundId) => rowsByFundId.get(fundId).length > 1);
  const unmatchedFundIds = [...new Set(normalizedRows
    .map((row) => row.fund_id)
    .filter((fundId) => !rowsByFundId.has(fundId)))].sort();
  const exactRows = expectedFundIds
    .filter((fundId) => rowsByFundId.get(fundId).length === 1)
    .map((fundId) => rowsByFundId.get(fundId)[0]);
  const nullAumFundIds = exactRows
    .filter((row) => row.benchmark_aum === null && row.invested_aum === null)
    .map((row) => row.fund_id)
    .sort();
  const authoritativeRows = exactRows.filter((row) => (
    row.benchmark_aum !== null && row.invested_aum !== null
  ));
  const invalidValueFundIds = exactRows
    .filter((row) => (
      (row.benchmark_aum === null) !== (row.invested_aum === null)
    ))
    .map((row) => row.fund_id)
    .sort();
  const matchedRows = normalizedRows.filter((row) => rowsByFundId.has(row.fund_id));
  const invalidProvenanceFundIds = [...new Set(matchedRows
    .filter((row) => (
      row.fund_id !== EXPECTED_NULL_FUND_ID
      && (
        row.aum_source !== EXPECTED_AUM_SOURCE
        || (
          row.fund_id === EXPECTED_NULL_BASE_DATE_FUND_ID
            ? row.aum_base_date !== null
            : row.aum_base_date !== EXPECTED_AUM_BASE_DATE
        )
      )
    ))
    .map((row) => row.fund_id))]
    .sort();
  const nullAumProvenance = exactRows
    .filter((row) => row.fund_id === EXPECTED_NULL_FUND_ID)
    .map((row) => ({
      fund_id: row.fund_id,
      aum_source: row.aum_source,
      aum_base_date: row.aum_base_date,
    }));
  const invalidNullAumProvenanceFundIds = exactRows
    .filter((row) => (
      row.fund_id === EXPECTED_NULL_FUND_ID
      && (
        row.aum_source !== EXPECTED_NULL_AUM_SOURCE
        || row.aum_base_date !== null
      )
    ))
    .map((row) => row.fund_id);
  const ok = (
    exactRows.length === expectedFundIds.length
    && missingFundIds.length === 0
    && duplicateFundIds.length === 0
    && unmatchedFundIds.length === 0
    && invalidValueFundIds.length === 0
    && invalidProvenanceFundIds.length === 0
    && invalidNullAumProvenanceFundIds.length === 0
    && nullAumFundIds.length === 1
    && nullAumFundIds[0] === EXPECTED_NULL_FUND_ID
  );
  return {
    ok,
    expected_fund_count: expectedFundIds.length,
    exact_match_count: exactRows.length,
    authoritative_value_count: authoritativeRows.length,
    expected_source: EXPECTED_AUM_SOURCE,
    expected_base_date: EXPECTED_AUM_BASE_DATE,
    missing_fund_ids: missingFundIds,
    duplicate_fund_ids: duplicateFundIds,
    unmatched_fund_ids: unmatchedFundIds,
    invalid_value_fund_ids: invalidValueFundIds,
    invalid_provenance_fund_ids: invalidProvenanceFundIds,
    invalid_null_aum_provenance_fund_ids: invalidNullAumProvenanceFundIds,
    null_aum_provenance: nullAumProvenance,
    null_aum_fund_ids: nullAumFundIds,
    matrix: exactRows.sort((left, right) => left.fund_id.localeCompare(right.fund_id)),
  };
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
  const action = HOME_READ_ACTION;
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
  return body;
}

async function collectCurrentFundCodes(config, token, asOfDate) {
  const bootstrap = await invokeHomeRead(config, token, { as_of_date: asOfDate });
  const assets = Array.isArray(bootstrap.data?.assets) ? bootstrap.data.assets : [];
  assert.equal(assets.length, EXPECTED_ASSET_COUNT, 'CURRENT_HOME_ASSET_COUNT_MISMATCH');
  const fundCodes = [];
  for (const asset of assets) {
    const assetCode = asset.asset_code || asset.asset_key;
    const response = await invokeHomeRead(config, token, {
      asset_code: assetCode,
      as_of_date: asOfDate,
    });
    const funds = Array.isArray(response.data?.funds) ? response.data.funds : [];
    assert.equal(funds.length, 1, `CURRENT_HOME_FUND_COUNT_MISMATCH:${assetCode}`);
    const fundCode = normalizedId(funds[0]?.fund_code);
    assert.ok(fundCode, `CURRENT_HOME_FUND_CODE_MISSING:${assetCode}`);
    fundCodes.push(fundCode);
  }
  const uniqueFundCodes = [...new Set(fundCodes)].sort();
  assert.equal(uniqueFundCodes.length, EXPECTED_FUND_COUNT, 'CURRENT_HOME_UNIQUE_FUND_COUNT_MISMATCH');
  return uniqueFundCodes;
}

async function readAuthoritativeAumRows(config, token, fundCodes) {
  const query = new URLSearchParams({
    select: 'fund_id,benchmark_aum,invested_aum,aum_source,aum_base_date',
    fund_id: `in.(${fundCodes.join(',')})`,
    order: 'fund_id.asc',
  });
  const response = await fetch(`${config.supabaseUrl}/rest/v1/v_funds_enriched?${query}`, {
    method: 'GET',
    headers: {
      apikey: config.anonKey,
      authorization: `Bearer ${token}`,
      accept: 'application/json',
    },
  });
  const rows = await response.json().catch(() => null);
  assert.equal(response.ok, true, `v_funds_enriched HTTP ${response.status}`);
  assert.ok(Array.isArray(rows), 'v_funds_enriched response is not an array');
  return rows;
}

async function main() {
  const config = runtimeConfig();
  const token = await acquireAuthenticatedSession(config);
  const asOfDate = argValue('as-of-date', todayKst());
  const currentFundCodes = await collectCurrentFundCodes(config, token, asOfDate);
  const sourceRows = await readAuthoritativeAumRows(config, token, currentFundCodes);
  const audit = auditAuthoritativeAumRows(sourceRows, currentFundCodes);
  const report = {
    ok: audit.ok,
    mode: 'production_read_only_authoritative_fund_aum_audit',
    generated_at: new Date().toISOString(),
    as_of_date: asOfDate,
    allowed_actions: [HOME_READ_ACTION, 'GET public.v_funds_enriched'],
    operating_network_used: true,
    database_write_used: false,
    current_fund_codes: currentFundCodes,
    ...audit,
  };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (!report.ok) process.exitCode = 1;
}

module.exports = {
  auditAuthoritativeAumRows,
};

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`${error.stack || error.message || error}\n`);
    process.exitCode = 1;
  });
}
