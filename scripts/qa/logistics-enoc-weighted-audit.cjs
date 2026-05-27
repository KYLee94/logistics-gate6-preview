const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT_DIR = path.join(ROOT, 'qa-artifacts', 'logistics-gate6');
const EDGE_FUNCTION = 'll-dashboard-api';
const DEFAULT_ORIGIN = 'https://kylee94.github.io';
const PY_PER_SQM = 0.3025;

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

function currentKstMonthEndDate() {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
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
  return { status: response.status, ok: response.ok, body };
}

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== '');
}

function numberValue(value) {
  if (value === undefined || value === null || value === '') return 0;
  const numeric = Number(String(value).replace(/,/gu, '').replace(/[^\d.-]/gu, ''));
  return Number.isFinite(numeric) ? numeric : 0;
}

function rowAreaPy(row = {}) {
  const sqm = numberValue(firstDefined(row.leased_area_sqm, row.leasedAreaSqm, row.area_sqm, row.areaSqm));
  if (sqm > 0) return sqm * PY_PER_SQM;
  return numberValue(firstDefined(row.leased_area_py, row.leasedAreaPy, row.area_py, row.areaPy));
}

function rowMonthlyCost(row = {}) {
  const combined = numberValue(firstDefined(row.current_monthly_cost_total, row.currentMonthlyCostTotal, row.monthly_cost_total, row.monthlyCostTotal, row.monthly_combined_total, row.monthlyCombinedTotal));
  if (combined > 0) return combined;
  const rent = numberValue(firstDefined(row.current_monthly_rent_total, row.currentMonthlyRentTotal, row.monthly_rent_total, row.monthlyRentTotal));
  const mf = numberValue(firstDefined(row.current_monthly_mf_total, row.currentMonthlyMfTotal, row.monthly_mf_total, row.monthlyMfTotal));
  return rent + mf;
}

function rowENoc(row = {}) {
  const areaPy = rowAreaPy(row);
  const monthlyCost = rowMonthlyCost(row);
  if (areaPy > 0 && monthlyCost > 0) return monthlyCost / areaPy;
  return numberValue(firstDefined(row.e_noc, row.eNoc, row.average_e_noc, row.averageENoc));
}

function tenantName(row = {}, tenantMap = new Map()) {
  const id = String(firstDefined(row.tenant_id, row.tenantId, '')).trim();
  return String(firstDefined(row.tenant_master_name, row.tenantMasterName, row.tenant_name, row.tenantName, tenantMap.get(id), id, '')).trim();
}

function weightedAudit(rows = []) {
  const usable = rows
    .map((row) => ({
      area_py: rowAreaPy(row),
      monthly_cost: rowMonthlyCost(row),
      row_e_noc: rowENoc(row),
    }))
    .filter((row) => row.area_py > 0 && row.monthly_cost > 0);
  const areaPy = usable.reduce((sum, row) => sum + row.area_py, 0);
  const monthlyCost = usable.reduce((sum, row) => sum + row.monthly_cost, 0);
  const weightedByCost = areaPy > 0 ? monthlyCost / areaPy : 0;
  const weightedByRows = areaPy > 0 ? usable.reduce((sum, row) => sum + row.row_e_noc * row.area_py, 0) / areaPy : 0;
  const simpleAverage = usable.length ? usable.reduce((sum, row) => sum + row.row_e_noc, 0) / usable.length : 0;
  return {
    row_count: rows.length,
    usable_row_count: usable.length,
    leased_area_py: Math.round(areaPy * 100) / 100,
    monthly_cost_total: Math.round(monthlyCost),
    weighted_e_noc_by_cost: Math.round(weightedByCost),
    weighted_e_noc_by_rows: Math.round(weightedByRows),
    simple_average_e_noc: Math.round(simpleAverage),
    weighted_formula_match: Math.abs(weightedByCost - weightedByRows) <= 1,
    simple_average_delta: Math.round(simpleAverage - weightedByCost),
  };
}

function frontendWeightedAverageStaticChecks() {
  const sourcePath = path.join(ROOT, 'src', 'components', 'system', 'workspace', 'WorkspaceLogistics.jsx');
  const source = fs.readFileSync(sourcePath, 'utf8');
  const checks = [
    {
      id: 'analysis_average_helper_uses_weighted_enoc',
      ok: /function averageMetricValue\(rows, metric\)[\s\S]*metric === 'eNoc'[\s\S]*calculateWeightedENoc\(rows, 0\)/u.test(source),
    },
    {
      id: 'pivot_average_enoc_uses_average_metric_value',
      ok: /aggregation === 'average' && metric === 'eNoc'[\s\S]*averageMetricValue\(rows, metric\)/u.test(source),
    },
    {
      id: 'analysis_portfolio_average_uses_helper',
      ok: /const portfolioAverage = averageMetricValue\(metricRankRows, benchmarkMetric\);/u.test(source),
    },
    {
      id: 'analysis_selected_average_uses_helper',
      ok: /const selectedAverage = averageMetricValue\(rows, benchmarkMetric\);/u.test(source),
    },
  ];
  return {
    ok: checks.every((check) => check.ok),
    checks,
  };
}

