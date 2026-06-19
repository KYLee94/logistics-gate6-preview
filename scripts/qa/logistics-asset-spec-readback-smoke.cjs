const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT_DIR = path.join(ROOT, 'qa-artifacts', 'logistics-gate6');
const TARGETS = ['아레나스양지물류센터', '인천석남물류센터', '아레나스안성'];

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

function compact(value) {
  return String(value || '').replace(/\s+/gu, '').toLowerCase();
}

function specRows(spec) {
  const payload = spec?.payload && typeof spec.payload === 'object' ? spec.payload : {};
  return Array.isArray(payload.spec_rows) ? payload.spec_rows : [];
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
  if (!response.ok || !body.access_token) throw new Error(`Supabase Auth login failed (${response.status}): ${body.message || body.error || 'unknown error'}`);
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

function findAsset(assets, targetName) {
  const key = compact(targetName);
  return assets.find((asset) => compact(asset.asset_name || asset.display_name).includes(key) || key.includes(compact(asset.asset_name || asset.display_name)));
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const supabaseUrl = envValue('LOGISTICS_SUPABASE_URL', 'VITE_SUPABASE_URL');
  const anonKey = envValue('LOGISTICS_SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY');
  if (!supabaseUrl || !anonKey) throw new Error('Set LOGISTICS_SUPABASE_URL/VITE_SUPABASE_URL and LOGISTICS_SUPABASE_ANON_KEY/VITE_SUPABASE_ANON_KEY.');
  const auth = await signIn(supabaseUrl, anonKey);
  const data = await invoke(supabaseUrl, anonKey, auth.token, 'asset-spec/read');
  const assets = Array.isArray(data.assets) ? data.assets : [];
  const specs = Array.isArray(data.specs) ? data.specs : [];
  const checks = {};
  const observed = {};
  for (const target of TARGETS) {
    const asset = findAsset(assets, target);
    const spec = specs.find((row) => row.asset_id === asset?.asset_id && row.spec_scope === 'asset');
    const rows = specRows(spec);
    const rowNumbers = new Set(rows.map((row) => Number(row.row_number)));
    const missingRows = [];
    for (let rowNumber = 5; rowNumber <= 53; rowNumber += 1) {
      if (!rowNumbers.has(rowNumber)) missingRows.push(rowNumber);
    }
    const coreRows = rows.filter((row) => Number(row.row_number) >= 5 && Number(row.row_number) <= 9);
    checks[`${target}_asset_found`] = Boolean(asset?.asset_id);
    checks[`${target}_spec_found`] = Boolean(spec?.asset_spec_id);
    checks[`${target}_rows_5_53_present`] = missingRows.length === 0;
    checks[`${target}_core_values_present`] = coreRows.length === 5 && coreRows.every((row) => String(row.value || '').trim());
    observed[target] = {
      asset_id: asset?.asset_id || null,
      asset_name: asset?.asset_name || null,
      can_update: asset?.can_update === true,
      spec_id: spec?.asset_spec_id || null,
      row_count: rows.length,
      missing_rows: missingRows,
      core_rows: coreRows,
    };
  }
  const report = {
    ok: Object.values(checks).every(Boolean),
    generated_at: new Date().toISOString(),
    auth_source: auth.source,
    checks,
    observed,
  };
  const stamp = timestampForFile();
  const outJson = path.join(OUT_DIR, `asset-spec-readback-smoke-${stamp}.json`);
  const latestJson = path.join(OUT_DIR, 'asset-spec-readback-smoke-latest.json');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(latestJson, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ ok: report.ok, artifact: outJson, checks }, null, 2));
  if (!report.ok) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
