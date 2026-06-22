const fs = require('fs');
const http = require('http');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT_DIR = path.join(ROOT, 'qa-artifacts', 'logistics-gate6');
const DEFAULT_PORT = 4192;
const DEFAULT_BASE_PATH = '/logistics-gate6-preview/';
const LEGACY_TEXT = [
  'The Engine',
  'The Steering Wheel',
  'Inside IFPDP',
  'Execution Plan',
  'AI Peer Review',
  'Core Detail Page Draft',
];
const ROUTES = [
  '',
  'home',
  'action-plan',
  'system-plan',
  'system-bridge',
  'system-chat',
  'system-detail',
  'system-core',
  'platform',
  'platform/iotaseoul',
  'platform/iotaseoul/workspace/logistics/dashboard/home',
];

function argsValue(name, fallback = '') {
  const flag = `--${name}`;
  const index = process.argv.indexOf(flag);
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
  const url = new URL(String(route || '').replace(/^\/+/u, ''), normalizedBase);
  if (hasFlag('cache-bust')) url.searchParams.set('qa_cache_bust', timestampForFile());
  return url.toString();
}

function requestUrl(url) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      res.resume();
      res.on('end', () => resolve({ ok: res.statusCode >= 200 && res.statusCode < 400, status: res.statusCode }));
    });
    req.on('error', (error) => resolve({ ok: false, status: 0, error: error.message }));
    req.setTimeout(1000, () => {
      req.destroy();
      resolve({ ok: false, status: 0, error: 'timeout' });
    });
  });
}

async function waitForServer(url, timeoutMs = 45000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const result = await requestUrl(url);
    if (result.ok) return result;
    await new Promise((resolve) => setTimeout(resolve, 600));
  }
  throw new Error(`Preview server did not become ready: ${url}`);
}

