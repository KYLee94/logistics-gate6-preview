const fs = require('fs');
const path = require('path');
const { assertQaMutationOptIn } = require('./lib/qa-mutation-guard.cjs');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT_DIR = path.join(ROOT, 'qa-artifacts', 'logistics-gate6');
const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+$/u, 'Z');
const OUT_JSON = path.join(OUT_DIR, `feature-access-save-readback-${stamp}.json`);
const LATEST_JSON = path.join(OUT_DIR, 'feature-access-save-readback-latest.json');
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
  if (!response.ok || body?.ok === false) {
    const message = body?.message || body?.error || body?.raw || `HTTP ${response.status}`;
    throw new Error(`${action} failed: ${message}`);
  }
  return body?.data || body;
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function userKey(row) {
  return String(row?.email || row?.staff_name || '').trim().toLowerCase();
}

function usersEqual(left = [], right = []) {
  const a = left.map(userKey).filter(Boolean).sort();
  const b = right.map(userKey).filter(Boolean).sort();
  return JSON.stringify(a) === JSON.stringify(b);
}

function pickMutation(config, users) {
  const featureEntries = Object.entries(config.features || {});
  if (!featureEntries.length) throw new Error('feature-access/get returned no features');
  const candidateUsers = users.length
    ? users
    : featureEntries.flatMap(([, feature]) => Array.isArray(feature.users) ? feature.users : []);
  if (!candidateUsers.length) throw new Error('No users available for feature-access mutation probe');

  for (const [featureKey, feature] of featureEntries) {
    const currentUsers = Array.isArray(feature.users) ? feature.users : [];
    const currentKeys = new Set(currentUsers.map(userKey).filter(Boolean));
    const addUser = candidateUsers.find((row) => {
      const key = userKey(row);
      return key && !currentKeys.has(key);
    });
    if (addUser) return { featureKey, mode: 'add', user: addUser };
  }

  for (const [featureKey, feature] of featureEntries) {
    const currentUsers = Array.isArray(feature.users) ? feature.users : [];
    if (currentUsers.length) return { featureKey, mode: 'remove', user: currentUsers[currentUsers.length - 1] };
  }
  throw new Error('No mutable feature access target was found');
}

async function main() {
  assertQaMutationOptIn({
    flag: 'allow-write',
    purpose: 'Feature-access save/readback/restore probe',
  });
  const supabaseUrl = envValue('LOGISTICS_SUPABASE_URL', 'VITE_SUPABASE_URL');
  const anonKey = envValue('LOGISTICS_SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY');
  const origin = DEFAULT_ORIGIN;
  if (!supabaseUrl || !anonKey) throw new Error('Missing Supabase URL or anon key.');
  const endpoint = `${supabaseUrl.replace(/\/$/u, '')}/functions/v1/${EDGE_FUNCTION}`;
  const auth = await resolveAccessToken(supabaseUrl, anonKey);

  const initial = await invoke(endpoint, anonKey, origin, auth.token, 'feature-access/get', {});
  const usersData = await invoke(endpoint, anonKey, origin, auth.token, 'auth/login-capability/list', {}).catch(() => ({ users: [] }));
  const originalConfig = cloneJson(initial);
  const mutation = pickMutation(originalConfig, Array.isArray(usersData.users) ? usersData.users : []);
  const mutatedConfig = cloneJson(originalConfig);
  const feature = mutatedConfig.features[mutation.featureKey];
  const currentUsers = Array.isArray(feature.users) ? feature.users : [];
  if (mutation.mode === 'add') {
    feature.users = [...currentUsers, mutation.user];
  } else {
    const removeKey = userKey(mutation.user);
    feature.users = currentUsers.filter((row) => userKey(row) !== removeKey);
  }
  mutatedConfig.updatedAt = new Date().toISOString();

  let restored = false;
  try {
    const changedStartedAt = Date.now();
    await invoke(endpoint, anonKey, origin, auth.token, 'feature-access/update', {
      config: mutatedConfig,
      changes: [{ featureKey: mutation.featureKey, user: mutation.user, enabled: mutation.mode === 'add' }],
    });
    const changedElapsedMs = Date.now() - changedStartedAt;
    const changed = await invoke(endpoint, anonKey, origin, auth.token, 'feature-access/get', {});
    if (!usersEqual(changed.features?.[mutation.featureKey]?.users || [], mutatedConfig.features?.[mutation.featureKey]?.users || [])) {
      throw new Error('feature-access readback did not match the changed config');
    }
    originalConfig.updatedAt = new Date().toISOString();
    const restoreStartedAt = Date.now();
    await invoke(endpoint, anonKey, origin, auth.token, 'feature-access/update', {
      config: originalConfig,
      changes: [{ featureKey: mutation.featureKey, user: mutation.user, enabled: mutation.mode !== 'add' }],
    });
    const restoreElapsedMs = Date.now() - restoreStartedAt;
    const restoredConfig = await invoke(endpoint, anonKey, origin, auth.token, 'feature-access/get', {});
    restored = usersEqual(restoredConfig.features?.[mutation.featureKey]?.users || [], originalConfig.features?.[mutation.featureKey]?.users || []);
    if (!restored) throw new Error('feature-access restore readback did not match the original config');
    if (changedElapsedMs > 3000 || restoreElapsedMs > 3000) {
      throw new Error(`feature-access save exceeded 3000ms (change=${changedElapsedMs}ms restore=${restoreElapsedMs}ms)`);
    }
    const report = {
      ok: true,
      generated_at: new Date().toISOString(),
      endpoint: endpoint.replace(/https:\/\/([^./]+)\./u, 'https://$1.redacted.'),
      origin,
      auth_source: auth.source,
      feature_key: mutation.featureKey,
      mutation_mode: mutation.mode,
      user_email: mutation.user.email || '',
      changed_elapsed_ms: changedElapsedMs,
      restore_elapsed_ms: restoreElapsedMs,
      save_under_3s: true,
      changed_readback_match: true,
      restored_readback_match: true,
    };
    fs.mkdirSync(OUT_DIR, { recursive: true });
    fs.writeFileSync(OUT_JSON, JSON.stringify(report, null, 2), 'utf8');
    fs.writeFileSync(LATEST_JSON, JSON.stringify(report, null, 2), 'utf8');
    console.log(JSON.stringify(report, null, 2));
  } catch (error) {
    if (!restored) {
      try {
        originalConfig.updatedAt = new Date().toISOString();
        await invoke(endpoint, anonKey, origin, auth.token, 'feature-access/update', {
          config: originalConfig,
          changes: [{ featureKey: mutation.featureKey, user: mutation.user, enabled: mutation.mode !== 'add' }],
        });
      } catch (restoreError) {
        error.restore_error = restoreError.message;
      }
    }
    throw error;
  }
}

main().catch((error) => {
  if (error?.code === 'QA_MUTATION_OPT_IN_REQUIRED') {
    console.error(error.message);
    process.exit(1);
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const report = { ok: false, generated_at: new Date().toISOString(), error: error.message, restore_error: error.restore_error || undefined };
  fs.writeFileSync(OUT_JSON, JSON.stringify(report, null, 2), 'utf8');
  fs.writeFileSync(LATEST_JSON, JSON.stringify(report, null, 2), 'utf8');
  console.error(error);
  process.exit(1);
});
