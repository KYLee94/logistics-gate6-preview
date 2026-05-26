const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT_DIR = path.join(ROOT, 'qa-artifacts', 'logistics-gate6');
const OUT_JSON = path.join(OUT_DIR, 'external-api-smoke-20260526.json');
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

function optionalPayloadFromEnv(prefix) {
  if (prefix === 'building') {
    const sigungu = envValue('LOGISTICS_BUILDING_SIGUNGU_CD');
    const bjdong = envValue('LOGISTICS_BUILDING_BJDONG_CD');
    const bun = envValue('LOGISTICS_BUILDING_BUN');
    const ji = envValue('LOGISTICS_BUILDING_JI') || '0000';
    if (!sigungu || !bjdong || !bun) return null;
    return { sigungu_cd: sigungu, bjdong_cd: bjdong, bun, ji, plat_gb_cd: envValue('LOGISTICS_BUILDING_PLAT_GB_CD') || '0' };
  }
  return null;
}

function summarizeBody(body) {
  if (!body || typeof body !== 'object') return body || null;
  const out = {};
  for (const key of ['ok', 'error', 'message', 'provider_error', 'provider_message', 'status', 'cache', 'detail']) {
    if (Object.prototype.hasOwnProperty.call(body, key)) out[key] = body[key];
  }
  if (body.data && typeof body.data === 'object') {
    out.data_keys = Object.keys(body.data).slice(0, 12);
  }
  return out;
}

async function main() {
  const supabaseUrl = envValue('LOGISTICS_SUPABASE_URL', 'VITE_SUPABASE_URL');
  const anonKey = envValue('LOGISTICS_SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY');
  const origin = argsValue('origin', DEFAULT_ORIGIN);
  if (!supabaseUrl || !anonKey) throw new Error('Missing Supabase URL or anon key.');
  const endpoint = `${supabaseUrl.replace(/\/$/u, '')}/functions/v1/${EDGE_FUNCTION}`;
  const auth = await resolveAccessToken(supabaseUrl, anonKey);

  const checks = [];
  const maps = await invoke(endpoint, anonKey, origin, auth.token, 'naver/maps-config', {});
  checks.push({ name: 'naver/maps-config', status: maps.status, ok: maps.status === 200 && maps.body?.ok === true });

  const dartCorpCode = argsValue('corp-code', envValue('LOGISTICS_DART_CORP_CODE'));
  if (dartCorpCode) {
    const dart = await invoke(endpoint, anonKey, origin, auth.token, 'opendart/company', { corp_code: dartCorpCode });
    checks.push({ name: 'opendart/company', status: dart.status, ok: dart.status === 200 && dart.body?.ok !== false, cache: dart.body?.cache || null, body: summarizeBody(dart.body) });
  } else {
    checks.push({ name: 'opendart/company', status: 'skipped', ok: false, reason: 'LOGISTICS_DART_CORP_CODE not set' });
  }

  const buildingPayload = optionalPayloadFromEnv('building');
  if (buildingPayload) {
    const building = await invoke(endpoint, anonKey, origin, auth.token, 'building-register/summary', buildingPayload);
    checks.push({ name: 'building-register/summary', status: building.status, ok: building.status === 200 && building.body?.ok !== false, cache: building.body?.cache || null, body: summarizeBody(building.body) });
  } else {
    checks.push({ name: 'building-register/summary', status: 'skipped', ok: false, reason: 'LOGISTICS_BUILDING_* env values not set' });
  }

  const geocodeQuery = argsValue('geocode-query', envValue('LOGISTICS_GEOCODE_QUERY'));
  if (geocodeQuery) {
    const geocode = await invoke(endpoint, anonKey, origin, auth.token, 'naver/geocode', { query: geocodeQuery });
    checks.push({ name: 'naver/geocode', status: geocode.status, ok: geocode.status === 200 && geocode.body?.ok !== false, count: Array.isArray(geocode.body?.data) ? geocode.body.data.length : 0, cache: geocode.body?.cache || null, body: summarizeBody(geocode.body) });
  } else {
    checks.push({ name: 'naver/geocode', status: 'skipped', ok: false, reason: 'LOGISTICS_GEOCODE_QUERY not set' });
  }

  const output = {
    ok: checks.filter((row) => row.status !== 'skipped').every((row) => row.ok),
    generated_at: new Date().toISOString(),
    origin,
    auth_source: auth.source,
    checks,
  };
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_JSON, JSON.stringify(output, null, 2), 'utf8');
  console.log(JSON.stringify(output, null, 2));
  if (!output.ok) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
