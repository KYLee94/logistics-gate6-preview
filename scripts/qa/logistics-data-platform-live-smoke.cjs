#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

const root = path.resolve(__dirname, '..', '..');

function argValue(name, fallback = '') {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : (process.argv[index + 1] || fallback);
}

function hasArg(name) {
  return process.argv.includes(`--${name}`);
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

const envRoot = path.resolve(argValue('env-root', root));
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
const expectedWriteState = argValue('expect-write', 'locked');
const validateSafeWrites = hasArg('validate-safe-writes');

assert.ok(supabaseUrl && anonKey, 'Supabase URL/anon key is missing');
assert.ok(['locked', 'enabled'].includes(expectedWriteState), '--expect-write must be locked or enabled');

async function accessToken() {
  if (accessTokenFromEnv) return { token: accessTokenFromEnv, source: 'access_token' };
  assert.ok(authEmail && authPassword, 'Supabase QA login credentials are missing');
  const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: anonKey, 'content-type': 'application/json' },
    body: JSON.stringify({ email: authEmail, password: authPassword }),
  });
  const body = await response.json();
  assert.equal(response.status, 200, `Supabase Auth login failed: ${body?.message || response.status}`);
  assert.ok(body?.access_token, 'Supabase Auth response has no access token');
  return { token: body.access_token, source: 'password_grant' };
}

