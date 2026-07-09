const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT_DIR = path.join(ROOT, 'qa-artifacts', 'logistics-gate6');
const DEFAULT_BASE_URL = 'https://kylee94.github.io/logistics-gate6-preview/';
const DEFAULT_ROUTE = '?p=platform/iotaseoul/workspace/logistics';
const DEFAULT_DATES = ['2026-06-30', '2026-07-06', '2026-07-07'];
const MIN_EXPECTED_ITEMS = 8;
const NEWS_TITLE = '\uB370\uC77C\uB9AC \uBB3C\uB958 \uB274\uC2A4';

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

function argsValues(name) {
  const flag = `--${name}`;
  const values = [];
  for (let index = 0; index < process.argv.length; index += 1) {
    if (process.argv[index] === flag && process.argv[index + 1]) values.push(process.argv[index + 1]);
  }
  return values;
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

function normalizeTitle(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '');
}

function expectedWindowHours(dateText) {
  const match = String(dateText || '').match(/^(\d{4})-(\d{2})-(\d{2})$/u);
  if (!match) return 24;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return date.getUTCDay() === 1 ? 72 : 24;
}

function expectedWindow(dateText) {
  const match = String(dateText || '').match(/^(\d{4})-(\d{2})-(\d{2})$/u);
  if (!match) {
    const end = new Date();
    return { start: new Date(end.getTime() - 24 * 60 * 60 * 1000), end };
  }
  const end = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), -2, 0, 0));
  const start = new Date(end.getTime() - expectedWindowHours(dateText) * 60 * 60 * 1000);
  return { start, end };
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
      supabaseUrl,
      anonKey,
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
  return { supabaseUrl, anonKey, session, source: 'password_grant' };
}

