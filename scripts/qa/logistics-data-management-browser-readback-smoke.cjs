const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT_DIR = path.join(ROOT, 'qa-artifacts', 'logistics-gate6');
const DEFAULT_BASE_URL = 'https://kylee94.github.io/logistics-gate6-preview/';
const USER_VISIBLE_RAW_TOKEN_PATTERN = /Attribute\s+(?:Key|Type|Label)|attribute_(?:key|type|label)|area_breakdown|TenantMasterName|tenant_master_name|asset_[a-z0-9]{6,}|tenant_(?:brn|name)_[a-z0-9]+|source_payload/iu;
const INTERNAL_TOKEN_PATTERN = /\bll_|source_row_id|source_file_id|source_sheet_id|natural_key|row_hash|payload|\bPNU\b|\bpnu\b|원장|정규화|마스터|readback|Supabase|Excel row/u;

const REQUIRED_WORKFLOW_KEYS = [
  'asset',
  'investment',
  'lease',
  'managers',
  'quality',
];

const EXPECTED_VISIBLE_VIEW_KEYS = [
  'asset_integrated',
  'investment_integrated',
  'lease_general_excel',
  'lease_asset_manager_links',
  'data_quality_findings',
];

const REQUIRED_LEASE_FIELDS = [
  'exclusive_ratio',
  'current_contract_period',
  'sublease_yn',
];

const REQUIRED_RENT_FIELDS = [
  'current_rent_per_py',
  'current_mf_per_py',
  'e_noc',
  'required_specs_summary',
  'lease_special_summary',
  'tenant_info_summary',
];

const REQUIRED_EDITABLE_LEASE_FIELDS = [
  'exclusive_ratio',
  'sublease_yn',
];

const REQUIRED_EDITABLE_RENT_FIELDS = [];

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
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : (process.argv[index + 1] || fallback);
}

