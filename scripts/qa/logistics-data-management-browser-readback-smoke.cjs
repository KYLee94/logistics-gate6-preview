const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT_DIR = path.join(ROOT, 'qa-artifacts', 'logistics-gate6');
const DEFAULT_BASE_URL = 'http://127.0.0.1:5173/';
const INTERNAL_TOKEN_PATTERN = /\bll_|source_row_id|source_file_id|source_sheet_id|natural_key|natural\s+key|row_hash|row\s+hash|payload|\bPNU\b|\bpnu\b|법정동코드/iu;
const RAW_REGION_NUMBER_PATTERN = /\b\d+\s*[.)]\s*(동남권|남부권|중앙권|서부권|서북권|수도권|경남권|충청권|전라권|경북권|지방)/u;

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

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
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

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const stamp = timestampForFile();
  const outJson = path.join(OUT_DIR, `data-management-browser-readback-smoke-${stamp}.json`);
  const latestJson = path.join(OUT_DIR, 'data-management-browser-readback-smoke-latest.json');
  const screenshot = path.join(OUT_DIR, `data-management-browser-readback-smoke-${stamp}.png`);
  const baseUrl = argsValue('base-url', DEFAULT_BASE_URL);
  const allowSubmit = hasFlag('allow-submit') || process.env.QA_ALLOW_DATA_MANAGEMENT_SUBMIT === 'true';
  const auth = await signInSession();
  const uiEmail = envValue('LOGISTICS_BROWSER_UI_EMAIL') || 'kylee@igisam.com';
  const browserSession = { ...auth.session, user: { ...(auth.session.user || {}), email: uiEmail } };
  const report = {
    ok: false,
    generated_at: new Date().toISOString(),
    base_url: baseUrl,
    auth_source: auth.source,
    allow_submit: allowSubmit,
    checks: {},
    errors: [],
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
    page.on('response', (response) => {
      if (response.url().includes('/functions/v1/ll-dashboard-api') && response.status() >= 500) {
        report.errors.push(`edge ${response.status()} ${response.url()}`);
      }
    });
    const statusResponsePromise = page.waitForResponse((response) => (
      response.url().includes('/functions/v1/ll-dashboard-api') && response.request().postData()?.includes('data-management/status')
    ), { timeout: 45000 }).catch(() => null);
    await page.goto(joinUrl(baseUrl, 'data-management'), { waitUntil: 'domcontentloaded', timeout: 60000 });
    const statusResponse = await statusResponsePromise;
    const statusBody = statusResponse ? await statusResponse.json().catch(() => null) : null;
    await page.waitForFunction(() => document.body?.innerText?.includes('Data Management'), { timeout: 30000 });
    const body = await page.locator('body').innerText({ timeout: 20000 });
    const statusData = statusBody?.data || {};
    const sourceRows = Array.isArray(statusData.source_rows) ? statusData.source_rows : [];
    const columns = Array.isArray(statusData.columns) ? statusData.columns : [];
    const edits = Array.isArray(statusData.edit_requests) ? statusData.edit_requests : [];
    report.status_contract = {
      access_scope: statusData.access_scope || null,
      can_approve: statusData.can_approve,
      source_rows: sourceRows.length,
      columns: columns.length,
      edits: edits.length,
      managed_asset_codes: statusData.managed_asset_codes || [],
    };
    report.checks.status_api_ok = statusBody?.ok === true;
    report.checks.access_scope_present = Boolean(statusData.access_scope);
    report.checks.status_arrays_present = Array.isArray(statusData.source_rows) && Array.isArray(statusData.columns) && Array.isArray(statusData.edit_requests);
    report.checks.manager_has_rows = statusData.access_scope === 'manager_full_source' ? sourceRows.length > 0 && columns.length > 0 : true;
    report.checks.no_broken_question_marks = !/\?{4,}/u.test(body);
    report.checks.no_internal_tokens = !INTERNAL_TOKEN_PATTERN.test(body);
    report.checks.no_permission_explanation_banner = !body.includes('이관용, 전기영, 이시정, 이승훈, 이철승 계정은 모든 자산의 데이터 관리 권한으로 처리됩니다');
    report.checks.has_workflow_tabs = body.includes('\uB0B4 \uC791\uC5C5')
      && body.includes('\uC784\uB300\uCC28')
      && body.includes('\uC790\uC0B0 \uC2A4\uD399')
      && body.includes('\uC6B4\uC601\uBE44\uC6A9')
      && body.includes('\uC2B9\uC778 \uB300\uAE30')
      && body.includes('\uBC18\uC601 \uC774\uB825');

    const marketTab = page.getByRole('button', { name: '\uC2DC\uC7A5\uC790\uB8CC', exact: true }).first();
    await marketTab.click();
    await page.waitForFunction(() => document.body?.innerText?.includes('\uC785\uB825 \uB9C8\uBC95\uC0AC'), { timeout: 15000 }).catch(() => null);
    const workflowBody = await page.locator('body').innerText({ timeout: 10000 });
    const selectorCountText = await page.locator('[data-data-management-selector-count="true"]').innerText({ timeout: 5000 }).catch(() => '');
    const targetSelectCount = await page.locator('select').count().catch(() => 0);
    const targetSelectOptionCounts = await page.evaluate(() => Array.from(document.querySelectorAll('select')).map((select) => select.options.length)).catch(() => []);
    report.checks.has_sortable_tables = await page.locator('[data-sortable-table="true"]').count().catch(() => 0) > 0;
    report.checks.no_internal_tokens_after_workflow_tab = !INTERNAL_TOKEN_PATTERN.test(workflowBody);
    report.checks.no_raw_region_numbers_after_workflow_tab = !RAW_REGION_NUMBER_PATTERN.test(workflowBody);
    report.checks.target_selector_visible = workflowBody.includes('\uAD00\uB9AC \uB300\uC0C1 \uC120\uD0DD') && Boolean(selectorCountText);
    report.checks.target_selector_has_options = targetSelectCount >= 4 && targetSelectOptionCounts.some((count) => count > 1);
    report.checks.workflow_selection_visible = workflowBody.includes('\uC6D0\uBCF8 \uD589') && workflowBody.includes('\uC218\uC815 \uD544\uB4DC');
    report.checks.workflow_validation_visible = workflowBody.includes('\uC800\uC7A5 \uC804 \uAC80\uC99D') || workflowBody.includes('\uC800\uC7A5 \uC804 \uC601\uD5A5 \uBC94\uC704') || workflowBody.includes('\uD544\uC218\uAC12') || workflowBody.includes('\uAC80\uC99D \uC911') || workflowBody.includes('\uAC80\uC99D \uC624\uB958');
    report.checks.workflow_diff_visible = (workflowBody.includes('Before') && workflowBody.includes('After'))
      || (workflowBody.includes('\uBCC0\uACBD \uC804') && workflowBody.includes('\uBCC0\uACBD \uD6C4'));
    report.checks.workflow_approval_visible = workflowBody.includes('\uC2B9\uC778 \uC694\uCCAD');
    const afterBox = page.locator('textarea').nth(1);
    const canEdit = await afterBox.isVisible({ timeout: 5000 }).catch(() => false);
    report.checks.editable_or_scoped_message = canEdit || /\uAD8C\uD55C|\uC6D0\uCC9C|\uB2F4\uB2F9 \uC790\uC0B0/u.test(await page.locator('body').innerText({ timeout: 5000 }));
    if (statusData.access_scope === 'manager_full_source') report.checks.manager_can_edit = canEdit;

    if (canEdit) {
      const previewResponsePromise = page.waitForResponse((response) => (
        response.url().includes('/functions/v1/ll-dashboard-api') && response.request().postData()?.includes('data-management/preview-edit')
      ), { timeout: 30000 }).catch(() => null);
      await afterBox.fill(`QA preview ${stamp}`);
      const previewResponse = await previewResponsePromise;
      const previewBody = previewResponse ? await previewResponse.json().catch(() => null) : null;
      const previewText = await page.locator('body').innerText({ timeout: 10000 });
      report.preview_contract = {
        http_status: previewResponse?.status() || null,
        ok: previewBody?.ok,
        auto_write_enabled: previewBody?.data?.auto_write_enabled,
        validation_count: Array.isArray(previewBody?.data?.validations) ? previewBody.data.validations.length : null,
        has_target: Boolean(previewBody?.data?.target),
      };
      report.checks.preview_api_ok = previewBody?.ok === true;
      report.checks.preview_visible = previewText.includes('\uC800\uC7A5 \uC804 \uAC80\uC99D') && previewText.includes('\uBC18\uC601 \uBC29\uC2DD');
      if (allowSubmit) {
        const submitResponsePromise = page.waitForResponse((response) => (
          response.url().includes('/functions/v1/ll-dashboard-api') && response.request().postData()?.includes('data-management/submit-edit')
        ), { timeout: 30000 });
        const submitButton = page.getByRole('button', { name: /\uC2B9\uC778 \uC694\uCCAD \uC800\uC7A5/u });
        await submitButton.click();
        const submitResponse = await submitResponsePromise;
        const submitBody = await submitResponse.json().catch(() => null);
        report.submit_contract = {
          http_status: submitResponse.status(),
          ok: submitBody?.ok,
          id: submitBody?.data?.id || submitBody?.id || null,
        };
        report.checks.submit_api_ok = submitBody?.ok === true && Boolean(report.submit_contract.id);
      } else {
        report.checks.submit_guarded = true;
      }
    } else {
      report.checks.preview_api_ok = statusData.access_scope !== 'manager_full_source';
      report.checks.preview_visible = statusData.access_scope !== 'manager_full_source';
      report.checks.submit_guarded = true;
    }
    const historyTab = page.getByRole('button', { name: '\uBC18\uC601 \uC774\uB825', exact: true }).first();
    await historyTab.click();
    await page.waitForFunction(() => document.body?.innerText?.includes('\uC2B9\uC778/\uBC18\uC601 \uC694\uCCAD \uC774\uB825'), { timeout: 10000 }).catch(() => null);
    const historyBody = await page.locator('body').innerText({ timeout: 10000 });
    report.checks.history_readback_visible = historyBody.includes('Readback') || historyBody.includes('\uC2B9\uC778/\uBC18\uC601 \uC694\uCCAD \uC774\uB825') || historyBody.includes('\uBC18\uC601 \uC774\uB825');
    report.checks.no_internal_tokens_after_history_tab = !INTERNAL_TOKEN_PATTERN.test(historyBody);
    report.checks.no_raw_region_numbers_after_history_tab = !RAW_REGION_NUMBER_PATTERN.test(historyBody);
    await page.screenshot({ path: screenshot, fullPage: false });
    report.ok = Object.values(report.checks).every(Boolean) && report.errors.length === 0;
  } catch (error) {
    report.errors.push(error?.message || String(error));
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
