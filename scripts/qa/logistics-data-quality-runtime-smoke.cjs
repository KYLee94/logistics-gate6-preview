const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT_DIR = path.join(ROOT, 'qa-artifacts', 'logistics-gate6');
const DEFAULT_ORIGIN = 'https://kylee94.github.io';

function timestamp() {
  return new Date().toISOString().replace(/[-:]/gu, '').replace(/\.\d{3}Z$/u, 'Z').slice(0, 15);
}

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

function redactUrl(url) {
  return String(url || '').replace(/https:\/\/([a-z0-9]+)\.supabase\.co/iu, 'https://$1.redacted.supabase.co');
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
  const email = envValue('LOGISTICS_SUPABASE_EMAIL', 'LOGISTICS_SUPABASE_AUTH_EMAIL');
  const password = envValue('LOGISTICS_SUPABASE_PASSWORD', 'LOGISTICS_SUPABASE_AUTH_PASSWORD');
  if (!email || !password) throw new Error('Set LOGISTICS_SUPABASE_ACCESS_TOKEN, or LOGISTICS_SUPABASE_EMAIL and LOGISTICS_SUPABASE_PASSWORD.');
  return { token: await signInForAccessToken(supabaseUrl, anonKey, email, password), source: 'password_grant' };
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
  return { status: response.status, ok: response.ok, body };
}

async function main() {
  const supabaseUrl = envValue('LOGISTICS_SUPABASE_URL', 'VITE_SUPABASE_URL');
  const anonKey = envValue('LOGISTICS_SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY');
  if (!supabaseUrl || !anonKey) throw new Error('Set LOGISTICS_SUPABASE_URL and LOGISTICS_SUPABASE_ANON_KEY.');
  const endpoint = `${supabaseUrl.replace(/\/$/u, '')}/functions/v1/ll-dashboard-api`;
  const origin = envValue('LOGISTICS_QA_ORIGIN') || DEFAULT_ORIGIN;
  const auth = await resolveAccessToken(supabaseUrl, anonKey);
  const result = await invoke(endpoint, anonKey, origin, auth.token, 'quality/findings', { limit: 120 });
  if (result.status !== 200 || result.body?.ok === false) {
    throw new Error(`quality/findings failed (${result.status}): ${result.body?.message || JSON.stringify(result.body).slice(0, 300)}`);
  }
  const rows = Array.isArray(result.body?.data) ? result.body.data : [];
  const runtimeRows = rows.filter((row) => row?.event_payload?.runtime_rule === true || String(row?.status || '') === 'runtime_detected');
  if (!String(result.body?.mode || '').includes('runtime_rules')) throw new Error(`quality/findings mode is not runtime-backed: ${result.body?.mode || '-'}`);
  if (!runtimeRows.length) throw new Error('quality/findings returned no runtime rule rows.');
  const badActionRows = runtimeRows.filter((row) => /ll_[a-z_]+|public\./iu.test(String(row.action || '')));
  if (badActionRows.length) throw new Error(`runtime findings expose technical table names in action: ${badActionRows[0].id}`);
  const badTargetRows = runtimeRows.filter((row) => /(?:^|[\s·])(?:asset_[a-z0-9_]+|tenant_brn_[a-z0-9_]+)(?:$|[\s·])/iu.test(String(row.target_name || '')));
  if (badTargetRows.length) throw new Error(`runtime findings expose machine ids in target name: ${badTargetRows[0].id} / ${badTargetRows[0].target_name}`);
  const requiredShapeMissing = runtimeRows.filter((row) => !row.target_name || !row.field_name || !row.reason_code || !row.action);
  if (requiredShapeMissing.length) throw new Error(`runtime finding missing human-facing fields: ${requiredShapeMissing[0].id}`);

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const artifact = path.join(OUT_DIR, `data-quality-runtime-smoke-${timestamp()}.json`);
  const report = {
    ok: true,
    generated_at: new Date().toISOString(),
    endpoint: redactUrl(endpoint),
    origin,
    auth_source: auth.source,
    mode: result.body?.mode,
    returned_count: rows.length,
    runtime_count: runtimeRows.length,
    sample: runtimeRows.slice(0, 10).map((row) => ({
      id: row.id,
      severity: row.severity,
      target_name: row.target_name,
      field_name: row.field_name,
      reason_code: row.reason_code,
      action: row.action,
    })),
    artifact,
  };
  fs.writeFileSync(artifact, JSON.stringify(report, null, 2), 'utf8');
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
