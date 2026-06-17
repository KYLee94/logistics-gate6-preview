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
  if (!response.ok || body?.ok === false) throw new Error(`${action} failed (${response.status}): ${body.message || body.error || 'unknown error'}`);
  return body.data || {};
}

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const supabaseUrl = envValue('LOGISTICS_SUPABASE_URL', 'VITE_SUPABASE_URL');
  const anonKey = envValue('LOGISTICS_SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY');
  if (!supabaseUrl || !anonKey) throw new Error('Set LOGISTICS_SUPABASE_URL/VITE_SUPABASE_URL and LOGISTICS_SUPABASE_ANON_KEY/VITE_SUPABASE_ANON_KEY.');
  const auth = await signIn(supabaseUrl, anonKey);
  const data = await invoke(supabaseUrl, anonKey, auth.token, 'investment-index/read');
  const funds = Array.isArray(data.funds) ? data.funds : [];
  const assets = Array.isArray(data.assets) ? data.assets : [];
  const tranches = Array.isArray(data.tranches) ? data.tranches : [];
  const summary = data.summary || {};
  const jointNames = ['동산', '부국', '에이블로지스'];
  const jointAssetRows = jointNames.map((name) => assets.find((row) => String(row.display_name || row.asset_name || '').includes(name))).filter(Boolean);
  const fundTotal = number(summary.funds?.total_capital_krw);
  const assetConfirmedTotal = number(summary.assets?.total_capital_krw);
  const checks = {
    fund_count: summary.fund_count === 17 || funds.length === 17,
    asset_count: summary.asset_count === 19 || assets.length === 19,
    tranche_non_empty: tranches.length > 0,
    equity_and_loan_present: tranches.some((row) => row.capital_kind === 'equity') && tranches.some((row) => row.capital_kind === 'loan'),
    display_names_present: funds.every((row) => row.display_name && !/^fund_/iu.test(String(row.display_name))),
    joint_assets_found: jointAssetRows.length === 3,
    joint_assets_reference_flagged: jointAssetRows.every((row) => row.joint_fund_reference && number(row.reference_total_capital_krw) > 0),
    asset_confirmed_total_not_tripled: fundTotal > 0 && assetConfirmedTotal <= fundTotal,
  };
  const report = {
    ok: Object.values(checks).every(Boolean),
    generated_at: new Date().toISOString(),
    auth_source: auth.source,
    checks,
    observed: {
      fund_count: summary.fund_count,
      asset_count: summary.asset_count,
      raw_tranche_count: summary.raw_tranche_count,
      tranche_count: summary.tranche_count,
      deduped_tranche_count: summary.deduped_tranche_count,
      joint_asset_reference_count: summary.joint_asset_reference_count,
      fund_total: fundTotal,
      asset_confirmed_total: assetConfirmedTotal,
      joint_asset_names: jointAssetRows.map((row) => row.display_name || row.asset_name),
    },
  };
  const outJson = path.join(OUT_DIR, `investment-index-readback-smoke-${timestampForFile()}.json`);
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ ok: report.ok, artifact: outJson, checks, observed: report.observed }, null, 2));
  if (!report.ok) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
