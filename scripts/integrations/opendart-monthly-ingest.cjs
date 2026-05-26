const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT_DIR = path.join(ROOT, 'qa-artifacts', 'logistics-gate6');
const EDGE_FUNCTION = 'll-dashboard-api';
const DEFAULT_ORIGIN = 'https://kylee94.github.io';
const OPEN_DART_BASE_URL = 'https://opendart.fss.or.kr/api';
const ANNUAL_REPORT_CODE = '11011';

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

function writeArtifact(output) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const outJson = path.join(OUT_DIR, `opendart-monthly-ingest-${timestampForFile()}.json`);
  fs.writeFileSync(outJson, JSON.stringify(output, null, 2), 'utf8');
  fs.writeFileSync(path.join(OUT_DIR, 'opendart-monthly-ingest-latest.json'), JSON.stringify(output, null, 2), 'utf8');
  return outJson;
}

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== '');
}

function normalizeText(value) {
  return String(value || '').trim();
}

function normalizeKey(value) {
  return normalizeText(value).replace(/\s+/gu, '').toLowerCase();
}

function safeProviderError(error) {
  const raw = error instanceof Error ? error.message : normalizeText(error);
  return raw
    .replace(/(crtfc_key|serviceKey|api[_-]?key|apikey|client[_-]?secret|token)=([^&\s)]+)/giu, '$1=[redacted]')
    .replace(/(Bearer\s+)[A-Za-z0-9._~-]+/gu, '$1[redacted]')
    .slice(0, 500);
}

