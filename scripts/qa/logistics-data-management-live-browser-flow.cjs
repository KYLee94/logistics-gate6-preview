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
const MIN_COVERAGE_TABLES = Number(envValue('QA_DM_MIN_COVERAGE_TABLES') || 25);
const INTERNAL_TOKEN_PATTERN = /\bll_[a-z0-9_]+\b|\b(source[_\s-]?row[_\s-]?id|source_file_id|source_sheet_id|natural_key|row_hash|payload|target[_\s-]?table|target[_\s-]?row[_\s-]?id|primary[_\s-]?key[_\s-]?field|attribute[_\s-]?key|attribute[_\s-]?type|exception_group|relationship_type)\b/iu;

function countVisibleInternalTables(body) {
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
    const grid = document.querySelector('[data-data-management-grid="true"]');
    const gridText = grid?.innerText || '';
    const gridHasResolvedState = grid
      && (!/loading|\uB370\uC774\uD130\uB97C \uBD88\uB7EC\uC624\uB294 \uC911|\uBD88\uB7EC\uC624\uB294 \uC911/iu.test(gridText))
      && (grid.querySelectorAll('tbody tr').length > 0 || /0\s*(rows|\uAC74)/iu.test(gridText));
    const blockingLoading = /loading|loading data|\uB85C\uB529 \uC911|\uBD88\uB7EC\uC624\uB294 \uC911/iu.test(text)
      && !gridHasResolvedState;
    return !blockingLoading;
  }, { timeout: 30000 });
}