async function invokeNewsList(auth, date) {
  const response = await fetch(`${auth.supabaseUrl.replace(/\/$/u, '')}/functions/v1/ll-dashboard-api`, {
    method: 'POST',
    headers: {
      apikey: auth.anonKey,
      authorization: `Bearer ${auth.session.access_token}`,
      'content-type': 'application/json',
      origin: 'https://kylee94.github.io',
    },
    body: JSON.stringify({ action: 'news/list', payload: { limit: 10, date } }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body?.ok === false) throw new Error(`news/list ${date} failed (${response.status}): ${body.message || body.error || 'unknown error'}`);
  const data = body.data || {};
  const items = Array.isArray(data.items) ? data.items : [];
  const expected = expectedWindow(date);
  return {
    date,
    selected_date: data.selected_date,
    items,
    source_summary: data.latest_run?.source_summary || {},
    outside_window_items: items.filter((item) => {
      const publishedAt = new Date(item.published_at);
      return Number.isNaN(publishedAt.getTime()) || publishedAt < expected.start || publishedAt > expected.end;
    }),
  };
}

async function setNewsDate(newsSection, date) {
  const dateInput = newsSection.locator('input[type="date"]').first();
  await dateInput.evaluate((input, value) => {
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, date);
}

async function visibleNewsState(newsSection) {
  return newsSection.evaluate((section) => {
    const links = [...section.querySelectorAll('a[href]')].map((anchor) => ({
      href: anchor.getAttribute('href') || '',
      text: anchor.textContent || '',
    })).filter((item) => item.text.trim());
    const date = section.querySelector('input[type="date"]')?.value || '';
    return { date, links };
  });
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const stamp = timestampForFile();
  const outJson = path.join(OUT_DIR, `news-browser-smoke-${stamp}.json`);
  const latestJson = path.join(OUT_DIR, 'news-browser-smoke-latest.json');
  const screenshotPath = path.join(OUT_DIR, `news-browser-smoke-${stamp}.png`);
  const baseUrl = argsValue('base-url', DEFAULT_BASE_URL);
  const dates = argsValues('date');
  const targetDates = dates.length ? dates : DEFAULT_DATES;
  const baseTargetUrl = joinUrl(baseUrl, argsValue('route', DEFAULT_ROUTE));
  const targetUrl = `${baseTargetUrl}${baseTargetUrl.includes('?') ? '&' : '?'}cb=${encodeURIComponent(stamp)}`;
  const auth = await signInSession();
  const uiEmail = argsValue('ui-email', envValue('LOGISTICS_BROWSER_UI_EMAIL') || auth.session.user?.email || 'kylee@igisam.com');
  const browserSession = { ...auth.session, user: { ...(auth.session.user || {}), email: uiEmail } };
  const report = {
    ok: false,
    generated_at: new Date().toISOString(),
    url: targetUrl,
    auth_source: auth.source,
    ui_email: uiEmail,
    dates: [],
    screenshot: path.relative(ROOT, screenshotPath).replace(/\\/gu, '/'),
    errors: [],
  };
  let browser;
  try {
    const expectedByDate = {};
    for (const date of targetDates) {
      expectedByDate[date] = await invokeNewsList(auth, date);
    }

    browser = await chromium.launch({ headless: true, executablePath: chromeExecutablePath() });
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' });
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
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForLoadState('networkidle', { timeout: 60000 }).catch(() => null);
    const newsSection = page.locator('section', { has: page.locator('h2', { hasText: NEWS_TITLE }) }).first();
    await newsSection.waitFor({ state: 'visible', timeout: 30000 });
    await newsSection.locator('input[type="date"]').first().waitFor({ state: 'visible', timeout: 10000 });

    for (const date of targetDates) {
      const expected = expectedByDate[date];
      const expectedTokens = expected.items.slice(0, 6).map((item) => normalizeTitle(item.title)).filter(Boolean);
      const responsePromise = page.waitForResponse((response) => {
        const request = response.request();
        return response.url().includes('/functions/v1/ll-dashboard-api')
          && (request.postData() || '').includes('"news/list"')
          && (request.postData() || '').includes(date);
      }, { timeout: 30000 }).catch(() => null);
      await setNewsDate(newsSection, date);
      await responsePromise;
      await page.waitForFunction(({ sectionTitle, expectedDate, tokens }) => {
        const section = [...document.querySelectorAll('section')]
          .find((candidate) => (candidate.querySelector('h2')?.textContent || '').includes(sectionTitle));
        if (!section) return false;
        const dateValue = section.querySelector('input[type="date"]')?.value || '';
        if (dateValue !== expectedDate) return false;
        const linkText = [...section.querySelectorAll('a[href]')]
          .map((anchor) => (anchor.textContent || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ''))
          .join(' ');
        return tokens.some((token) => token && linkText.includes(token));
      }, { sectionTitle: NEWS_TITLE, expectedDate: date, tokens: expectedTokens }, { timeout: 30000 });

      const firstState = await visibleNewsState(newsSection);
      await page.waitForTimeout(1600);
      const stableState = await visibleNewsState(newsSection);
      const visibleTokens = stableState.links.map((item) => normalizeTitle(item.text)).filter(Boolean);
      const matchedExpectedCount = expectedTokens.filter((token) => visibleTokens.some((visible) => visible.includes(token))).length;
      const check = {
        date,
        api_selected_date: expected.selected_date,
        api_item_count: expected.items.length,
        api_outside_window_count: expected.outside_window_items.length,
        api_strict_window_only: expected.source_summary?.strict_window_only === true,
        visible_date: stableState.date,
        visible_link_count_initial: firstState.links.length,
        visible_link_count_stable: stableState.links.length,
        matched_expected_titles: matchedExpectedCount,
        disappeared_after_load: firstState.links.length > 0 && stableState.links.length === 0,
      };
      check.ok = check.api_selected_date === date
        && check.api_item_count >= MIN_EXPECTED_ITEMS
        && check.api_outside_window_count === 0
        && check.api_strict_window_only
        && check.visible_date === date
        && check.visible_link_count_stable >= Math.min(MIN_EXPECTED_ITEMS, expected.items.length)
        && check.matched_expected_titles >= Math.min(3, expectedTokens.length)
        && !check.disappeared_after_load;
      report.dates.push(check);
      if (!check.ok) report.errors.push(`news browser check failed for ${date}: ${JSON.stringify(check)}`);
    }
    await newsSection.screenshot({ path: screenshotPath });
    report.ok = report.errors.length === 0 && report.dates.every((item) => item.ok);
  } catch (error) {
    report.errors.push(error?.message || String(error));
  } finally {
    if (browser) await browser.close();
  }
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(latestJson, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`news browser smoke ${report.ok ? 'PASS' : 'FAIL'}: ${path.relative(ROOT, outJson)}`);
  if (!report.ok) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
