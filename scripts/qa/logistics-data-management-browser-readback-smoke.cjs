const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT_DIR = path.join(ROOT, 'qa-artifacts', 'logistics-gate6');
const DEFAULT_BASE_URL = 'http://127.0.0.1:5173/';
const INTERNAL_TOKEN_PATTERN = /\bll_|source_row_id|source_file_id|source_sheet_id|natural_key|row_hash|payload|\bPNU\b|\bpnu\b|법정동코드/iu;

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
    return !text.includes('데이터를 불러오는 중입니다.') && (
      grid.querySelectorAll('thead button').length > 1
      || text.includes('View는 1차 구현 이후 확장됩니다')
      || text.includes('현재 조건 0건')
    );
  }, gridSelector, { timeout: 45000 }).catch((error) => {
    report.errors.push(`${label} grid did not settle: ${error.message}`);
  });
  const metrics = await page.evaluate((selector) => {
    const grid = document.querySelector(selector);
    if (!grid) return { headerButtons: 0, rowButtons: 0, hasLoadingText: false, hasZeroState: false };
    return {
      headerButtons: grid.querySelectorAll('thead button').length,
      rowButtons: grid.querySelectorAll('tbody tr button').length,
      hasLoadingText: (grid.innerText || '').includes('데이터를 불러오는 중입니다.'),
      hasZeroState: (grid.innerText || '').includes('현재 조건 0건입니다.'),
    };
  }, gridSelector);
  report.grid_metrics = report.grid_metrics || {};
  report.grid_metrics[label] = metrics;
  return metrics;
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
    const dataManagementUrl = joinUrl(baseUrl, 'data-management');
    await page.goto(`${dataManagementUrl}${dataManagementUrl.includes('?') ? '&' : '?'}qa=${stamp}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    const [viewsResponse, viewRowsResponse] = await Promise.all([viewsPromise, viewRowsPromise]);
    const viewsBody = await responseJson(viewsResponse);
    const viewRowsBody = await responseJson(viewRowsResponse);
    await page.waitForSelector('[data-data-management-redesign="true"]', { timeout: 45000 });
    await page.waitForSelector('[data-data-management-grid="true"]', { timeout: 45000 });
    await page.waitForSelector('[data-data-management-change-basket="true"]', { timeout: 45000 });
    const igisGridMetrics = await waitForGridSettled(page, report, 'igis');
    const body = await page.locator('body').innerText({ timeout: 20000 });
    const viewsData = viewsBody?.data || {};
    const rowsData = viewRowsBody?.data || {};
    report.views_contract = {
      http_status: viewsResponse?.status() || null,
      ok: viewsBody?.ok,
      workspaces: Array.isArray(viewsData.workspaces) ? viewsData.workspaces.map((space) => space.label) : [],
      view_count: Array.isArray(viewsData.views) ? viewsData.views.length : 0,
      bundle_count: Array.isArray(viewsData.fund_asset_bundles) ? viewsData.fund_asset_bundles.length : 0,
      management_scope: viewsData.management_scope || null,
    };
    report.view_rows_contract = {
      http_status: viewRowsResponse?.status() || null,
      ok: viewRowsBody?.ok,
      view: rowsData.view || null,
      field_count: Array.isArray(rowsData.fields) ? rowsData.fields.length : 0,
      row_count: Array.isArray(rowsData.rows) ? rowsData.rows.length : 0,
      pagination: rowsData.pagination || null,
    };
    report.checks.views_api_ok = viewsBody?.ok === true;
    report.checks.view_rows_api_ok = viewRowsBody?.ok === true;
    report.checks.has_three_workspaces = ['이지스 Data', '시장 Data', '시스템·운영 Data'].every((label) => body.includes(label));
    report.checks.has_single_bundle_selector = body.includes('자산 · 펀드 묶음') && !body.includes('자산/펀드 선택 · 펀드');
    report.checks.scope_19_assets_17_funds = viewsData.management_scope?.asset_count === 19 && viewsData.management_scope?.fund_count === 17;
    report.checks.bundle_scope_present = Array.isArray(viewsData.fund_asset_bundles) && viewsData.fund_asset_bundles.length >= 19;
    report.checks.has_lease_contract_view = Array.isArray(viewsData.views) && viewsData.views.some((view) => view.view_key === 'lease_contracts');
    report.checks.has_business_column_groups = ['기본정보', '계약기간', '면적', '경제조건'].every((label) => body.includes(label));
    report.checks.grid_has_rows_or_clear_zero_state = Number(report.view_rows_contract.row_count || 0) > 0 || body.includes('현재 조건 0건') || body.includes('View는 1차 구현 이후 확장됩니다');
    report.checks.grid_has_sorting_headers = Number(igisGridMetrics.headerButtons || 0) > 1;
    report.checks.grid_not_stuck_loading = !igisGridMetrics.hasLoadingText;
    report.checks.change_basket_visible = body.includes('검증 및 승인 요청') && body.includes('변경 전') && body.includes('변경 후');
    report.checks.no_internal_tokens = !INTERNAL_TOKEN_PATTERN.test(body);
    report.checks.no_broken_question_marks = !/\?{4,}/u.test(body);

    const marketButton = page.getByRole('button', { name: '시장 Data' }).first();
    await marketButton.click();
    await page.waitForResponse((response) => (
      response.url().includes('/functions/v1/ll-dashboard-api') && response.request().postData()?.includes('data-management/view-rows')
    ), { timeout: 30000 }).catch(() => null);
    const marketGridMetrics = await waitForGridSettled(page, report, 'market');
    const marketBody = await page.locator('body').innerText({ timeout: 10000 });
    report.checks.market_workspace_no_asset_fund_selector = marketBody.includes('자산·펀드 선택 없이') && !marketBody.includes('연결 펀드');
    report.checks.market_workspace_grid_visible = await page.locator('[data-data-management-grid="true"]').isVisible({ timeout: 5000 }).catch(() => false);
    report.checks.market_grid_not_stuck_loading = !marketGridMetrics.hasLoadingText;
    report.checks.no_internal_tokens_market = !INTERNAL_TOKEN_PATTERN.test(marketBody);

    const operationsButton = page.getByRole('button', { name: '시스템·운영 Data' }).first();
    await operationsButton.click();
    await page.waitForResponse((response) => (
      response.url().includes('/functions/v1/ll-dashboard-api') && response.request().postData()?.includes('data-management/view-rows')
    ), { timeout: 30000 }).catch(() => null);
    const operationsGridMetrics = await waitForGridSettled(page, report, 'operations');
    const operationsBody = await page.locator('body').innerText({ timeout: 10000 });
    report.checks.operations_workspace_visible = operationsBody.includes('readback') || operationsBody.includes('읽기 전용') || operationsBody.includes('전용 workflow');
    report.checks.operations_grid_not_stuck_loading = !operationsGridMetrics.hasLoadingText;
    report.checks.no_internal_tokens_operations = !INTERNAL_TOKEN_PATTERN.test(operationsBody);

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