function groupByTenant(rows = [], tenantMap = new Map()) {
  const groups = new Map();
  rows.forEach((row) => {
    const id = String(firstDefined(row.tenant_id, row.tenantId, '')).trim();
    const name = tenantName(row, tenantMap);
    const key = id || name;
    if (!key) return;
    const current = groups.get(key) || { tenant_id_redacted: id ? id.replace(/^tenant_/u, 'tenant_[redacted]_') : '', tenant_name: name, rows: [] };
    current.rows.push(row);
    groups.set(key, current);
  });
  return [...groups.values()];
}

async function main() {
  const supabaseUrl = envValue('LOGISTICS_SUPABASE_URL', 'VITE_SUPABASE_URL');
  const anonKey = envValue('LOGISTICS_SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY');
  const origin = argsValue('origin', DEFAULT_ORIGIN);
  const basisDate = argsValue('basis-date', envValue('LOGISTICS_BASIS_DATE') || currentKstMonthEndDate());
  if (!supabaseUrl || !anonKey) throw new Error('Missing Supabase URL or anon key.');
  const endpoint = `${supabaseUrl.replace(/\/$/u, '')}/functions/v1/${EDGE_FUNCTION}`;
  const auth = await resolveAccessToken(supabaseUrl, anonKey);

  const homeRead = await invoke(endpoint, anonKey, origin, auth.token, 'dashboard/home/read', { basis_date: basisDate });
  if (homeRead.status !== 200 || homeRead.body?.ok !== true) throw new Error(`dashboard/home/read failed: ${homeRead.status}`);
  const assets = homeRead.body?.data?.assets || [];
  const tenantMap = new Map((homeRead.body?.data?.tenants || []).map((row) => [String(row.tenant_id || ''), String(row.tenant_master_name || row.tenant_name || '')]));

  const assetResults = [];
  const tenantResults = [];
  const allLeaseRows = [];
  for (const asset of assets) {
    const assetRead = await invoke(endpoint, anonKey, origin, auth.token, 'dashboard/asset/read', { basis_date: basisDate, asset_id: asset.asset_id });
    if (assetRead.status !== 200 || assetRead.body?.ok !== true) throw new Error(`dashboard/asset/read failed for ${asset.asset_name}: ${assetRead.status}`);
    const leaseRows = assetRead.body?.data?.lease_spaces || [];
    allLeaseRows.push(...leaseRows);
    const audit = weightedAudit(leaseRows);
    assetResults.push({
      asset_name: asset.asset_name,
      asset_id_redacted: String(asset.asset_id || '').replace(/^asset_/u, 'asset_[redacted]_'),
      ...audit,
      status: audit.usable_row_count > 0 ? 'calculated' : 'no_calculable_e_noc',
      ok: audit.weighted_formula_match,
    });
    groupByTenant(leaseRows, tenantMap).forEach((group) => {
      const tenantAudit = weightedAudit(group.rows);
      tenantResults.push({
        asset_name: asset.asset_name,
        tenant_name: group.tenant_name,
        tenant_id_redacted: group.tenant_id_redacted,
        ...tenantAudit,
        status: tenantAudit.usable_row_count > 0 ? 'calculated' : 'no_calculable_e_noc',
        ok: tenantAudit.weighted_formula_match,
      });
    });
  }

  const portfolio = weightedAudit(allLeaseRows);
  const frontendStatic = frontendWeightedAverageStaticChecks();
  const output = {
    ok: assetResults.every((row) => row.ok) && tenantResults.every((row) => row.ok) && portfolio.weighted_formula_match && frontendStatic.ok,
    generated_at: new Date().toISOString(),
    origin,
    basis_date: basisDate,
    auth_source: auth.source,
    formula: 'weighted_e_noc = sum(monthly_rent_total + monthly_mf_total) / sum(leased_area_sqm * 0.3025)',
    portfolio,
    frontend_weighted_average_static: frontendStatic,
    asset_count: assetResults.length,
    tenant_asset_count: tenantResults.length,
    assets: assetResults,
    tenant_assets: tenantResults,
    largest_simple_average_deltas: [...assetResults]
      .sort((a, b) => Math.abs(b.simple_average_delta) - Math.abs(a.simple_average_delta))
      .slice(0, 8)
      .map((row) => ({
        asset_name: row.asset_name,
        weighted_e_noc: row.weighted_e_noc_by_cost,
        simple_average_e_noc: row.simple_average_e_noc,
        delta: row.simple_average_delta,
      })),
  };

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const outJson = path.join(OUT_DIR, `enoc-weighted-audit-${timestampForFile()}.json`);
  fs.writeFileSync(outJson, JSON.stringify(output, null, 2), 'utf8');
  fs.writeFileSync(path.join(OUT_DIR, 'enoc-weighted-audit-latest.json'), JSON.stringify(output, null, 2), 'utf8');
  console.log(JSON.stringify({ ...output, artifact: outJson }, null, 2));
  if (!output.ok) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
