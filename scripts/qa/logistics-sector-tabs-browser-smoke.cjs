const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT_DIR = path.join(ROOT, 'qa-artifacts', 'logistics-gate6');
const DEFAULT_BASE_URL = 'https://kylee94.github.io/logistics-gate6-preview/';
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

function timestampForFile() {
  return new Date().toISOString().replace(/[-:]/gu, '').replace(/\..+$/u, '').replace('T', '-');
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

async function waitForBodyReady(page, pattern) {
  await page.waitForFunction((source) => {
    const text = document.body?.innerText || '';
    return new RegExp(source, 'iu').test(text);
  }, pattern.source, { timeout: 30000 }).catch(() => null);
}

async function gotoWithRetry(page, url, pattern) {
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    return;
  } catch (error) {
    if (!/ERR_ABORTED/u.test(error?.message || '')) throw error;
    await page.waitForTimeout(1000);
    const body = await page.locator('body').innerText({ timeout: 5000 }).catch(() => '');
    if (pattern.test(body)) return;
    await page.goto(url, { waitUntil: 'load', timeout: 60000 });
  }
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const stamp = timestampForFile();
  const outJson = path.join(OUT_DIR, `sector-tabs-browser-smoke-${stamp}.json`);
  const latestJson = path.join(OUT_DIR, 'sector-tabs-browser-smoke-latest.json');
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
    routes: [],
    errors: [],
  };
  const probes = [
    { key: 'home', route: 'platform/iotaseoul/workspace/logistics/dashboard/home', patterns: [/E\.?\s*NOC/u, /WALE/u] },
    { key: 'asset', route: 'platform/iotaseoul/workspace/logistics/dashboard/asset', patterns: [/면적 구성/u, /자산 3D 모델 열기/u] },
    { key: 'investment_index', route: 'platform/iotaseoul/workspace/logistics/dashboard/investment-index', patterns: [/Investment Index/u, /Equity/u, /Loan/u] },
    { key: 'asset_spec', route: 'platform/iotaseoul/workspace/logistics/dashboard/asset-spec', patterns: [/Asset Spec/u] },
    { key: 'market_data', route: 'platform/iotaseoul/workspace/logistics/market-data', patterns: [/Market Data/u] },
    { key: 'data_management', route: 'platform/iotaseoul/workspace/logistics/data-management', patterns: [/Data Management/u] },
    { key: 'work_platform_news', route: 'platform/iotaseoul/workspace/logistics', patterns: [/\uB370\uC77C\uB9AC \uBB3C\uB958 \uB274\uC2A4/u, /Project/u] },
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

    for (const probe of probes) {
      const url = joinUrl(baseUrl, probe.route);
      await gotoWithRetry(page, url, probe.patterns[0]);
      await waitForBodyReady(page, probe.patterns[0]);
      const body = await page.locator('body').innerText({ timeout: 20000 });
      const matched = probe.patterns.map((pattern) => pattern.test(body));
      const routeReport = {
        key: probe.key,
        url: page.url(),
        matched,
        has_question_marks: /\?{4,}/u.test(body),
        internal_tokens_visible: INTERNAL_TOKEN_PATTERN.test(body),
        raw_region_numbers_visible: ['investment_index', 'asset_spec', 'data_management'].includes(probe.key) ? RAW_REGION_NUMBER_PATTERN.test(body) : false,
        excerpt: body.slice(0, 600),
      };
      routeReport.ok = matched.every(Boolean)
        && !routeReport.has_question_marks
        && !routeReport.internal_tokens_visible
        && !routeReport.raw_region_numbers_visible;

      if (probe.key === 'asset') {
        const modelLink = page.locator('[data-testid="asset-3d-model-link"]').first();
        routeReport.asset_3d_model_link = {
          visible: await modelLink.isVisible({ timeout: 5000 }).catch(() => false),
          href: await modelLink.getAttribute('href').catch(() => ''),
          target: await modelLink.getAttribute('target').catch(() => ''),
          text: await modelLink.innerText().catch(() => ''),
        };
        routeReport.ok = routeReport.ok
          && routeReport.asset_3d_model_link.visible
          && routeReport.asset_3d_model_link.href === 'https://sjleeigisam-ra-ieo.github.io/drawer/'
          && routeReport.asset_3d_model_link.target === '_blank'
          && /자산\s*3D\s*모델\s*열기/u.test(routeReport.asset_3d_model_link.text || '');
      }

      if (probe.key === 'work_platform_news') {
        const today = kstDateKey();
        const newsSection = page.locator('section', { has: page.locator('h2', { hasText: '\uB370\uC77C\uB9AC \uBB3C\uB958 \uB274\uC2A4' }) }).first();
        const dateInput = newsSection.locator('input[type="date"]').first();
        await dateInput.waitFor({ state: 'visible', timeout: 10000 }).catch(() => null);
        const prevButton = newsSection.locator('button[aria-label="\uC774\uC804 \uB0A0\uC9DC \uB274\uC2A4"]').first();
        const nextButton = newsSection.locator('button[aria-label="\uB2E4\uC74C \uB0A0\uC9DC \uB274\uC2A4"]').first();
        const dateControlVisible = await dateInput.isVisible({ timeout: 1000 }).catch(() => false);
        const initialDate = dateControlVisible ? await dateInput.inputValue() : '';
        const maxDate = dateControlVisible ? await dateInput.getAttribute('max') : '';
        const todayNextDisabled = await nextButton.isDisabled().catch(() => false);
        if (dateControlVisible) {
          await Promise.all([
            page.waitForFunction((expected) => document.querySelector('input[type="date"]')?.value === expected, addDateDays(initialDate, -1), { timeout: 10000 }).catch(() => null),
            prevButton.click(),
          ]);
        }
        const previousDate = dateControlVisible ? await dateInput.inputValue() : '';
        const previousBody = dateControlVisible ? await newsSection.innerText({ timeout: 5000 }).catch(() => '') : '';
        const afterPreviousNextDisabled = dateControlVisible ? await nextButton.isDisabled().catch(() => true) : true;
        if (dateControlVisible && !afterPreviousNextDisabled) {
          await Promise.all([
            page.waitForFunction((expected) => document.querySelector('input[type="date"]')?.value === expected, initialDate, { timeout: 10000 }).catch(() => null),
            nextButton.click(),
          ]);
        }
        const restoredDate = dateControlVisible ? await dateInput.inputValue() : '';
        const sectionText = await newsSection.innerText({ timeout: 5000 }).catch(() => '');
        const publisherDatePairs = dateControlVisible ? await newsSection.locator('a').evaluateAll((nodes) => nodes.map((node) => {
          const text = node.textContent || '';
          return /[\uAC00-\uD7A3A-Za-z0-9.\s]+(?:\uB274\uC2A4|\uC77C\uBCF4|\uC2E0\uBB38|\uACBD\uC81C|\uD22C\uB370\uC774|\uB370\uC77C\uB9AC|TV|\uBC29\uC1A1|\uD1B5\uC2E0)?\s+\d{2}\.\s*\d{2}\./u.test(text);
        }).slice(0, 10)).catch(() => []) : [];
        const dateControls = {
          visible: dateControlVisible,
          initial_date: initialDate,
          max_date: maxDate,
          today_next_disabled: todayNextDisabled,
          after_previous_next_disabled: afterPreviousNextDisabled,
          previous_date: previousDate,
          restored_date: restoredDate,
          empty_state_ok: /\uC218\uC9D1\uB41C \uB274\uC2A4\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4\.|\uB274\uC2A4\uB97C \uBD88\uB7EC\uC624\uB294 \uC911\uC785\uB2C8\uB2E4\./u.test(previousBody) || previousBody.length > 0,
          important_badge_absent: !/\b\uC911\uC694\b/u.test(sectionText),
          publisher_date_pairs_ok: !publisherDatePairs.length || publisherDatePairs.every(Boolean),
        };
        dateControls.ok = dateControls.visible
          && dateControls.initial_date === today
          && dateControls.max_date === today
          && dateControls.today_next_disabled
          && !dateControls.after_previous_next_disabled
          && dateControls.previous_date === addDateDays(initialDate, -1)
          && dateControls.restored_date === initialDate
          && dateControls.empty_state_ok
          && dateControls.important_badge_absent
          && dateControls.publisher_date_pairs_ok;
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
