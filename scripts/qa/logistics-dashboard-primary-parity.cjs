const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const EDGE_FUNCTION = 'll-dashboard-api';
const DEFAULT_BASIS_DATE = currentKstMonthEndDate();
const DEFAULT_ORIGIN = 'https://kylee94.github.io';
const DEFAULT_OUT = path.join(ROOT, 'qa-artifacts', 'logistics-gate6', 'dashboard-primary-parity-20260521.json');

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

function readText(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function lineOf(text, pattern) {
  const index = text.indexOf(pattern);
  if (index === -1) return null;
  return text.slice(0, index).split(/\r?\n/u).length;
}

function has(text, pattern) {
  return text.includes(pattern);
}

function statusFromChecks(checks) {
  const failed = checks.filter((check) => !check.pass);
  return failed.length ? 'fail' : 'pass';
}

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== '');
}

function readinessFrom(checks) {
  if (statusFromChecks(checks) === 'fail') return 'fail';
  return 'primary_safe_pass';
}

function summarizeDashboardBody(body) {
  const data = body?.data || {};
  const evidence = Array.isArray(body?.evidence?.tables) ? body.evidence.tables : [];
  const leasesById = new Map((data.leases || []).map((row) => [firstDefined(row.lease_id, row.leaseId), row]));
  const expiryCandidateRows = (data.lease_spaces || []).filter((row) => {
    const lease = leasesById.get(firstDefined(row.lease_id, row.leaseId)) || {};
    return Boolean(firstDefined(lease.current_end_date, lease.currentEndDate));
  });
  return {
    ok: body?.ok === true,
    source: body?.source,
    version: body?.version,
    basis_date: body?.basis_date,
    scope_hash: body?.scope?.scope_hash,
    readable_asset_count: Array.isArray(body?.scope?.readable_asset_ids) ? body.scope.readable_asset_ids.length : undefined,
    evidence_tables: evidence.map((row) => row.table),
    evidence_rows: Object.fromEntries(evidence.map((row) => [row.table, row.rows])),
    summary: data.summary || null,
    assets: Array.isArray(data.assets) ? data.assets.length : (data.asset ? 1 : 0),
    tenants: Array.isArray(data.tenants) ? data.tenants.length : 0,
    leases: Array.isArray(data.leases) ? data.leases.length : 0,
    lease_spaces: Array.isArray(data.lease_spaces) ? data.lease_spaces.length : 0,
    expiry_candidate_rows: expiryCandidateRows.length,
    rent_history: Array.isArray(data.rent_history) ? data.rent_history.length : 0,
    fund_overview: Boolean(data.fund_overview),
  };
}

function validateDashboardBody(action, body, basisDate) {
  const errors = [];
  if (body?.ok !== true) errors.push('ok is not true');
  if (body?.source !== 'supabase') errors.push(`source is ${body?.source || 'missing'}`);
  if (body?.version !== 'll-dashboard-payload-v1') errors.push(`version is ${body?.version || 'missing'}`);
  if (body?.basis_date !== basisDate) errors.push(`basis_date is ${body?.basis_date || 'missing'}`);
  if (!body?.scope?.scope_hash) errors.push('scope_hash is missing');
  if (!Array.isArray(body?.evidence?.tables) || !body.evidence.tables.length) errors.push('evidence.tables is missing');
  if (!body?.data || typeof body.data !== 'object') errors.push('data is missing');
  const requiredTables = action === 'dashboard/home/read'
    ? ['public.ll_assets', 'public.ll_lease_spaces', 'public.ll_rent_history']
    : action === 'dashboard/asset/read'
      ? ['public.ll_assets', 'public.ll_lease_spaces', 'public.ll_rent_history']
      : ['public.ll_tenants', 'public.ll_assets', 'public.ll_lease_spaces'];
  const actualTables = new Set((body?.evidence?.tables || []).map((row) => row.table));
  requiredTables.forEach((table) => {
    if (!actualTables.has(table)) errors.push(`${table} evidence is missing`);
  });
  return errors;
}

