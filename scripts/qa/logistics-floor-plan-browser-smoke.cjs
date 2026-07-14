const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT_DIR = path.join(ROOT, 'qa-artifacts', 'logistics-gate6');
const DEFAULT_BASE_URL = 'https://kylee94.github.io/logistics-gate6-preview/';
const VIEWPORT = { width: 1440, height: 900 };
const TARGETS = [
  {
    key: 'gyeongsan',
    assetId: 'asset_a120085001',
    assetName: '경산 쿠팡물류센터',
    floorLabel: 'B2',
  },
  {
    key: 'incheon',
    assetId: 'asset_a112721001',
    assetName: '인천석남물류센터',
    floorLabel: 'B1',
    expectedStackingFloors: ['B1', '1F', '2F', '3F', '4F', '5F', '6F', '7F', '8F'],
  },
];

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
  const index = process.argv.indexOf(`--${name}`);
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
  return new URL(route.replace(/^\/+|\/+$/gu, ''), normalizedBase).toString();
}

function safePublicUrl(value) {
  const url = new URL(value);
  url.search = '';
  url.hash = '';
  return url.toString();
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

function sanitizeError(value) {
  return String(value || 'Unknown error')
    .replace(/https?:\/\/[^\s)'"<>]+/giu, '[redacted-url]')
    .replace(/Bearer\s+[A-Za-z0-9._~-]+/giu, 'Bearer [redacted]')
    .replace(/[?&](?:token|apikey|access_token|refresh_token)=[^\s&)'"<>]+/giu, (match) => `${match.slice(0, match.indexOf('='))}=[redacted]`)
    .slice(0, 800);
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
      source: 'LOGISTICS_SUPABASE_ACCESS_TOKEN',
      session: {
        access_token: accessToken,
        token_type: 'bearer',
        expires_in: 3600,
        expires_at: Math.round(Date.now() / 1000) + 3600,
        refresh_token: '',
        user,
      },
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
  if (!session.expires_at && session.expires_in) {
    session.expires_at = Math.round(Date.now() / 1000) + Number(session.expires_in);
  }
  return { source: 'password_grant', session };
}

function recordImageResponse(responseByUrl, response) {
  const request = response.request();
  if (request.resourceType() !== 'image') return;
  const evidence = {
    status: response.status(),
    mime: String(response.headers()['content-type'] || '').split(';')[0].trim().toLowerCase(),
  };
  let current = request;
  while (current) {
    responseByUrl.set(current.url(), evidence);
    current = current.redirectedFrom();
  }
}

async function loadedImageEvidence(page, image, responseByUrl) {
  await image.waitFor({ state: 'visible', timeout: 60000 });
  const handle = await image.elementHandle();
  if (!handle) throw new Error('Floor-plan image element was not available.');
  await page.waitForFunction((node) => (
    node instanceof HTMLImageElement
      && node.complete
      && node.naturalWidth > 0
      && node.naturalHeight > 0
  ), handle, { timeout: 60000 });
  const state = await image.evaluate((node) => ({
    complete: node.complete,
    naturalWidth: node.naturalWidth,
    naturalHeight: node.naturalHeight,
    source: node.currentSrc || node.src,
  }));
  const network = responseByUrl.get(state.source);
  if (!network) throw new Error('No matching image network response was captured.');
  return {
    complete: state.complete,
    natural_width: state.naturalWidth,
    natural_height: state.naturalHeight,
    response_status: network.status,
    response_mime: network.mime,
  };
}

async function verifyZoomAndPan(page, dialog) {
  const viewport = dialog.locator('[data-floorplan-zoom]').first();
  const zoomIn = dialog.locator('button:has([data-lucide="zoom-in"])').first();
  const zoomOut = dialog.locator('button:has([data-lucide="zoom-out"])').first();
  const reset = dialog.locator('button:has([data-lucide="rotate-ccw"])').first();
  await zoomIn.click();
  await zoomIn.click();
  await page.waitForFunction((node) => Number(node?.dataset?.floorplanZoom || 0) > 1, await viewport.elementHandle());

  const before = await viewport.evaluate((node) => ({
    left: node.scrollLeft,
    top: node.scrollTop,
    scrollWidth: node.scrollWidth,
    scrollHeight: node.scrollHeight,
    clientWidth: node.clientWidth,
    clientHeight: node.clientHeight,
  }));
  const box = await viewport.boundingBox();
  if (!box) throw new Error('Floor-plan pan viewport had no visible bounds.');
  const start = {
    x: box.x + (box.width * 0.68),
    y: box.y + (box.height * 0.68),
  };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x - Math.min(180, box.width * 0.25), start.y - Math.min(120, box.height * 0.2), { steps: 8 });
  await page.mouse.up();

  const after = await viewport.evaluate((node) => ({
    left: node.scrollLeft,
    top: node.scrollTop,
  }));

  await reset.click();
  await zoomOut.click();
  await zoomOut.click();
  await page.waitForFunction((node) => Number(node?.dataset?.floorplanZoom || 0) < 1, await viewport.elementHandle());
  const reducedBefore = await viewport.evaluate((node) => ({
    zoom: Number(node.dataset.floorplanZoom || 0),
    x: Number(node.dataset.floorplanPanX || 0),
    y: Number(node.dataset.floorplanPanY || 0),
  }));
  const reducedBox = await viewport.boundingBox();
  if (!reducedBox) throw new Error('Reduced floor-plan pan viewport had no visible bounds.');
  const reducedStart = {
    x: reducedBox.x + (reducedBox.width * 0.5),
    y: reducedBox.y + (reducedBox.height * 0.5),
  };
  await page.mouse.move(reducedStart.x, reducedStart.y);
  await page.mouse.down();
  await page.mouse.move(reducedStart.x + Math.min(120, reducedBox.width * 0.2), reducedStart.y + Math.min(90, reducedBox.height * 0.15), { steps: 8 });
  await page.mouse.up();
  const reducedAfter = await viewport.evaluate((node) => ({
    x: Number(node.dataset.floorplanPanX || 0),
    y: Number(node.dataset.floorplanPanY || 0),
  }));
  return {
    zoomed: before.scrollWidth > before.clientWidth && before.scrollHeight > before.clientHeight,
    moved: after.left > before.left + 10 && after.top > before.top + 10,
    before,
    after,
    reduced_zoom: reducedBefore.zoom,
    reduced_moved: Math.abs(reducedAfter.x - reducedBefore.x) > 10 && Math.abs(reducedAfter.y - reducedBefore.y) > 10,
    reduced_before: reducedBefore,
    reduced_after: reducedAfter,
  };
}

function imageChecks(evidence) {
  return {
    image_complete: evidence.complete === true,
    image_has_pixels: evidence.natural_width > 0 && evidence.natural_height > 0,
    image_response_200: evidence.response_status === 200,
    image_response_mime: evidence.response_mime.startsWith('image/'),
  };
}

async function verifyTarget(context, baseUrl, stamp, target, reportErrors) {
  const screenshotPath = path.join(OUT_DIR, `floor-plan-browser-${target.key}-1440x900-${stamp}.png`);
  const result = {
    asset_id: target.assetId,
    asset_name: target.assetName,
    representative_floor: target.floorLabel,
    viewport: VIEWPORT,
    screenshot: path.relative(ROOT, screenshotPath).replace(/\\/gu, '/'),
    checks: {
      asset_selected: false,
      carousel_visible: false,
      image_complete: false,
      image_has_pixels: false,
      image_response_200: false,
      image_response_mime: false,
      modal_visible: false,
      modal_title_visible: false,
      modal_image_complete: false,
      modal_image_has_pixels: false,
      modal_zoom_scrollable: false,
      modal_drag_pan_works: false,
      modal_reduced_drag_pan_works: false,
      stacking_floor_range_correct: target.expectedStackingFloors ? false : true,
      screenshot_written: false,
    },
    image: null,
    modal_image: null,
    ok: false,
  };
  const responseByUrl = new Map();
  const page = await context.newPage();
  page.on('response', (response) => recordImageResponse(responseByUrl, response));
  page.on('pageerror', (error) => reportErrors.push({ asset: target.key, kind: 'pageerror', message: sanitizeError(error.message) }));
  await page.addInitScript(({ assetId }) => {
    sessionStorage.setItem('logisticsSelectedAssetId', assetId);
  }, { assetId: target.assetId });

  try {
    await page.goto(joinUrl(baseUrl, 'asset/'), { waitUntil: 'domcontentloaded', timeout: 60000 });
    const assetHeading = page.getByRole('heading', { name: new RegExp(escapeRegExp(target.assetName), 'u') }).first();
    await assetHeading.waitFor({ state: 'visible', timeout: 90000 });
    result.checks.asset_selected = true;

    const carousel = page.getByRole('button', { name: `${target.assetName} 평면도 이미지`, exact: true }).first();
    await carousel.waitFor({ state: 'visible', timeout: 60000 });
    result.checks.carousel_visible = true;
    const imageName = new RegExp(`^${escapeRegExp(target.assetName)}\\s+${escapeRegExp(target.floorLabel)}(?:층)?\\s+평면도$`, 'u');
    const image = carousel.getByRole('img', { name: imageName }).first();
    result.image = await loadedImageEvidence(page, image, responseByUrl);
    Object.assign(result.checks, imageChecks(result.image));
    if (target.expectedStackingFloors) {
      const stackingFloors = await page.locator('[data-stacking-floor-label]').evaluateAll((nodes) => (
        nodes.map((node) => String(node.getAttribute('data-stacking-floor-label') || '').trim()).filter(Boolean)
      ));
      result.stacking_floors = stackingFloors;
      result.checks.stacking_floor_range_correct = target.expectedStackingFloors.every((label) => stackingFloors.includes(label))
        && !['B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8'].some((label) => stackingFloors.includes(label));
    }

    await carousel.click();
    const dialog = page.getByRole('dialog').first();
    await dialog.waitFor({ state: 'visible', timeout: 15000 });
    result.checks.modal_visible = true;
    const modalHeading = dialog.getByRole('heading', {
      name: new RegExp(`${escapeRegExp(target.assetName)}.*평면도 이미지`, 'u'),
    }).first();
    await modalHeading.waitFor({ state: 'visible', timeout: 15000 });
    result.checks.modal_title_visible = true;
    const modalImage = dialog.getByRole('img', { name: imageName }).first();
    result.modal_image = await loadedImageEvidence(page, modalImage, responseByUrl);
    result.checks.modal_image_complete = result.modal_image.complete === true;
    result.checks.modal_image_has_pixels = result.modal_image.natural_width > 0 && result.modal_image.natural_height > 0;
    result.pan = await verifyZoomAndPan(page, dialog);
    result.checks.modal_zoom_scrollable = result.pan.zoomed;
    result.checks.modal_drag_pan_works = result.pan.moved;
    result.checks.modal_reduced_drag_pan_works = result.pan.reduced_moved;

    await page.screenshot({ path: screenshotPath, fullPage: false });
    result.checks.screenshot_written = fs.existsSync(screenshotPath) && fs.statSync(screenshotPath).size > 0;
  } catch (error) {
    reportErrors.push({ asset: target.key, kind: 'verification', message: sanitizeError(error?.message || error) });
    await page.screenshot({ path: screenshotPath, fullPage: false }).then(() => {
      result.checks.screenshot_written = fs.existsSync(screenshotPath) && fs.statSync(screenshotPath).size > 0;
    }).catch(() => null);
  } finally {
    result.ok = Object.values(result.checks).every(Boolean);
    await page.close().catch(() => null);
  }
  return result;
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const stamp = timestampForFile();
  const outJson = path.join(OUT_DIR, `floor-plan-browser-smoke-${stamp}.json`);
  const latestJson = path.join(OUT_DIR, 'floor-plan-browser-smoke-latest.json');
  const baseUrl = argsValue('base-url', DEFAULT_BASE_URL);
  const report = {
    ok: false,
    generated_at: new Date().toISOString(),
    base_url: safePublicUrl(baseUrl),
    viewport: VIEWPORT,
    auth_source: null,
    targets: [],
    errors: [],
  };

  let browser;
  let context;
  try {
    const auth = await signInSession();
    report.auth_source = auth.source;
    const uiEmail = auth.session.user?.email || envValue('LOGISTICS_BROWSER_UI_EMAIL') || '';
    browser = await chromium.launch({ headless: true, executablePath: chromeExecutablePath() });
    context = await browser.newContext({ viewport: VIEWPORT, serviceWorkers: 'block' });
    await context.addInitScript(({ email, session }) => {
      sessionStorage.setItem('sb-iota-auth-token', JSON.stringify(session));
      sessionStorage.setItem('logistics_preview_auth', JSON.stringify({ email }));
      localStorage.setItem('logisticsDashboardReadMode', 'primary-safe');
    }, { email: uiEmail, session: auth.session });

    for (const target of TARGETS) {
      report.targets.push(await verifyTarget(context, baseUrl, stamp, target, report.errors));
    }
    report.ok = report.targets.length === TARGETS.length
      && report.targets.every((target) => target.ok)
      && report.errors.length === 0;
  } catch (error) {
    report.errors.push({ asset: null, kind: 'setup', message: sanitizeError(error?.message || error) });
  } finally {
    if (context) await context.close().catch(() => null);
    if (browser) await browser.close().catch(() => null);
    fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`);
    fs.writeFileSync(latestJson, `${JSON.stringify(report, null, 2)}\n`);
  }

  console.log(JSON.stringify({
    ok: report.ok,
    artifact: outJson,
    targets: report.targets.map((target) => ({
      asset_id: target.asset_id,
      asset_name: target.asset_name,
      representative_floor: target.representative_floor,
      ok: target.ok,
      screenshot: target.screenshot,
      checks: target.checks,
    })),
    error_count: report.errors.length,
  }, null, 2));
  if (!report.ok) process.exit(1);
}

main().catch((error) => {
  console.error(sanitizeError(error?.message || error));
  process.exit(1);
});
