const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT_DIR = path.join(ROOT, 'qa-artifacts', 'logistics-gate6');

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  return Object.fromEntries(fs.readFileSync(filePath, 'utf8')
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => {
      const index = line.indexOf('=');
      return [line.slice(0, index).trim(), line.slice(index + 1).trim().replace(/^['"]|['"]$/gu, '')];
    }));
}

const fileEnv = {
  ...readEnvFile(path.join(ROOT, '.env')),
  ...readEnvFile(path.join(ROOT, '.env.local')),
};

function envValue(...keys) {
  for (const key of keys) {
    if (process.env[key]) return process.env[key];
    if (fileEnv[key]) return fileEnv[key];
  }
  return '';
}

function timestampForFile() {
  return new Date().toISOString().replace(/[-:]/gu, '').replace(/\..+$/u, '').replace('T', '-');
}

async function signIn(supabaseUrl, anonKey) {
  const accessToken = envValue('LOGISTICS_SUPABASE_ACCESS_TOKEN');
  if (accessToken) return { token: accessToken, source: 'LOGISTICS_SUPABASE_ACCESS_TOKEN' };
  const email = envValue('LOGISTICS_SUPABASE_EMAIL', 'LOGISTICS_SUPABASE_AUTH_EMAIL');
  const password = envValue('LOGISTICS_SUPABASE_PASSWORD', 'LOGISTICS_SUPABASE_AUTH_PASSWORD');
  if (!email || !password) throw new Error('Set LOGISTICS_SUPABASE_ACCESS_TOKEN, or set LOGISTICS_SUPABASE_EMAIL and LOGISTICS_SUPABASE_PASSWORD.');
  const response = await fetch(`${supabaseUrl.replace(/\/$/u, '')}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: anonKey, 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.access_token) {
    const message = body.msg || body.message || body.error_description || body.error || 'unknown auth error';
    throw new Error(`Supabase Auth login failed (${response.status}): ${message}`);
  }
  return { token: body.access_token, source: 'password_grant' };
}

async function invoke(supabaseUrl, anonKey, token, action, payload = {}) {
  const response = await fetch(`${supabaseUrl.replace(/\/$/u, '')}/functions/v1/ll-dashboard-api`, {
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
  if (!response.ok || body?.ok === false) throw new Error(`${action} failed (${response.status}): ${body.message || body.error || 'unknown error'}`);
  return body.data || {};
}

function approxEqual(actual, expected, tolerance = 0.1) {
  return Math.abs(Number(actual) - Number(expected)) <= tolerance;
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const supabaseUrl = envValue('LOGISTICS_SUPABASE_URL', 'VITE_SUPABASE_URL');
  const anonKey = envValue('LOGISTICS_SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY');
  if (!supabaseUrl || !anonKey) throw new Error('Set LOGISTICS_SUPABASE_URL/VITE_SUPABASE_URL and LOGISTICS_SUPABASE_ANON_KEY/VITE_SUPABASE_ANON_KEY.');
  const auth = await signIn(supabaseUrl, anonKey);
  const data = await invoke(supabaseUrl, anonKey, auth.token, 'sector-market/read', { limit: 12000 });
  const summary = data.summary || {};
  const readback = summary.readback || {};
  const sourceAudit = summary.source_audit || {};
  const checks = {
    status_ready: summary.status === 'ready',
    active_source_only: Boolean(summary.source?.active_version && summary.source?.source_file_id),
    source_sheet_count: sourceAudit.sheet_count === 9,
    source_row_count: sourceAudit.source_row_count === 11738,
    source_sheet_readback_all_pass: Array.isArray(sourceAudit.sheet_readback) && sourceAudit.sheet_readback.length === 9 && sourceAudit.sheet_readback.every((row) => row.ok !== false && row.expected_rows === row.actual_rows),
    lease_count: summary.lease_observation_count === 9610,
    transaction_count: summary.transaction_case_count === 541,
    pipeline_supply_count: summary.pipeline_supply_count === 267,
    supply_total_count: summary.supply_case_count === 276,
    new_supply_count: summary.new_supply_count === 9,
    cap_rate_series_count: summary.cap_rate_series_count === 90,
    new_supply_total_gross_area_py: approxEqual(summary.new_supply_total_gross_area_py, 111517.9),
    readback_all_pass: Object.values(readback).every((item) => item && item.ok !== false),
    sample_non_empty: Array.isArray(data.leases) && data.leases.length > 0
      && Array.isArray(data.supply) && data.supply.length > 0
      && Array.isArray(data.transactions) && data.transactions.length > 0,
    lease_sample_full: Array.isArray(data.leases) && data.leases.length === 9610,
  };
  const report = {
    ok: Object.values(checks).every(Boolean),
    generated_at: new Date().toISOString(),
    auth_source: auth.source,
    checks,
    observed: {
      status: summary.status,
      source_file: summary.source?.file_name || null,
      lease_observation_count: summary.lease_observation_count,
      transaction_case_count: summary.transaction_case_count,
      pipeline_supply_count: summary.pipeline_supply_count,
      new_supply_total_gross_area_py: summary.new_supply_total_gross_area_py,
      sample_counts: summary.sample_counts,
      readback,
      source_audit: sourceAudit,
    },
  };
  const outJson = path.join(OUT_DIR, `market-data-readback-smoke-${timestampForFile()}.json`);
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ ok: report.ok, artifact: outJson, checks, observed: report.observed }, null, 2));
  if (!report.ok) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