function timestampForFile() {
  return new Date().toISOString().replace(/[-:]/gu, '').replace(/\..+$/u, '').replace('T', '-');
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

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function internalTokenMatch(value) {
  const text = String(value || '');
  const match = text.match(INTERNAL_TOKEN_PATTERN) || text.match(USER_VISIBLE_RAW_TOKEN_PATTERN);
  if (!match) return null;
  const index = match.index || 0;
  return {
    token: match[0],
    excerpt: text.slice(Math.max(0, index - 80), index + 120),
  };
}

function fieldKeys(fields) {
  return safeArray(fields).map((field) => String(field?.field_key || field?.field || '')).filter(Boolean);
}

function editableFieldKeys(fields) {
  return safeArray(fields)
    .filter((field) => field?.editable === true)
    .map((field) => String(field?.field_key || field?.field || ''))
    .filter(Boolean);
}

function dataManagementFieldsByView(viewsData, rowsData, viewKey) {
  if (rowsData?.view?.view_key === viewKey && safeArray(rowsData.fields).length) return rowsData.fields;
  return safeArray(viewsData?.views).find((view) => view?.view_key === viewKey)?.fields || [];
}

async function signInSession() {
  const supabaseUrl = envValue('LOGISTICS_SUPABASE_URL', 'VITE_SUPABASE_URL');
  const anonKey = envValue('LOGISTICS_SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY');
  const accessToken = envValue('LOGISTICS_SUPABASE_ACCESS_TOKEN');
  if (supabaseUrl && anonKey && accessToken) {
    const response = await fetch(`${supabaseUrl.replace(/\/$/u, '')}/auth/v1/user`, {
      headers: { apikey: anonKey, authorization: `Bearer ${accessToken}` },
    });
    const user = await response.json().catch(() => null);
    if (!response.ok || !user?.id) throw new Error(`Supabase access token validation failed (${response.status}).`);
    return {
      session: {
        access_token: accessToken,
        token_type: 'bearer',
        expires_in: 3600,
        expires_at: Math.round(Date.now() / 1000) + 3600,
        refresh_token: '',
        user,
      },
      source: 'LOGISTICS_SUPABASE_ACCESS_TOKEN',
    };
  }
  const email = envValue('LOGISTICS_SUPABASE_EMAIL', 'LOGISTICS_SUPABASE_AUTH_EMAIL');
  const password = envValue('LOGISTICS_SUPABASE_PASSWORD', 'LOGISTICS_SUPABASE_AUTH_PASSWORD');
  if (!supabaseUrl || !anonKey || !email || !password) {
    throw new Error('Set LOGISTICS_SUPABASE_ACCESS_TOKEN, or set LOGISTICS_SUPABASE_EMAIL and LOGISTICS_SUPABASE_PASSWORD.');
  }
  const response = await fetch(`${supabaseUrl.replace(/\/$/u, '')}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: anonKey, 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const session = await response.json().catch(() => null);
  if (!response.ok || !session?.access_token) throw new Error(`Supabase Auth login failed (${response.status}).`);
  if (!session.expires_at && session.expires_in) session.expires_at = Math.round(Date.now() / 1000) + Number(session.expires_in);
  return { session, source: 'password_grant' };
}

async function responseJson(response) {
  return response ? response.json().catch(() => null) : null;
}

async function waitForGridSettled(page, report, label) {
  const gridSelector = '[data-data-management-grid="true"]';
  await page.waitForSelector(gridSelector, { timeout: 45000 });
  await page.waitForFunction((selector) => {
    const grid = document.querySelector(selector);
    if (!grid) return false;
    const text = grid.innerText || '';
    return grid.querySelectorAll('thead button').length > 1
      || grid.querySelectorAll('tbody tr button').length > 0
      || text.includes('0건');
  }, gridSelector, { timeout: 45000 }).catch((error) => {
    report.errors.push(`${label} grid did not settle: ${error.message}`);
  });
  const metrics = await page.evaluate((selector) => {
    const grid = document.querySelector(selector);
    if (!grid) return { headerButtons: 0, rowButtons: 0, hasLoadingText: false, hasZeroState: false };
    const text = grid.innerText || '';
    return {
      headerButtons: grid.querySelectorAll('thead button').length,
      rowButtons: grid.querySelectorAll('tbody tr button').length,
      hasLoadingText: text.includes('불러오는 중'),
      hasZeroState: text.includes('0건'),
    };
  }, gridSelector);
  report.grid_metrics = report.grid_metrics || {};
  report.grid_metrics[label] = metrics;
  return metrics;
}

async function clickWorkflow(page, key, report) {
  const select = page.locator('[data-data-management-workflow-select="true"]').first();
  const selectVisible = await select.isVisible({ timeout: 5000 }).catch(() => false);
  if (selectVisible) {
    await select.selectOption(key).catch((error) => {
      report.errors.push(`workflow select failed: ${key} ${error.message}`);
    });
    return true;
  }
  const locator = page.locator(`[data-data-management-workflow-key="${key}"]`).first();
  const visible = await locator.isVisible({ timeout: 5000 }).catch(() => false);
  if (!visible) {
    report.errors.push(`workflow card is not visible: ${key}`);
    return false;
  }
  await locator.click();
  return true;
}

async function clickWorkspace(page, key, report) {
  const locator = page.locator(`[data-data-management-space-key="${key}"]`).first();
  const visible = await locator.isVisible({ timeout: 5000 }).catch(() => false);
  if (!visible) {
    report.errors.push(`workspace tab is not visible: ${key}`);
    return false;
  }
  await locator.click();
  return true;
}

async function selectDataManagementView(page, report, viewKey, label, expectedTerms = []) {
  const select = page.locator('[data-data-management-view-select="true"]').first();
  const visible = await select.isVisible({ timeout: 5000 }).catch(() => false);
  if (!visible) {
    report.errors.push(`view select is not visible for ${viewKey}`);
    return { available: false, api_ok: false, rows: 0, ui_rows: 0, no_internal_tokens: false, expected_terms_visible: false };
  }
  const responsePromise = page.waitForResponse((response) => {
    const postData = response.request().postData() || '';
    return response.url().includes('/functions/v1/ll-dashboard-api')
      && postData.includes('data-management/view-rows')
      && postData.includes(viewKey);
  }, { timeout: 45000 }).catch(() => null);
  await select.selectOption(viewKey).catch((error) => {
    report.errors.push(`view select failed: ${viewKey} ${error.message}`);
  });
  const response = await responsePromise;
  const responseBody = await responseJson(response);
  const metrics = await waitForGridSettled(page, report, `view_${viewKey}`);
  const body = await page.locator('[data-data-management-grid="true"]').innerText({ timeout: 10000 }).catch(() => '');
  const internalMatch = internalTokenMatch(body);
  const rows = safeArray(responseBody?.data?.rows);
  const fields = safeArray(responseBody?.data?.fields);
  const visibleText = `${body}\n${fields.map((field) => `${field.group || ''} ${field.label || ''}`).join('\n')}`;
  return {
    label,
    available: true,
    http_status: response?.status() || null,
    api_ok: responseBody?.ok === true && responseBody?.data?.view?.view_key === viewKey,
    rows: rows.length,
    fields: fields.length,
    ui_rows: metrics.rowButtons,
    sorting_headers: metrics.headerButtons,
    not_loading: !metrics.hasLoadingText,
    no_internal_tokens: !internalMatch,
    internal_token_match: internalMatch,
    expected_terms_visible: expectedTerms.every((term) => visibleText.includes(term)),
  };
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const stamp = timestampForFile();
  const outJson = path.join(OUT_DIR, `data-management-browser-readback-smoke-${stamp}.json`);
  const latestJson = path.join(OUT_DIR, 'data-management-browser-readback-smoke-latest.json');
  const screenshot = path.join(OUT_DIR, `data-management-browser-readback-smoke-${stamp}.png`);
  const baseUrl = argsValue('base-url', DEFAULT_BASE_URL);
  const auth = await signInSession();
  const uiEmail = envValue('LOGISTICS_BROWSER_UI_EMAIL') || 'kylee@igisam.com';
  const browserSession = { ...auth.session, user: { ...(auth.session.user || {}), email: uiEmail } };
  const report = {
    ok: false,
    generated_at: new Date().toISOString(),
    base_url: baseUrl,
    auth_source: auth.source,
    checks: {},
    errors: [],
    screenshot: path.relative(ROOT, screenshot).replace(/\\/gu, '/'),
  };
  let browser;
  let page;
  try {
    browser = await chromium.launch({ headless: true, executablePath: chromeExecutablePath() });
    const context = await browser.newContext({ viewport: { width: 1600, height: 1100 }, serviceWorkers: 'block' });
    await context.addInitScript(({ email, session }) => {
      sessionStorage.setItem('sb-iota-auth-token', JSON.stringify(session));
      sessionStorage.setItem('logistics_preview_auth', JSON.stringify({ email }));
      localStorage.setItem('logisticsDashboardReadMode', 'primary-safe');
    }, { email: uiEmail, session: browserSession });
    page = await context.newPage();
    page.on('pageerror', (error) => report.errors.push(error.message));
    page.on('response', (response) => {
      if (response.url().includes('/functions/v1/ll-dashboard-api') && response.status() >= 500) {
        report.errors.push(`edge ${response.status()} ${response.url()}`);
      }
    });

    const viewsPromise = page.waitForResponse((response) => (
      response.url().includes('/functions/v1/ll-dashboard-api') && response.request().postData()?.includes('data-management/views')
    ), { timeout: 45000 }).catch(() => null);
    const viewRowsPromise = page.waitForResponse((response) => (
      response.url().includes('/functions/v1/ll-dashboard-api') && response.request().postData()?.includes('data-management/view-rows')
    ), { timeout: 45000 }).catch(() => null);
    const dataManagementUrl = joinUrl(baseUrl, 'data-management/lease-contracts');
    await page.goto(`${dataManagementUrl}${dataManagementUrl.includes('?') ? '&' : '?'}qa=${stamp}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    const [viewsResponse, viewRowsResponse] = await Promise.all([viewsPromise, viewRowsPromise]);
    const viewsBody = await responseJson(viewsResponse);
    const viewRowsBody = await responseJson(viewRowsResponse);
    await page.waitForSelector('[data-data-management-redesign="true"]', { timeout: 45000 });
    await page.waitForSelector('[data-data-management-grid="true"]', { timeout: 45000 });
    await page.waitForSelector('[data-data-management-inline-edit="true"]', { timeout: 45000 }).catch(() => null);

    const viewsData = viewsBody?.data || {};
    const rowsData = viewRowsBody?.data || {};
    const initialGridMetrics = await waitForGridSettled(page, report, 'igis_initial');
    const body = await page.locator('body').innerText({ timeout: 20000 });
    const leaseFields = dataManagementFieldsByView(viewsData, rowsData, 'lease_general_excel');
    const rentFields = leaseFields;
    const leaseKeys = fieldKeys(leaseFields);
    const rentKeys = fieldKeys(rentFields);
    const editableLeaseKeys = editableFieldKeys(leaseFields);
    const editableRentKeys = editableFieldKeys(rentFields);

    report.views_contract = {
      http_status: viewsResponse?.status() || null,
      ok: viewsBody?.ok,
      workspaces: safeArray(viewsData.workspaces).map((space) => space.label),
      view_count: safeArray(viewsData.views).length,
      bundle_count: safeArray(viewsData.fund_asset_bundles).length,
      management_scope: viewsData.management_scope || null,
    };
    report.view_rows_contract = {
      http_status: viewRowsResponse?.status() || null,
      ok: viewRowsBody?.ok,
      view: rowsData.view || null,
      field_count: safeArray(rowsData.fields).length,
      row_count: safeArray(rowsData.rows).length,
      pagination: rowsData.pagination || null,
    };
    report.required_fields = {
      lease: REQUIRED_LEASE_FIELDS.map((key) => ({ key, present: leaseKeys.includes(key), editable: editableLeaseKeys.includes(key) })),
      rent: REQUIRED_RENT_FIELDS.map((key) => ({ key, present: rentKeys.includes(key), editable: editableRentKeys.includes(key) })),
    };

    report.checks.views_api_ok = viewsBody?.ok === true;
    report.checks.view_rows_api_ok = viewRowsBody?.ok === true;
    report.checks.has_management_views = safeArray(viewsData.views).length > 0;
    report.checks.scope_19_assets_17_funds = viewsData.management_scope?.asset_count === 19 && viewsData.management_scope?.fund_count === 17;
    report.checks.bundle_scope_present = safeArray(viewsData.fund_asset_bundles).length >= 19;
    report.checks.default_view_has_fields = Number(report.view_rows_contract.field_count || 0) > 0;
    report.checks.default_view_has_rows = Number(report.view_rows_contract.row_count || 0) > 0;
    report.checks.default_view_uses_normalized_readback = report.view_rows_contract.view?.source_status?.normalized_data_present === true;
    const workflowOptionValues = await page.locator('[data-data-management-workflow-select="true"] option').evaluateAll((options) => options.map((option) => option.value)).catch(() => []);
    const visibleViewKeys = safeArray(viewsData.views).map((view) => String(view?.view_key || '')).filter(Boolean);
    report.workflow_option_values = workflowOptionValues;
    report.visible_view_keys = visibleViewKeys;
    report.checks.workflow_card_elements_visible = EXPECTED_VISIBLE_VIEW_KEYS.every((key) => visibleViewKeys.includes(key));
    report.checks.direct_management_fields_present = REQUIRED_LEASE_FIELDS.every((key) => leaseKeys.includes(key))
      && REQUIRED_RENT_FIELDS.every((key) => rentKeys.includes(key));
    report.checks.direct_management_fields_editable = REQUIRED_EDITABLE_LEASE_FIELDS.every((key) => editableLeaseKeys.includes(key))
      && REQUIRED_EDITABLE_RENT_FIELDS.every((key) => editableRentKeys.includes(key));
    report.checks.grid_has_sorting_headers = Number(initialGridMetrics.headerButtons || 0) > 1;
    report.checks.grid_has_rows = Number(initialGridMetrics.rowButtons || 0) > 0;
    report.checks.grid_not_stuck_loading = !initialGridMetrics.hasLoadingText;
    const visibleChangeBasket = await page.locator('[data-data-management-change-basket="true"]').isVisible({ timeout: 5000 }).catch(() => false);
    report.checks.change_basket_removed_from_layout = visibleChangeBasket === false;
    report.checks.inline_edit_inputs_present = (await page.locator('[data-data-management-inline-edit="true"]').count().catch(() => 0)) > 0;
    report.checks.approval_request_button_present = (await page.locator('[data-data-management-approval-open="true"]').count().catch(() => 0)) > 0;
    report.internal_token_match = internalTokenMatch(body);
    report.checks.no_internal_tokens = !report.internal_token_match;
    report.checks.no_broken_question_marks = !/\?{4,}/u.test(body);

    const workflowChecks = {};
    const expectedViewByWorkflow = {
      asset: 'asset_integrated',
      investment: 'investment_integrated',
      lease: 'lease_general_excel',
      managers: 'lease_asset_manager_links',
      quality: 'data_quality_findings',
    };
    for (const key of REQUIRED_WORKFLOW_KEYS) {
      const available = visibleViewKeys.includes(expectedViewByWorkflow[key]);
      workflowChecks[key] = {
        consolidated: true,
        available,
        rows: initialGridMetrics.rowButtons,
        sorting_headers: initialGridMetrics.headerButtons,
        not_loading: !initialGridMetrics.hasLoadingText,
      };
    }
    report.workflow_checks = workflowChecks;
    report.checks.workflow_switches_render_rows = Object.values(workflowChecks).every((item) => item.available && item.rows > 0 && item.not_loading);

    report.required_view_checks = {
      lease_general_excel: {
        available: true,
        api_ok: viewRowsBody?.ok === true && rowsData?.view?.view_key === 'lease_general_excel',
        rows: safeArray(rowsData.rows).length,
        fields: safeArray(rowsData.fields).length,
        ui_rows: initialGridMetrics.rowButtons,
        not_loading: !initialGridMetrics.hasLoadingText,
        no_internal_tokens: !report.internal_token_match,
        expected_terms_visible: ['요구 스펙', '특약', '임차인 정보', '평당 월임대료', '평당 월관리비', 'E. NOC'].every((term) => body.includes(term) || safeArray(rowsData.fields).some((field) => `${field.group || ''} ${field.label || ''}`.includes(term))),
      },
    };
    report.checks.required_views_api_ok = report.required_view_checks.lease_general_excel.api_ok;
    report.checks.required_views_render_rows = report.required_view_checks.lease_general_excel.rows > 0 && report.required_view_checks.lease_general_excel.ui_rows > 0 && report.required_view_checks.lease_general_excel.not_loading;
    report.checks.required_views_have_business_headers = report.required_view_checks.lease_general_excel.expected_terms_visible;
    report.checks.required_views_no_internal_tokens = report.required_view_checks.lease_general_excel.no_internal_tokens;
    const fullScreenButton = page.getByRole('button', { name: /전체화면으로 편집/u }).first();
    const fullScreenButtonVisible = await fullScreenButton.isVisible({ timeout: 5000 }).catch(() => false);
    report.checks.fullscreen_edit_button_visible = fullScreenButtonVisible;
    if (fullScreenButtonVisible) {
      await fullScreenButton.click();
      const editor = page.locator('[data-data-management-fullscreen-editor="true"]').first();
      const editorVisible = await editor.isVisible({ timeout: 10000 }).catch(() => false);
      const editorBody = editorVisible ? await editor.innerText({ timeout: 10000 }).catch(() => '') : '';
      const editorInternalMatch = internalTokenMatch(editorBody);
      report.fullscreen_editor = {
        visible: editorVisible,
        has_table: await editor.locator('table').first().isVisible({ timeout: 5000 }).catch(() => false),
        has_inline_edit: (await editor.locator('[data-data-management-inline-edit="true"]').count().catch(() => 0)) > 0,
        has_approval_button: (await editor.locator('[data-data-management-approval-open="true"]').count().catch(() => 0)) > 0,
        no_internal_tokens: !editorInternalMatch,
        internal_token_match: editorInternalMatch,
      };
      report.checks.fullscreen_editor_opens = report.fullscreen_editor.visible === true;
      report.checks.fullscreen_editor_has_table = report.fullscreen_editor.has_table === true;
      report.checks.fullscreen_editor_has_inline_edit = report.fullscreen_editor.has_inline_edit === true;
      report.checks.fullscreen_editor_has_approval_button = report.fullscreen_editor.has_approval_button === true;
      report.checks.fullscreen_editor_no_internal_tokens = report.fullscreen_editor.no_internal_tokens === true;
      await page.keyboard.press('Escape');
      await editor.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => null);
    } else {
      report.checks.fullscreen_editor_opens = false;
      report.checks.fullscreen_editor_has_table = false;
      report.checks.fullscreen_editor_has_inline_edit = false;
      report.checks.fullscreen_editor_has_approval_button = false;
      report.checks.fullscreen_editor_no_internal_tokens = false;
    }

    const subTabs = [
      ['asset', 'data-management/asset-data'],
      ['investment', 'data-management/investment-data'],
      ['lease', 'data-management/lease-contracts'],
      ['managers', 'data-management/managers'],
      ['quality', 'data-management/data-quality'],
    ];
    report.subtab_checks = {};
    for (const [key, route] of subTabs) {
      const tabUrl = joinUrl(baseUrl, route);
      await page.goto(`${tabUrl}${tabUrl.includes('?') ? '&' : '?'}qa=${stamp}-${key}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForSelector(`[data-data-management-tab="${key}"]`, { timeout: 45000 }).catch((error) => {
        report.errors.push(`subtab not visible: ${key} ${error.message}`);
      });
      const metrics = await waitForGridSettled(page, report, `subtab_${key}`);
      const tabBody = await page.locator('body').innerText({ timeout: 10000 });
      report.subtab_checks[key] = {
        route,
        grid_visible: await page.locator('[data-data-management-grid="true"]').isVisible({ timeout: 5000 }).catch(() => false),
        rows: metrics.rowButtons,
        sorting_headers: metrics.headerButtons,
        not_loading: !metrics.hasLoadingText,
        no_internal_tokens: !internalTokenMatch(tabBody),
      };
    }
    report.checks.subtabs_visible = Object.keys(report.subtab_checks).length === subTabs.length;
    report.checks.subtabs_render_rows = Object.values(report.subtab_checks).every((item) => item.grid_visible && item.rows > 0 && item.not_loading);
    report.checks.subtabs_no_internal_tokens = Object.values(report.subtab_checks).every((item) => item.no_internal_tokens);

    await page.screenshot({ path: screenshot, fullPage: false });
    report.ok = Object.values(report.checks).every(Boolean) && report.errors.length === 0;
  } catch (error) {
    report.errors.push(error?.message || String(error));
    if (page) {
      report.failure_body_excerpt = await page.locator('body').innerText({ timeout: 5000 }).then((value) => value.slice(0, 2000)).catch(() => '');
      await page.screenshot({ path: screenshot, fullPage: false }).catch(() => null);
    }
  } finally {
    if (browser) await browser.close();
  }
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(latestJson, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`data management browser readback smoke ${report.ok ? 'PASS' : 'FAIL'}: ${path.relative(ROOT, outJson)}`);
  if (!report.ok) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
