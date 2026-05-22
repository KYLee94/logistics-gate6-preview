const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const EDGE_FUNCTION = 'll-dashboard-api';
const DEFAULT_BASIS_DATE = currentKstMonthEndDate();
const DEFAULT_ORIGIN = 'https://kylee94.github.io';

function currentKstMonthEndDate() {
  const now = new Date();
  const kst = new Date(now.getTime() + (9 * 60 * 60 * 1000));
  const year = kst.getUTCFullYear();
  const month = kst.getUTCMonth() + 1;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
}

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/u);
  return Object.fromEntries(lines
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => {
      const index = line.indexOf('=');
      const key = line.slice(0, index).trim();
      const raw = line.slice(index + 1).trim();
      return [key, raw.replace(/^['"]|['"]$/gu, '')];
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

function argsValue(name, fallback = '') {
  const flag = `--${name}`;
  const index = process.argv.indexOf(flag);
  if (index === -1) return fallback;
  return process.argv[index + 1] || fallback;
}

const supabaseUrl = envValue('LOGISTICS_SUPABASE_URL', 'VITE_SUPABASE_URL');
const anonKey = envValue('LOGISTICS_SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY');
const accessToken = envValue('LOGISTICS_SUPABASE_ACCESS_TOKEN');
const authEmail = argsValue('email', envValue('LOGISTICS_SUPABASE_EMAIL', 'LOGISTICS_SUPABASE_AUTH_EMAIL'));
const authPassword = argsValue('password', envValue('LOGISTICS_SUPABASE_PASSWORD', 'LOGISTICS_SUPABASE_AUTH_PASSWORD'));
const basisDate = argsValue('basis-date', DEFAULT_BASIS_DATE);
const origin = argsValue('origin', DEFAULT_ORIGIN);
const assetId = argsValue('asset-id');
const tenantId = argsValue('tenant-id');
const outputPath = argsValue('out', path.join(ROOT, 'qa-artifacts', 'logistics-gate6', 'jwt-smoke-result-20260521.json'));

function fail(message, code = 1) {
  console.error(message);
  process.exit(code);
}

if (!supabaseUrl || !anonKey) {
  fail('Missing Supabase URL or anon key. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env, or LOGISTICS_SUPABASE_URL / LOGISTICS_SUPABASE_ANON_KEY.');
}

const endpoint = `${supabaseUrl.replace(/\/$/u, '')}/functions/v1/${EDGE_FUNCTION}`;
const authEndpoint = `${supabaseUrl.replace(/\/$/u, '')}/auth/v1/token?grant_type=password`;

async function signInForAccessToken() {
  if (!authEmail || !authPassword) {
    fail('Missing login credentials. Set LOGISTICS_SUPABASE_ACCESS_TOKEN, or set LOGISTICS_SUPABASE_EMAIL and LOGISTICS_SUPABASE_PASSWORD for password login smoke.', 2);
  }
  const response = await fetch(authEndpoint, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ email: authEmail, password: authPassword }),
  });
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text.slice(0, 500) };
  }
  if (!response.ok || !body?.access_token) {
    const message = body?.msg || body?.message || body?.error_description || body?.error || JSON.stringify(body).slice(0, 300);
    throw new Error(`Supabase Auth login failed (${response.status}): ${message}`);
  }
  return body.access_token;
}

async function resolveAccessToken() {
  if (accessToken) return { token: accessToken, source: 'LOGISTICS_SUPABASE_ACCESS_TOKEN' };
  const token = await signInForAccessToken();
  return { token, source: 'password_grant' };
}

async function invoke(action, payload, token) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      authorization: token ? `Bearer ${token}` : '',
      'content-type': 'application/json',
      origin,
    },
    body: JSON.stringify({ action, payload }),
  });
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text.slice(0, 500) };
  }
  return { action, status: response.status, ok: response.ok, body };
}

function evidenceSummary(result) {
  const tables = result.body?.evidence?.tables;
  if (!Array.isArray(tables)) return '';
  return tables.map((row) => `${row.table}:${row.rows}`).join(', ');
}

function evidenceTables(result) {
  const tables = result.body?.evidence?.tables;
  if (!Array.isArray(tables)) return [];
  return tables.map((row) => row.table).filter(Boolean);
}

function assertStatus(result, expected) {
  if (result.status !== expected) {
    const message = result.body?.message || result.body?.error || JSON.stringify(result.body).slice(0, 300);
    throw new Error(`${result.action} expected ${expected}, got ${result.status}: ${message}`);
  }
}

function assertDashboardBody(result) {
  assertStatus(result, 200);
  if (result.body?.ok !== true) {
    throw new Error(`${result.action} returned non-ok body: ${result.body?.message || result.body?.error || JSON.stringify(result.body).slice(0, 300)}`);
  }
  if (result.body?.source !== 'supabase') {
    throw new Error(`${result.action} source mismatch: expected supabase, got ${result.body?.source}`);
  }
  if (result.body?.version !== 'll-dashboard-payload-v1') {
    throw new Error(`${result.action} version mismatch: expected ll-dashboard-payload-v1, got ${result.body?.version}`);
  }
  if (result.body?.basis_date !== basisDate) {
    throw new Error(`${result.action} basis_date mismatch: expected ${basisDate}, got ${result.body?.basis_date}`);
  }
  if (!result.body?.scope?.scope_hash) {
    throw new Error(`${result.action} scope_hash is missing`);
  }
  if (!Array.isArray(result.body?.evidence?.tables) || !result.body.evidence.tables.length) {
    throw new Error(`${result.action} evidence.tables is missing`);
  }
  if (!result.body?.data || typeof result.body.data !== 'object') {
    throw new Error(`${result.action} data payload is missing`);
  }
}

