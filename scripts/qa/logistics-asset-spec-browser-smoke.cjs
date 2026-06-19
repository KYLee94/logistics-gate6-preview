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
  const outJson = path.join(OUT_DIR, `asset-spec-browser-smoke-${stamp}.json`);
  const latestJson = path.join(OUT_DIR, 'asset-spec-browser-smoke-latest.json');
  const screenshot = path.join(OUT_DIR, `asset-spec-browser-smoke-${stamp}.png`);
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
    await page.goto(joinUrl(baseUrl, 'asset-spec'), { waitUntil: 'domcontentloaded', timeout: 60000 });
    report.checks.shell_ready = await page.getByText('자산 스펙 데이터 입력').waitFor({ timeout: 90000 }).then(() => true).catch(() => false);
    report.checks.error_hidden = (await page.locator('text=Dashboard read blocked').count().catch(() => 0)) === 0;
    report.checks.input_cta_present = (await page.getByRole('button', { name: '데이터 입력' }).count().catch(() => 0)) > 0;
    report.checks.compare_tables_present = (await page.locator('[data-sortable-table="true"]').count().catch(() => 0)) >= 2;
    report.checks.component_submessages_removed = await page.evaluate(() => {
      const text = document.body?.innerText || '';
      return !text.includes('권한이 있는 자산만 선택해')
        && !text.includes('비교할 두 자산을 선택해')
        && !text.includes('선택한 두 임차인의 점유 자산 스펙');
    }).catch(() => false);
    report.checks.core_rows_visible = await page.waitForFunction(() => {
      const text = document.body?.innerText || '';
      return text.includes('주소') && text.includes('GFA(㎡)') && text.includes('소방설비');
    }, { timeout: 10000 }).then(() => true).catch(() => false);
    report.checks.table_view_buttons = (await page.getByRole('button', { name: '테이블 보기' }).count().catch(() => 0)) >= 2;

    const firstTableButton = page.getByRole('button', { name: '테이블 보기' }).first();
    if ((await firstTableButton.count().catch(() => 0)) > 0) {
      await firstTableButton.click();
      report.checks.full_table_modal = await page.locator('[role="dialog"] [data-sortable-table="true"]').waitFor({ timeout: 10000 }).then(() => true).catch(() => false);
      report.checks.full_table_modal_fullscreen = await page.locator('[role="dialog"] > div').first().evaluate((node) => {
        const box = node.getBoundingClientRect();
        return box.width >= window.innerWidth * 0.9 && box.height >= window.innerHeight * 0.85;
      }).catch(() => false);
      await page.locator('[role="dialog"] button').filter({ hasText: '×' }).click().catch(() => null);
    }

    await page.getByRole('button', { name: '데이터 입력' }).click();
    report.checks.input_modal_open = await page.locator('[role="dialog"]').waitFor({ timeout: 10000 }).then(() => true).catch(() => false);
    report.checks.input_modal_fullscreen = await page.locator('[role="dialog"] > div').first().evaluate((node) => {
      const box = node.getBoundingClientRect();
      return box.width >= window.innerWidth * 0.9 && box.height >= window.innerHeight * 0.85;
    }).catch(() => false);
    report.checks.permission_asset_select = (await page.locator('[role="dialog"] select option').count().catch(() => 0)) > 0;
    report.checks.input_rows_5_53 = await page.waitForFunction(() => {
      const text = document.querySelector('[role="dialog"]')?.innerText || '';
      return text.includes('주소') && text.includes('소방설비') && text.includes('53');
    }, { timeout: 10000 }).then(() => true).catch(() => false);
    report.checks.save_delete_controls = await page.waitForFunction(() => {
      const text = document.querySelector('[role="dialog"]')?.innerText || '';
      return text.includes('Supabase 저장') && text.includes('선택 자산 스펙 삭제');
    }, { timeout: 10000 }).then(() => true).catch(() => false);
    await page.screenshot({ path: screenshot, fullPage: false });
    report.ok = Object.values(report.checks).every(Boolean) && report.errors.length === 0;
    await context.close();
  } catch (error) {
    report.errors.push(error instanceof Error ? error.message : String(error));
  } finally {
    if (browser) await browser.close().catch(() => null);
    fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`);
    fs.writeFileSync(latestJson, `${JSON.stringify(report, null, 2)}\n`);
  }

  console.log(`asset spec browser smoke ${report.ok ? 'PASS' : 'FAIL'}: ${path.relative(ROOT, outJson)}`);
  if (!report.ok) {
    console.log(JSON.stringify(report.checks, null, 2));
    if (report.errors.length) console.error(report.errors.join('\n'));
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