function startPreviewServer(port) {
  if (argsValue('base-url')) return null;
  const child = process.platform === 'win32'
    ? spawn('cmd.exe', ['/d', '/s', '/c', `npx vite preview --host 127.0.0.1 --port ${port} --strictPort`], {
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    : spawn('npx', ['vite', 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  return { child };
}

function stopPreviewServer(preview) {
  if (!preview?.child?.pid) return;
  if (process.platform === 'win32') {
    spawnSync('taskkill.exe', ['/pid', String(preview.child.pid), '/t', '/f'], { stdio: 'ignore' });
    return;
  }
  preview.child.kill();
}

function chromeExecutablePath() {
  return [
    process.env.CHROME_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ].filter(Boolean).find((candidate) => fs.existsSync(candidate)) || undefined;
}

function normalizeActionFromPostData(postData) {
  if (!postData) return '';
  try {
    const body = JSON.parse(postData);
    return String(body?.action || body?.body?.action || '');
  } catch {
    return '';
  }
}

function contentTypeForAsset(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.js') return 'application/javascript; charset=utf-8';
  if (ext === '.css') return 'text/css; charset=utf-8';
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.svg') return 'image/svg+xml';
  return 'application/octet-stream';
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const stamp = timestampForFile();
  const outJson = path.join(OUT_DIR, `legacy-intro-block-smoke-${stamp}.json`);
  const latestJson = path.join(OUT_DIR, 'legacy-intro-block-smoke-latest.json');
  const port = Number(argsValue('port', DEFAULT_PORT));
  const baseUrl = argsValue('base-url') || `http://127.0.0.1:${port}${DEFAULT_BASE_PATH}`;
  const preview = startPreviewServer(port);
  let browser;
  try {
    if (preview) await waitForServer(baseUrl);
    browser = await chromium.launch({ headless: true, executablePath: chromeExecutablePath() });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, serviceWorkers: 'block' });
    await context.route('**/logistics-gate6-preview/assets/**', async (route) => {
      const url = new URL(route.request().url());
      const assetName = path.basename(url.pathname);
      const assetPath = path.join(ROOT, 'dist', 'assets', assetName);
      if (!fs.existsSync(assetPath)) {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: contentTypeForAsset(assetPath),
        body: fs.readFileSync(assetPath),
      });
    });
    await context.route('**/functions/v1/ll-dashboard-api', async (route) => {
      const action = normalizeActionFromPostData(route.request().postData());
      if (action === 'auth/me') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: true,
            data: {
              id: 'qa-user',
              email: 'kylee@igisam.com',
              permission_email: 'kylee@igisam.com',
              staff_name: 'QA User',
              name: 'QA User',
              organization: 'QA',
              logistics_role: 'Admin',
              feature_permissions: {},
            },
          }),
        });
        return;
      }
      await route.continue();
    });
    await context.addInitScript(() => {
      const now = Math.round(Date.now() / 1000);
      const base64Url = (value) => btoa(JSON.stringify(value))
        .replace(/\+/gu, '-')
        .replace(/\//gu, '_')
        .replace(/=+$/gu, '');
      const accessToken = `${base64Url({ alg: 'none', typ: 'JWT' })}.${base64Url({
        iss: 'https://qvegpozwrcmspdvjokiz.supabase.co/auth/v1',
        sub: 'qa-user',
        aud: 'authenticated',
        exp: now + 3600,
        iat: now,
        email: 'kylee@igisam.com',
        role: 'authenticated',
      })}.qa`;
      const session = {
        access_token: accessToken,
        refresh_token: 'qa-refresh-token',
        token_type: 'bearer',
        expires_in: 3600,
        expires_at: now + 3600,
        user: {
          id: 'qa-user',
          aud: 'authenticated',
          role: 'authenticated',
          email: 'kylee@igisam.com',
          app_metadata: { provider: 'email', providers: ['email'] },
          user_metadata: { email: 'kylee@igisam.com' },
        },
      };
      sessionStorage.setItem('sb-iota-auth-token', JSON.stringify(session));
      sessionStorage.setItem('logistics_preview_auth', JSON.stringify({ email: 'kylee@igisam.com' }));
      localStorage.setItem('logisticsDashboardReadMode', 'primary-safe');
      sessionStorage.setItem('iotaLeftNavCollapsed', 'true');
    });
    const page = await context.newPage();
    const browserLogs = [];
    page.on('console', (message) => browserLogs.push({
      type: 'console',
      level: message.type(),
      text: message.text().slice(0, 700),
    }));
    page.on('pageerror', (error) => browserLogs.push({
      type: 'pageerror',
      text: String(error.message || error).slice(0, 700),
    }));
    page.on('requestfailed', (request) => browserLogs.push({
      type: 'requestfailed',
      url: request.url(),
      failure: request.failure()?.errorText || '',
    }));
    const routeReports = [];
    for (const route of ROUTES) {
      const url = joinUrl(baseUrl, route);
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(1800);
      const body = await page.locator('body').innerText({ timeout: 10000 }).catch(() => '');
      const foundLegacyText = LEGACY_TEXT.filter((text) => body.includes(text));
      const hasLogisticsShell = /Work Platform|Home|Daily|Market Data|Data Management|Investment Index|자산|물류|데일리|워크플랫폼/iu.test(body);
      routeReports.push({
        route: route || '(base)',
        final_url: page.url(),
        found_legacy_text: foundLegacyText,
        has_logistics_shell: hasLogisticsShell,
        ok: foundLegacyText.length === 0 && hasLogisticsShell,
        excerpt: body.slice(0, 500),
      });
    }
    const report = {
      ok: routeReports.every((item) => item.ok),
      generated_at: new Date().toISOString(),
      base_url: baseUrl,
      browser_logs: browserLogs,
      checked_routes: routeReports,
    };
    fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    fs.writeFileSync(latestJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    console.log(`legacy intro block smoke ${report.ok ? 'PASS' : 'FAIL'}: ${path.relative(ROOT, outJson)}`);
    if (!report.ok) process.exitCode = 1;
    await context.close();
  } finally {
    if (browser) await browser.close().catch(() => {});
    stopPreviewServer(preview);
  }
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