function assertSnapshotReadback(upsert, list) {
  assertStatus(upsert, 200);
  assertStatus(list, 200);
  if (upsert.body?.ok === false) {
    throw new Error(`${upsert.action} returned ok=false: ${upsert.body?.message || upsert.body?.error || ''}`);
  }
  if (list.body?.ok === false) {
    throw new Error(`${list.action} returned ok=false: ${list.body?.message || list.body?.error || ''}`);
  }
  const upsertWeekKey = upsert.body?.data?.week_key || upsert.body?.week_key || upsert.body?.data?.snapshot?.week_key;
  const taskCount = Number(upsert.body?.data?.task_count || 0);
  if (taskCount === 0) return;
  const snapshots = Array.isArray(list.body?.data) ? list.body.data : (Array.isArray(list.body?.data?.snapshots) ? list.body.data.snapshots : []);
  if (upsertWeekKey && !snapshots.some((row) => String(row.week_key || row.snapshot_week_key || '') === String(upsertWeekKey))) {
    throw new Error(`Snapshot readback failed: week_key ${upsertWeekKey} was not found in snapshots/list`);
  }
}

function assertFundReadBody(result) {
  assertStatus(result, 200);
  if (result.body?.ok !== true) {
    throw new Error(`${result.action} returned non-ok body: ${result.body?.message || result.body?.error || JSON.stringify(result.body).slice(0, 300)}`);
  }
  if (!result.body?.data?.fund_id || !result.body?.data?.fund_name) {
    throw new Error(`${result.action} fund_id/fund_name is missing`);
  }
}

async function main() {
  const auth = await resolveAccessToken();
  const smoke = [
    { action: 'dashboard/home/read', payload: { basis_date: basisDate }, expected: 200 },
    { action: 'dashboard/asset/read', payload: { basis_date: basisDate, ...(assetId ? { asset_id: assetId } : {}) }, expected: 200 },
    { action: 'dashboard/company/read', payload: { basis_date: basisDate, ...(tenantId ? { tenant_id: tenantId } : {}) }, expected: 200 },
    { action: 'work-platform/tasks/snapshots/upsert-current', payload: { basis_date: basisDate, seed_tasks: [] }, expected: 200 },
    { action: 'work-platform/tasks/snapshots/list', payload: { limit: 100 }, expected: 200 },
  ];

  const results = [];
  for (const item of smoke) {
    const result = await invoke(item.action, item.payload, auth.token);
    if (item.action.startsWith('dashboard/')) {
      assertDashboardBody(result);
    } else {
      assertStatus(result, item.expected);
    }
    results.push(result);
  }

  const assetRead = results.find((row) => row.action === 'dashboard/asset/read');
  const readableAssetId = assetRead?.body?.data?.asset?.asset_id;
  if (readableAssetId) {
    const fundRead = await invoke('funds/read-by-asset', { asset_id: readableAssetId }, auth.token);
    assertFundReadBody(fundRead);
    results.push(fundRead);
  }

  const snapshotUpsert = results.find((row) => row.action === 'work-platform/tasks/snapshots/upsert-current');
  const snapshotList = results.find((row) => row.action === 'work-platform/tasks/snapshots/list');
  assertSnapshotReadback(snapshotUpsert, snapshotList);

  const unauth = await invoke('dashboard/home/read', { basis_date: basisDate }, '');
  assertStatus(unauth, 401);
  const unauthorizedAsset = await invoke('dashboard/asset/read', { basis_date: basisDate, asset_id: '__not_readable_asset__' }, auth.token);
  assertStatus(unauthorizedAsset, 403);
  const unauthorizedCompany = await invoke('dashboard/company/read', { basis_date: basisDate, tenant_id: '__not_readable_tenant__' }, auth.token);
  assertStatus(unauthorizedCompany, 403);

  const output = {
    ok: true,
    endpoint: endpoint.replace(/https:\/\/([^./]+)\./u, 'https://$1.redacted.'),
    auth_source: auth.source,
    auth_user: authEmail ? authEmail.replace(/^(.{2}).*(@.*)$/u, '$1***$2') : undefined,
    origin,
    basis_date: basisDate,
    smoke: results.map((result) => ({
      action: result.action,
      status: result.status,
      evidence: evidenceSummary(result),
      evidence_tables: evidenceTables(result),
      scope_hash: result.body?.scope?.scope_hash,
      readable_asset_count: result.body?.scope?.readable_asset_ids?.length,
      fund_id: result.body?.data?.fund_id,
      task_count: result.body?.data?.task_count,
      week_key: result.body?.data?.week_key || result.body?.week_key,
      snapshot_count: Array.isArray(result.body?.data) ? result.body.data.length : undefined,
    })),
    negative: [
      { action: unauth.action, status: unauth.status },
      { action: unauthorizedAsset.action, status: unauthorizedAsset.status },
      { action: unauthorizedCompany.action, status: unauthorizedCompany.status },
    ],
  };
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(output, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
