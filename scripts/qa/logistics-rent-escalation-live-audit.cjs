#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const escalationFields = Object.freeze([
  'deposit_escalation_rate',
  'rent_escalation_rate',
  'cam_escalation_rate',
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

function classifyEscalation(value) {
  if (value === null || value === undefined || String(value).trim() === '') {
    return { classification: 'missing', canonical_display: null, numeric_percent: null };
  }
  const source = String(value).trim();
  const explicitPercent = source.endsWith('%');
  const numeric = Number(source.replace(/%$/u, '').trim());
  if (!Number.isFinite(numeric) || numeric < 0 || numeric > (explicitPercent ? 100 : Number.MAX_VALUE)) {
    return { classification: 'invalid', canonical_display: null, numeric_percent: null };
  }
  const rawFraction = !explicitPercent && numeric > 0 && numeric < 1;
  const ambiguousSubunitPercent = explicitPercent && numeric > 0 && numeric < 1;
  const numericPercent = rawFraction ? numeric * 100 : numeric;
  if (numericPercent > 100) {
    return { classification: 'invalid', canonical_display: null, numeric_percent: numericPercent };
  }
  const canonical = String(Number(numericPercent.toFixed(10)));
  return {
    classification: ambiguousSubunitPercent
      ? 'ambiguous_subunit_percent'
      : (explicitPercent ? 'explicit_percent' : (rawFraction ? 'raw_fraction' : 'percent_number')),
    canonical_display: `${canonical}%`,
    numeric_percent: numericPercent,
  };
}

function hashIdentity(assetKey, row, rowIndex) {
  const identity = row?.rent_term_key || row?.contract_space_key || row?.space_key || row?.row_key || `row-${rowIndex}`;
  return createHash('sha256').update(`${assetKey}|${identity}`).digest('hex').slice(0, 16);
}

async function main() {
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
  assert.ok(supabaseUrl && anonKey && email && password, 'Supabase QA credentials are missing');

  const auth = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: anonKey, 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const authBody = await auth.json();
  assert.equal(auth.status, 200, `Supabase Auth login failed: ${authBody?.message || auth.status}`);

  const invoke = async (action, payload = {}) => {
    const response = await fetch(`${supabaseUrl}/functions/v1/ll-dashboard-api`, {
      method: 'POST',
      headers: {
        apikey: anonKey,
        authorization: `Bearer ${authBody.access_token}`,
        'content-type': 'application/json',
        origin: 'https://kylee94.github.io',
      },
      body: JSON.stringify({ action, payload }),
    });
    const body = await response.json();
    assert.equal(response.status, 200, `${action} HTTP ${response.status}`);
    assert.equal(body?.ok, true, `${action} did not return ok:true`);
    assert.equal(body?.status, 'primary', `${action} did not return primary data`);
    return body;
  };

  const home = await invoke('v2/home/read');
  const assets = (home.data.assets || []).filter((asset) => asset?.asset_key);
  const rows = [];
  const distinct = Object.fromEntries(escalationFields.map((field) => [field, new Set()]));
  const counts = Object.fromEntries(escalationFields.map((field) => [field, {
    missing: 0,
    raw_fraction: 0,
    ambiguous_subunit_percent: 0,
    explicit_percent: 0,
    percent_number: 0,
    invalid: 0,
  }]));

  for (const asset of assets) {
    const rentRoll = await invoke('v2/rent-roll/read', { asset_key: asset.asset_key, limit: 500 });
    for (const [rowIndex, row] of (rentRoll.data.rows || []).entries()) {
      const rates = {};
      for (const field of escalationFields) {
        const raw = row?.[field] ?? null;
        const parsed = classifyEscalation(raw);
        counts[field][parsed.classification] += 1;
        if (raw !== null && raw !== '') distinct[field].add(String(raw));
        rates[field] = { raw, ...parsed };
      }
      rows.push({
        asset_key: asset.asset_key,
        row_ref: hashIdentity(asset.asset_key, row, rowIndex),
        rates,
      });
    }
  }

  const invalidCount = Object.values(counts).reduce((sum, fieldCounts) => sum + fieldCounts.invalid, 0);
  const ambiguousCount = Object.values(counts)
    .reduce((sum, fieldCounts) => sum + fieldCounts.ambiguous_subunit_percent, 0);
  const evidence = {
    ok: invalidCount === 0 && ambiguousCount === 0,
    source: 'v2/rent-roll/read primary',
    asset_count: assets.length,
    row_count: rows.length,
    field_count: rows.length * escalationFields.length,
    invalid_count: invalidCount,
    ambiguous_subunit_percent_count: ambiguousCount,
    counts,
    distinct_values: Object.fromEntries(escalationFields.map((field) => [field, [...distinct[field]].sort()])),
    rows,
  };
  process.stdout.write(`${JSON.stringify(evidence, null, 2)}\n`);
  if (!evidence.ok) process.exitCode = 1;
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`${JSON.stringify({ ok: false, error: error.message }, null, 2)}\n`);
    process.exit(1);
  });
}

module.exports = { classifyEscalation };
