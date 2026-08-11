#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { assertQaMutationOptIn } = require('./lib/qa-mutation-guard.cjs');

const ROOT = path.resolve(__dirname, '..', '..');

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

const envRoot = path.resolve(argValue('env-root', ROOT));
const fileEnv = {
  ...readEnvFile(path.join(envRoot, '.env')),
  ...readEnvFile(path.join(envRoot, '.env.local')),
};
const envValue = (...names) => names
  .map((name) => process.env[name] || fileEnv[name] || '')
  .find(Boolean) || '';
const supabaseUrl = envValue('LOGISTICS_SUPABASE_URL', 'VITE_SUPABASE_URL').replace(/\/$/u, '');
const anonKey = envValue('LOGISTICS_SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY');
const accessTokenFromEnv = envValue('LOGISTICS_SUPABASE_ACCESS_TOKEN');
const authEmail = envValue('LOGISTICS_SUPABASE_EMAIL', 'LOGISTICS_SUPABASE_AUTH_EMAIL');
const authPassword = envValue('LOGISTICS_SUPABASE_PASSWORD', 'LOGISTICS_SUPABASE_AUTH_PASSWORD');

assert.ok(supabaseUrl && anonKey, 'Supabase URL/anon key is missing');

async function accessToken() {
  if (accessTokenFromEnv) return accessTokenFromEnv;
  assert.ok(authEmail && authPassword, 'Supabase QA login credentials are missing');
  const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: anonKey, 'content-type': 'application/json' },
    body: JSON.stringify({ email: authEmail, password: authPassword }),
  });
  const body = await response.json().catch(() => ({}));
  assert.equal(response.status, 200, `Supabase Auth login failed: ${body.message || response.status}`);
  assert.ok(body.access_token, 'Supabase Auth response has no access token');
  return body.access_token;
}

async function invoke(action, token, payload = {}) {
  const response = await fetch(`${supabaseUrl}/functions/v1/ll-dashboard-api`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      origin: 'https://kylee94.github.io',
    },
    body: JSON.stringify({ action, payload }),
  });
  const body = await response.json().catch(() => ({}));
  assert.equal(response.ok, true, `${action} HTTP ${response.status}: ${body.error || body.message || 'unknown'}`);
  assert.equal(body.ok, true, `${action} did not return ok:true`);
  assert.equal(body.status, 'primary', `${action} did not return primary data`);
  return body;
}

function financePayload(assetKey) {
  return {
    asset_key: assetKey,
    start_month: '2026-08',
    end_month: '2026-08',
    scenario: 'actual',
    accounting_basis: 'accrual',
  };
}

function findAccount(body, accountCode) {
  return (Array.isArray(body.data?.accounts) ? body.data.accounts : [])
    .find((account) => account.account_code === accountCode);
}

