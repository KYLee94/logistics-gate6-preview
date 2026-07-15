const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT_DIR = path.join(ROOT, 'qa-artifacts', 'logistics-gate6');
const DEFAULT_BASE_URL = 'https://kylee94.github.io/logistics-gate6-preview/';
const DEFAULT_ROUTE = '?p=platform/iotaseoul/workspace/logistics';

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  return Object.fromEntries(fs.readFileSync(filePath, 'utf8').split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => {
      const index = line.indexOf('=');
      return [line.slice(0, index).trim(), line.slice(index + 1).trim().replace(/^['"]|['"]$/gu, '')];
    }));
}

const fileEnv = { ...readEnvFile(path.join(ROOT, '.env')), ...readEnvFile(path.join(ROOT, '.env.local')) };
function envValue(...keys) {
  for (const key of keys) {
    if (process.env[key]) return process.env[key];
    if (fileEnv[key]) return fileEnv[key];
  }
  return '';
}
function argsValue(name, fallback = '') {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : (process.argv[index + 1] || fallback);
}
function timestampForFile() {
  return new Date().toISOString().replace(/[-:]/gu, '').replace(/\..+$/u, '').replace('T', '-');
}
function chromeExecutablePath() {
  return [process.env.CHROME_PATH, 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe']
    .filter(Boolean).find((candidate) => fs.existsSync(candidate));
}
function joinUrl(baseUrl, route) {
  return new URL(route.replace(/^\/+ /u, '').replace(/^\/+/, ''), baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`).toString();
}

async function signInSession() {
  const supabaseUrl = envValue('LOGISTICS_SUPABASE_URL', 'VITE_SUPABASE_URL');
  const anonKey = envValue('LOGISTICS_SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY');
  const accessToken = envValue('LOGISTICS_SUPABASE_ACCESS_TOKEN');
  if (!supabaseUrl || !anonKey) throw new Error('Supabase URL/anon key가 없습니다.');
  if (accessToken) {
    const response = await fetch(`${supabaseUrl.replace(/\/$/u, '')}/auth/v1/user`, { headers: { apikey: anonKey, authorization: `Bearer ${accessToken}` } });
    const user = await response.json().catch(() => null);
    if (response.ok && user?.id) return { access_token: accessToken, token_type: 'bearer', expires_in: 3600, expires_at: Math.round(Date.now() / 1000) + 3600, refresh_token: '', user };
  }
  const email = argsValue('email', envValue('LOGISTICS_SUPABASE_EMAIL', 'LOGISTICS_SUPABASE_AUTH_EMAIL'));
  const password = argsValue('password', envValue('LOGISTICS_SUPABASE_PASSWORD', 'LOGISTICS_SUPABASE_AUTH_PASSWORD'));
  if (!email || !password) throw new Error('실제 로그인 계정 정보가 없습니다.');
  const response = await fetch(`${supabaseUrl.replace(/\/$/u, '')}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: { apikey: anonKey, 'content-type': 'application/json' }, body: JSON.stringify({ email, password }),
  });
  const session = await response.json().catch(() => null);
  if (!response.ok || !session?.access_token || !session?.user?.id) throw new Error(`Supabase 로그인 실패 (${response.status})`);
  if (!session.expires_at && session.expires_in) session.expires_at = Math.round(Date.now() / 1000) + Number(session.expires_in);
  return session;
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const stamp = timestampForFile();
  const outJson = path.join(OUT_DIR, `work-platform-browser-smoke-${stamp}.json`);
  const latestJson = path.join(OUT_DIR, 'work-platform-browser-smoke-latest.json');
  const screenshotPath = path.join(OUT_DIR, `work-platform-browser-smoke-${stamp}.png`);
  const filterScreenshotPath = path.join(OUT_DIR, `work-platform-filter-dropdown-${stamp}.png`);
  const baseUrl = argsValue('base-url', DEFAULT_BASE_URL);
  const targetUrl = `${joinUrl(baseUrl, argsValue('route', DEFAULT_ROUTE))}&cb=${encodeURIComponent(stamp)}`;
  const session = await signInSession();
  const report = {
    ok: false,
    generated_at: new Date().toISOString(),
    url: targetUrl,
    auth_user_id: session.user.id,
    auth_email: String(session.user.email || '').replace(/^(.{2}).*(@.*)$/u, '$1***$2'),
    checks: {},
    api: [],
    errors: [],
    screenshot: path.relative(ROOT, screenshotPath).replace(/\\/gu, '/'),
    filter_screenshot: path.relative(ROOT, filterScreenshotPath).replace(/\\/gu, '/'),
  };
  let browser;
  try {
    browser = await chromium.launch({ headless: true, executablePath: chromeExecutablePath() });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' });
    await context.addInitScript((authSession) => {
      sessionStorage.setItem('sb-iota-auth-token', JSON.stringify(authSession));
      sessionStorage.setItem('logistics_preview_auth', JSON.stringify({ email: authSession.user.email }));
      localStorage.setItem('logisticsDashboardReadMode', 'primary-safe');
    }, session);
    const page = await context.newPage();
    page.on('pageerror', (error) => report.errors.push(`page: ${error.message}`));
    page.on('response', async (response) => {
      if (!response.url().includes('/functions/v1/ll-dashboard-api')) return;
      let action = '';
      try { action = JSON.parse(response.request().postData() || '{}').action || ''; } catch { /* ignore malformed QA observation */ }
      report.api.push({ action, status: response.status() });
      if (response.status() >= 500) report.errors.push(`edge ${response.status()} ${action || response.url()}`);
    });

    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    const board = page.getByTestId('logistics-task-board');
    await board.waitFor({ state: 'visible', timeout: 45000 });
    await page.getByTestId('logistics-news-ticker').waitFor({ state: 'visible', timeout: 30000 });
    await page.waitForFunction(() => !document.body.innerText.includes('업무 목록을 불러오는 중입니다.'), null, { timeout: 30000 });

    const bodyText = await page.locator('body').innerText();
    report.checks.brand_visible = bodyText.includes('IGIS Logistics Platform');
    report.checks.platform_title_visible = bodyText.includes('업무 플랫폼');
    report.checks.header_commands = bodyText.includes('관리 Project 현황') && bodyText.includes('담당 및 권한') && !bodyText.includes('데일리 물류 뉴스');
    report.checks.ai_hidden = !bodyText.includes('AI 챗봇') && !bodyText.includes('AI에게 질문');
    report.checks.task_board_visible = (await board.innerText()).includes('통합 업무 보드');
    const boardText = await board.innerText();
    report.checks.task_board_columns = ['프로젝트', '업무 분류', '업무 요약', '담당자', '이해관계자', '진행상황', '등록일'].every((label) => boardText.includes(label));
    await board.getByRole('button', { name: '업무 분류 필터', exact: true }).click();
    const categoryFilterMenu = page.getByTestId('task-board-filter-menu-category');
    await categoryFilterMenu.waitFor({ state: 'visible', timeout: 10000 });
    report.checks.task_board_filter_dark = await categoryFilterMenu.evaluate((menu) => getComputedStyle(menu).backgroundColor === 'rgb(21, 21, 21)');
    report.checks.task_board_filter_options = await categoryFilterMenu.getByRole('option').count() === 9;
    await page.screenshot({ path: filterScreenshotPath, fullPage: false });
    await page.keyboard.press('Escape');
    report.checks.task_board_filter_escape = await categoryFilterMenu.isHidden();
    report.checks.task_board_controls = boardText.includes('새 업무 추가') && !boardText.includes('간추려보기') && !boardText.includes('자세히보기') && !boardText.includes('20개씩 보기');
    report.checks.loading_cleared = !bodyText.includes('데이터 로딩 96%') && !boardText.includes('업무 목록을 불러오는 중입니다.');

    await page.getByTestId('logistics-news-expand').click();
    const newsList = page.getByTestId('logistics-news-list');
    await newsList.waitFor({ state: 'visible', timeout: 10000 });
    const newsItemCount = await newsList.locator('[data-news-item="true"]').count();
    report.news_item_count = newsItemCount;
    report.checks.news_dropdown = newsItemCount >= 1 && newsItemCount <= 10;
    report.checks.news_dropdown_no_scroll = await newsList.evaluate((element) => {
      const list = element.querySelector('ol');
      return Boolean(list) && getComputedStyle(list).overflowY !== 'auto' && getComputedStyle(list).overflowY !== 'scroll';
    });
    report.checks.news_date_control = await page.getByTestId('logistics-news-date-input').isVisible();
    await page.getByTestId('logistics-news-expand').click();

    await page.getByRole('button', { name: '관리 Project 현황' }).click();
    const projectDialog = page.getByRole('dialog').last();
    await projectDialog.waitFor({ state: 'visible', timeout: 30000 });
    const dialogText = await projectDialog.innerText();
    report.checks.project_large_table_default = dialogText.includes('자산명') && dialogText.includes('펀드명') && dialogText.includes('Main Issue') && !dialogText.includes('큰 표 보기');
    const projectEditButtonCount = await projectDialog.getByRole('button', { name: '수정', exact: true }).count();
    report.project_edit_available = projectEditButtonCount === 1;
    report.checks.project_edit_control_single = projectEditButtonCount <= 1;
    await projectDialog.getByRole('button', { name: '닫기', exact: true }).click();
    await projectDialog.waitFor({ state: 'hidden', timeout: 10000 });

    await page.screenshot({ path: screenshotPath, fullPage: false });
    report.checks.no_edge_5xx = !report.api.some((row) => row.status >= 500);
    report.checks.primary_apis_called = report.api.some((row) => row.action === 'work-platform/task-board/list') && report.api.some((row) => row.action === 'news/list');
    report.ok = Object.values(report.checks).every(Boolean) && report.errors.length === 0;
  } catch (error) {
    report.errors.push(error?.message || String(error));
  } finally {
    if (browser) await browser.close();
  }
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(latestJson, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`work-platform browser smoke ${report.ok ? 'PASS' : 'FAIL'}: ${path.relative(ROOT, outJson)}`);
  if (!report.ok) process.exit(1);
}

main().catch((error) => { console.error(error); process.exit(1); });