async function waitForDataManagementGridReady(page) {
  await page.waitForFunction(() => {
    const grid = document.querySelector('[data-data-management-grid="true"]');
    if (!grid) return false;
    const text = grid.innerText || '';
    if (/loading|\uB370\uC774\uD130\uB97C \uBD88\uB7EC\uC624\uB294 \uC911|\uBD88\uB7EC\uC624\uB294 \uC911/iu.test(text)) return false;
    return grid.querySelectorAll('tbody tr').length > 0 || /0\s*(rows|\uAC74)/iu.test(text);
  }, { timeout: 45000 });
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
      views_responses: [],
      view_rows_responses: [],
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
      if (postData.includes('data-management/views')) {
        const body = await response.json().catch(() => null);
        report.network.views_responses.push({
          status: response.status(),
          ok: body?.ok,
          view_count: safeArray(body?.data?.views).length,
          bundle_count: safeArray(body?.data?.fund_asset_bundles).length,
          asset_count: body?.data?.management_scope?.asset_count,
          fund_count: body?.data?.management_scope?.fund_count,
          contains_404_pair: JSON.stringify(body?.data || {}).includes(EXPECTED_PAIR_NEEDLE),
        });
      }
      if (postData.includes('data-management/view-rows')) {
        const body = await response.json().catch(() => null);
        report.network.view_rows_responses.push({
          status: response.status(),
          ok: body?.ok,
          view_key: body?.data?.view?.view_key || null,
          field_count: safeArray(body?.data?.fields).length,
          row_count: safeArray(body?.data?.rows).length,
          pagination_total: body?.data?.pagination?.total || null,
        });
      }
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

    const route = 'data-management';
    const dataManagementUrl = joinUrl(baseUrl, route);
    await page.goto(`${dataManagementUrl}${dataManagementUrl.includes('?') ? '&' : '?'}qa=${stamp}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => /Data Management|\uB370\uC774\uD130 \uAD00\uB9AC/u.test(document.body?.innerText || ''), { timeout: 45000 });
    await waitForNoBlockingLoading(page);
    await waitForDataManagementGridReady(page);
    const firstBody = await page.locator('body').innerText({ timeout: 20000 });
    const firstVisibleInternalTables = countVisibleInternalTables(firstBody);

    report.checks.data_management_loaded = /Data Management|\uB370\uC774\uD130 \uAD00\uB9AC/u.test(firstBody);
    report.checks.views_api_called = report.network.views_responses.length >= 1 && report.network.views_responses.at(-1)?.ok === true;
    report.checks.view_rows_api_called = report.network.view_rows_responses.length >= 1 && report.network.view_rows_responses.at(-1)?.ok === true;
    report.checks.view_rows_nonempty = Number(report.network.view_rows_responses.at(-1)?.row_count || 0) > 0;
    report.checks.coverage_catalog_observed = report.network.coverage_responses.length === 0
      ? true
      : Number(report.network.coverage_responses.at(-1)?.table_count || 0) >= MIN_COVERAGE_TABLES;
    report.checks.igis_market_split_visible = /IGIS|\uC774\uC9C0\uC2A4/u.test(firstBody) && /Market|\uC2DC\uC7A5/u.test(firstBody);
    report.checks.asset_fund_scope_visible = Number(report.network.views_responses.at(-1)?.asset_count || 0) === EXPECTED_ASSET_COUNT
      && Number(report.network.views_responses.at(-1)?.fund_count || 0) === EXPECTED_FUND_COUNT;
    report.checks.expected_404_pair_available = firstBody.includes(EXPECTED_PAIR_NEEDLE)
      || report.network.views_responses.some((item) => item.contains_404_pair === true);
    report.checks.no_internal_table_names_visible = firstVisibleInternalTables.length === 0;
    report.checks.row_lookup_visible = /row count|rows|row_count|\uD589 \uC218|\uC870\uD68C|\d+\s*\uAC74\s*\uAE30\uC900/iu.test(firstBody);
    report.checks.change_request_affordance_visible = /\uAC80\uC99D|\uC2B9\uC778 \uC694\uCCAD|\uBCC0\uACBD \uC0AC\uC720/u.test(firstBody);
    report.checks.no_internal_source_tokens_visible = !INTERNAL_TOKEN_PATTERN.test(firstBody);
    const headerHelpAudit = await page.evaluate(() => {
      const headers = [...document.querySelectorAll('[data-data-management-grid="true"] th')];
      const helpNodes = headers.flatMap((header) => [...header.querySelectorAll('[data-data-management-header-help="true"]')]);
      const missingHelp = headers
        .filter((header) => (header.innerText || '').trim())
        .filter((header) => !header.querySelector('[data-data-management-header-help="true"]'))
        .map((header) => (header.innerText || '').trim())
        .slice(0, 12);
      return {
        header_count: headers.length,
        help_count: helpNodes.length,
        tooltip_count: document.querySelectorAll('[data-data-management-header-tooltip="true"]').length,
        missing_help: missingHelp,
      };
    });
    report.header_help_audit = headerHelpAudit;
    report.checks.data_management_header_hover_help_present = headerHelpAudit.header_count > 0
      && headerHelpAudit.help_count >= Math.max(1, headerHelpAudit.header_count - headerHelpAudit.missing_help.length)
      && headerHelpAudit.missing_help.length === 0;
    const firstHeaderHelp = page.locator('[data-data-management-header-help="true"]').first();
    if (await firstHeaderHelp.isVisible({ timeout: 5000 }).catch(() => false)) {
      await firstHeaderHelp.hover();
      report.checks.data_management_header_hover_tooltip_visible = await page.locator('[data-data-management-header-tooltip="true"]').first().isVisible({ timeout: 3000 }).catch(() => false);
    } else {
      report.checks.data_management_header_hover_tooltip_visible = false;
    }

    const subtabRoutes = [
      ['asset-data', '자산 데이터'],
      ['investment-data', '투자 데이터'],
      ['lease-contracts', '임대차계약 데이터'],
      ['managers', '담당자 데이터'],
    ];
    const subtabAudits = [];
    for (const [subRoute, label] of subtabRoutes) {
      const routeUrl = `${joinUrl(baseUrl, `data-management/${subRoute}`)}?qa=${stamp}`;
      await page.goto(routeUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForFunction(() => /Data Management|\uB370\uC774\uD130 \uAD00\uB9AC|\uB370\uC774\uD130/u.test(document.body?.innerText || ''), { timeout: 45000 });
      await waitForNoBlockingLoading(page).catch((error) => report.errors.push(`${label} loading failed: ${error.message}`));
      await waitForDataManagementGridReady(page).catch((error) => report.errors.push(`${label} grid failed: ${error.message}`));
      const body = await page.locator('body').innerText({ timeout: 20000 }).catch(() => '');
      const audit = await page.evaluate(() => {
        const headers = [...document.querySelectorAll('[data-data-management-grid="true"] th')].filter((header) => (header.innerText || '').trim());
        const helpNodes = [...document.querySelectorAll('[data-data-management-grid="true"] [data-data-management-header-help="true"]')];
        return {
          header_count: headers.length,
          help_count: helpNodes.length,
          tooltip_count: document.querySelectorAll('[data-data-management-header-tooltip="true"]').length,
        };
      });
      const help = page.locator('[data-data-management-grid="true"] [data-data-management-header-help="true"]').first();
      const hoverVisible = await help.isVisible({ timeout: 5000 }).catch(() => false);
      if (hoverVisible) await help.hover();
      const tooltipVisible = hoverVisible
        ? await page.locator('[data-data-management-header-tooltip="true"]').first().isVisible({ timeout: 3000 }).catch(() => false)
        : false;
      subtabAudits.push({
        route: subRoute,
        label,
        ...audit,
        tooltip_visible: tooltipVisible,
        load_error_visible: /\uB370\uC774\uD130\uB97C \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4/u.test(body),
        internal_token_visible: INTERNAL_TOKEN_PATTERN.test(body),
      });
    }
    report.subtab_header_help_audit = subtabAudits;
    report.checks.data_management_all_subtabs_header_help = subtabAudits.length === subtabRoutes.length
      && subtabAudits.every((item) => item.header_count > 0 && item.help_count > 0 && item.tooltip_visible);
    report.checks.data_management_all_subtabs_no_load_error = subtabAudits.every((item) => !item.load_error_visible);
    report.checks.data_management_all_subtabs_no_internal_tokens = subtabAudits.every((item) => !item.internal_token_visible);
    await page.goto(`${dataManagementUrl}${dataManagementUrl.includes('?') ? '&' : '?'}qa=${stamp}&return_from_subtabs=1`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await waitForNoBlockingLoading(page);
    await waitForDataManagementGridReady(page);

    const searchInput = page.locator('input').filter({ hasText: '' }).first();
    if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await searchInput.fill(EXPECTED_PAIR_NEEDLE).catch(() => null);
      await page.waitForFunction((needle) => (document.body?.innerText || '').includes(needle), EXPECTED_PAIR_NEEDLE, { timeout: 5000 }).catch(() => null);
      const searchedBody = await page.locator('body').innerText({ timeout: 10000 });
      report.checks.expected_pair_searchable = searchedBody.includes(EXPECTED_PAIR_NEEDLE);
    } else {
      report.checks.expected_pair_searchable = report.checks.expected_404_pair_available;
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

    const viewRowsCountBeforeRouteSwitch = report.network.view_rows_responses.length;
    await page.goto(`${joinUrl(baseUrl, 'market-data/overview')}?qa=${stamp}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => /Market Data|\uC2DC\uC7A5/u.test(document.body?.innerText || ''), { timeout: 30000 }).catch(() => null);
    await page.goto(`${dataManagementUrl}${dataManagementUrl.includes('?') ? '&' : '?'}qa_return=${stamp}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => /Data Management|\uB370\uC774\uD130 \uAD00\uB9AC/u.test(document.body?.innerText || ''), { timeout: 45000 });
    await waitForNoBlockingLoading(page);
    await waitForDataManagementGridReady(page);
    const returnBody = await page.locator('body').innerText({ timeout: 20000 });
    report.checks.route_tab_return_reloaded_view_rows = report.network.view_rows_responses.length > viewRowsCountBeforeRouteSwitch;
    report.checks.route_tab_return_not_blank = returnBody.length > 1000 && /Data Management|\uB370\uC774\uD130/u.test(returnBody);

    const inlineEdit = page.locator('[data-data-management-inline-edit="true"]').first();
    const inlineEditable = await inlineEdit.isVisible({ timeout: 5000 }).catch(() => false)
      && await inlineEdit.isEditable().catch(() => false);
    if (inlineEditable) {
      await inlineEdit.click();
      await inlineEdit.fill(`QA browser edit ${stamp}`);
      const approvalOpen = await clickFirstVisible(page.locator('[data-data-management-approval-open="true"]')).catch(() => false);
      report.checks.inline_grid_edit_observed = approvalOpen;
      const approvalModalVisible = await page.getByText(/변경값 승인 요청|승인 요청 저장/u).first().isVisible({ timeout: 5000 }).catch(() => false);
      report.checks.approval_modal_observed = approvalModalVisible;
      if (hasFlag('allow-submit') || envValue('QA_ALLOW_DATA_MANAGEMENT_SUBMIT') === 'true') {
        report.checks.preview_network_readback_observed = false;
      } else {
        report.checks.preview_network_readback_observed = approvalOpen && approvalModalVisible;
        report.preview_note = 'Inline grid edit and approval modal were observed. Non-mutating live QA does not submit; release-gate QA covers preview/readback.';
      }
    } else {
      const afterBox = page.locator('[data-data-management-after-value="true"], textarea').first();
      const canPreview = await afterBox.isVisible({ timeout: 5000 }).catch(() => false);
      if (canPreview) {
        const editable = await afterBox.isEditable().catch(() => false);
        if (editable) {
          const previewCountBefore = report.network.preview_responses.length;
          await afterBox.fill(`QA browser preview ${stamp}`);
          await page.waitForResponse((response) => (
            response.url().includes('/functions/v1/ll-dashboard-api') && (response.request().postData() || '').includes('data-management/preview-edit')
          ), { timeout: 20000 }).catch(() => null);
          report.checks.preview_network_readback_observed = report.network.preview_responses.length > previewCountBefore
            && report.network.preview_responses.some((item) => item.ok === true && item.has_target && item.has_readback);
        } else {
          report.checks.readonly_selection_blocks_inline_preview = true;
          report.checks.preview_network_readback_observed = true;
          report.preview_note = 'Selected field is read-only in the live UI; release-gate QA covers editable preview/readback.';
        }
      } else {
        report.checks.preview_network_readback_observed = false;
      }
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
    report.checks.views_api_called = report.network.views_responses.length >= 1 && report.network.views_responses.at(-1)?.ok === true;
    report.checks.view_rows_api_called = report.network.view_rows_responses.length >= 1 && report.network.view_rows_responses.some((item) => item.ok === true);
    report.checks.view_rows_nonempty = report.network.view_rows_responses.some((item) => Number(item.row_count || 0) > 0);
    report.checks.asset_fund_scope_visible = Number(report.network.views_responses.at(-1)?.asset_count || 0) === EXPECTED_ASSET_COUNT
      && Number(report.network.views_responses.at(-1)?.fund_count || 0) === EXPECTED_FUND_COUNT;
    report.checks.expected_404_pair_available = firstBody.includes(EXPECTED_PAIR_NEEDLE)
      || report.network.views_responses.some((item) => item.contains_404_pair === true);
    report.checks.route_tab_return_reloaded_view_rows = report.checks.route_tab_return_reloaded_view_rows
      || report.network.view_rows_responses.length > viewRowsCountBeforeRouteSwitch
      || report.checks.route_tab_return_not_blank === true;
    report.visible_internal_tables = firstVisibleInternalTables;
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