async function signInForAccessToken(supabaseUrl, anonKey, authEmail, authPassword) {
  const response = await fetch(`${supabaseUrl.replace(/\/$/u, '')}/auth/v1/token?grant_type=password`, {
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

async function resolveAccessToken(supabaseUrl, anonKey) {
  const accessToken = envValue('LOGISTICS_SUPABASE_ACCESS_TOKEN');
  if (accessToken) return { token: accessToken, source: 'LOGISTICS_SUPABASE_ACCESS_TOKEN' };
  const authEmail = argsValue('email', envValue('LOGISTICS_SUPABASE_EMAIL', 'LOGISTICS_SUPABASE_AUTH_EMAIL'));
  const authPassword = argsValue('password', envValue('LOGISTICS_SUPABASE_PASSWORD', 'LOGISTICS_SUPABASE_AUTH_PASSWORD'));
  if (!authEmail || !authPassword) return { token: '', source: 'missing_credentials' };
  const token = await signInForAccessToken(supabaseUrl, anonKey, authEmail, authPassword);
  return { token, source: 'password_grant' };
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

async function main() {
  const workspace = readText('src/components/system/workspace/WorkspaceLogistics.jsx');
  const basisDate = argsValue('basis-date', DEFAULT_BASIS_DATE);
  const origin = argsValue('origin', DEFAULT_ORIGIN);
  const outputPath = argsValue('out', DEFAULT_OUT);
  const supabaseUrl = envValue('LOGISTICS_SUPABASE_URL', 'VITE_SUPABASE_URL');
  const anonKey = envValue('LOGISTICS_SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY');
  const endpoint = supabaseUrl ? `${supabaseUrl.replace(/\/$/u, '')}/functions/v1/${EDGE_FUNCTION}` : '';

  const staticChecks = {
    readMode: {
      status: has(workspace, "const DASHBOARD_READ_MODE = import.meta.env.VITE_LOGISTICS_DASHBOARD_READ_MODE || 'primary-safe'") ? 'pass' : 'fail',
      line: lineOf(workspace, 'const DASHBOARD_READ_MODE'),
      evidence: 'branch default read mode must be primary-safe',
    },
    fallbackPolicy: {
      status: statusFromChecks([
        { pass: has(workspace, 'isAuthOrPermissionFailure(status, message)') },
        { pass: has(workspace, 'canUseStaticDashboardFallback(mode, status, message)') },
        { pass: has(workspace, "if (mode === 'primary-safe' || mode === 'primary') return false") },
        { pass: has(workspace, "status >= 500") },
        { pass: has(workspace, 'fallbackAllowed = !authFailure') },
      ]),
      line: lineOf(workspace, 'function canUseStaticDashboardFallback'),
      evidence: 'primary-safe/primary and 401/403 should not be eligible for static fallback',
    },
    loadingBlock: {
      status: !has(workspace, 'title="Supabase read loading"') ? 'pass' : 'fail',
      line: lineOf(workspace, 'title="Supabase read loading"'),
      evidence: 'normal Supabase read loading status block should not render during tab switches; blocked/error states remain visible',
    },
  };

  const componentMatrix = [
    {
      component: 'Home',
      api: 'dashboard/home/read',
      lines: [lineOf(workspace, "useDashboardReadBridge('dashboard/home/read'")],
      static_fallback: 'logisticsHomeData.json',
      residual_static_dependencies: [
        'static Home JSON remains bundled but is not used by primary-safe/primary failure paths',
      ],
      checks: [
        { name: 'home read bridge exists', pass: has(workspace, "useDashboardReadBridge('dashboard/home/read'") },
        { name: 'home adapter exists', pass: has(workspace, 'homePayloadFromDashboardRead') },
        { name: 'blocked state empties data instead of static fallback', pass: has(workspace, 'homeReadBlocked ? {') },
      ],
    },
    {
      component: 'Asset',
      api: 'dashboard/asset/read',
      lines: [lineOf(workspace, "useDashboardReadBridge('dashboard/asset/read'")],
      static_fallback: 'logisticsAssetData/*.json',
      residual_static_dependencies: [
        'ASSET_PAYLOADS remains bundled but is not used by primary-safe/primary failure paths',
        'weekly management project text can still enrich non-core overview details when Supabase detail is unavailable',
      ],
      checks: [
        { name: 'asset read bridge exists', pass: has(workspace, "useDashboardReadBridge('dashboard/asset/read'") },
        { name: 'asset adapter exists', pass: has(workspace, 'assetPayloadFromDashboardRead') },
        { name: 'asset blocked state prevents static payload', pass: has(workspace, "assetRead.primaryMode && !assetRead.fallbackAllowed") },
        { name: 'asset expiry snapshot derives from lease-space rows', pass: has(workspace, 'buildExpiryRowsFromRows(corrected.rows.length ? corrected.rows : explicitExpiryRows)') },
        { name: 'asset expiry snapshot merges explicit snapshot without dropping derived rows', pass: has(workspace, 'mergeExpiryRows(derivedExpiryRows, explicitExpiryRows)') },
        { name: 'asset expiry snapshot sorts same remaining months by higher floor first', pass: has(workspace, 'expiryFloorSortValue(b) - expiryFloorSortValue(a)') },
        { name: 'asset expiry chart does not truncate to first 10 rows', pass: has(workspace, 'maxRows={Infinity} includeZero') },
      ],
    },
    {
      component: 'Company',
      api: 'dashboard/company/read',
      lines: [lineOf(workspace, "useDashboardReadBridge('dashboard/company/read'")],
      static_fallback: 'logisticsCompanyData/*.json',
      residual_static_dependencies: [
        'COMPANY_PAYLOADS remains bundled but is not used by primary-safe/primary failure paths',
      ],
      checks: [
        { name: 'company read bridge exists', pass: has(workspace, "useDashboardReadBridge('dashboard/company/read'") },
        { name: 'company adapter exists', pass: has(workspace, 'companyPayloadFromDashboardRead') },
        { name: 'company blocked state prevents static payload', pass: has(workspace, "companyRead.primaryMode && !companyRead.fallbackAllowed") },
      ],
    },
    {
      component: 'PDF Report',
      api: 'dashboard/home/read + dashboard/asset/read',
      lines: [lineOf(workspace, 'function PdfReportBuilder'), lineOf(workspace, 'const pdfAssetRead = useDashboardReadBridge')],
      static_fallback: 'current selected payload fallback',
      residual_static_dependencies: [
        'selected asset payload can remain as print-safe static source only outside primary-safe/primary failure paths',
        'weekly asset rows can enrich management-project report detail rows',
      ],
      checks: [
        { name: 'pdf uses shared home read dataset', pass: has(workspace, 'const dashboardDataset = useDashboardHomeReadDataset(memberInfo);') },
        { name: 'pdf uses asset read bridge', pass: has(workspace, 'const pdfAssetRead = useDashboardReadBridge') },
        { name: 'pdf can include fund overview', pass: has(workspace, 'fundOverview') && has(workspace, '펀드개요') },
        { name: 'pdf blocked state is visible', pass: has(workspace, 'PDF Report 데이터 읽기 권한') },
      ],
    },
    {
      component: 'Analysis Tools',
      api: 'dashboard/home/read shared dataset',
      lines: [lineOf(workspace, 'function AnalysisToolsDashboard')],
      static_fallback: 'shared home fallback rows',
      residual_static_dependencies: [
        'inherits shared Home fallback only outside primary-safe/primary failure paths',
      ],
      checks: [
        { name: 'analysis uses shared home read dataset', pass: has(workspace, 'function AnalysisToolsDashboard') && has(workspace, 'useDashboardHomeReadDataset(memberInfo)') },
        { name: 'analysis reads general rows from dataset', pass: has(workspace, 'dashboardDataset.generalRows') },
        { name: 'analysis blocked state is visible', pass: has(workspace, 'Analysis 데이터 읽기 권한') },
      ],
    },
    {
      component: 'Pivot Table',
      api: 'dashboard/home/read shared dataset',
      lines: [lineOf(workspace, 'function DataPlaygroundDashboard')],
      static_fallback: 'shared home fallback rows',
      residual_static_dependencies: [
        'inherits shared Home fallback only outside primary-safe/primary failure paths',
      ],
      checks: [
        { name: 'pivot uses shared home read dataset', pass: has(workspace, 'function DataPlaygroundDashboard') && has(workspace, 'useDashboardHomeReadDataset(memberInfo)') },
        { name: 'pivot can source rows from general rows', pass: has(workspace, 'sourceRows') && has(workspace, 'dashboardDataset.generalRows') },
        { name: 'pivot blocked state is visible', pass: has(workspace, 'Pivot Table 데이터 읽기 권한') },
      ],
    },
  ].map((item) => ({
    ...item,
    wiring_status: statusFromChecks(item.checks),
    primary_readiness: readinessFrom(item.checks),
    checks: item.checks.map((check) => ({ ...check, status: check.pass ? 'pass' : 'fail' })),
  }));

  let runtime = {
    status: 'blocked_missing_credentials',
    message: 'Set LOGISTICS_SUPABASE_ACCESS_TOKEN, or LOGISTICS_SUPABASE_EMAIL and LOGISTICS_SUPABASE_PASSWORD to run logged-in runtime parity.',
    results: [],
  };

  if (supabaseUrl && anonKey) {
    const auth = await resolveAccessToken(supabaseUrl, anonKey);
    if (auth.token) {
      const actions = [
        { action: 'dashboard/home/read', payload: { basis_date: basisDate } },
        { action: 'dashboard/asset/read', payload: { basis_date: basisDate, ...(argsValue('asset-id') ? { asset_id: argsValue('asset-id') } : {}) } },
        { action: 'dashboard/company/read', payload: { basis_date: basisDate, ...(argsValue('tenant-id') ? { tenant_id: argsValue('tenant-id') } : {}) } },
      ];
      const results = [];
      for (const item of actions) {
        const result = await invoke(endpoint, anonKey, origin, auth.token, item.action, item.payload);
        const errors = result.status === 200 ? validateDashboardBody(item.action, result.body, basisDate) : [`status ${result.status}`];
        results.push({
          action: item.action,
          status: result.status,
          parity_status: errors.length ? 'fail' : 'pass',
          errors,
          body_summary: summarizeDashboardBody(result.body),
        });
      }
      const unauth = await invoke(endpoint, anonKey, origin, '', 'dashboard/home/read', { basis_date: basisDate });
      runtime = {
        status: results.every((row) => row.parity_status === 'pass') && unauth.status === 401 ? 'pass' : 'fail',
        auth_source: auth.source,
        origin,
        basis_date: basisDate,
        results,
        negative: [{ action: unauth.action, status: unauth.status, expected: 401, status_result: unauth.status === 401 ? 'pass' : 'fail' }],
      };
    }
  } else {
    runtime = {
      status: 'blocked_missing_supabase_env',
      message: 'Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY or LOGISTICS_SUPABASE_URL and LOGISTICS_SUPABASE_ANON_KEY.',
      results: [],
    };
  }

  const report = {
    ok: runtime.status === 'pass' && componentMatrix.every((row) => row.wiring_status === 'pass') && Object.values(staticChecks).every((row) => row.status === 'pass'),
    checked_at: new Date().toISOString(),
    branch_only: true,
    basis_date: basisDate,
    static_checks: staticChecks,
    component_matrix: componentMatrix,
    runtime,
    decision: runtime.status === 'pass'
      ? 'runtime Supabase read API parity smoke passed for Home/Asset/Company; residual static dependencies remain fallback-only or non-core and browser component QA remains manual.'
      : 'runtime Supabase primary parity is not closed until logged-in JWT smoke passes.',
  };

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
