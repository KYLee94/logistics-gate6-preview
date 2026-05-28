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

function currentKstMonthEndDate() {
  const now = new Date();
  const kst = new Date(now.getTime() + (9 * 60 * 60 * 1000));
  const year = kst.getUTCFullYear();
  const month = kst.getUTCMonth() + 1;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
}

function futureSmokeDate(offsetDays = 0) {
  const date = new Date(Date.UTC(2099, 0, 1 + offsetDays));
  return date.toISOString().slice(0, 10);
}

function leaseEventWriteResult(result) {
  return result.body?.data?.write_result || {};
}

function leaseEventRolledBack(result) {
  const writeResult = leaseEventWriteResult(result);
  return result.status === 200
    && result.body?.ok === true
    && result.body?.data?.write_status === 'rolled_back_after_smoke'
    && writeResult.rollback_after_write === true
    && Array.isArray(writeResult.rollback_readbacks)
    && writeResult.rollback_readbacks.length >= 1;
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

function buildLeaseEventCases(assetRead) {
  const data = assetRead.body?.data || {};
  const asset = data.asset || {};
  const leaseSpaces = data.lease_spaces || [];
  const tenants = data.tenants || [];
  const rentHistory = data.rent_history || [];
  const lease = leaseSpaces[0] || {};
  const tenant = tenants.find((row) => normalizeText(row.tenant_id) === normalizeText(lease.tenant_id)) || tenants[0] || {};
  const latestRent = rentHistory.find((row) => row.is_latest === true || String(row.is_latest).toLowerCase() === 'true') || rentHistory[0] || {};
  const base = {
    asset_id: asset.asset_id,
    asset_name: asset.asset_name,
    lease_space_id: lease.lease_space_id,
    lease_id: lease.lease_id,
    tenant_id: firstDefined(lease.tenant_id, tenant.tenant_id),
  };
  const unique = String(Date.now()).slice(-8);
  const rentFutureDate = futureSmokeDate(12);
  const addStartDate = futureSmokeDate(40);
  const addEndDate = futureSmokeDate(404);
  const addTenantName = `QA Smoke Tenant ${unique}`;
  const addPayload = {
    event_type: 'new_lease',
    asset_id: asset.asset_id,
    asset_name: asset.asset_name,
    tenant_name: addTenantName,
    lease_space_id: '',
    effective_date: addStartDate,
    summary: `QA smoke new lease ${unique}`,
    before: {},
    after: {
      fields: {
        tenant_master_name: addTenantName,
        business_registration_no: `999-${unique.slice(0, 2)}-${unique.slice(2)}`,
        floor_label: `QA-${unique}`,
        detail_area_label: 'Smoke Zone',
        current_start_date: addStartDate,
        current_end_date: addEndDate,
        leased_area_sqm: 330.58,
        exclusive_area_sqm: 300.12,
        monthly_rent_total: 1000000,
        monthly_mf_total: 200000,
        basis_date: addStartDate,
        rent_change_reason: 'QA smoke initial rent',
      },
    },
    source_rows: [{ sheet: 'DB_general + DB_history', action: 'qa_new_lease' }],
  };
  const rentChangePayload = {
    event_type: 'rent_change',
    asset_id: asset.asset_id,
    asset_name: asset.asset_name,
    tenant_name: firstDefined(tenant.tenant_master_name, lease.tenant_master_name, ''),
    lease_space_id: lease.lease_space_id,
    effective_date: rentFutureDate,
    summary: `QA smoke rent change ${unique}`,
    before: lease,
    after: {
      fields: {
        basis_date: rentFutureDate,
        monthly_rent_total: nextNumberValue(firstDefined(latestRent.monthly_rent_total, lease.current_monthly_rent_total)),
        monthly_mf_total: nextNumberValue(firstDefined(latestRent.monthly_mf_total, lease.current_monthly_mf_total)),
        rent_change_reason: `QA smoke rent change ${unique}`,
      },
    },
    cell_edits: [
      cell(base, {
        target_table: 'public.ll_rent_history',
        primary_key_field: 'rent_history_id',
        target_row_id: latestRent.rent_history_id,
        field_name: 'basis_date',
        before_value: firstDefined(latestRent.effective_date, ''),
        after_value: rentFutureDate,
        source_sheet: 'DB_history',
        source_column_letter: 'N',
        source_header: 'basis_date',
      }),
      cell(base, {
        target_table: 'public.ll_rent_history',
        primary_key_field: 'rent_history_id',
        target_row_id: latestRent.rent_history_id,
        field_name: 'monthly_rent_total',
        before_value: firstDefined(latestRent.monthly_rent_total, ''),
        after_value: nextNumberValue(firstDefined(latestRent.monthly_rent_total, lease.current_monthly_rent_total)),
        source_sheet: 'DB_history',
        source_column_letter: 'P',
        source_header: 'monthly_rent_total',
      }),
      cell(base, {
        target_table: 'public.ll_rent_history',
        primary_key_field: 'rent_history_id',
        target_row_id: latestRent.rent_history_id,
        field_name: 'monthly_mf_total',
        before_value: firstDefined(latestRent.monthly_mf_total, ''),
        after_value: nextNumberValue(firstDefined(latestRent.monthly_mf_total, lease.current_monthly_mf_total)),
        source_sheet: 'DB_history',
        source_column_letter: 'Q',
        source_header: 'monthly_mf_total',
      }),
    ],
  };
  const duplicateRentPayload = {
    ...rentChangePayload,
    effective_date: firstDefined(latestRent.effective_date, currentKstMonthEndDate()),
    summary: firstDefined(latestRent.change_reason, 'QA duplicate rent check'),
    after: {
      fields: {
        basis_date: firstDefined(latestRent.effective_date, currentKstMonthEndDate()),
        monthly_rent_total: firstDefined(latestRent.monthly_rent_total, lease.current_monthly_rent_total),
        monthly_mf_total: firstDefined(latestRent.monthly_mf_total, lease.current_monthly_mf_total),
        rent_change_reason: firstDefined(latestRent.change_reason, 'QA duplicate rent check'),
      },
    },
    cell_edits: rentChangePayload.cell_edits.map((item) => ({
      ...item,
      after_value: item.field_name === 'basis_date'
        ? firstDefined(latestRent.effective_date, currentKstMonthEndDate())
        : item.field_name === 'monthly_rent_total'
          ? firstDefined(latestRent.monthly_rent_total, lease.current_monthly_rent_total)
          : firstDefined(latestRent.monthly_mf_total, lease.current_monthly_mf_total),
    })),
  };
  const sameDateDifferentAmountPayload = {
    ...duplicateRentPayload,
    summary: 'QA same basis date different amount',
    after: {
      fields: {
        ...duplicateRentPayload.after.fields,
        monthly_rent_total: nextNumberValue(firstDefined(latestRent.monthly_rent_total, lease.current_monthly_rent_total)),
      },
    },
    cell_edits: duplicateRentPayload.cell_edits.map((item) => ({
      ...item,
      after_value: item.field_name === 'monthly_rent_total'
        ? nextNumberValue(firstDefined(latestRent.monthly_rent_total, lease.current_monthly_rent_total))
        : item.after_value,
    })),
  };
  return [
    {
      name: 'lease-event-preview-new-lease-ready',
      action: 'lease-events/preview',
      payload: addPayload,
      ok: (result) => result.status === 200 && result.body?.data?.preview?.status === 'ready',
    },
    {
      name: 'lease-event-submit-new-lease-rollback',
      action: 'lease-events/submit',
      payload: { ...addPayload, rollback_after_write: true },
      ok: leaseEventRolledBack,
    },
    {
      name: 'lease-event-preview-missing-required-blocked',
      action: 'lease-events/preview',
      payload: { event_type: 'new_lease', asset_id: asset.asset_id, asset_name: asset.asset_name, summary: 'QA missing required' },
      ok: (result) => result.status === 200 && result.body?.data?.preview?.status === 'blocked' && result.body.data.preview.required_missing.length >= 1,
    },
    {
      name: 'lease-event-submit-rent-history-append-rollback',
      action: 'lease-events/submit',
      payload: { ...rentChangePayload, rollback_after_write: true },
      ok: (result) => leaseEventRolledBack(result) && Number(leaseEventWriteResult(result).rent_history_appended_count || 0) >= 1,
    },
    {
      name: 'lease-event-preview-rent-history-duplicate-blocked',
      action: 'lease-events/preview',
      payload: duplicateRentPayload,
      ok: (result) => result.status === 200 && result.body?.data?.preview?.status === 'blocked',
    },
    {
      name: 'lease-event-submit-rent-history-duplicate-blocked',
      action: 'lease-events/submit',
      payload: duplicateRentPayload,
      ok: (result) => result.status === 409 && result.body?.ok === false,
    },
    {
      name: 'lease-event-preview-same-date-different-amount-blocked',
      action: 'lease-events/preview',
      payload: sameDateDifferentAmountPayload,
      ok: (result) => result.status === 200 && result.body?.data?.preview?.status === 'blocked',
    },
    {
      name: 'lease-event-submit-archive-rollback',
      action: 'lease-events/submit',
      payload: {
        event_type: 'expiry_vacancy',
        asset_id: asset.asset_id,
        asset_name: asset.asset_name,
        tenant_name: firstDefined(tenant.tenant_master_name, lease.tenant_master_name, ''),
        lease_space_id: lease.lease_space_id,
        effective_date: currentKstMonthEndDate(),
        summary: 'QA smoke archive rollback',
        before: lease,
        after: { contract_status: 'archived' },
        rollback_after_write: true,
      },
      ok: (result) => leaseEventRolledBack(result) && Number(leaseEventWriteResult(result).archived_count || 0) >= 1,
    },
    {
      name: 'lease-event-submit-current-space-update-rollback',
      action: 'lease-events/submit',
      payload: {
        event_type: 'correction',
        asset_id: asset.asset_id,
        asset_name: asset.asset_name,
        tenant_name: firstDefined(tenant.tenant_master_name, lease.tenant_master_name, ''),
        lease_space_id: lease.lease_space_id,
        effective_date: currentKstMonthEndDate(),
        summary: 'QA smoke current space update',
        before: lease,
        after: { fields: { detail_area_label: nextTextValue(lease.detail_area_label, 'detail_event') } },
        rollback_after_write: true,
        cell_edits: [cell(base, {
          target_table: 'public.ll_lease_spaces',
          primary_key_field: 'lease_space_id',
          target_row_id: lease.lease_space_id,
          field_name: 'detail_area_label',
          before_value: firstDefined(lease.detail_area_label, ''),
          after_value: nextTextValue(lease.detail_area_label, 'detail_event'),
          source_sheet: 'DB_general',
          source_column_letter: 'N',
          source_header: 'detail_area_label',
        })],
      },
      ok: leaseEventRolledBack,
    },
    {
      name: 'lease-event-submit-source-only-preserve-rollback',
      action: 'lease-events/submit',
      payload: {
        event_type: 'correction',
        asset_id: asset.asset_id,
        asset_name: asset.asset_name,
        tenant_name: firstDefined(tenant.tenant_master_name, lease.tenant_master_name, ''),
        lease_space_id: lease.lease_space_id,
        effective_date: currentKstMonthEndDate(),
        summary: 'QA smoke source-only preserve',
        before: lease,
        after: { fields: { check_leased_area: `QA source preserve ${unique}` } },
        rollback_after_write: true,
        cell_edits: [cell(base, {
          target_table: 'source_only',
          source_only: true,
          primary_key_field: 'id',
          target_row_id: lease.lease_space_id,
          field_name: 'check_leased_area',
          before_value: '',
          after_value: `QA source preserve ${unique}`,
          source_sheet: 'DB_general',
          source_column_letter: 'X',
          source_header: 'check_leased_area',
        })],
      },
      ok: (result) => leaseEventRolledBack(result) && Number(leaseEventWriteResult(result).source_only_count || 0) >= 1,
    },
  ].filter((item) => item.payload);
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

  const leaseEventCases = buildLeaseEventCases(assetRead);
  const leaseEventResults = [];
  for (const testCase of leaseEventCases) {
    const result = await invoke(endpoint, anonKey, origin, auth.token, testCase.action, testCase.payload);
    let ok = false;
    let validationError = '';
    try {
      ok = Boolean(testCase.ok(result));
    } catch (error) {
      validationError = error instanceof Error ? error.message : String(error);
    }
    leaseEventResults.push({
      name: testCase.name,
      action: testCase.action,
      status: result.status,
      ok,
      mode: result.body?.data?.write_result?.preview?.mode || result.body?.data?.preview?.mode || null,
      preview_status: result.body?.data?.preview?.status || result.body?.data?.write_result?.preview?.status || null,
      write_status: result.body?.data?.write_status || null,
      write_result: result.body?.data?.write_result || undefined,
      validation_error: validationError || undefined,
      detail: ok ? undefined : result.body,
    });
  }

  const passed = results.filter((row) => row.ok);
  const leaseEventPassed = leaseEventResults.filter((row) => row.ok);
  const output = {
    ok: results.length >= 10 && passed.length === results.length && leaseEventResults.length >= 10 && leaseEventPassed.length === leaseEventResults.length,
    generated_at: new Date().toISOString(),
    endpoint: endpoint.replace(/https:\/\/([^./]+)\./u, 'https://$1.redacted.'),
    origin,
    auth_source: auth.source,
    asset_id: asset.asset_id,
    asset_name: asset.asset_name,
    required_pass_count: results.length + leaseEventResults.length,
    passed_count: passed.length + leaseEventPassed.length,
    total_count: results.length + leaseEventResults.length,
    results,
    lease_event_results: leaseEventResults,
  };
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const outPath = path.join(OUT_DIR, `data-update-auto-smoke-${timestampForFile()}.json`);
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2), 'utf8');
  console.log(JSON.stringify({ ...output, artifact: outPath }, null, 2));
  if (!output.ok) throw new Error(`Data Update auto smoke passed ${passed.length + leaseEventPassed.length}/${results.length + leaseEventResults.length} required cases.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
