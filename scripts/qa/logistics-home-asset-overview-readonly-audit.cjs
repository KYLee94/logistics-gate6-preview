#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const DEFAULT_ENV_ROOT = path.resolve(ROOT, '..', 'IGIS-Fund-Production-DP');
const ALLOWED_ACTION = 'v2/home/read';
const EXCLUDED_ASSET_CODES = new Set(['A112127001', 'AP00014001']);
const OVERVIEW_FIELDS = Object.freeze([
  'name',
  'address',
  'zoning_text',
  'land_area_sqm',
  'building_area_sqm',
  'gross_area_sqm',
  'leasable_area_sqm',
  'primary_use',
  'building_coverage_ratio',
  'floor_area_ratio',
  'floor_count',
  'structure_text',
  'parking_count',
  'completion_date',
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

function isMissing(value) {
  return value === null || value === undefined || String(value).trim() === '';
}

function auditAssetOverview(data = {}) {
  const asset = data.asset || {};
  const provenance = data.asset_source_provenance || {};
  const fields = Object.fromEntries(OVERVIEW_FIELDS.map((field) => [field, {
    value: isMissing(asset[field]) ? null : asset[field],
    missing: isMissing(asset[field]),
    source: provenance[field] || null,
  }]));
  const missingFields = OVERVIEW_FIELDS.filter((field) => fields[field].missing);
  return {
    asset_code: asset.asset_code || null,
    asset_name: asset.name || null,
    building_register_match: provenance.building_register_match || null,
    building_register_provider: provenance.building_register_provider || null,
    building_register_fetched_at: provenance.building_register_fetched_at || null,
    missing_field_count: missingFields.length,
    missing_fields: missingFields,
    fields,
  };
}

function emitReport(report) {
  const serialized = `${JSON.stringify(report, null, 2)}\n`;
  const outputPath = argValue('output');
  if (outputPath) fs.writeFileSync(path.resolve(outputPath), serialized, 'utf8');
  process.stdout.write(serialized);
}

async function acquireAuthenticatedSession(config) {
  assert.ok(config.supabaseUrl && config.anonKey, 'Supabase URL/anon key is missing');
  if (config.accessToken) return config.accessToken;
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
  assert.equal(ALLOWED_ACTION, 'v2/home/read');
  const response = await fetch(`${config.supabaseUrl}/functions/v1/ll-dashboard-api`, {
    method: 'POST',
    headers: {
      apikey: config.anonKey,
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      origin: 'https://kylee94.github.io',
    },
    body: JSON.stringify({ action: ALLOWED_ACTION, payload }),
  });
  const body = await response.json().catch(() => null);
  assert.equal(response.ok, true, `${ALLOWED_ACTION} HTTP ${response.status}`);
  assert.equal(body?.ok, true, `${ALLOWED_ACTION} missing ok:true`);
  assert.equal(body?.status, 'primary', `${ALLOWED_ACTION} is not primary`);
  return body;
}

async function main() {
  const config = runtimeConfig();
  const token = await acquireAuthenticatedSession(config);
  const asOfDate = argValue('as-of-date', todayKst());
  const bootstrap = await invokeHomeRead(config, token, { as_of_date: asOfDate });
  const directory = Array.isArray(bootstrap.data?.assets) ? bootstrap.data.assets : [];
  const visibleDirectory = directory.filter((asset) => (
    !EXCLUDED_ASSET_CODES.has(String(asset.asset_code || '').trim().toUpperCase())
  ));
  const assets = [];
  for (const entry of visibleDirectory) {
    const assetCode = entry.asset_code || entry.asset_key;
    const response = await invokeHomeRead(config, token, {
      asset_code: assetCode,
      as_of_date: asOfDate,
    });
    assets.push(auditAssetOverview(response.data));
  }
  const missingCountsByField = Object.fromEntries(OVERVIEW_FIELDS.map((field) => [
    field,
    assets.filter((asset) => asset.fields[field].missing).length,
  ]));
  const report = {
    ok: assets.length === 17,
    mode: 'production_read_only_home_asset_overview_audit',
    generated_at: new Date().toISOString(),
    as_of_date: asOfDate,
    allowed_actions: [ALLOWED_ACTION],
    operating_network_used: true,
    database_write_used: false,
    api_directory_count: directory.length,
    excluded_asset_codes: [...EXCLUDED_ASSET_CODES],
    visible_asset_count: assets.length,
    complete_asset_count: assets.filter((asset) => asset.missing_field_count === 0).length,
    missing_counts_by_field: missingCountsByField,
    assets,
  };
  emitReport(report);
  if (!report.ok) process.exitCode = 1;
}

module.exports = {
  OVERVIEW_FIELDS,
  auditAssetOverview,
  isMissing,
};

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`${JSON.stringify({ ok: false, error: error.message }, null, 2)}\n`);
    process.exit(1);
  });
}
