const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

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

function argsValue(name, fallback = '') {
  const flag = `--${name}`;
  const index = process.argv.indexOf(flag);
  return index === -1 ? fallback : (process.argv[index + 1] || fallback);
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function timestampForFile() {
  return new Date().toISOString().replace(/[-:]/gu, '').replace(/\..+$/u, '').replace('T', '-');
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function text(value) {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function unique(values) {
  return [...new Set(values.map(text).filter(Boolean))];
}

function deepIncludes(value, needle) {
  const target = text(needle).toLowerCase();
  if (!target) return false;
  if (value === undefined || value === null) return false;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value).toLowerCase().includes(target);
  }
  if (Array.isArray(value)) return value.some((item) => deepIncludes(item, target));
  if (typeof value === 'object') return Object.values(value).some((item) => deepIncludes(item, target));
  return false;
}

async function signIn(supabaseUrl, anonKey, overrides = {}) {
  const accessToken = overrides.accessToken || envValue('LOGISTICS_SUPABASE_ACCESS_TOKEN');
  if (accessToken) {
    const response = await fetch(`${supabaseUrl.replace(/\/$/u, '')}/auth/v1/user`, {
      headers: { apikey: anonKey, authorization: `Bearer ${accessToken}` },
    });
    const user = await response.json().catch(() => null);
    if (!response.ok || !user?.id) throw new Error(`Supabase access token validation failed (${response.status}).`);
    return {
      token: accessToken,
      source: overrides.accessToken ? 'override_access_token' : 'LOGISTICS_SUPABASE_ACCESS_TOKEN',
      user,
      session: {
        access_token: accessToken,
        token_type: 'bearer',
        expires_in: 3600,
        expires_at: Math.round(Date.now() / 1000) + 3600,
        refresh_token: '',
        user,
      },
    };
  }

  const email = overrides.email || envValue('LOGISTICS_SUPABASE_EMAIL', 'LOGISTICS_SUPABASE_AUTH_EMAIL');
  const password = overrides.password || envValue('LOGISTICS_SUPABASE_PASSWORD', 'LOGISTICS_SUPABASE_AUTH_PASSWORD');
  if (!email || !password) {
    throw new Error('Set LOGISTICS_SUPABASE_ACCESS_TOKEN, or set LOGISTICS_SUPABASE_EMAIL and LOGISTICS_SUPABASE_PASSWORD.');
  }
  const response = await fetch(`${supabaseUrl.replace(/\/$/u, '')}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: anonKey, 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const session = await response.json().catch(() => ({}));
  if (!response.ok || !session.access_token) {
    const message = session.msg || session.message || session.error_description || session.error || 'unknown auth error';
    throw new Error(`Supabase Auth login failed (${response.status}): ${message}`);
  }
  if (!session.expires_at && session.expires_in) {
    session.expires_at = Math.round(Date.now() / 1000) + Number(session.expires_in);
  }
  return { token: session.access_token, source: 'password_grant', user: session.user || null, session };
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
  if (!response.ok || body?.ok === false) {
    throw new Error(`${action} failed (${response.status}): ${body.message || body.error || 'unknown error'}`);
  }
  return { body, data: body.data || {}, status: response.status };
}

function parseSupabaseJson(raw) {
  const start = raw.indexOf('{');
  if (start === -1) throw new Error('Supabase CLI JSON output was not found.');
  for (let end = raw.length - 1; end > start; end -= 1) {
    if (raw[end] !== '}') continue;
    try {
      return JSON.parse(raw.slice(start, end + 1));
    } catch {
      // Keep searching for the real JSON boundary.
    }
  }
  throw new Error('Supabase CLI JSON output could not be parsed.');
}

function runLinkedDbQuery(sql, prefix = 'gate6-data-management-query') {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const sqlFile = path.join(OUT_DIR, `.${prefix}-${process.pid}-${Date.now()}.sql`);
  fs.writeFileSync(sqlFile, sql, 'utf8');
  try {
    const result = spawnSync('npx', ['supabase', 'db', 'query', '--linked', '--file', sqlFile, '-o', 'json'], {
      cwd: ROOT,
      encoding: 'utf8',
      maxBuffer: 1024 * 1024 * 32,
      shell: process.platform === 'win32',
    });
    if (result.status !== 0) {
      throw new Error((result.stderr || result.stdout || 'supabase db query failed').trim());
    }
    const parsed = parseSupabaseJson(result.stdout || '');
    return Array.isArray(parsed) ? parsed : (parsed.rows || []);
  } finally {
    fs.rmSync(sqlFile, { force: true });
  }
}

function chromeExecutablePath() {
  return [
    process.env.CHROME_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ].filter(Boolean).find((candidate) => fs.existsSync(candidate)) || undefined;
}

function joinUrl(baseUrl, route) {
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  return new URL(route.replace(/^\/+/u, ''), normalizedBase).toString();
}

module.exports = {
  ROOT,
  OUT_DIR,
  argsValue,
  chromeExecutablePath,
  deepIncludes,
  envValue,
  hasFlag,
  invoke,
  joinUrl,
  number,
  runLinkedDbQuery,
  safeArray,
  signIn,
  text,
  timestampForFile,
  unique,
};
