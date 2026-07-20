#!/usr/bin/env node
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

function argValue(name, fallback = '') {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] || fallback : fallback;
}

function hasFlag(name) {
  return process.argv.includes(name);
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
  if (!response.ok) throw new Error(`${action} failed (${response.status}): ${body.message || body.error || 'unknown error'}`);
  return { ok: body?.ok !== false, data: body.data || {}, error: body.message || body.error || '' };
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const supabaseUrl = envValue('LOGISTICS_SUPABASE_URL', 'VITE_SUPABASE_URL');
  const anonKey = envValue('LOGISTICS_SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY');
  if (!supabaseUrl || !anonKey) throw new Error('Set LOGISTICS_SUPABASE_URL/VITE_SUPABASE_URL and LOGISTICS_SUPABASE_ANON_KEY/VITE_SUPABASE_ANON_KEY.');
  const auth = await signIn(supabaseUrl, anonKey);
  const runAll = hasFlag('--all');
  const untilComplete = hasFlag('--until-complete');
  const latestOnly = hasFlag('--latest');
  const reportPeriod = argValue('--period');
  const geocode = hasFlag('--geocode');
  if (latestOnly && reportPeriod) throw new Error('Use --latest or --period, not both.');
  if (untilComplete && !geocode) throw new Error('--until-complete requires --geocode.');
  if (untilComplete && !hasFlag('--apply')) throw new Error('--until-complete requires --apply.');
  if (untilComplete && !latestOnly && !reportPeriod) throw new Error('--until-complete requires --latest or --period for a stable lease scope.');
  if (untilComplete && runAll) throw new Error('Use either --until-complete or --all, not both.');
  const limit = Number(argValue('--limit', '1000')) || 1000;
  let offset = Number(argValue('--offset', '0')) || 0;
  const kind = argValue('--kind', latestOnly || reportPeriod ? 'lease' : 'all');
  if ((latestOnly || reportPeriod) && !['lease', 'll_sector_market_lease_observations'].includes(kind)) {
    throw new Error('--latest and --period only support --kind lease.');
  }
  const basePayload = {
    dry_run: !hasFlag('--apply'),
    kind,
    limit,
    geocode,
    geocode_limit: geocode ? Math.min(Math.max(Number(argValue('--geocode-limit', '25')) || 25, 1), 25) : 0,
    latest_only: latestOnly,
    report_period: reportPeriod || undefined,
  };
  const batches = [];
  let firstRequest = true;
  do {
    if (!firstRequest) await wait(6500);
    firstRequest = false;
    const payload = { ...basePayload, offset };
    const response = await invoke(supabaseUrl, anonKey, auth.token, 'sector-market/address-backfill', payload);
    const data = response.data;
    batches.push({ payload, ok: response.ok, error: response.error || undefined, data });
    if (!response.ok) break;
    if (untilComplete) {
      if (Number(data.remaining_locations || 0) === 0) break;
      continue;
    }
    const maxScanned = Math.max(...(Array.isArray(data.results) ? data.results.map((row) => Number(row.scanned || 0)) : [0]));
    if (!runAll || maxScanned < limit) break;
    offset += limit;
  } while (untilComplete || offset < 20000);
  const report = {
    ok: batches.every((batch) => batch.ok),
    generated_at: new Date().toISOString(),
    auth_source: auth.source,
    payload: { ...basePayload, run_all: runAll, until_complete: untilComplete, starting_offset: Number(argValue('--offset', '0')) || 0 },
    batches,
    totals: batches.reduce((acc, batch) => {
      for (const result of batch.data.results || []) {
        const key = result.kind || result.table || 'unknown';
        const current = acc[key] || { scanned_rows: 0, changed: 0, missing: 0, unique_locations: 0, geocoded_locations: 0, updated_rows: 0, remaining_locations: 0, failures: [] };
        current.scanned_rows += Number(result.scanned_rows ?? result.scanned ?? 0);
        current.changed += Number(result.changed || 0);
        current.missing += Number(result.missing || 0);
        current.unique_locations += Number(result.unique_locations || 0);
        current.geocoded_locations += Number(result.geocoded_locations || 0);
        current.updated_rows += Number(result.updated_rows || 0);
        current.remaining_locations = Number(result.remaining_locations || 0);
        current.failures.push(...(Array.isArray(result.failures) ? result.failures : []));
        acc[key] = current;
      }
      return acc;
    }, {}),
  };
  const outJson = path.join(OUT_DIR, `market-address-backfill-${timestampForFile()}.json`);
  const latestJson = path.join(OUT_DIR, 'market-address-backfill-latest.json');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(latestJson, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ ok: report.ok, artifact: outJson, payload: report.payload, totals: report.totals, batch_count: batches.length, last_batch: batches.at(-1) }, null, 2));
  if (!report.ok) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