async function invoke(action, token, request = {}) {
  const response = await fetch(`${supabaseUrl}/functions/v1/ll-dashboard-api`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      origin: 'https://kylee94.github.io',
    },
    body: JSON.stringify({ action, payload: request }),
  });
  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text.slice(0, 500) };
  }
  if (response.status !== 200) {
    const rpcName = {
      'v2/home/read': 'home_read',
      'v2/rent-roll/read': 'rent_roll_read',
      'v2/rent-roll/batch-save': 'rent_roll_batch_save',
      'v2/finance/read': 'finance_read',
      'v2/finance/batch-save': 'finance_batch_save',
      'v2/maturities/read': 'maturities_read',
    }[action];
    let rpcDiagnostic = null;
    if (rpcName) {
      const directResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/${rpcName}`, {
        method: 'POST',
        headers: {
          apikey: anonKey,
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
          'content-profile': 'logistics_api',
          'accept-profile': 'logistics_api',
        },
        body: JSON.stringify({
          p_request_id: request.client_request_id || randomUUID(),
          p_asset_key: request.asset_key || null,
          p_payload: request,
          p_expected_revisions: request.expected_revisions || {},
        }),
      });
      rpcDiagnostic = {
        status: directResponse.status,
        body: (await directResponse.text()).slice(0, 1000),
      };
    }
    throw new Error(`${action} returned ${response.status}: ${body?.error || body?.message || text.slice(0, 300)}; rpc=${JSON.stringify(rpcDiagnostic)}`);
  }
  assert.equal(body?.ok, true, `${action} did not return ok:true`);
  assert.equal(body?.status, 'primary', `${action} did not return primary data`);
  assert.ok(body?.request_id, `${action} request_id is missing`);
  assert.ok(Object.prototype.hasOwnProperty.call(body, 'revision'), `${action} revision is missing`);
  assert.ok(body?.data && typeof body.data === 'object', `${action} data is missing`);
  return body;
}

function assertWriteState(action, body) {
  const expected = expectedWriteState === 'enabled';
  assert.equal(body.data.write_enabled, expected, `${action} write state mismatch`);
  assert.equal(typeof body.data.write_reason, 'string', `${action} write reason is missing`);
}

function sameBusinessValues(before, after) {
  const keys = [
    'space_key', 'tenant_key', 'tenant_name', 'occupancy_status', 'use_category',
    'floor_label', 'zone_label', 'exclusive_area_sqm', 'common_area_sqm',
    'leased_area_sqm', 'commencement_date', 'expiry_date', 'deposit_total_krw',
    'monthly_rent_total_krw', 'monthly_cam_total_krw',
  ];
  return Object.fromEntries(keys.map((key) => [key, before?.[key] ?? null]))
    && assert.deepEqual(
      Object.fromEntries(keys.map((key) => [key, after?.[key] ?? null])),
      Object.fromEntries(keys.map((key) => [key, before?.[key] ?? null])),
      'no-op rent-roll validation changed business values',
    );
}

async function main() {
  const auth = await accessToken();
  const homeBootstrap = await invoke('v2/home/read', auth.token, {});
  const assets = Array.isArray(homeBootstrap.data.assets) ? homeBootstrap.data.assets : [];
  assert.ok(assets.length > 0, 'No readable assets were returned');
  const assetKey = argValue('asset-key', assets[0].asset_key);
  assert.ok(assetKey, 'Selected asset key is missing');

  const month = new Date(Date.now() + (9 * 60 * 60 * 1000)).toISOString().slice(0, 7);
  const home = await invoke('v2/home/read', auth.token, { asset_key: assetKey });
  const rentRoll = await invoke('v2/rent-roll/read', auth.token, { asset_key: assetKey });
  const finance = await invoke('v2/finance/read', auth.token, {
    asset_key: assetKey,
    start_month: month,
    end_month: month,
    scenario: 'actual',
    accounting_basis: 'accrual',
  });
  const maturities = await invoke('v2/maturities/read', auth.token, { asset_key: assetKey });
  assertWriteState('v2/rent-roll/read', rentRoll);
  assertWriteState('v2/finance/read', finance);
  const rentRows = Array.isArray(rentRoll.data.rows) ? rentRoll.data.rows : [];
  const selectableTenants = Array.isArray(rentRoll.data.tenants) ? rentRoll.data.tenants : [];
  const investments = Array.isArray(home.data.investments) ? home.data.investments : [];
  const maturityRows = Array.isArray(maturities.data.maturities)
    ? maturities.data.maturities
    : (Array.isArray(maturities.data.items) ? maturities.data.items : []);
  assert.equal(
    rentRows.some((row) => row.tenant_name && row.tenant_name === row.tenant_key),
    false,
    'rent-roll exposes an internal tenant identifier as a visible name',
  );
  assert.equal(
    selectableTenants.some((tenant) => tenant.tenant_name && tenant.tenant_name === tenant.tenant_key),
    false,
    'tenant selector exposes an unresolved placeholder identifier',
  );
  assert.equal(
    rentRows.every((row) => Number.isFinite(Number(row.display_order))),
    true,
    'rent-roll display order is missing',
  );

  const writeEvidence = [];
  if (validateSafeWrites) {
    assert.equal(expectedWriteState, 'enabled', 'Safe write validation requires --expect-write enabled');
    const beforeRows = Array.isArray(rentRoll.data.rows) ? rentRoll.data.rows : [];
    const before = beforeRows.find((row) => row?.space_key && Number(row?.revision) > 0);
    assert.ok(before, 'No existing rent-roll row is available for no-op validation');

    const rentSave = await invoke('v2/rent-roll/batch-save', auth.token, {
      asset_key: assetKey,
      client_request_id: randomUUID(),
      expected_revisions: { [before.space_key]: Number(before.revision) },
      operations: [{
        entity: 'space',
        operation: 'update',
        entity_key: before.space_key,
        expected_revision: Number(before.revision),
        reason: 'release_validation_no_business_value_change',
        record: {},
      }],
    });
    const rentReadback = await invoke('v2/rent-roll/read', auth.token, { asset_key: assetKey });
    const after = rentReadback.data.rows.find((row) => row?.space_key === before.space_key);
    assert.ok(after, 'Updated rent-roll row is missing from readback');
    sameBusinessValues(before, after);
    assert.ok(Number(after.revision) > Number(before.revision), 'Rent-roll no-op validation did not advance revision');
    writeEvidence.push({ action: 'rent_roll_noop_update', revision: rentSave.revision, readback_revision: after.revision });

    const financeSave = await invoke('v2/finance/batch-save', auth.token, {
      asset_key: assetKey,
      client_request_id: randomUUID(),
      expected_revisions: {},
      entries: [],
    });
    const financeReadback = await invoke('v2/finance/read', auth.token, {
      asset_key: assetKey,
      start_month: month,
      end_month: month,
      scenario: 'actual',
      accounting_basis: 'accrual',
    });
    assert.deepEqual(financeReadback.data.entries, [], 'Finance safe validation created a business row');
    writeEvidence.push({ action: 'finance_empty_batch', revision: financeSave.revision, active_rows: 0 });
  }

  process.stdout.write(`${JSON.stringify({
    ok: true,
    mode: 'live-data-platform-smoke',
    auth_source: auth.source,
    asset_key: assetKey,
    expected_write_state: expectedWriteState,
    counts: {
      readable_assets: assets.length,
      home_funds: home.data.funds?.length || 0,
      home_investments: investments.length,
      home_loans: home.data.loans?.length || 0,
      rent_roll_rows: rentRows.length,
      selectable_tenants: selectableTenants.length,
      finance_rows: finance.data.entries?.length || 0,
      maturities: maturityRows.length,
    },
    write_evidence: writeEvidence,
  }, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exit(1);
});
