const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT_DIR = path.join(ROOT, 'qa-artifacts', 'logistics-gate6');
const OUT_JSON = path.join(OUT_DIR, 'data-quality-e2e-20260521.json');
const EDGE_FUNCTION = 'll-dashboard-api';
const DEFAULT_ORIGIN = 'https://kylee94.github.io';

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

function argsValue(name, fallback = '') {
  const flag = `--${name}`;
  const index = process.argv.indexOf(flag);
  return index === -1 ? fallback : (process.argv[index + 1] || fallback);
}

function parseSupabaseJson(raw) {
  const start = raw.indexOf('{');
  if (start === -1) throw new Error('Supabase CLI JSON output was not found.');
  for (let end = raw.length - 1; end > start; end -= 1) {
    if (raw[end] !== '}') continue;
    try {
      return JSON.parse(raw.slice(start, end + 1));
    } catch {
      // Keep scanning until a valid JSON boundary is found.
    }
  }
  throw new Error('Supabase CLI JSON output could not be parsed.');
}

function sqlLiteral(value) {
  return `'${String(value ?? '').replace(/'/gu, "''")}'`;
}

function runQuery(sql) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const sqlFile = path.join(OUT_DIR, `.tmp-data-quality-e2e-${process.pid}-${Date.now()}.sql`);
  fs.writeFileSync(sqlFile, sql, 'utf8');
  try {
    const quotedSqlFile = `"${sqlFile.replace(/"/gu, '\\"')}"`;
    const output = execSync(`npx supabase db query --linked -o json --file ${quotedSqlFile}`, {
      cwd: ROOT,
      encoding: 'utf8',
      maxBuffer: 1024 * 1024 * 8,
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return parseSupabaseJson(output).rows || [];
  } finally {
    fs.rmSync(sqlFile, { force: true });
  }
}

async function signInForAccessToken(supabaseUrl, anonKey, email, password) {
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
  return body.access_token;
}

async function resolveAccessToken(supabaseUrl, anonKey) {
  const token = envValue('LOGISTICS_SUPABASE_ACCESS_TOKEN');
  if (token) return { token, source: 'LOGISTICS_SUPABASE_ACCESS_TOKEN' };
  const email = argsValue('email', envValue('LOGISTICS_SUPABASE_EMAIL', 'LOGISTICS_SUPABASE_AUTH_EMAIL'));
  const password = argsValue('password', envValue('LOGISTICS_SUPABASE_PASSWORD', 'LOGISTICS_SUPABASE_AUTH_PASSWORD'));
  if (!email || !password) throw new Error('Set LOGISTICS_SUPABASE_ACCESS_TOKEN, or LOGISTICS_SUPABASE_EMAIL and LOGISTICS_SUPABASE_PASSWORD.');
  return { token: await signInForAccessToken(supabaseUrl, anonKey, email, password), source: 'password_grant' };
}

async function authUser(supabaseUrl, anonKey, token) {
  const response = await fetch(`${supabaseUrl.replace(/\/$/u, '')}/auth/v1/user`, {
    headers: { apikey: anonKey, authorization: `Bearer ${token}` },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.id) throw new Error(`Auth user lookup failed (${response.status})`);
  return body;
}

async function invoke(endpoint, anonKey, origin, token, action, payload) {
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

function assertStatus(result, expected) {
  if (result.status !== expected) {
    const message = result.body?.message || result.body?.error || JSON.stringify(result.body).slice(0, 300);
    throw new Error(`${result.action} expected ${expected}, got ${result.status}: ${message}`);
  }
}

async function main() {
  const supabaseUrl = envValue('LOGISTICS_SUPABASE_URL', 'VITE_SUPABASE_URL');
  const anonKey = envValue('LOGISTICS_SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY');
  const origin = argsValue('origin', DEFAULT_ORIGIN);
  if (!supabaseUrl || !anonKey) throw new Error('Missing Supabase URL or anon key.');
  const endpoint = `${supabaseUrl.replace(/\/$/u, '')}/functions/v1/${EDGE_FUNCTION}`;
  const auth = await resolveAccessToken(supabaseUrl, anonKey);
  const user = await authUser(supabaseUrl, anonKey, auth.token);

  const assetRead = await invoke(endpoint, anonKey, origin, auth.token, 'dashboard/asset/read', {});
  assertStatus(assetRead, 200);
  const asset = assetRead.body?.data?.asset;
  if (!asset?.asset_id || !asset?.asset_name) throw new Error('dashboard/asset/read did not return an editable asset.');

  const beforeValue = String(asset.asset_name);
  const submitPayload = {
    source_table: 'public.ll_assets',
    target_type: 'asset',
    target_name: asset.asset_name,
    target_row_id: asset.asset_id,
    field_name: 'asset_name',
    before_value: beforeValue,
    requested_value: beforeValue,
    reason_code: 'qa_noop_roundtrip',
    request_payload: {
      qa_noop: true,
      cell_edits: [{
        target_table: 'public.ll_assets',
        primary_key_field: 'asset_id',
        target_row_id: asset.asset_id,
        field_name: 'asset_name',
        before_value: beforeValue,
        after_value: beforeValue,
        asset_id: asset.asset_id,
        asset_name: asset.asset_name,
      }],
    },
  };

  const submitted = await invoke(endpoint, anonKey, origin, auth.token, 'edits/submit', submitPayload);
  assertStatus(submitted, 200);
  const editId = submitted.body?.data?.id;
  if (!editId) throw new Error('edits/submit did not return request id.');

  const readbackBefore = await invoke(endpoint, anonKey, origin, auth.token, 'edits/readback', { id: editId });
  assertStatus(readbackBefore, 200);
  const staleAtSubmit = readbackBefore.body?.data?.readbacks?.some((row) => row.stale);
  if (staleAtSubmit) throw new Error('No-op edit unexpectedly became stale before approval.');

  const selfApprove = await invoke(endpoint, anonKey, origin, auth.token, 'edits/approve', { id: editId, approval_note: 'self approval negative smoke' });
  assertStatus(selfApprove, 403);

  const swapped = runQuery(`
with other_user as (
  select user_id
  from public.ll_user_permissions
  where user_id is not null
    and user_id::text <> ${sqlLiteral(user.id)}
  order by email
  limit 1
)
update public.ll_edit_requests
set requested_by = (select user_id from other_user),
    request_payload = jsonb_set(coalesce(request_payload, '{}'::jsonb), '{qa_requester_swapped}', 'true'::jsonb, true),
    updated_at = now()
where id = ${sqlLiteral(editId)}
  and status = 'submitted'
  and exists (select 1 from other_user)
returning id, requested_by::text as requested_by, status;
`);
  if (!swapped.length) throw new Error('Failed to prepare non-self approval requester for QA.');

  const approved = await invoke(endpoint, anonKey, origin, auth.token, 'edits/approve', { id: editId, approval_note: 'QA no-op approve/write/readback/audit smoke' });
  assertStatus(approved, 200);

  const readbackAfter = await invoke(endpoint, anonKey, origin, auth.token, 'edits/readback', { id: editId });
  assertStatus(readbackAfter, 200);
  const finalRows = runQuery(`
select
  er.id::text,
  er.status,
  er.write_status,
  er.target_row_id,
  er.field_name,
  er.readback_value,
  er.write_result,
  count(al.id)::int as audit_rows
from public.ll_edit_requests er
left join public.ll_audit_events al on al.edit_request_id = er.id and al.event_type in ('data_change', 'fund_overview_write')
where er.id = ${sqlLiteral(editId)}
group by er.id, er.status, er.write_status, er.target_row_id, er.field_name, er.readback_value, er.write_result;
`);
  const final = finalRows[0];
  if (!final || final.status !== 'written') throw new Error(`Edit request was not written: ${JSON.stringify(final)}`);
  if (Number(final.audit_rows || 0) < 1) throw new Error('Data change audit log was not written.');

  const output = {
    ok: true,
    generated_at: new Date().toISOString(),
    endpoint: endpoint.replace(/https:\/\/([^./]+)\./u, 'https://$1.redacted.'),
    origin,
    auth_source: auth.source,
    auth_user_id: `${String(user.id).slice(0, 8)}...`,
    edit_request_id: editId,
    asset_id: asset.asset_id,
    asset_name: asset.asset_name,
    checks: {
      submit: submitted.status,
      readback_before: readbackBefore.status,
      self_approve_blocked: selfApprove.status,
      requester_swapped_for_qa: swapped.length === 1,
      approve_write_readback_audit: approved.status,
      readback_after: readbackAfter.status,
      final_status: final.status,
      audit_rows: Number(final.audit_rows || 0),
    },
  };
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_JSON, JSON.stringify(output, null, 2), 'utf8');
  console.log(JSON.stringify(output, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
