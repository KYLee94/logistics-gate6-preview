const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT_DIR = path.join(ROOT, 'qa-artifacts', 'logistics-gate6');
const EDGE_FUNCTION = 'll-dashboard-api';
const DEFAULT_ORIGIN = 'https://kylee94.github.io';
const TEST_PATTERN = /(smoke|test|qa|playwright|codex|dummy|example)/iu;

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

function timestampForFile() {
  return new Date().toISOString().replace(/[-:]/gu, '').replace(/\..+$/u, '').replace('T', '-');
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
  return { token: body.access_token, email: body.user?.email || email };
}

async function resolveAccessToken(supabaseUrl, anonKey) {
  const token = envValue('LOGISTICS_SUPABASE_ACCESS_TOKEN');
  if (token) return { token, email: envValue('LOGISTICS_SUPABASE_EMAIL', 'LOGISTICS_SUPABASE_AUTH_EMAIL'), source: 'LOGISTICS_SUPABASE_ACCESS_TOKEN' };
  const email = argsValue('email', envValue('LOGISTICS_SUPABASE_EMAIL', 'LOGISTICS_SUPABASE_AUTH_EMAIL'));
  const password = argsValue('password', envValue('LOGISTICS_SUPABASE_PASSWORD', 'LOGISTICS_SUPABASE_AUTH_PASSWORD'));
  if (!email || !password) throw new Error('Set LOGISTICS_SUPABASE_ACCESS_TOKEN, or LOGISTICS_SUPABASE_EMAIL and LOGISTICS_SUPABASE_PASSWORD.');
  const session = await signInForAccessToken(supabaseUrl, anonKey, email, password);
  return { ...session, source: 'password_grant' };
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

function failMessages(report) {
  const messages = [];
  if (!report.record_smoke_event?.ok) messages.push('smoke login event write failed');
  if (!report.history_list?.ok) messages.push('login history list failed');
  if (!report.capability_list?.ok) messages.push('login capability list failed');
  if (report.history_has_test_rows) messages.push('login history list includes test/smoke rows');
  if (report.history_rows_missing_identity > 0) messages.push('history rows missing organization/name/email');
  if (report.capability_users_missing_identity > 0) messages.push('permission users missing organization/name/email');
  if (report.blocked_login_users.length > 0) messages.push('one or more permission users are blocked');
  return messages;
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const stamp = timestampForFile();
  const outPath = path.join(OUT_DIR, `login-history-smoke-${stamp}.json`);
  const latestPath = path.join(OUT_DIR, 'login-history-smoke-latest.json');
  const supabaseUrl = argsValue('supabase-url', envValue('LOGISTICS_SUPABASE_URL', 'VITE_SUPABASE_URL'));
  const anonKey = argsValue('anon-key', envValue('LOGISTICS_SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY'));
  const origin = argsValue('origin', DEFAULT_ORIGIN);
  if (!supabaseUrl || !anonKey) throw new Error('Set LOGISTICS_SUPABASE_URL/VITE_SUPABASE_URL and LOGISTICS_SUPABASE_ANON_KEY/VITE_SUPABASE_ANON_KEY.');
  const endpoint = `${supabaseUrl.replace(/\/$/u, '')}/functions/v1/${EDGE_FUNCTION}`;
  const auth = await resolveAccessToken(supabaseUrl, anonKey);

  const record = await invoke(endpoint, anonKey, origin, auth.token, 'auth/login-history/record', {
    email: auth.email,
    source: 'smoke_test',
    client_timezone: 'Asia/Seoul',
    user_agent: 'logistics-login-history-smoke',
  });
  const history = await invoke(endpoint, anonKey, origin, auth.token, 'auth/login-history/list', { limit: 200 });
  const capability = await invoke(endpoint, anonKey, origin, auth.token, 'auth/login-capability/list', {});
  const historyRows = history.body?.data?.rows || [];
  const users = capability.body?.data?.users || history.body?.data?.users || [];

  const report = {
    ok: false,
    generated_at: new Date().toISOString(),
    endpoint,
    origin,
    auth_source: auth.source,
    record_smoke_event: { status: record.status, ok: record.ok && record.body?.ok === true },
    history_list: {
      status: history.status,
      ok: history.ok && history.body?.ok === true,
      rows: historyRows.length,
      summary: history.body?.data?.summary || null,
    },
    capability_list: {
      status: capability.status,
      ok: capability.ok && capability.body?.ok === true,
      users: users.length,
    },
    history_has_test_rows: historyRows.some((row) => TEST_PATTERN.test(`${row.email || ''} ${row.source_label || ''}`)),
    history_rows_missing_identity: historyRows.filter((row) => !row.organization || !row.staff_name || !row.email).length,
    capability_users_missing_identity: users.filter((row) => !row.organization || !row.staff_name || !row.email).length,
    blocked_login_users: users.filter((row) => /차단/iu.test(String(row.login_status || ''))),
    first_access_pending_users: users.filter((row) => row.login_status === '최초 접속 전').map((row) => ({
      email: row.email,
      staff_name: row.staff_name,
      organization: row.organization,
    })),
    email_confirmation_pending_users: users.filter((row) => row.login_status === '이메일 확인 필요').map((row) => ({
      email: row.email,
      staff_name: row.staff_name,
      organization: row.organization,
    })),
  };
  const messages = failMessages(report);
  report.ok = messages.length === 0;
  report.failures = messages;

  fs.writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(latestPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`login-history smoke ${report.ok ? 'PASS' : 'FAIL'}: ${path.relative(ROOT, outPath)}`);
  if (!report.ok) {
    console.error(messages.join('\n'));
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
