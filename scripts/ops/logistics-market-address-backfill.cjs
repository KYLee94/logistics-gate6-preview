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

function safeText(value) {
  return String(value ?? '').trim();
}

function positiveInteger(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
}

function leaseScopeFromResponse(data) {
  const scope = {
    source_file_id: safeText(data?.source_file_id),
    report_period: safeText(data?.report_period),
    expected_rows: positiveInteger(data?.expected_rows),
  };
  if (!scope.source_file_id || !scope.report_period || !scope.expected_rows) {
    throw new Error('Lease backfill preflight did not return a complete source_file_id, report_period, and expected_rows scope.');
  }
  return scope;
}

function leaseScopeMatches(data, expectedScope) {
  if (!expectedScope) return { ok: true, actual: null };
  const actual = leaseScopeFromResponse(data);
  const ok = actual.source_file_id === expectedScope.source_file_id
    && actual.report_period === expectedScope.report_period
    && actual.expected_rows === expectedScope.expected_rows;
  return { ok, actual };
}

function batchMetrics(data, phase) {
  const plannedWriteCount = Number(data?.updated_rows || 0);
  return {
    write_count: phase === 'apply' ? plannedWriteCount : 0,
    planned_write_count: plannedWriteCount,
    failure_count: Array.isArray(data?.failures) ? data.failures.length : 0,
    remaining_locations: Number(data?.remaining_locations || 0),
  };
}

function batchRecord({ phase, payload, response, error, expectedScope, previousRemaining }) {
  const data = response?.data || {};
  const metrics = batchMetrics(data, phase);
  let scopeCheck = { ok: !expectedScope, actual: null };
  if (response && expectedScope) {
    try {
      scopeCheck = leaseScopeMatches(data, expectedScope);
    } catch (scopeError) {
      scopeCheck = { ok: false, actual: null, error: scopeError.message };
    }
  }
  return {
    phase,
    payload,
    ok: Boolean(response?.ok) && !error && scopeCheck.ok,
    error: error || response?.error || scopeCheck.error || (scopeCheck.ok ? undefined : 'Lease backfill scope drift detected'),
    scope: scopeCheck.actual,
    write_count: metrics.write_count,
    planned_write_count: metrics.planned_write_count,
    failure_count: metrics.failure_count,
    remaining_locations: metrics.remaining_locations,
    progress_locations: Number.isFinite(previousRemaining)
      ? previousRemaining - metrics.remaining_locations
      : null,
    data,
  };
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
  const stableLeaseScope = latestOnly || Boolean(reportPeriod);
  let pinnedScope = null;
  if (stableLeaseScope) {
    const preflightPayload = {
      ...basePayload,
      dry_run: true,
      geocode: false,
      geocode_limit: 0,
    };
    try {
      const preflightResponse = await invoke(supabaseUrl, anonKey, auth.token, 'sector-market/address-backfill', preflightPayload);
      pinnedScope = leaseScopeFromResponse(preflightResponse.data);
      const preflightBatch = batchRecord({
        phase: 'preflight',
        payload: preflightPayload,
        response: preflightResponse,
        expectedScope: pinnedScope,
      });
      batches.push(preflightBatch);
    } catch (error) {
      batches.push(batchRecord({
        phase: 'preflight',
        payload: preflightPayload,
        error: error.message,
        expectedScope: pinnedScope,
      }));
    }
  }
  let aborted = batches.some((batch) => !batch.ok);
  let previousRemaining = null;
  const seenRemaining = new Set();
  let firstRequest = true;
  while (!aborted) {
    if (!firstRequest) await wait(6500);
    firstRequest = false;
    const payload = {
      ...basePayload,
      offset,
      ...(pinnedScope && !basePayload.dry_run ? {
        expected_source_file_id: pinnedScope.source_file_id,
        expected_report_period: pinnedScope.report_period,
        expected_rows: pinnedScope.expected_rows,
      } : {}),
    };
    let response;
    try {
      response = await invoke(supabaseUrl, anonKey, auth.token, 'sector-market/address-backfill', payload);
    } catch (error) {
      batches.push(batchRecord({ phase: 'apply', payload, error: error.message, expectedScope: pinnedScope, previousRemaining }));
      break;
    }
    const batch = batchRecord({
      phase: basePayload.dry_run ? 'dry_run' : 'apply',
      payload,
      response,
      expectedScope: pinnedScope,
      previousRemaining,
    });
    batches.push(batch);
    if (!batch.ok) break;
    const data = response.data;
    if (untilComplete) {
      if (Number(data.remaining_locations || 0) === 0) break;
      if (batch.write_count === 0 || (previousRemaining !== null && batch.progress_locations <= 0) || seenRemaining.has(batch.remaining_locations)) {
        batch.ok = false;
        batch.error = batch.write_count === 0
          ? 'Lease backfill made no write progress before completion.'
          : 'Lease backfill remaining_locations did not decrease before completion.';
        break;
      }
      seenRemaining.add(batch.remaining_locations);
      previousRemaining = batch.remaining_locations;
      continue;
    }
    const maxScanned = Math.max(...(Array.isArray(data.results) ? data.results.map((row) => Number(row.scanned || 0)) : [0]));
    if (!runAll || maxScanned < limit) break;
    offset += limit;
    if (offset >= 20000) break;
  }
  const report = {
    ok: batches.some((batch) => batch.phase !== 'preflight') && batches.every((batch) => batch.ok),
    generated_at: new Date().toISOString(),
    auth_source: auth.source,
    payload: { ...basePayload, run_all: runAll, until_complete: untilComplete, starting_offset: Number(argValue('--offset', '0')) || 0 },
    pinned_scope: pinnedScope,
    batch_manifest: batches.map((batch) => ({
      phase: batch.phase,
      ok: batch.ok,
      scope: batch.scope,
      write_count: batch.write_count,
      planned_write_count: batch.planned_write_count,
      failure_count: batch.failure_count,
      remaining_locations: batch.remaining_locations,
      progress_locations: batch.progress_locations,
      error: batch.error,
    })),
    batches,
    totals: batches.filter((batch) => batch.phase !== 'preflight').reduce((acc, batch) => {
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
