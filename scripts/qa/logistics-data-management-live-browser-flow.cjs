const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const {
  ROOT,
  OUT_DIR,
  argsValue,
  chromeExecutablePath,
  envValue,
  hasFlag,
  joinUrl,
  safeArray,
  signIn,
  text,
  timestampForFile,
} = require('./logistics-data-management-qa-utils.cjs');

const DEFAULT_BASE_URL = 'https://kylee94.github.io/logistics-gate6-preview/';
const EXPECTED_ASSET_COUNT = Number(envValue('QA_DM_EXPECTED_ASSET_COUNT') || 19);
const EXPECTED_FUND_COUNT = Number(envValue('QA_DM_EXPECTED_FUND_COUNT') || 17);
const EXPECTED_PAIR_NEEDLE = envValue('QA_DM_EXPECTED_PAIR_NEEDLE') || argsValue('expected-pair', '404');
const MIN_VISIBLE_LL_TABLES = Number(envValue('QA_DM_MIN_VISIBLE_LL_TABLES') || 8);
const INTERNAL_TOKEN_PATTERN = /\b(source_row_id|source_file_id|source_sheet_id|natural_key|row_hash|payload)\b/iu;

function countVisibleLlTables(body) {
  return [...new Set((body.match(/\bll_[a-z0-9_]+\b/giu) || []).map((item) => item.toLowerCase()))];
}

async function clickFirstVisible(locator) {
  const count = await locator.count().catch(() => 0);
  for (let index = 0; index < count; index += 1) {
    const item = locator.nth(index);
    if (await item.isVisible({ timeout: 1000 }).catch(() => false)) {
      await item.click();
      return true;
    }
  }
  return false;
}