async function main() {
  assertQaMutationOptIn({
    flag: 'allow-mutation',
    purpose: 'Current addendum create/delete live probe',
  });
  const token = await accessToken();
  const bootstrap = await invoke('v2/home/read', token, {});
  const assets = Array.isArray(bootstrap.data?.assets) ? bootstrap.data.assets : [];
  assert.ok(assets.length >= 2, 'At least two readable assets are required');

  const homeAssetName = argValue('home-asset-name', '아레나스양지물류센터');
  const homeAsset = assets.find((asset) => asset.name === homeAssetName);
  assert.ok(homeAsset?.asset_key, `Readable home asset not found: ${homeAssetName}`);
  const home = await invoke('v2/home/read', token, { asset_key: homeAsset.asset_key });
  const building = home.data?.asset || {};
  const buildingFields = [
    'building_area_sqm',
    'primary_use',
    'building_coverage_ratio',
    'floor_area_ratio',
    'structure_text',
    'parking_count',
  ];
  for (const field of buildingFields) {
    assert.notEqual(building[field], null, `HOME_BUILDING_FIELD_MISSING:${field}`);
    assert.notEqual(building[field], '', `HOME_BUILDING_FIELD_EMPTY:${field}`);
  }
  assert.equal(home.data?.asset_source_provenance?.building_register_match, 'cache_asset_id');

  const primaryAsset = homeAsset;
  const comparisonAsset = assets.find((asset) => asset.asset_key !== primaryAsset.asset_key);
  assert.ok(comparisonAsset?.asset_key, 'Comparison asset is missing');
  const accountCode = `CUSTOM:${randomUUID()}`;
  const accountName = `QA 자산범위 검증 ${new Date().toISOString().slice(0, 19)}`;
  let createdRevision = null;
  let deleted = false;

  try {
    const create = await invoke('v2/finance/batch-save', token, {
      asset_key: primaryAsset.asset_key,
      client_request_id: randomUUID(),
      expected_revisions: {},
      entries: [],
      account_operations: [{
        operation: 'create',
        account_code: accountCode,
        record: {
          name_ko: accountName,
          statement_section: 'operating_expense',
          normal_sign: -1,
          display_order: 9990,
        },
      }],
      selection_operations: [{ operation: 'upsert', account_code: accountCode, selected: true }],
    });
    const createMutation = (create.data?.account_mutations_readback || [])
      .find((mutation) => mutation.account_code === accountCode && mutation.operation === 'create');
    assert.equal(createMutation?.active, true, 'Create mutation readback is not active');

    const primaryRead = await invoke('v2/finance/read', token, financePayload(primaryAsset.asset_key));
    const createdAccount = findAccount(primaryRead, accountCode);
    assert.ok(createdAccount, 'Created account is missing from its asset');
    assert.equal(createdAccount.is_custom, true);
    assert.equal(createdAccount.asset_key, primaryAsset.asset_key);
    assert.equal(createdAccount.selected, true);
    createdRevision = createdAccount.revision;
    assert.ok(Number.isInteger(createdRevision), 'Created account revision is missing');

    const comparisonRead = await invoke('v2/finance/read', token, financePayload(comparisonAsset.asset_key));
    assert.equal(findAccount(comparisonRead, accountCode), undefined, 'Custom account leaked into another asset');
    assert.equal(
      (comparisonRead.data?.archived_accounts || []).some((account) => account.account_code === accountCode),
      false,
      'Custom account archive leaked into another asset',
    );

    const remove = await invoke('v2/finance/batch-save', token, {
      asset_key: primaryAsset.asset_key,
      client_request_id: randomUUID(),
      expected_revisions: {},
      entries: [],
      account_operations: [{
        operation: 'delete',
        account_code: accountCode,
        expected_revision: createdRevision,
      }],
      selection_operations: [],
    });
    const deleteMutation = (remove.data?.account_mutations_readback || [])
      .find((mutation) => mutation.account_code === accountCode && mutation.operation === 'delete');
    assert.equal(deleteMutation?.active, false, 'Delete mutation readback is still active');
    assert.ok(deleteMutation?.deleted_at, 'Delete mutation has no tombstone timestamp');
    deleted = true;

    const deletedRead = await invoke('v2/finance/read', token, financePayload(primaryAsset.asset_key));
    assert.equal(findAccount(deletedRead, accountCode), undefined, 'Deleted account remains active');
    const archived = (deletedRead.data?.archived_accounts || [])
      .find((account) => account.account_code === accountCode);
    assert.ok(archived, 'Deleted account is missing from its asset archive');
    assert.equal(archived.active, false);
    assert.equal(archived.asset_key, primaryAsset.asset_key);

    console.log(JSON.stringify({
      ok: true,
      home: {
        asset_key: homeAsset.asset_key,
        asset_name: homeAsset.name,
        building_register_match: home.data.asset_source_provenance.building_register_match,
        values: Object.fromEntries(buildingFields.map((field) => [field, building[field]])),
      },
      finance: {
        primary_asset_key: primaryAsset.asset_key,
        comparison_asset_key: comparisonAsset.asset_key,
        account_code: accountCode,
        create_readback: 'verified',
        cross_asset_visibility: 0,
        delete_readback: 'verified',
        archived_in_primary_asset: true,
        ledger_entry_writes: 0,
      },
    }, null, 2));
  } finally {
    if (createdRevision != null && !deleted) {
      const latest = await invoke('v2/finance/read', token, financePayload(primaryAsset.asset_key));
      const active = findAccount(latest, accountCode);
      if (active?.revision != null) {
        await invoke('v2/finance/batch-save', token, {
          asset_key: primaryAsset.asset_key,
          client_request_id: randomUUID(),
          expected_revisions: {},
          entries: [],
          account_operations: [{
            operation: 'delete',
            account_code: accountCode,
            expected_revision: active.revision,
          }],
          selection_operations: [],
        });
      }
    }
  }
}

main().catch((error) => {
  console.error(error?.stack || error);
  process.exitCode = 1;
});
