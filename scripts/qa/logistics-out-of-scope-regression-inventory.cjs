const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT_DIR = path.join(ROOT, 'qa-artifacts', 'logistics-gate6');
const DEFAULT_BASE_URL = 'https://kylee94.github.io/logistics-gate6-preview/';

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

function argValue(name, fallback = '') {
  const eqPrefix = `--${name}=`;
  const eqArg = process.argv.find((item) => item.startsWith(eqPrefix));
  if (eqArg) return eqArg.slice(eqPrefix.length);
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : (process.argv[index + 1] || fallback);
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function timestampForFile() {
  return new Date().toISOString().replace(/[-:]/gu, '').replace(/\./u, '-').replace('T', '-');
}

function joinUrl(baseUrl, route) {
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const url = new URL(route.replace(/^\/+/u, ''), normalizedBase);
  if (hasFlag('cache-bust')) url.searchParams.set('qa_cache_bust', timestampForFile());
  return url.toString();
}

function chromeExecutablePath() {
  return [
    process.env.CHROME_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ].filter(Boolean).find((candidate) => fs.existsSync(candidate)) || undefined;
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

function markdownTable(headers, rows) {
  const escapeCell = (value) => String(value ?? '').replace(/\|/gu, '\\|').replace(/\r?\n/gu, '<br>');
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.map(escapeCell).join(' | ')} |`),
  ].join('\n');
}

async function collectPageInventory(page, route, id, screenshotPath) {
  const responses = [];
  const responseHandler = (response) => {
    if (response.url().includes('/functions/v1/ll-dashboard-api') && response.status() >= 400) {
      responses.push({ status: response.status(), url: response.url() });
    }
  };
  page.on('response', responseHandler);
  const startedAt = Date.now();
  await page.goto(route.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => (document.body?.innerText || '').trim().length > 50, undefined, { timeout: 60000 }).catch(() => null);
  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => null);
  const body = await page.locator('body').innerText({ timeout: 20000 }).catch(() => '');
  await page.screenshot({ path: screenshotPath, fullPage: false }).catch(() => null);
  page.off('response', responseHandler);
  const internalDetailPatterns = [
    /\bll_[a-z0-9_]+\b/iu,
    /source_row_id|source_file_id|source_sheet_id|natural_key|row_hash|payload/iu,
    /Dashboard read blocked|Supabase read loading/iu,
  ];
  const internalDetailHits = internalDetailPatterns
    .map((pattern) => {
      const match = body.match(pattern);
      return match ? match[0] : '';
    })
    .filter(Boolean);
  return {
    id,
    route: route.route,
    url: page.url(),
    elapsed_ms: Date.now() - startedAt,
    expected_unchanged: route.expected_unchanged,
    body_excerpt: body.slice(0, 500),
    body_length: body.length,
    internal_detail_hits: internalDetailHits,
    failed_edge_responses: responses,
    screenshot: path.relative(ROOT, screenshotPath).replace(/\\/gu, '/'),
    ok: body.length > 50 && responses.length === 0,
    approval_required: internalDetailHits.length > 0,
  };
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const stamp = timestampForFile();
  const baseUrl = argValue('base-url', DEFAULT_BASE_URL);
  const routes = [
    { id: 'work-platform', route: 'work-platform', expected_unchanged: 'Work Platform shell should load without Market Data regressions.' },
    { id: 'dashboard-home', route: 'home', expected_unchanged: 'Dashboard Home should keep core KPI cards and asset navigation.' },
    { id: 'dashboard-asset', route: 'asset', expected_unchanged: 'Asset view should keep readback data and map/callout behavior.' },
    { id: 'dashboard-company', route: 'company', expected_unchanged: 'Company view should keep tenant and asset exposure tables.' },
    { id: 'investment-index', route: 'investment-index', expected_unchanged: 'Investment Index should load existing loan and fund sections.' },
    { id: 'asset-spec', route: 'asset-spec', expected_unchanged: 'Asset Spec should keep spec/readback sections visible.' },
    { id: 'analysis-tools', route: 'analysis-tools', expected_unchanged: 'Analysis tools should load without blocked data state.' },
    { id: 'pivot-table', route: 'pivot-table', expected_unchanged: 'Pivot table should load table/chart areas.' },
    { id: 'data-quality', route: 'data-quality', expected_unchanged: 'Data Quality should keep findings and review workflow visible.' },
    { id: 'data-management', route: 'data-management', expected_unchanged: 'Data Management should keep request/history workflow visible.' },
    { id: 'pdf-report', route: 'pdf-report', expected_unchanged: 'PDF Report should keep report preview sections visible.' },
  ].map((route) => ({ ...route, url: joinUrl(baseUrl, route.route) }));
  const selectedIds = argValue('routes', '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  const selectedRoutes = selectedIds.length ? routes.filter((route) => selectedIds.includes(route.id) || selectedIds.includes(route.route)) : routes;
  const auth = await signInSession();
  const email = auth.session.user?.email || envValue('LOGISTICS_BROWSER_UI_EMAIL') || 'kylee@igisam.com';
  const report = {
    ok: false,
    generated_at: new Date().toISOString(),
    script: 'qa:out-of-scope-regression-inventory',
    base_url: baseUrl,
    auth_source: auth.source,
    scope: 'Dashboard and Work Platform non-Market-Data routes',
    routes: [],
    approval_required_findings: [],
    errors: [],
    warnings: [],
  };
  let browser;
  try {
    browser = await chromium.launch({ headless: !hasFlag('headed'), executablePath: chromeExecutablePath() });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, serviceWorkers: 'block' });
    await context.addInitScript(({ session, email: injectedEmail }) => {
      sessionStorage.setItem('sb-iota-auth-token', JSON.stringify(session));
      sessionStorage.setItem('logistics_preview_auth', JSON.stringify({ email: injectedEmail }));
      localStorage.setItem('logisticsDashboardReadMode', 'primary-safe');
    }, { session: auth.session, email });
    const page = await context.newPage();
    page.on('pageerror', (error) => report.errors.push(error?.message || String(error)));
    page.on('console', (message) => {
      if (message.type() === 'error' && !/favicon/iu.test(message.text())) report.warnings.push(message.text().slice(0, 400));
    });
    for (const route of selectedRoutes) {
      const screenshotPath = path.join(OUT_DIR, `out-of-scope-regression-${route.id}-${stamp}.png`);
      try {
        report.routes.push(await collectPageInventory(page, route, route.id, screenshotPath));
      } catch (error) {
        report.routes.push({
          id: route.id,
          route: route.route,
          url: route.url,
          expected_unchanged: route.expected_unchanged,
          screenshot: path.relative(ROOT, screenshotPath).replace(/\\/gu, '/'),
          ok: false,
          error: error?.message || String(error),
        });
      }
    }
    await context.close();
  } catch (error) {
    report.errors.push(error?.stack || error?.message || String(error));
  } finally {
    if (browser) await browser.close().catch(() => null);
  }
  report.ok = report.routes.length === selectedRoutes.length
    && report.routes.every((route) => route.ok)
    && report.errors.length === 0;
  report.approval_required_findings = report.routes
    .filter((route) => Array.isArray(route.internal_detail_hits) && route.internal_detail_hits.length > 0)
    .map((route) => ({
      id: route.id,
      route: route.route,
      hits: route.internal_detail_hits,
      screenshot: route.screenshot,
      note: '범위 밖 기존 화면에서 내부 문자열이 보입니다. 사용자 승인 전에는 자동 수정하지 않습니다.',
    }));
  const outJson = path.join(OUT_DIR, `out-of-scope-regression-inventory-${stamp}.json`);
  const latestJson = path.join(OUT_DIR, 'out-of-scope-regression-inventory-latest.json');
  const outMd = path.join(OUT_DIR, `out-of-scope-regression-inventory-${stamp}.md`);
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(latestJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(outMd, [
    '# Out-of-Scope Regression Inventory',
    '',
    `- Base URL: ${baseUrl}`,
    `- Status: ${report.ok ? 'PASS' : 'FAIL'}`,
    `- Scope: ${report.scope}`,
    '',
    markdownTable(
      ['Route', 'Status', 'Expected unchanged', 'Failed API', 'Approval-required findings', 'Screenshot'],
      report.routes.map((route) => [
        route.route,
        route.ok ? 'pass' : 'fail',
        route.expected_unchanged,
        (route.failed_edge_responses || []).map((item) => item.status).join(', '),
        (route.internal_detail_hits || []).join(', '),
        route.screenshot,
      ]),
    ),
    '',
  ].join('\n'), 'utf8');
  console.log(`out-of-scope regression inventory ${report.ok ? 'PASS' : 'FAIL'}: ${path.relative(ROOT, outJson).replace(/\\/gu, '/')}`);
  if (!report.ok) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error?.stack || error?.message || error);
  process.exit(1);
});
