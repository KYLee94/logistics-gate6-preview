const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT_DIR = path.join(ROOT, 'qa-artifacts', 'logistics-gate6');
const DEFAULT_BASE_URL = 'https://kylee94.github.io/logistics-gate6-preview/';
const DEFAULT_ROUTE = 'work-platform';
const DEFAULT_QUESTION = '안성 성은 물류센터 임대 현황 알려줘';

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

function normalizeActionFromPostData(postData) {
  if (!postData) return '';
  try {
    const body = JSON.parse(postData);
    return String(body?.action || '');
  } catch {
    return '';
  }
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
  const outJson = path.join(OUT_DIR, `ai-chatbot-browser-smoke-${stamp}.json`);
  const latestJson = path.join(OUT_DIR, 'ai-chatbot-browser-smoke-latest.json');
  const screenshotPath = path.join(OUT_DIR, `ai-chatbot-browser-smoke-${stamp}.png`);
  const baseUrl = argsValue('base-url', DEFAULT_BASE_URL);
  const route = argsValue('route', DEFAULT_ROUTE);
  const question = argsValue('question', DEFAULT_QUESTION);
  const targetUrl = joinUrl(baseUrl, route);
  const auth = await signInSession();
  const uiEmail = argsValue('ui-email', envValue('LOGISTICS_BROWSER_UI_EMAIL') || 'kylee@igisam.com');
  const browserSession = {
    ...auth.session,
    user: {
      ...(auth.session.user || {}),
      email: uiEmail,
    },
  };
  const requests = [];
  const responses = [];
  const startedAt = Date.now();
  let browser;
  let page;
  const result = {
    ok: false,
    generated_at: new Date().toISOString(),
    url: targetUrl,
    question,
    auth_source: auth.source,
    ui_email: uiEmail,
    duration_ms: 0,
    requests,
    responses,
    answer_excerpt: '',
    screenshot: path.relative(ROOT, screenshotPath).replace(/\\/gu, '/'),
  };
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
    page.on('request', (request) => {
      if (!request.url().includes('/functions/v1/ll-dashboard-api')) return;
      requests.push({
        method: request.method(),
        action: normalizeActionFromPostData(request.postData()),
        url: request.url().replace(/https:\/\/[^/]+\.supabase\.co/u, 'https://qvegpozwrcmspdvjokiz.redacted.supabase.co'),
      });
    });
    page.on('response', async (response) => {
      if (!response.url().includes('/functions/v1/ll-dashboard-api')) return;
      const item = {
        status: response.status(),
        action: normalizeActionFromPostData(response.request().postData()),
        body_ok: undefined,
        body_message: '',
      };
      responses.push(item);
      try {
        const text = await response.text();
        const body = text ? JSON.parse(text) : null;
        item.body_ok = body?.ok;
        item.body_message = String(body?.message || body?.error || body?.answer || '').slice(0, 220);
      } catch {
        item.body_message = 'unreadable response body';
      }
    });
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.getByTestId('logistics-ai-dock-open').waitFor({ state: 'visible', timeout: 60000 });
    await page.getByTestId('logistics-ai-dock-open').click();
    await page.getByTestId('logistics-ai-input').fill(question);
    await page.getByTestId('logistics-ai-submit').click();
    await page.waitForFunction(() => document.body.innerText.includes('답변 생성 중...'), null, { timeout: 8000 }).catch(() => {});
    await page.waitForFunction(() => {
      const text = document.body.innerText;
      return text.includes('안성 성은지구 물류센터') && text.includes('임대면적은') && !text.includes('답변 생성 중...');
    }, null, { timeout: 45000 });
    const bodyText = await page.locator('body').innerText({ timeout: 10000 });
    await page.screenshot({ path: screenshotPath, fullPage: true });
    const aiResponse = responses.find((response) => response.status === 200 && response.body_ok === true && /안성 성은지구/u.test(response.body_message));
    const failedResponse = responses.find((response) => response.status >= 400 || response.body_ok === false);
    if (!aiResponse) throw new Error('AI chat response was not observed in browser network responses.');
    if (failedResponse) throw new Error(`AI browser smoke saw failed Edge response: ${JSON.stringify(failedResponse)}`);
    const answerStart = bodyText.indexOf(aiResponse.body_message.slice(0, 30));
    result.answer_excerpt = aiResponse.body_message || (answerStart >= 0 ? bodyText.slice(answerStart, answerStart + 500) : bodyText.slice(-500));
    result.ok = true;
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
    if (page) {
      await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => {});
      result.body_excerpt = await page.locator('body').innerText({ timeout: 3000 }).then((text) => text.slice(-1000)).catch(() => '');
    }
  } finally {
    result.duration_ms = Date.now() - startedAt;
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
