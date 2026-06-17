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
  const candidates = [
    process.env.CHROME_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ].filter(Boolean);
  return candidates.find((candidate) => fs.existsSync(candidate)) || undefined;
}

function joinUrl(baseUrl, route) {
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  return new URL(route.replace(/^\/+/u, ''), normalizedBase).toString();
}

function kstDateKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  return new Date(date.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function addDateDays(dateText, diff) {
  const match = String(dateText || '').match(/^(\d{4})-(\d{2})-(\d{2})$/u);
  if (!match) return kstDateKey();
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  date.setUTCDate(date.getUTCDate() + diff);
  return date.toISOString().slice(0, 10);
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

  const email = argsValue('email', envValue('LOGISTICS_SUPABASE_EMAIL', 'LOGISTICS_SUPABASE_AUTH_EMAIL'));
  const password = argsValue('password', envValue('LOGISTICS_SUPABASE_PASSWORD', 'LOGISTICS_SUPABASE_AUTH_PASSWORD'));
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
  const outJson = path.join(OUT_DIR, `sector-tabs-browser-smoke-${stamp}.json`);
  const latestJson = path.join(OUT_DIR, 'sector-tabs-browser-smoke-latest.json');
  const baseUrl = argsValue('base-url', DEFAULT_BASE_URL);
  const auth = await signInSession();
  const uiEmail = argsValue('ui-email', envValue('LOGISTICS_BROWSER_UI_EMAIL') || 'kylee@igisam.com');
  const browserSession = {
    ...auth.session,
    user: {
      ...(auth.session.user || {}),
      email: uiEmail,
    },
  };
  const report = {
    ok: false,
    generated_at: new Date().toISOString(),
    base_url: baseUrl,
    auth_source: auth.source,
    checks: {},
    routes: [],
    errors: [],
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

    const probes = [
      { key: 'home', route: 'platform/iotaseoul/workspace/logistics/dashboard/home', patterns: [/E\.?\s*NOC/u, /WALE/u, /OPERATING COST|운영비용/u] },
      { key: 'investment_index', route: 'platform/iotaseoul/workspace/logistics/dashboard/investment-index', patterns: [/Investment Index/u, /Equity/u, /Loan/u, /펀드 기준|자산 기준/u] },
      { key: 'asset_spec', route: 'platform/iotaseoul/workspace/logistics/dashboard/asset-spec', patterns: [/Asset Spec|자산 스펙/u, /층고|통로|램프|바닥/u, /임차인|Tenant/u] },
      { key: 'market_data', route: 'platform/iotaseoul/workspace/logistics/market-data', patterns: [/Market Data/u, /Lease Market/u, /Supply Pipeline/u, /Transactions/u] },
      { key: 'data_management', route: 'platform/iotaseoul/workspace/logistics/data-management', patterns: [/Data Management/u, /내 작업|임대차/u, /승인 대기|반영 이력/u] },
      { key: 'work_platform_news', route: 'platform/iotaseoul/workspace/logistics', patterns: [/데일리 물류 뉴스/u, /Project 현황|Project/u, /주요\s*TASK|주요\s*Task/u] },
    ];

    for (const probe of probes) {
      const url = joinUrl(baseUrl, probe.route);
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(3500);
      if (probe.key === 'market_data') {
        await page.waitForFunction(() => {
          const bodyText = document.body?.innerText || '';
          return bodyText.includes('9,610') || bodyText.includes('Supabase readback 통과') || bodyText.includes('통과');
        }, { timeout: 30000 }).catch(() => null);
      }
      let body = await page.locator('body').innerText({ timeout: 20000 });
      let matched = probe.patterns.map((pattern) => pattern.test(body));
      if (!matched.every(Boolean)) {
        await page.waitForTimeout(4500);
        body = await page.locator('body').innerText({ timeout: 20000 });
        matched = probe.patterns.map((pattern) => pattern.test(body));
      }
      const routeReport = {
        key: probe.key,
        url: page.url(),
        matched,
        ok: matched.every(Boolean) && !/\?{4,}/u.test(body),
        has_question_marks: /\?{4,}/u.test(body),
        excerpt: body.slice(0, 600),
      };
      if (probe.key === 'work_platform_news') {
        const today = kstDateKey();
        const newsSection = page.locator('section', { has: page.locator('h2', { hasText: '데일리 물류 뉴스' }) }).first();
        const dateInput = newsSection.locator('input[type="date"]').first();
        const prevButton = newsSection.locator('button[aria-label="이전 날짜 뉴스"]').first();
        const nextButton = newsSection.locator('button[aria-label="다음 날짜 뉴스"]').first();
        const dateControlVisible = await dateInput.isVisible({ timeout: 5000 }).catch(() => false);
        const initialDate = dateControlVisible ? await dateInput.inputValue() : '';
        const maxDate = dateControlVisible ? await dateInput.getAttribute('max') : '';
        const todayNextDisabled = await nextButton.isDisabled().catch(() => false);
        if (dateControlVisible) {
          await prevButton.click();
          await page.waitForTimeout(1000);
        }
        const previousDate = dateControlVisible ? await dateInput.inputValue() : '';
        const previousBody = dateControlVisible ? await newsSection.innerText({ timeout: 5000 }).catch(() => '') : '';
        const afterPreviousNextDisabled = dateControlVisible ? await nextButton.isDisabled().catch(() => true) : true;
        if (dateControlVisible && !afterPreviousNextDisabled) {
          await nextButton.click();
          await page.waitForTimeout(1200);
        }
        const restoredDate = dateControlVisible ? await dateInput.inputValue() : '';
        const dateControls = {
          visible: dateControlVisible,
          initial_date: initialDate,
          max_date: maxDate,
          today_next_disabled: todayNextDisabled,
          after_previous_next_disabled: afterPreviousNextDisabled,
          previous_date: previousDate,
          restored_date: restoredDate,
          empty_state_ok: /수집된 뉴스가 없습니다\.|뉴스를 불러오는 중입니다\.|중요|[가-힣].*(물류|쿠팡|CJ|한진|컬리|롯데)/u.test(previousBody),
        };
        dateControls.ok = dateControls.visible
          && dateControls.initial_date === today
          && dateControls.max_date === today
          && dateControls.today_next_disabled
          && !dateControls.after_previous_next_disabled
          && dateControls.previous_date === addDateDays(initialDate, -1)
          && dateControls.restored_date === initialDate
          && dateControls.empty_state_ok;
        routeReport.news_date_controls = dateControls;
        routeReport.ok = routeReport.ok && dateControls.ok;
      }
      report.routes.push(routeReport);
      report.checks[probe.key] = routeReport.ok;
    }
    report.ok = Object.values(report.checks).every(Boolean) && report.errors.length === 0;
  } catch (error) {
    report.errors.push(error?.message || String(error));
  } finally {
    if (browser) await browser.close();
  }
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(latestJson, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`sector tabs browser smoke ${report.ok ? 'PASS' : 'FAIL'}: ${path.relative(ROOT, outJson)}`);
  if (!report.ok) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
