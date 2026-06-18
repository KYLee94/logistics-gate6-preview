const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT_DIR = path.join(ROOT, 'qa-artifacts', 'logistics-gate6');
const DEFAULT_BASE_URL = 'http://127.0.0.1:5173/';

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

function hasRequiredRows(apiBody, key) {
  const views = apiBody?.data?.views || {};
  if (key === 'overview') return Boolean(views.overview?.kpis);
  if (key === 'lease') return Array.isArray(views.lease?.latest_rows) && views.lease.latest_rows.length > 0;
  if (key === 'supply') return Array.isArray(views.supply?.rows) && views.supply.rows.length > 0;
  if (key === 'transactions') return Array.isArray(views.transactions?.rows) && views.transactions.rows.length > 0;
  if (key === 'source') return Array.isArray(views.source?.sheet_readback) && views.source.sheet_readback.length > 0;
  return false;
}

async function invokeMarketData(session) {
  const supabaseUrl = envValue('LOGISTICS_SUPABASE_URL', 'VITE_SUPABASE_URL');
  const anonKey = envValue('LOGISTICS_SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY');
  const response = await fetch(`${supabaseUrl.replace(/\/$/u, '')}/functions/v1/ll-dashboard-api`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      authorization: `Bearer ${session.access_token}`,
      'content-type': 'application/json',
      origin: 'https://kylee94.github.io',
    },
    body: JSON.stringify({ action: 'sector-market/read', payload: { limit: 12000 } }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body?.ok === false) throw new Error(`sector-market/read failed (${response.status}): ${body.message || body.error || 'unknown error'}`);
  return body;
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const stamp = timestampForFile();
  const outJson = path.join(OUT_DIR, `market-data-browser-smoke-${stamp}.json`);
  const latestJson = path.join(OUT_DIR, 'market-data-browser-smoke-latest.json');
  const baseUrl = argsValue('base-url', DEFAULT_BASE_URL);
  const auth = await signInSession();
  const apiBody = await invokeMarketData(auth.session);
  const uiEmail = auth.session.user?.email || envValue('LOGISTICS_BROWSER_UI_EMAIL') || 'kylee@igisam.com';
  const browserSession = auth.session;
  const report = {
    ok: false,
    generated_at: new Date().toISOString(),
    base_url: baseUrl,
    auth_source: auth.source,
    tabs: [],
    errors: [],
  };
  const tabs = [
    { key: 'overview', route: 'market-data/overview', viewKey: 'overview', needsMap: false },
    { key: 'lease-market', route: 'market-data/lease-market', viewKey: 'lease', needsMap: true },
    { key: 'supply-pipeline', route: 'market-data/supply-pipeline', viewKey: 'supply', needsMap: true },
    { key: 'transactions', route: 'market-data/transactions', viewKey: 'transactions', needsMap: true },
    { key: 'source-update', route: 'market-data/source-update', viewKey: 'source', needsMap: false },
  ];
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
    for (const tab of tabs) {
      const url = joinUrl(baseUrl, tab.route);
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForFunction(() => document.body?.innerText?.includes('Market Data'), { timeout: 30000 }).catch(() => null);
      await page.waitForFunction(() => !document.body?.innerText?.includes('\uC2DC\uC7A5\uC790\uB8CC\uB97C \uBD88\uB7EC\uC624\uB294 \uC911\uC785\uB2C8\uB2E4.'), { timeout: 45000 }).catch(() => null);
      if (tab.needsMap) {
        await page.waitForFunction(() => document.querySelectorAll('div[aria-label] button[title]').length > 0, { timeout: 45000 }).catch(() => null);
      }
      const body = await page.locator('body').innerText({ timeout: 20000 });
      const screenshot = path.join(OUT_DIR, `market-data-${tab.key}-${stamp}.png`);
      await page.screenshot({ path: screenshot, fullPage: false });
      const mapCount = await page.locator('div[aria-label] button[title]').count().catch(() => 0);
      const naverMapCount = await page.locator('[data-naver-map-ready="true"]').count().catch(() => 0);
      const fallbackMapCount = await page.locator('[data-map-fallback-ready="true"]').count().catch(() => 0);
      const mapWarningPresent = body.includes('지도 API 미설정') || body.includes('좌표 부족');
      const tableCount = await page.locator('table').count().catch(() => 0);
      const sortableTableCount = await page.locator('[data-sortable-table="true"]').count().catch(() => 0);
      const chartCount = await page.locator('[data-chart-role]').count().catch(() => 0);
      const emptyChartCount = await page.locator('[data-chart-empty="true"]').count().catch(() => 0);
      const regionPrefixPresent = body.includes('(수도권)') || body.includes('(지방)');
      const leaseSlicerPresent = body.includes('상/저온') && body.includes('지표');
      const supplySlicerPresent = body.includes('유형') && body.includes('기간');
      const transactionSlicerPresent = body.includes('기간') && body.includes('권역') && body.includes('상/저온') && body.includes('실물/선매입');
      const row = {
        key: tab.key,
        url: page.url(),
        screenshot: path.relative(ROOT, screenshot).replace(/\\/gu, '/'),
        api_ok: apiBody?.ok === true && apiBody?.data?.summary?.status === 'ready',
        view_present: Boolean(apiBody?.data?.views?.[tab.viewKey]),
        view_has_rows: hasRequiredRows(apiBody, tab.viewKey),
        api_data_quality: apiBody?.data?.summary?.data_quality || null,
        title_present: body.includes('Market Data'),
        has_broken_question_marks: /\?{4,}/u.test(body),
        internal_tokens_visible: /\bll_|source_row_id|source_file_id|payload|natural_key|natural\s+key|row_hash|row\s+hash|\bPNU\b|\bpnu\b|법정동코드/iu.test(body),
        map_count: mapCount,
        naver_map_count: naverMapCount,
        fallback_map_count: fallbackMapCount,
        map_warning_present: mapWarningPresent,
        table_count: tableCount,
        sortable_table_count: sortableTableCount,
        chart_count: chartCount,
        empty_chart_count: emptyChartCount,
        region_prefix_present: regionPrefixPresent,
        lease_slicer_present: leaseSlicerPresent,
        supply_slicer_present: supplySlicerPresent,
        transaction_slicer_present: transactionSlicerPresent,
      };
      row.ok = row.api_ok
        && row.view_present
        && row.view_has_rows
        && row.title_present
        && !row.has_broken_question_marks
        && !row.internal_tokens_visible
        && tableCount > 0
        && sortableTableCount > 0
        && (!tab.needsMap || naverMapCount > 0 || fallbackMapCount > 0)
        && (tab.key === 'source-update' || chartCount > 0)
        && emptyChartCount === 0
        && (tab.key === 'source-update' || regionPrefixPresent)
        && (tab.key !== 'lease-market' || leaseSlicerPresent)
        && (tab.key !== 'supply-pipeline' || supplySlicerPresent)
        && (tab.key !== 'transactions' || transactionSlicerPresent);
      report.tabs.push(row);
    }
    report.ok = report.tabs.every((tab) => tab.ok) && report.errors.length === 0;
  } catch (error) {
    report.errors.push(error?.message || String(error));
  } finally {
    if (browser) await browser.close();
  }
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(latestJson, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`market data browser smoke ${report.ok ? 'PASS' : 'FAIL'}: ${path.relative(ROOT, outJson)}`);
  if (!report.ok) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