function assertNoSecrets(label, value) {
  const serialized = JSON.stringify(value);
  if (/(crtfc_key|serviceKey)=|Bearer\s+[A-Za-z0-9._~-]+|OPENDART_API_KEY|SUPABASE_SERVICE_ROLE_KEY/iu.test(serialized)) {
    throw new Error(`${label} leaked a secret-like value`);
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

function latestClosedFinancialYears(count = 3) {
  const latestLikelyClosedYear = new Date().getUTCFullYear() - 1;
  return Array.from({ length: count }, (_, index) => String(latestLikelyClosedYear - index));
}

function parseAmount(value) {
  if (value === undefined || value === null || value === '') return null;
  const text = String(value).replace(/,/gu, '').trim();
  const negative = /^\(.+\)$/u.test(text);
  const numeric = Number(text.replace(/[()]/gu, ''));
  if (!Number.isFinite(numeric)) return null;
  return negative ? -numeric : numeric;
}

function metricForAccount(row = {}) {
  const accountName = normalizeText(firstDefined(row.account_nm, row.accountName, row.name)).toLowerCase();
  const accountId = normalizeText(row.account_id).toLowerCase();
  const sjName = normalizeText(row.sj_nm).toLowerCase();
  const combined = `${accountId} ${accountName} ${sjName}`;
  if (/ifrs[-_]?full_assets|자산총계|total\s*assets/iu.test(combined)) return { key: 'totalAssets', label: 'total assets' };
  if (/ifrs[-_]?full_liabilities|부채총계|total\s*liabil/iu.test(combined)) return { key: 'totalLiabilities', label: 'total liabilities' };
  if (/ifrs[-_]?full_equity|자본총계|total\s*equity/iu.test(combined)) return { key: 'totalEquity', label: 'total equity' };
  if (/ifrs[-_]?full_revenue|매출액|영업수익|수익\(매출액\)|revenue|sales/iu.test(combined)) return { key: 'revenue', label: 'revenue' };
  if (/ifrs[-_]?full_profitlossfromoperatingactivities|영업이익|operating\s*(income|profit)/iu.test(combined)) return { key: 'operatingIncome', label: 'operating income' };
  if (/ifrs[-_]?full_profitloss|당기순이익|net\s*income|profit\s*\(loss\)/iu.test(combined)) return { key: 'netIncome', label: 'net income' };
  return null;
}

async function fetchOpenDartJson(apiKey, endpointPath, query, timeoutMs = 15000) {
  const url = new URL(`${OPEN_DART_BASE_URL}/${endpointPath}`);
  url.searchParams.set('crtfc_key', apiKey);
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
  });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    const body = await response.json().catch(() => ({}));
    return { response, body };
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchCompany(apiKey, corpCode) {
  const { response, body } = await fetchOpenDartJson(apiKey, 'company.json', { corp_code: corpCode });
  if (!response.ok || body.status !== '000') {
    return {
      ok: false,
      provider_status: response.status,
      provider_code: body.status,
      provider_message: body.message || 'OpenDART company request failed',
    };
  }
  return { ok: true, provider_status: response.status, body };
}

async function fetchFinancialRows(apiKey, corpCode) {
  const rows = [];
  const warnings = [];
  const latestByMetric = {};
  for (const year of latestClosedFinancialYears(3)) {
    let yearRows = [];
    let usedFsDiv = '';
    for (const fsDiv of ['CFS', 'OFS']) {
      const { response, body } = await fetchOpenDartJson(apiKey, 'fnlttSinglAcntAll.json', {
        corp_code: corpCode,
        bsns_year: year,
        reprt_code: ANNUAL_REPORT_CODE,
        fs_div: fsDiv,
      });
      if (!response.ok || body.status !== '000') {
        warnings.push(`${year}/${fsDiv}: ${body.message || response.status}`);
        continue;
      }
      const sourceRows = Array.isArray(body.list) ? body.list : [];
      const normalized = [];
      const seen = new Set();
      for (const sourceRow of sourceRows) {
        const metric = metricForAccount(sourceRow);
        if (!metric || seen.has(metric.key)) continue;
        const amount = parseAmount(firstDefined(sourceRow.thstrm_amount, sourceRow.amount));
        if (amount === null) continue;
        seen.add(metric.key);
        normalized.push({
          year,
          bsns_year: year,
          fs_div: fsDiv,
          metric: metric.key,
          accountName: metric.label,
          account_nm: metric.label,
          amount,
          thstrm_amount: amount,
          currency: 'KRW',
          source_account_nm: sourceRow.account_nm,
          source_account_id: sourceRow.account_id,
        });
      }
      if (normalized.length) {
        yearRows = normalized;
        usedFsDiv = fsDiv;
        break;
      }
    }
    if (!yearRows.length) continue;
    rows.push(...yearRows);
    if (!Object.keys(latestByMetric).length) {
      for (const row of yearRows) latestByMetric[row.metric] = row.amount;
      latestByMetric.bsns_year = year;
      latestByMetric.fs_div = usedFsDiv;
    }
  }
  return { rows, latestByMetric, warnings };
}

function walkCompanies(value, out = []) {
  if (!value || typeof value !== 'object') return out;
  if (Array.isArray(value)) {
    value.forEach((item) => walkCompanies(item, out));
    return out;
  }
  const corpCode = normalizeText(firstDefined(value.dartCorpCode, value.dart_corp_code));
  if (/^\d{8}$/u.test(corpCode)) {
    out.push({
      corp_code: corpCode,
      tenant_name: normalizeText(firstDefined(value.tenantMasterName, value.tenant_master_name, value.companyName, value.company_name)),
      business_registration_no: normalizeText(firstDefined(value.businessRegistrationNo, value.business_registration_no)),
    });
  }
  Object.values(value).forEach((item) => walkCompanies(item, out));
  return out;
}

function loadCompanyTargets() {
  const explicitCorpCode = argsValue('corp-code');
  if (explicitCorpCode) return [{ corp_code: explicitCorpCode, tenant_name: argsValue('tenant-name'), business_registration_no: '' }];
  const dir = path.join(ROOT, 'src', 'components', 'system', 'workspace', 'logisticsCompanyData');
  const byCode = new Map();
  for (const fileName of fs.readdirSync(dir).filter((name) => name.endsWith('.json'))) {
    const filePath = path.join(dir, fileName);
    const payload = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    for (const row of walkCompanies(payload)) {
      const key = normalizeKey(row.corp_code);
      if (!key || byCode.has(key)) continue;
      byCode.set(key, { ...row, source_file: fileName });
    }
  }
  const limit = Number(argsValue('limit', '0'));
  const rows = [...byCode.values()].sort((a, b) => a.corp_code.localeCompare(b.corp_code));
  return limit > 0 ? rows.slice(0, limit) : rows;
}

function summarizeBody(body) {
  return {
    ok: body?.ok,
    provider_status: body?.provider_status,
    cache: body?.cache || null,
    data_keys: body?.data && typeof body.data === 'object' ? Object.keys(body.data).slice(0, 18) : [],
  };
}

async function main() {
  const supabaseUrl = envValue('LOGISTICS_SUPABASE_URL', 'VITE_SUPABASE_URL');
  const anonKey = envValue('LOGISTICS_SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY');
  const openDartApiKey = envValue('OPENDART_API_KEY', 'LOGISTICS_OPENDART_API_KEY');
  const origin = argsValue('origin', DEFAULT_ORIGIN);
  const checks = [];
  const outputBase = {
    ok: false,
    generated_at: new Date().toISOString(),
    origin,
    mode: 'opendart_monthly_ingest',
    opendart_provider_success: false,
    opendart_fallback_success: false,
    checks,
  };
  if (!supabaseUrl || !anonKey) throw new Error('Missing Supabase URL or anon key.');
  if (!openDartApiKey) {
    const output = {
      ...outputBase,
      missing_local_opendart_key: true,
      required_action: 'Set OPENDART_API_KEY in the local environment or GitHub Actions secret before running monthly ingest. Supabase Edge secrets cannot be read back by local scripts.',
    };
    const artifact = writeArtifact(output);
    console.log(JSON.stringify({ ...output, artifact }, null, 2));
    process.exitCode = 2;
    return;
  }

  const endpoint = `${supabaseUrl.replace(/\/$/u, '')}/functions/v1/${EDGE_FUNCTION}`;
  const auth = await resolveAccessToken(supabaseUrl, anonKey);
  const targets = loadCompanyTargets();
  if (!targets.length) throw new Error('No DART corp_code targets found.');

  for (const target of targets) {
    const check = {
      corp_code: target.corp_code,
      tenant_name: target.tenant_name || '',
      provider_success: false,
      cache_upsert_ok: false,
      readback_ok: false,
      fallback_success: false,
    };
    try {
      const company = await fetchCompany(openDartApiKey, target.corp_code);
      check.provider_status = company.provider_status;
      if (!company.ok) {
        check.provider_error = company.provider_message;
        checks.push(check);
        continue;
      }
      const financials = await fetchFinancialRows(openDartApiKey, target.corp_code);
      const data = {
        ...company.body,
        financials: financials.rows,
        bsns_year: financials.latestByMetric.bsns_year,
        total_assets: financials.latestByMetric.totalAssets,
        total_liabilities: financials.latestByMetric.totalLiabilities,
        total_equity: financials.latestByMetric.totalEquity,
        revenue: financials.latestByMetric.revenue,
        operating_income: financials.latestByMetric.operatingIncome,
        net_income: financials.latestByMetric.netIncome,
        financial_warnings: financials.warnings.slice(0, 12).map(safeProviderError),
      };
      assertNoSecrets(`provider ${target.corp_code}`, data);
      check.provider_success = true;
      check.financial_rows = financials.rows.length;

      const upsert = await invoke(endpoint, anonKey, origin, auth.token, 'opendart/company/cache-upsert', {
        corp_code: target.corp_code,
        include_financials: true,
        provider_status: company.provider_status,
        data,
      });
      assertNoSecrets(`cache-upsert ${target.corp_code}`, upsert.body);
      check.cache_upsert_status = upsert.status;
      check.cache_upsert_ok = upsert.status === 200 && upsert.body?.ok === true && upsert.body?.cache?.readback_hit === true;
      check.cache_upsert = summarizeBody(upsert.body);

      const readback = await invoke(endpoint, anonKey, origin, auth.token, 'opendart/company', {
        corp_code: target.corp_code,
        include_financials: true,
      });
      assertNoSecrets(`readback ${target.corp_code}`, readback.body);
      check.readback_status = readback.status;
      check.readback_ok = readback.status === 200
        && readback.body?.ok === true
        && readback.body?.provider_status === 200
        && readback.body?.cache?.hit === true
        && readback.body?.cache?.source !== 'll_tenants';
      check.readback = summarizeBody(readback.body);
    } catch (error) {
      check.error = safeProviderError(error);
    }
    checks.push(check);
  }

  const output = {
    ...outputBase,
    auth_source: auth.source,
    target_count: targets.length,
    passed: checks.filter((row) => row.provider_success && row.cache_upsert_ok && row.readback_ok).length,
    failed: checks.filter((row) => !(row.provider_success && row.cache_upsert_ok && row.readback_ok)).length,
  };
  output.ok = output.failed === 0;
  output.opendart_provider_success = checks.some((row) => row.provider_success);
  output.opendart_fallback_success = checks.some((row) => row.fallback_success);
  const artifact = writeArtifact(output);
  console.log(JSON.stringify({ ...output, artifact }, null, 2));
  if (!output.ok) process.exitCode = 1;
}

main().catch((error) => {
  const output = {
    ok: false,
    generated_at: new Date().toISOString(),
    mode: 'opendart_monthly_ingest',
    error: safeProviderError(error),
  };
  const artifact = writeArtifact(output);
  console.error(JSON.stringify({ ...output, artifact }, null, 2));
  process.exit(1);
});
