#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  randomUUID,
} = require('node:crypto');

const root = path.resolve(__dirname, '..', '..');

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
const email = envValue('LOGISTICS_SUPABASE_EMAIL', 'LOGISTICS_SUPABASE_AUTH_EMAIL');
const password = envValue('LOGISTICS_SUPABASE_PASSWORD', 'LOGISTICS_SUPABASE_AUTH_PASSWORD');

assert.ok(supabaseUrl && anonKey && email && password, 'Supabase audit credentials are missing');

async function accessToken() {
  const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: anonKey, 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const body = await response.json().catch(() => ({}));
  assert.equal(response.status, 200, `Supabase Auth login failed: ${body.message || response.status}`);
  assert.ok(body.access_token, 'Supabase Auth response has no access token');
  return body.access_token;
}

async function invokeRpc(token, rpcName, assetCode = null, payload = {}) {
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/${rpcName}`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      'content-profile': 'logistics_api',
      'accept-profile': 'logistics_api',
    },
    body: JSON.stringify({
      p_request_id: randomUUID(),
      p_asset_key: assetCode,
      p_payload: payload,
      p_expected_revisions: {},
    }),
  });
  const text = await response.text();
  let body;
  try { body = text ? JSON.parse(text) : null; } catch { body = { raw: text.slice(0, 500) }; }
  assert.equal(response.status, 200, `${rpcName} returned ${response.status}: ${text.slice(0, 500)}`);
  assert.equal(body?.ok, true, `${rpcName} did not return ok:true`);
  return body;
}

function duplicateValues(rows, key) {
  const counts = new Map();
  rows.forEach((row) => {
    const value = String(row?.[key] ?? '').trim();
    counts.set(value, (counts.get(value) || 0) + 1);
  });
  return [...counts.entries()].filter(([, count]) => count > 1).map(([value, count]) => ({ value, count }));
}

function numericValue(value) {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(String(value).replaceAll(',', '').trim());
  return Number.isFinite(numeric) ? numeric : null;
}

function occupancyFromRentRoll(rows) {
  const areas = rows.map((row) => ({
    area: numericValue(row?.leased_area_sqm),
    occupied: String(row?.occupancy_status || '').trim().toLowerCase() === 'occupied',
  })).filter(({ area }) => area !== null && area > 0);
  const denominatorAreaSqm = areas.reduce((sum, { area }) => sum + area, 0);
  const occupiedAreaSqm = areas
    .filter(({ occupied }) => occupied)
    .reduce((sum, { area }) => sum + area, 0);
  return {
    occupied_area_sqm: occupiedAreaSqm,
    denominator_area_sqm: denominatorAreaSqm,
    occupancy_rate: denominatorAreaSqm > 0
      ? Math.round((occupiedAreaSqm / denominatorAreaSqm) * 10000) / 100
      : null,
  };
}

function publicValue(value) {
  if (Array.isArray(value)) return value.map(publicValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !(
      key === 'id'
      || key.endsWith('_id')
      || key.endsWith('_key')
      || key === 'revision'
      || key.endsWith('_revision')
      || key.startsWith('source_')
      || key === 'source'
    ))
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, child]) => [key, publicValue(child)]));
}

function digest(value) {
  return createHash('sha256').update(JSON.stringify(publicValue(value))).digest('hex');
}

async function main() {
  const token = await accessToken();
  const bootstrap = await invokeRpc(token, 'home_read');
  const assets = Array.isArray(bootstrap.data?.assets) ? bootstrap.data.assets : [];
  assert.ok(assets.length, 'No readable assets were returned');

  const results = [];
  const backupDocuments = [];
  for (const asset of assets) {
    const assetCode = String(asset.asset_code || asset.asset_key || '').trim();
    const rpcAssetKey = String(asset.asset_key || asset.asset_code || '').trim();
    assert.ok(assetCode, `Asset code is missing for ${asset.name || 'unknown asset'}`);
    assert.ok(rpcAssetKey, `RPC asset key is missing for ${asset.name || 'unknown asset'}`);
    const [home, rentRoll, finance] = await Promise.all([
      invokeRpc(token, 'home_read', rpcAssetKey, { asset_key: rpcAssetKey }),
      invokeRpc(token, 'rent_roll_read', rpcAssetKey, { asset_key: rpcAssetKey, limit: 1000 }),
      invokeRpc(token, 'finance_read', rpcAssetKey, {
        asset_key: rpcAssetKey,
        start_month: '2025-01',
        end_month: '2027-12',
        scenario: 'actual',
        accounting_basis: 'accrual',
      }),
    ]);
    const funds = Array.isArray(home.data?.funds) ? home.data.funds : [];
    const rentRows = Array.isArray(rentRoll.data?.rows) ? rentRoll.data.rows : [];
    const financeAccounts = Array.isArray(finance.data?.accounts) ? finance.data.accounts : [];
    const correctedOccupancy = occupancyFromRentRoll(rentRows);
    const currentOccupancy = home.data?.occupancy_summary || home.data?.tenant_summary || {};
    backupDocuments.push({ asset_code: assetCode, home, rent_roll: rentRoll, finance });
    results.push({
      asset_code: assetCode,
      asset_name: home.data?.asset?.name || asset.name || '',
      fund_count: funds.length,
      fund_codes: funds.map((fund) => fund.fund_code || fund.fund_key || '').filter(Boolean),
      fund_payload_hashes: funds.map((fund) => ({
        fund_code: fund.fund_code || fund.fund_key || '',
        fund: digest(fund),
        investments: digest(home.data?.investments || []),
        loans: digest(home.data?.loans || []),
      })),
      investment_count: Array.isArray(home.data?.investments) ? home.data.investments.length : 0,
      loan_count: Array.isArray(home.data?.loans) ? home.data.loans.length : 0,
      rent_roll_rows: rentRows.length,
      asset_leasable_area_sqm: numericValue(home.data?.asset?.leasable_area_sqm),
      asset_gross_area_sqm: numericValue(home.data?.asset?.gross_area_sqm),
      current_occupancy_rate: numericValue(currentOccupancy.occupancy_rate),
      corrected_occupancy_rate: correctedOccupancy.occupancy_rate,
      corrected_occupied_area_sqm: correctedOccupancy.occupied_area_sqm,
      corrected_denominator_area_sqm: correctedOccupancy.denominator_area_sqm,
      duplicate_display_order: duplicateValues(rentRows, 'display_order'),
      finance_accounts: financeAccounts.length,
    });
  }

  const report = {
    checked_at: new Date().toISOString(),
    assets_checked: results.length,
    assets_with_multiple_funds: results.filter((row) => row.fund_count > 1),
    assets_without_fund: results.filter((row) => row.fund_count === 0).map((row) => row.asset_code),
    assets_with_duplicate_rent_order: results.filter((row) => row.duplicate_display_order.length),
    assets_with_occupancy_difference: results.filter((row) => (
      row.current_occupancy_rate !== row.corrected_occupancy_rate
    )).map((row) => ({
      asset_code: row.asset_code,
      asset_name: row.asset_name,
      current_occupancy_rate: row.current_occupancy_rate,
      corrected_occupancy_rate: row.corrected_occupancy_rate,
      occupied_area_sqm: row.corrected_occupied_area_sqm,
      rent_roll_denominator_area_sqm: row.corrected_denominator_area_sqm,
      asset_leasable_area_sqm: row.asset_leasable_area_sqm,
      asset_gross_area_sqm: row.asset_gross_area_sqm,
    })),
    repeated_fund_payload_conflicts: [...new Set(results.flatMap((row) => row.fund_codes))]
      .map((fundCode) => ({
        fund_code: fundCode,
        payloads: results.flatMap((row) => row.fund_payload_hashes)
          .filter((payload) => payload.fund_code === fundCode),
      }))
      .filter((row) => (
        new Set(row.payloads.map((payload) => payload.fund)).size > 1
        || new Set(row.payloads.map((payload) => payload.investments)).size > 1
        || new Set(row.payloads.map((payload) => payload.loans)).size > 1
      )),
    results,
  };
  const backupPath = argValue('backup-path');
  if (backupPath) {
    const resolvedBackupPath = path.resolve(backupPath);
    const keyPath = `${resolvedBackupPath}.key`;
    fs.mkdirSync(path.dirname(resolvedBackupPath), { recursive: true });
    const plaintext = Buffer.from(JSON.stringify({
      created_at: new Date().toISOString(),
      supabase_project: new URL(supabaseUrl).hostname.split('.')[0],
      documents: backupDocuments,
    }), 'utf8');
    const key = randomBytes(32);
    const nonce = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, nonce);
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const tag = cipher.getAuthTag();
    fs.writeFileSync(resolvedBackupPath, ciphertext, { mode: 0o600 });
    fs.writeFileSync(keyPath, JSON.stringify({
      algorithm: 'aes-256-gcm',
      key: key.toString('base64'),
      nonce: nonce.toString('base64'),
      tag: tag.toString('base64'),
    }), { mode: 0o600 });

    const decipher = createDecipheriv('aes-256-gcm', key, nonce);
    decipher.setAuthTag(tag);
    const readback = Buffer.concat([
      decipher.update(fs.readFileSync(resolvedBackupPath)),
      decipher.final(),
    ]);
    const parsedReadback = JSON.parse(readback.toString('utf8'));
    assert.equal(parsedReadback.documents.length, assets.length, 'Encrypted backup readback count mismatch');
    const encryptedBytes = fs.statSync(resolvedBackupPath).size;

    const account = `${process.env.USERDOMAIN || '.'}\\${process.env.USERNAME || ''}`;
    if (process.env.USERNAME) {
      const acl = childProcess.spawnSync('icacls.exe', [
        path.dirname(resolvedBackupPath),
        '/inheritance:r',
        '/grant:r',
        `${account}:(OI)(CI)F`,
        '/T',
        '/C',
      ], { encoding: 'utf8' });
      assert.equal(acl.status, 0, `Private backup ACL failed: ${acl.stderr || acl.stdout}`);
    }
    report.encrypted_backup = {
      path: resolvedBackupPath,
      key_path: keyPath,
      bytes: encryptedBytes,
      protection: 'AES-256-GCM and Windows user-only ACL',
      readback_documents: parsedReadback.documents.length,
    };
  }
  const output = process.argv.includes('--occupancy-only')
    ? {
      checked_at: report.checked_at,
      assets_checked: report.assets_checked,
      assets_with_occupancy_difference: report.assets_with_occupancy_difference,
      occupancy_by_asset: results.map((row) => ({
        asset_code: row.asset_code,
        asset_name: row.asset_name,
        current_occupancy_rate: row.current_occupancy_rate,
        corrected_occupancy_rate: row.corrected_occupancy_rate,
        occupied_area_sqm: row.corrected_occupied_area_sqm,
        denominator_area_sqm: row.corrected_denominator_area_sqm,
      })),
    }
    : report;
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error?.stack || error);
  process.exitCode = 1;
});
