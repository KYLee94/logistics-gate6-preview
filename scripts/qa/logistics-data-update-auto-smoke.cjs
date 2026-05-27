const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT_DIR = path.join(ROOT, 'qa-artifacts', 'logistics-gate6');
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

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== '');
}

function normalizeText(value) {
  if (value === undefined || value === null) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function numberValue(value) {
  if (value === undefined || value === null || value === '') return null;
  const numeric = Number(String(value).replace(/,/gu, '').replace(/[^\d.-]/gu, ''));
  return Number.isFinite(numeric) ? numeric : null;
}

function valuesEqual(a, b) {
  const left = normalizeText(a).trim();
  const right = normalizeText(b).trim();
  if (left === right) return true;
  const leftNumber = Number(left.replace(/,/gu, ''));
  const rightNumber = Number(right.replace(/,/gu, ''));
  return Number.isFinite(leftNumber) && Number.isFinite(rightNumber) && Math.abs(leftNumber - rightNumber) < 0.000001;
}

function readbackMatches(cell, readbacks, valueKey, expectedValue) {
  return readbacks.some((row) => {
    const sameField = normalizeText(row.field_name) === normalizeText(cell.field_name);
    const sameTarget = cell.source_only
      || normalizeText(row.target_row_id) === normalizeText(cell.target_row_id)
      || normalizeText(row.target_table) === normalizeText(cell.target_table);
    return sameField && sameTarget && valuesEqual(row[valueKey], expectedValue);
  });
}

function nextTextValue(value, label) {
  const current = normalizeText(value);
  const suffix = ` QA_SMOKE_${label}`;
  return current.includes(suffix) ? current.replace(suffix, '') || `QA_SMOKE_${label}` : `${current || label}${suffix}`;
}

function nextNumberValue(value) {
  const current = numberValue(value);
  return current === null ? 1 : current + 1;
}

function cell(base, overrides) {
  return {
    action: 'update',
    asset_id: base.asset_id,
    asset_name: base.asset_name,
    lease_space_id: base.lease_space_id || '',
    lease_id: base.lease_id || '',
    tenant_id: base.tenant_id || '',
    source_row_id: base.source_row_id || '',
    source_cell_id: '',
    ...overrides,
  };
}

function buildCases(assetRead) {
  const data = assetRead.body?.data || {};
  const asset = data.asset || {};
  const leaseSpaces = data.lease_spaces || [];
  const tenants = data.tenants || [];
  const rentHistory = data.rent_history || [];
  const lease = leaseSpaces[0] || {};
  const tenant = tenants[0] || {};
  const latestRent = rentHistory.find((row) => row.is_latest === true || String(row.is_latest).toLowerCase() === 'true') || rentHistory[0] || {};
  const base = {
    asset_id: asset.asset_id,
    asset_name: asset.asset_name,
    lease_space_id: lease.lease_space_id,
    lease_id: lease.lease_id,
    tenant_id: firstDefined(lease.tenant_id, tenant.tenant_id),
  };
  return [
    {
      name: 'asset-sector',
      cell: cell(base, {
        target_table: 'public.ll_assets',
        primary_key_field: 'asset_id',
        target_row_id: asset.asset_id,
        field_name: 'sector',
        before_value: firstDefined(asset.sector, ''),
        after_value: nextTextValue(asset.sector, 'asset_sector'),
      }),
    },
    {
      name: 'asset-gross-area',
      cell: cell(base, {
        target_table: 'public.ll_assets',
        primary_key_field: 'asset_id',
        target_row_id: asset.asset_id,
        field_name: 'gross_floor_area_sqm',
        before_value: firstDefined(asset.gross_floor_area_sqm, ''),
        after_value: nextNumberValue(asset.gross_floor_area_sqm),
      }),
    },
    {
      name: 'tenant-master-name',
      cell: cell(base, {
        target_table: 'public.ll_tenants',
        primary_key_field: 'tenant_id',
        target_row_id: tenant.tenant_id,
        field_name: 'tenant_master_name',
        before_value: firstDefined(tenant.tenant_master_name, ''),
        after_value: nextTextValue(tenant.tenant_master_name, 'tenant_name'),
      }),
    },
    {
      name: 'tenant-business-registration',
      cell: cell(base, {
        target_table: 'public.ll_tenants',
        primary_key_field: 'tenant_id',
        target_row_id: tenant.tenant_id,
        field_name: 'business_registration_no',
        before_value: firstDefined(tenant.business_registration_no, ''),
        after_value: nextTextValue(tenant.business_registration_no, 'tenant_brn'),
      }),
    },
    {
      name: 'lease-space-floor',
      cell: cell(base, {
        target_table: 'public.ll_lease_spaces',
        primary_key_field: 'lease_space_id',
        target_row_id: lease.lease_space_id,
        field_name: 'floor_label',
        before_value: firstDefined(lease.floor_label, ''),
        after_value: nextTextValue(lease.floor_label, 'floor'),
      }),
    },
    {
      name: 'lease-space-detail-area',
      cell: cell(base, {
        target_table: 'public.ll_lease_spaces',
        primary_key_field: 'lease_space_id',
        target_row_id: lease.lease_space_id,
        field_name: 'detail_area_label',
        before_value: firstDefined(lease.detail_area_label, ''),
        after_value: nextTextValue(lease.detail_area_label, 'detail'),
      }),
    },
    {
      name: 'lease-space-leased-area',
      cell: cell(base, {
        target_table: 'public.ll_lease_spaces',
        primary_key_field: 'lease_space_id',
        target_row_id: lease.lease_space_id,
        field_name: 'leased_area_sqm',
        before_value: firstDefined(lease.leased_area_sqm, ''),
        after_value: nextNumberValue(lease.leased_area_sqm),
      }),
    },
    {
      name: 'lease-space-exclusive-area',
      cell: cell(base, {
        target_table: 'public.ll_lease_spaces',
        primary_key_field: 'lease_space_id',
        target_row_id: lease.lease_space_id,
        field_name: 'exclusive_area_sqm',
        before_value: firstDefined(lease.exclusive_area_sqm, ''),
        after_value: nextNumberValue(lease.exclusive_area_sqm),
      }),
    },
    {
      name: 'lease-space-monthly-rent',
      cell: cell(base, {
        target_table: 'public.ll_lease_spaces',
        primary_key_field: 'lease_space_id',
        target_row_id: lease.lease_space_id,
        field_name: 'current_monthly_rent_total',
        before_value: firstDefined(lease.current_monthly_rent_total, ''),
        after_value: nextNumberValue(lease.current_monthly_rent_total),
      }),
    },
    {
      name: 'lease-space-monthly-mf',
      cell: cell(base, {
        target_table: 'public.ll_lease_spaces',
        primary_key_field: 'lease_space_id',
        target_row_id: lease.lease_space_id,
        field_name: 'current_monthly_mf_total',
        before_value: firstDefined(lease.current_monthly_mf_total, ''),
        after_value: nextNumberValue(lease.current_monthly_mf_total),
      }),
    },
    {
      name: 'source-only-general-check',
      cell: cell(base, {
        target_table: 'source_only',
        source_only: true,
        primary_key_field: 'id',
        target_row_id: lease.lease_space_id,
        field_name: 'check_leased_area',
        before_value: '',
        after_value: 'QA source-only write/readback',
        source_sheet: 'DB_general',
        source_column_letter: 'X',
        source_header: 'leased area check',
      }),
    },
    {
      name: 'source-only-history-sector',
      cell: cell(base, {
        target_table: 'source_only',
        source_only: true,
        primary_key_field: 'id',
        target_row_id: lease.lease_space_id,
        field_name: 'history_sector',
        before_value: '',
        after_value: 'QA history source-only write/readback',
        source_sheet: 'DB_history',
        source_column_letter: 'F',
        source_header: 'sector',
      }),
    },
    latestRent.rent_history_id ? {
      name: 'rent-history-review-status',
      cell: cell(base, {
        target_table: 'public.ll_rent_history',
        primary_key_field: 'rent_history_id',
        target_row_id: latestRent.rent_history_id,
        field_name: 'review_status',
        before_value: firstDefined(latestRent.review_status, ''),
        after_value: nextTextValue(latestRent.review_status, 'rent_review'),
      }),
    } : null,
  ].filter((item) => item && item.cell.target_row_id);
}

async function main() {
  const supabaseUrl = envValue('LOGISTICS_SUPABASE_URL', 'VITE_SUPABASE_URL');
  const anonKey = envValue('LOGISTICS_SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY');
  const origin = argsValue('origin', DEFAULT_ORIGIN);
  const basisDate = argsValue('basis-date', envValue('LOGISTICS_BASIS_DATE') || '');
  if (!supabaseUrl || !anonKey) throw new Error('Missing Supabase URL or anon key.');
  const endpoint = `${supabaseUrl.replace(/\/$/u, '')}/functions/v1/${EDGE_FUNCTION}`;
  const auth = await resolveAccessToken(supabaseUrl, anonKey);

  const homeRead = await invoke(endpoint, anonKey, origin, auth.token, 'dashboard/home/read', { basis_date: basisDate || undefined });
  if (homeRead.status !== 200) throw new Error(`dashboard/home/read failed: ${homeRead.status} ${JSON.stringify(homeRead.body).slice(0, 300)}`);
  const assets = homeRead.body?.data?.assets || [];
  const asset = assets.find((row) => row.asset_id || row.asset_name);
  if (!asset) throw new Error('No readable asset found for Data Update smoke.');

  const assetRead = await invoke(endpoint, anonKey, origin, auth.token, 'dashboard/asset/read', { basis_date: basisDate || undefined, asset_id: asset.asset_id });
  if (assetRead.status !== 200) throw new Error(`dashboard/asset/read failed: ${assetRead.status} ${JSON.stringify(assetRead.body).slice(0, 300)}`);

  const cases = buildCases(assetRead);
  const results = [];
  for (const testCase of cases) {
    const result = await invoke(endpoint, anonKey, origin, auth.token, 'contract-data/apply', {
      source_table: testCase.cell.target_table === 'source_only' ? 'public.ll_lease_attributes' : testCase.cell.target_table,
      target_name: asset.asset_name,
      target_row_id: testCase.cell.target_row_id,
      reason_code: `qa_auto_smoke_${testCase.name}`,
      rollback_after_write: true,
      cell_edits: [testCase.cell],
    });
    const writeResult = result.body?.data?.write_result || {};
    const readbacks = writeResult.readbacks || [];
    const rollbackReadbacks = writeResult.rollback_readbacks || [];
    const writeReadbackMatches = readbackMatches(testCase.cell, readbacks, 'readback_value', testCase.cell.after_value);
    const rollbackReadbackMatches = readbackMatches(testCase.cell, rollbackReadbacks, 'rollback_readback_value', testCase.cell.before_value);
    results.push({
      name: testCase.name,
      status: result.status,
      ok: result.status === 200 && result.body?.ok === true && readbacks.length >= 1 && rollbackReadbacks.length >= 1 && writeReadbackMatches && rollbackReadbackMatches,
      target_table: testCase.cell.target_table,
      field_name: testCase.cell.field_name,
      readback_count: readbacks.length,
      rollback_readback_count: rollbackReadbacks.length,
      write_readback_matches_after_value: writeReadbackMatches,
      rollback_readback_matches_before_value: rollbackReadbackMatches,
      request_id: result.body?.data?.id || null,
      message: result.body?.message || null,
      detail: result.status === 200 ? undefined : result.body,
    });
  }

  const passed = results.filter((row) => row.ok);
  const output = {
    ok: results.length >= 10 && passed.length === results.length,
    generated_at: new Date().toISOString(),
    endpoint: endpoint.replace(/https:\/\/([^./]+)\./u, 'https://$1.redacted.'),
    origin,
    auth_source: auth.source,
    asset_id: asset.asset_id,
    asset_name: asset.asset_name,
    required_pass_count: results.length,
    passed_count: passed.length,
    total_count: results.length,
    results,
  };
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const outPath = path.join(OUT_DIR, `data-update-auto-smoke-${timestampForFile()}.json`);
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2), 'utf8');
  console.log(JSON.stringify({ ...output, artifact: outPath }, null, 2));
  if (!output.ok) throw new Error(`Data Update auto smoke passed ${passed.length}/${results.length} required cases.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
