const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT_DIR = path.join(ROOT, 'qa-artifacts', 'logistics-gate6');
const DEFAULT_BASE_URL = 'https://kylee94.github.io/logistics-gate6-preview/';
const DEFAULT_ROUTE = '?p=contract-data';

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

function excelColumnIndex(letter) {
  return String(letter || '').toUpperCase().split('').reduce((sum, char) => sum * 26 + char.charCodeAt(0) - 64, 0);
}

function excelColumnName(index) {
  let current = index;
  let name = '';
  while (current > 0) {
    const remainder = (current - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    current = Math.floor((current - 1) / 26);
  }
  return name;
}

function excelColumnRange(start, end) {
  const startIndex = excelColumnIndex(start);
  const endIndex = excelColumnIndex(end);
  return Array.from({ length: endIndex - startIndex + 1 }, (_, offset) => excelColumnName(startIndex + offset));
}

function dataUpdateFieldCoverage() {
  const sourcePath = path.join(ROOT, 'src', 'components', 'system', 'workspace', 'WorkspaceLogistics.jsx');
  const source = fs.readFileSync(sourcePath, 'utf8');
  const expected = {
    'DB_일반': [...excelColumnRange('B', 'S'), ...excelColumnRange('U', 'Z'), ...excelColumnRange('AA', 'CF')],
    'DB_히스토리 누적': excelColumnRange('B', 'S'),
  };
  const found = {
    'DB_일반': new Set(),
    'DB_히스토리 누적': new Set(),
  };
  source.split(/\r?\n/u).forEach((line) => {
    if (!line.includes('sourceColumnLetter') || !line.includes('domain')) return;
    const domain = line.match(/domain: '([^']+)'/u)?.[1];
    const column = line.match(/sourceColumnLetter: '([^']+)'/u)?.[1];
    if (domain && column && found[domain]) found[domain].add(column);
  });
  const sheets = Object.fromEntries(Object.entries(expected).map(([sheet, columns]) => {
    const foundColumns = found[sheet] || new Set();
    const missing = columns.filter((column) => !foundColumns.has(column));
    return [sheet, {
      expected_count: columns.length,
      found_count: foundColumns.size,
      missing_columns: missing,
      ok: missing.length === 0,
    }];
  }));
  return {
    ok: Object.values(sheets).every((sheet) => sheet.ok),
    sheets,
  };
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
      email: user.email || envValue('LOGISTICS_SUPABASE_EMAIL', 'LOGISTICS_SUPABASE_AUTH_EMAIL'),
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
  return { session, email, source: 'password_grant' };
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const stamp = timestampForFile();
  const outJson = path.join(OUT_DIR, `data-update-browser-smoke-${stamp}.json`);
  const latestJson = path.join(OUT_DIR, 'data-update-browser-smoke-latest.json');
  const screenshotPath = path.join(OUT_DIR, `data-update-browser-smoke-${stamp}.png`);
  const baseUrl = argsValue('base-url', DEFAULT_BASE_URL);
  const route = argsValue('route', DEFAULT_ROUTE);
  const targetUrl = joinUrl(baseUrl, route);
  const auth = await signInSession();
  const sourceFieldCoverage = dataUpdateFieldCoverage();
  const uiEmail = argsValue('ui-email', envValue('LOGISTICS_BROWSER_UI_EMAIL') || 'kylee@igisam.com');
  const browserSession = {
    ...auth.session,
    user: {
      ...(auth.session.user || {}),
      email: uiEmail,
    },
  };
  const errors = [];
  const resourceErrors = [];
  const corsWarnings = [];
  const result = {
    ok: false,
    generated_at: new Date().toISOString(),
    url: targetUrl,
    auth_source: auth.source,
    ui_email: uiEmail,
    required_text: ['Data Update', '임대차계약 데이터 관리', '현재 계약 원장', '원본 Excel 전체 필드 수정 요청'],
    forbidden_text: ['Contract Data', '원본 데이터 수정'],
    missing_text: [],
    forbidden_found: [],
    page_errors: errors,
    resource_errors: resourceErrors,
    cors_warnings: corsWarnings,
    source_field_coverage: sourceFieldCoverage,
    mode_checks: {},
    screenshot: path.relative(ROOT, screenshotPath).replace(/\\/gu, '/'),
  };
  let browser;
  let page;
  try {
    browser = await chromium.launch({ headless: true, executablePath: chromeExecutablePath() });
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1100 },
      deviceScaleFactor: 1,
      serviceWorkers: 'block',
    });
    await context.addInitScript(({ email, session }) => {
      sessionStorage.setItem('sb-iota-auth-token', JSON.stringify(session));
      sessionStorage.setItem('logistics_preview_auth', JSON.stringify({ email }));
      localStorage.setItem('logisticsDashboardReadMode', 'primary-safe');
    }, { email: uiEmail, session: browserSession });
    page = await context.newPage();
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() !== 'error') return;
      const text = message.text();
      if (/blocked by CORS policy/iu.test(text)) corsWarnings.push(text);
      else if (/Failed to load resource/iu.test(text)) resourceErrors.push(text);
      else errors.push(text);
    });
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => document.body.innerText.includes('Data Update'), null, { timeout: 45000 });
    let bodyText = await page.locator('body').innerText({ timeout: 10000 });
    result.missing_text = result.required_text.filter((text) => !bodyText.includes(text));
    result.forbidden_found = result.forbidden_text.filter((text) => bodyText.includes(text));

    await page.getByRole('button', { name: /계약 구역 추가/u }).first().click();
    await page.waitForFunction(() => document.body.innerText.includes('원본 Excel 전체 필드 추가 요청'), null, { timeout: 10000 });
    const addModeText = await page.locator('body').innerText({ timeout: 10000 });
    result.mode_checks.add_mode = {
      ok: addModeText.includes('원본 Excel 전체 필드 추가 요청') && addModeText.includes('예시') && addModeText.includes('입력값'),
      has_example_column: addModeText.includes('예시'),
      has_input_column: addModeText.includes('입력값'),
    };

    await page.getByRole('button', { name: /계약 구역 삭제/u }).first().click();
    await page.waitForFunction(() => document.body.innerText.includes('정말 삭제하시겠습니까? 삭제된 내용은 별도 저장 공간에 아카이빙됩니다.'), null, { timeout: 10000 });
    const deleteModeText = await page.locator('body').innerText({ timeout: 10000 });
    result.mode_checks.delete_modal = {
      ok: deleteModeText.includes('정말 삭제하시겠습니까? 삭제된 내용은 별도 저장 공간에 아카이빙됩니다.')
        && deleteModeText.includes('예')
        && deleteModeText.includes('아니오'),
      has_archive_message: deleteModeText.includes('정말 삭제하시겠습니까? 삭제된 내용은 별도 저장 공간에 아카이빙됩니다.'),
      has_yes_no: deleteModeText.includes('예') && deleteModeText.includes('아니오'),
    };
    await page.getByRole('button', { name: '아니오' }).click();

    await page.getByRole('button', { name: /계약 구역 수정/u }).first().click();
    await page.waitForFunction(() => document.body.innerText.includes('원본 Excel 전체 필드 수정 요청'), null, { timeout: 10000 });
    bodyText = await page.locator('body').innerText({ timeout: 10000 });
    await page.screenshot({ path: screenshotPath, fullPage: true });
    result.body_excerpt = bodyText.slice(0, 1200);
    result.ok = result.missing_text.length === 0
      && result.forbidden_found.length === 0
      && result.page_errors.length === 0
      && sourceFieldCoverage.ok
      && result.mode_checks.add_mode.ok
      && result.mode_checks.delete_modal.ok;
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
    if (page) {
      await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => {});
      const bodyText = await page.locator('body').innerText({ timeout: 3000 }).catch(() => '');
      result.missing_text = result.required_text.filter((text) => !bodyText.includes(text));
      result.forbidden_found = result.forbidden_text.filter((text) => bodyText.includes(text));
      result.body_excerpt = bodyText.slice(0, 1200);
    }
  } finally {
    if (browser) await browser.close();
    fs.writeFileSync(outJson, JSON.stringify(result, null, 2), 'utf8');
    fs.writeFileSync(latestJson, JSON.stringify(result, null, 2), 'utf8');
  }
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
