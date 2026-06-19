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

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const stamp = timestampForFile();
  const outJson = path.join(OUT_DIR, `investment-index-browser-smoke-${stamp}.json`);
  const latestJson = path.join(OUT_DIR, 'investment-index-browser-smoke-latest.json');
  const screenshot = path.join(OUT_DIR, `investment-index-browser-smoke-${stamp}.png`);
  const baseUrl = argsValue('base-url', DEFAULT_BASE_URL);
  const auth = await signInSession();
  const uiEmail = auth.session.user?.email || envValue('LOGISTICS_BROWSER_UI_EMAIL') || 'kylee@igisam.com';
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
  try {
    browser = await chromium.launch({ headless: true, executablePath: chromeExecutablePath() });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, serviceWorkers: 'block' });
    await context.addInitScript(({ email, session }) => {
      sessionStorage.setItem('sb-iota-auth-token', JSON.stringify(session));
      sessionStorage.setItem('logistics_preview_auth', JSON.stringify({ email }));
      localStorage.setItem('logisticsDashboardReadMode', 'primary-safe');
    }, { email: uiEmail, session: auth.session });
    const page = await context.newPage();
    page.on('pageerror', (error) => report.errors.push(error.message));
    await page.goto(joinUrl(baseUrl, 'investment-index'), { waitUntil: 'domcontentloaded', timeout: 60000 });
    report.checks.shell_ready = await page.waitForFunction(() => /Investment\s*Index/iu.test(document.body?.innerText || ''), { timeout: 60000 }).then(() => true).catch(() => false);
    report.checks.loading_gone = await page.waitForFunction(() => !(document.body?.innerText || '').includes('투자지표를 불러오는 중입니다.'), { timeout: 90000 }).then(() => true).catch(() => false);
    report.checks.capital_chart_ready = await page.waitForSelector('[data-chart-role="capital-stack"][data-chart-empty="false"]', { timeout: 90000 }).then(() => true).catch(() => false);
    report.checks.removed_top_exposure = !(await page.getByText('상위 노출액 비교').count().catch(() => 0));
    report.checks.collapsible_table_button = (await page.getByRole('button', { name: /표 접기|표 펼치기/u }).count().catch(() => 0)) > 0;
    report.checks.loan_maturity_section = (await page.getByText('대출 만기 일정').count().catch(() => 0)) > 0;
    report.checks.loan_rate_section = (await page.getByText('대출 금리 비교').count().catch(() => 0)) > 0;
    report.checks.sortable_tables = (await page.locator('[data-sortable-table="true"]').count().catch(() => 0)) >= 3;
    const firstCapitalRow = page.locator('[data-chart-role="capital-stack"] > div').first();
    report.checks.capital_row_present = (await firstCapitalRow.count().catch(() => 0)) > 0;
    if (report.checks.capital_row_present) {
      await firstCapitalRow.hover();
      report.checks.tooltip_has_hidden_detail = await page.waitForFunction(() => {
        const text = document.body?.innerText || '';
        return text.includes('Equity 투자자') || text.includes('Loan 대주');
      }, { timeout: 5000 }).then(() => true).catch(() => false);
      await firstCapitalRow.click();
      report.checks.detail_modal_open = await page.locator('[role="dialog"]').waitFor({ timeout: 10000 }).then(() => true).catch(() => false);
      report.checks.detail_modal_table = (await page.locator('[role="dialog"] [data-sortable-table="true"]').count().catch(() => 0)) > 0;
    }
    await page.screenshot({ path: screenshot, fullPage: false });
    report.ok = Object.values(report.checks).every(Boolean) && report.errors.length === 0;
    await context.close();
  } finally {
    if (browser) await browser.close().catch(() => null);
  }

  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(latestJson, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`investment index browser smoke ${report.ok ? 'PASS' : 'FAIL'}: ${path.relative(ROOT, outJson)}`);
  if (!report.ok) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