async function waitForNoBlockingLoading(page) {
  await page.waitForFunction(() => {
    const text = document.body?.innerText || '';
    const hasDataManagement = /Data Management|ll_assets|Readback|\uB370\uC774\uD130|\uC2B9\uC778/u.test(text);
    const blockingLoading = /loading|loading data|\uB85C\uB529 \uC911|\uBD88\uB7EC\uC624\uB294 \uC911/iu.test(text)
      && !hasDataManagement;
    return !blockingLoading;
  }, { timeout: 30000 });
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const stamp = timestampForFile();
  const outJson = path.join(OUT_DIR, `data-management-live-browser-flow-${stamp}.json`);
  const latestJson = path.join(OUT_DIR, 'data-management-live-browser-flow-latest.json');
  const screenshot = path.join(OUT_DIR, `data-management-live-browser-flow-${stamp}.png`);
  const baseUrl = argsValue('base-url', DEFAULT_BASE_URL);
  const supabaseUrl = envValue('LOGISTICS_SUPABASE_URL', 'VITE_SUPABASE_URL');
  const anonKey = envValue('LOGISTICS_SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY');
  if (!supabaseUrl || !anonKey) {
    throw new Error('Set LOGISTICS_SUPABASE_URL/VITE_SUPABASE_URL and LOGISTICS_SUPABASE_ANON_KEY/VITE_SUPABASE_ANON_KEY.');
  }
  const auth = await signIn(supabaseUrl, anonKey);
  const uiEmail = envValue('LOGISTICS_BROWSER_UI_EMAIL') || text(auth.user?.email) || 'kylee@igisam.com';
  const browserSession = { ...auth.session, user: { ...(auth.session.user || {}), email: uiEmail } };
  const report = {
    ok: false,
    generated_at: new Date().toISOString(),
    mode: 'data_management_live_browser_flow',
    base_url: baseUrl,
    auth_source: auth.source,
    checks: {},
    errors: [],
    network: {
      status_responses: [],
      coverage_responses: [],
      preview_responses: [],
      submit_responses: [],
      edge_failures: [],
    },
    screenshot: path.relative(ROOT, screenshot).replace(/\\/gu, '/'),
  };
  let browser;
  try {
    browser = await chromium.launch({ headless: true, executablePath: chromeExecutablePath() });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, serviceWorkers: 'block' });
    await context.addInitScript(({ email, session }) => {
      sessionStorage.setItem('sb-iota-auth-token', JSON.stringify(session));
      sessionStorage.setItem('logistics_preview_auth', JSON.stringify({ email }));
      localStorage.setItem('logisticsDashboardReadMode', 'primary-safe');
    }, { email: uiEmail, session: browserSession });
    const page = await context.newPage();
    page.on('pageerror', (error) => report.errors.push(error.message));
    page.on('response', async (response) => {
      const url = response.url();
      if (!url.includes('/functions/v1/ll-dashboard-api')) return;
      const postData = response.request().postData() || '';
      if (response.status() >= 500) report.network.edge_failures.push({ status: response.status(), url });
      if (postData.includes('data-management/status')) {
        const body = await response.json().catch(() => null);
        report.network.status_responses.push({
          status: response.status(),
          ok: body?.ok,
          generated_at: body?.data?.generated_at || null,
          source_rows: safeArray(body?.data?.source_rows).length,
          table_catalog: safeArray(body?.data?.table_catalog || body?.data?.tables || body?.data?.ll_tables).length,
          asset_count: body?.data?.management_scope?.asset_count,
          fund_count: body?.data?.management_scope?.fund_count,
        });
      }
      if (postData.includes('data-management/coverage')) {
        const body = await response.json().catch(() => null);
        report.network.coverage_responses.push({
          status: response.status(),
          ok: body?.ok,
          table_count: safeArray(body?.data?.table_coverage).length,
          total_row_count: body?.data?.totals?.total_row_count,
        });
      }
      if (postData.includes('data-management/preview-edit')) {
        const body = await response.json().catch(() => null);
        report.network.preview_responses.push({
          status: response.status(),
          ok: body?.ok,
          can_submit: body?.data?.can_submit,
          auto_write_enabled: body?.data?.auto_write_enabled,
          has_target: Boolean(body?.data?.target),
          has_readback: Boolean(body?.data?.target?.readback),
        });
      }
      if (postData.includes('data-management/submit-edit')) {
        const body = await response.json().catch(() => null);
        report.network.submit_responses.push({
          status: response.status(),
          ok: body?.ok,
          id: body?.data?.id || null,
        });
      }
    });

    const route = 'platform/iotaseoul/workspace/logistics/data-management';
    const dataManagementUrl = joinUrl(baseUrl, route);
    await page.goto(`${dataManagementUrl}${dataManagementUrl.includes('?') ? '&' : '?'}qa=${stamp}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => /Data Management|\uB370\uC774\uD130 \uAD00\uB9AC/u.test(document.body?.innerText || ''), { timeout: 45000 });
    await waitForNoBlockingLoading(page);
    const firstBody = await page.locator('body').innerText({ timeout: 20000 });
    const firstVisibleTables = countVisibleLlTables(firstBody);

    report.checks.data_management_loaded = /Data Management|\uB370\uC774\uD130 \uAD00\uB9AC/u.test(firstBody);
    report.checks.status_api_called = report.network.status_responses.length >= 1 && report.network.status_responses.at(-1)?.ok === true;
    report.checks.coverage_api_called = report.network.coverage_responses.length >= 1 && report.network.coverage_responses.at(-1)?.ok === true;
    report.checks.igis_market_split_visible = /IGIS|\uC774\uC9C0\uC2A4/u.test(firstBody) && /Market|\uC2DC\uC7A5/u.test(firstBody);
    report.checks.asset_fund_scope_visible = new RegExp(`\\b${EXPECTED_ASSET_COUNT}\\b|${EXPECTED_ASSET_COUNT}\\s*assets?`, 'iu').test(firstBody)
      && new RegExp(`\\b${EXPECTED_FUND_COUNT}\\b|${EXPECTED_FUND_COUNT}\\s*funds?`, 'iu').test(firstBody);
    report.checks.expected_404_pair_visible = firstBody.includes(EXPECTED_PAIR_NEEDLE);
    report.checks.visible_ll_catalog_present = firstVisibleTables.length >= MIN_VISIBLE_LL_TABLES;
    report.checks.core_tables_visible = ['ll_assets', 'll_funds', 'll_source_rows'].every((table) => firstVisibleTables.includes(table));
    report.checks.row_lookup_visible = /row count|rows|row_count|\uD589 \uC218|\uC870\uD68C/iu.test(firstBody);
    report.checks.preview_submit_readback_words_visible = /preview|\uBBF8\uB9AC\uBCF4\uAE30|\uAC80\uC99D/iu.test(firstBody)
      && /submit|\uC2B9\uC778 \uC694\uCCAD/iu.test(firstBody)
      && /readback|\uC7AC\uC870\uD68C|\uBC18\uC601 \uC774\uB825/iu.test(firstBody);
    report.checks.no_internal_source_tokens_visible = !INTERNAL_TOKEN_PATTERN.test(firstBody);

    const searchInput = page.locator('input').filter({ hasText: '' }).first();
    if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await searchInput.fill(EXPECTED_PAIR_NEEDLE).catch(() => null);
      await page.waitForFunction((needle) => (document.body?.innerText || '').includes(needle), EXPECTED_PAIR_NEEDLE, { timeout: 5000 }).catch(() => null);
      const searchedBody = await page.locator('body').innerText({ timeout: 10000 });
      report.checks.expected_pair_searchable = searchedBody.includes(EXPECTED_PAIR_NEEDLE);
    } else {
      report.checks.expected_pair_searchable = report.checks.expected_404_pair_visible;
    }

    const tabsClicked = [];
    for (const label of [/Market|\uC2DC\uC7A5/u, /IGIS|\uC774\uC9C0\uC2A4/u, /approval|\uC2B9\uC778/u, /history|readback|\uC774\uB825/u]) {
      const clicked = await clickFirstVisible(page.getByRole('button', { name: label })).catch(() => false);
      if (clicked) {
        tabsClicked.push(String(label));
        await waitForNoBlockingLoading(page).catch((error) => report.errors.push(`tab loading failed: ${error.message}`));
      }
    }
    report.checks.in_page_tab_switch_no_stuck_loading = tabsClicked.length >= 2;

    const statusCountBeforeRouteSwitch = report.network.status_responses.length;
    await page.goto(`${joinUrl(baseUrl, 'platform/iotaseoul/workspace/logistics/market-data')}?qa=${stamp}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => /Market Data|\uC2DC\uC7A5/u.test(document.body?.innerText || ''), { timeout: 30000 }).catch(() => null);
    await page.goto(`${dataManagementUrl}${dataManagementUrl.includes('?') ? '&' : '?'}qa_return=${stamp}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => /Data Management|\uB370\uC774\uD130 \uAD00\uB9AC/u.test(document.body?.innerText || ''), { timeout: 45000 });
    await waitForNoBlockingLoading(page);
    const returnBody = await page.locator('body').innerText({ timeout: 20000 });
    report.checks.route_tab_return_reloaded_status = report.network.status_responses.length > statusCountBeforeRouteSwitch;
    report.checks.route_tab_return_not_blank = returnBody.length > 1000 && /Data Management|\uB370\uC774\uD130/u.test(returnBody);

    const afterBox = page.locator('[data-data-management-after-value="true"], textarea').first();
    const canPreview = await afterBox.isVisible({ timeout: 5000 }).catch(() => false);
    if (canPreview) {
      const previewCountBefore = report.network.preview_responses.length;
      await afterBox.fill(`QA browser preview ${stamp}`);
      await page.waitForResponse((response) => (
        response.url().includes('/functions/v1/ll-dashboard-api') && (response.request().postData() || '').includes('data-management/preview-edit')
      ), { timeout: 20000 }).catch(() => null);
      report.checks.preview_network_readback_observed = report.network.preview_responses.length > previewCountBefore
        && report.network.preview_responses.some((item) => item.ok === true && item.has_target && item.has_readback);
    } else {
      report.checks.preview_network_readback_observed = false;
    }

    if (hasFlag('allow-submit') || envValue('QA_ALLOW_DATA_MANAGEMENT_SUBMIT') === 'true') {
      const submitBefore = report.network.submit_responses.length;
      const clicked = await clickFirstVisible(page.getByRole('button', { name: /submit|\uC2B9\uC778 \uC694\uCCAD|\uC800\uC7A5/iu })).catch(() => false);
      if (clicked) {
        await page.waitForResponse((response) => (
          response.url().includes('/functions/v1/ll-dashboard-api') && (response.request().postData() || '').includes('data-management/submit-edit')
        ), { timeout: 20000 }).catch(() => null);
      }
      report.checks.submit_network_observed = report.network.submit_responses.length > submitBefore
        && report.network.submit_responses.some((item) => item.ok === true && item.id);
    } else {
      report.checks.submit_network_observed = true;
      report.submit_note = 'Submit is guarded unless --allow-submit is set.';
    }

    await page.screenshot({ path: screenshot, fullPage: false });
    report.visible_ll_tables = firstVisibleTables;
    report.tabs_clicked = tabsClicked;
    report.ok = Object.values(report.checks).every(Boolean)
      && report.errors.length === 0
      && report.network.edge_failures.length === 0;
  } catch (error) {
    report.errors.push(error?.message || String(error));
  } finally {
    if (browser) await browser.close();
  }
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(latestJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(`data management live browser flow ${report.ok ? 'PASS' : 'FAIL'}: ${path.relative(ROOT, outJson)}`);
  if (!report.ok) {
    console.log(JSON.stringify({ checks: report.checks, errors: report.errors, edge_failures: report.network.edge_failures }, null, 2));
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error?.stack || error?.message || error);
  process.exit(1);
});
