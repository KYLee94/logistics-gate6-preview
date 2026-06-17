const fs = require('fs');
const http = require('http');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..', '..');
const BASE_PATH = '/logistics-gate6-preview/';
const DEFAULT_PORT = 4184;
const OUT_DIR = path.join(ROOT, 'qa-artifacts', 'logistics-gate6', 'map-callout-20260615');

function argsValue(name, fallback = '') {
  const flag = `--${name}`;
  const index = process.argv.indexOf(flag);
  return index === -1 ? fallback : (process.argv[index + 1] || fallback);
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
  const child = process.platform === 'win32'
    ? spawn('cmd.exe', ['/d', '/s', '/c', `npx vite preview --host 127.0.0.1 --port ${port} --strictPort`], {
      cwd: ROOT,
      env: { ...process.env },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    : spawn('npx', ['vite', 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
      cwd: ROOT,
      env: { ...process.env },
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
  const candidates = [
    process.env.CHROME_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ].filter(Boolean);
  return candidates.find((candidate) => fs.existsSync(candidate)) || undefined;
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

function normalizeActionFromPostData(postData) {
  if (!postData) return '';
  try {
    const body = JSON.parse(postData);
    return String(body?.action || '');
  } catch {
    return '';
  }
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const port = Number(argsValue('port', DEFAULT_PORT));
  const baseUrl = `http://127.0.0.1:${port}${BASE_PATH}`;
  const preview = startPreviewServer(port);
  let browser;
  try {
    await waitForServer(baseUrl);
    browser = await chromium.launch({
      headless: true,
      executablePath: chromeExecutablePath(),
    });
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1100 },
      deviceScaleFactor: 1,
      serviceWorkers: 'block',
    });
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
              staff_name: 'QA 사용자',
              name: 'QA 사용자',
              organization: 'QA',
              logistics_role: 'Admin',
              feature_permissions: {},
            },
          }),
        });
        return;
      }
      if (action === 'naver/maps-config') {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ ok: false, message: 'QA forces Leaflet fallback for deterministic geometry check.' }),
        });
        return;
      }
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ ok: false, message: `QA blocked ${action || 'unknown action'}.` }),
      });
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
      sessionStorage.setItem('sb-iota-auth-token', JSON.stringify({
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
      }));
      localStorage.setItem('logisticsDashboardReadMode', 'off');
      sessionStorage.setItem('iotaLeftNavCollapsed', 'true');
    });
    const page = await context.newPage();
    const browserLogs = [];
    page.on('console', (message) => {
      browserLogs.push({ type: 'console', level: message.type(), text: message.text().slice(0, 500) });
    });
    page.on('pageerror', (error) => {
      browserLogs.push({ type: 'pageerror', text: String(error.message || error).slice(0, 500) });
    });
    page.on('requestfailed', (request) => {
      browserLogs.push({
        type: 'requestfailed',
        url: request.url(),
        failure: request.failure()?.errorText || '',
      });
    });
    await page.goto(`${baseUrl}home?dashboardReadMode=off`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(3000);
    if (await page.locator('.logistics-map-canvas').count() === 0) {
      const debugScreenshotPath = path.join(OUT_DIR, 'home-map-callout-debug.png');
      const bodyText = await page.locator('body').innerText({ timeout: 5000 }).catch(() => '');
      await page.screenshot({ path: debugScreenshotPath, fullPage: true }).catch(() => {});
      fs.writeFileSync(path.join(OUT_DIR, 'home-map-callout-debug.txt'), [
        `url=${page.url()}`,
        '',
        'logs=',
        JSON.stringify(browserLogs, null, 2),
        '',
        bodyText.slice(0, 4000),
      ].join('\n'), 'utf8');
      throw new Error('Map canvas was not rendered. See qa-artifacts/logistics-gate6/map-callout-20260615/home-map-callout-debug.*');
    }
    await page.locator('.logistics-map-canvas').first().waitFor({ state: 'visible', timeout: 25000 });
    await page.locator('.leaflet-marker-icon').first().waitFor({ state: 'visible', timeout: 25000 });
    await page.locator('section:has(.logistics-map-canvas) table tbody tr').first().click({ timeout: 15000 });
    await page.locator('.logistics-map-callout').first().waitFor({ state: 'visible', timeout: 15000 });
    await page.waitForTimeout(500);

    const geometry = await page.evaluate(() => {
      const callout = document.querySelector('.logistics-map-callout');
      const markers = [...document.querySelectorAll('.leaflet-marker-icon')];
      if (!callout || !markers.length) return null;
      const calloutBox = callout.getBoundingClientRect();
      const calloutCenterX = calloutBox.left + calloutBox.width / 2;
      const markerCandidates = markers.map((marker) => {
        const box = marker.getBoundingClientRect();
        const pinX = box.left + box.width / 2;
        const pinY = box.top + box.height;
        return {
          pinX,
          pinY,
          markerTop: box.top,
          markerHeight: box.height,
          centerDeltaX: Math.abs(calloutCenterX - pinX),
          verticalGapFromPin: pinY - calloutBox.bottom,
        };
      }).sort((left, right) => (
        left.centerDeltaX - right.centerDeltaX
        || Math.abs(left.verticalGapFromPin) - Math.abs(right.verticalGapFromPin)
      ));
      const marker = markerCandidates[0];
      return {
        callout: {
          left: calloutBox.left,
          top: calloutBox.top,
          width: calloutBox.width,
          height: calloutBox.height,
          centerX: calloutCenterX,
          bottom: calloutBox.bottom,
        },
        marker,
        center_delta_x: marker.centerDeltaX,
        vertical_gap_from_pin: marker.verticalGapFromPin,
        pass_centered: marker.centerDeltaX <= 12,
        pass_above_pin: marker.verticalGapFromPin >= 8,
      };
    });

    const screenshotPath = path.join(OUT_DIR, 'home-map-callout.png');
    await page.screenshot({ path: screenshotPath, fullPage: false });
    const report = {
      ok: Boolean(geometry?.pass_centered && geometry?.pass_above_pin),
      checked_at: new Date().toISOString(),
      url: page.url(),
      geometry,
      screenshot: path.relative(ROOT, screenshotPath).replace(/\\/gu, '/'),
    };
    fs.writeFileSync(path.join(OUT_DIR, 'home-map-callout.json'), JSON.stringify(report, null, 2), 'utf8');
    console.log(JSON.stringify(report, null, 2));
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
