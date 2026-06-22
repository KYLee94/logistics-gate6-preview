const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT_DIR = path.join(ROOT, 'qa-artifacts', 'logistics-gate6');
const DEFAULT_BASE_URL = 'https://kylee94.github.io/logistics-gate6-preview/';

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

function argValue(name, fallback = '') {
  const eqPrefix = `--${name}=`;
  const eqArg = process.argv.find((item) => item.startsWith(eqPrefix));
  if (eqArg) return eqArg.slice(eqPrefix.length);
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : (process.argv[index + 1] || fallback);
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function timestampForFile() {
  return new Date().toISOString().replace(/[-:]/gu, '').replace(/\./u, '-').replace('T', '-');
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
  const url = new URL(route.replace(/^\/+/u, ''), normalizedBase);
  if (hasFlag('cache-bust')) url.searchParams.set('qa_cache_bust', timestampForFile());
  return url.toString();
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

async function visibleTileStats(page, selector = '[data-testid="market-map-panel"]') {
  return page.evaluate((mapSelector) => {
    const statsFor = (el) => {
      const containerRect = el.getBoundingClientRect();
      const containerArea = Math.max(1, containerRect.width * containerRect.height);
      const tiles = Array.from(el.querySelectorAll('img[src], canvas, [style*="background-image"]')).filter((node) => {
        const rect = node.getBoundingClientRect();
        const style = getComputedStyle(node);
        const src = node.getAttribute('src') || '';
        const background = style.backgroundImage || node.style.backgroundImage || '';
        const className = typeof node.className === 'string' ? node.className : '';
        const looksLikeControl = /marker|pin|sprite|logo|control|zoom|scale|dot\.gif|blank|transparent/iu.test(`${src} ${background} ${className}`);
        const overlapWidth = Math.max(0, Math.min(rect.right, containerRect.right) - Math.max(rect.left, containerRect.left));
        const overlapHeight = Math.max(0, Math.min(rect.bottom, containerRect.bottom) - Math.max(rect.top, containerRect.top));
        return !looksLikeControl
          && rect.width >= 96
          && rect.height >= 96
          && overlapWidth >= 96
          && overlapHeight >= 96
          && style.display !== 'none'
          && style.visibility !== 'hidden'
          && Number(style.opacity || 1) > 0.05;
      });
      const coveredArea = tiles.reduce((sum, node) => {
        const rect = node.getBoundingClientRect();
        const overlapWidth = Math.max(0, Math.min(rect.right, containerRect.right) - Math.max(rect.left, containerRect.left));
        const overlapHeight = Math.max(0, Math.min(rect.bottom, containerRect.bottom) - Math.max(rect.top, containerRect.top));
        return sum + (overlapWidth * overlapHeight);
      }, 0);
      const tileSources = Array.from(el.querySelectorAll('img[src]')).map((img) => img.getAttribute('src') || '');
      const markerSources = tileSources.filter((src) => /marker|pin|sprite/iu.test(src));
      return {
        mode: el.getAttribute('data-map-mode') || '',
        provider: el.getAttribute('data-map-provider') || '',
        naver_ready: el.getAttribute('data-naver-map-ready') === 'true',
        osm_ready: el.getAttribute('data-osm-map-ready') === 'true',
        region_cluster_count: Number(el.getAttribute('data-map-region-cluster-count') || 0),
        point_count: Number(el.getAttribute('data-map-point-count') || 0),
        native_marker_count: Number(el.getAttribute('data-map-native-marker-count') || 0),
        coordinate_count: Number(el.getAttribute('data-map-coordinate-count') || 0),
        visible_tile_count: tiles.length,
        visible_tile_coverage: Math.round(Math.min(1, coveredArea / containerArea) * 1000) / 1000,
        naver_tile_count: tileSources.filter((src) => /pstatic\.net|naver\.com/iu.test(src)).length,
        osm_tile_count: tileSources.filter((src) => /tile\.openstreetmap\.org/iu.test(src)).length,
        marker_image_count: markerSources.length,
        region_buttons: el.querySelectorAll('[data-region-cluster-button="true"]').length,
        width: Math.round(containerRect.width),
        height: Math.round(containerRect.height),
      };
    };
    return Array.from(document.querySelectorAll(mapSelector)).map(statsFor);
  }, selector);
}

async function screenshotElement(page, selector, filePath) {
  const locator = page.locator(selector).first();
  await locator.screenshot({ path: filePath });
  return filePath;
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const stamp = timestampForFile();
  const baseUrl = argValue('base-url', DEFAULT_BASE_URL);
  const routes = argValue('routes', 'market-data/lease-market,market-data/supply-pipeline,market-data/transactions')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  const auth = await signInSession();
  const email = auth.session.user?.email || envValue('LOGISTICS_BROWSER_UI_EMAIL') || 'kylee@igisam.com';
  const report = {
    ok: false,
    generated_at: new Date().toISOString(),
    script: 'qa:market-map:live-naver-region-flow',
    base_url: baseUrl,
    auth_source: auth.source,
    routes: [],
    screenshots: [],
    errors: [],
    warnings: [],
  };
  let browser;
  try {
    browser = await chromium.launch({ headless: true, executablePath: chromeExecutablePath() });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, serviceWorkers: 'block' });
    await context.addInitScript(({ session, email: injectedEmail }) => {
      sessionStorage.setItem('sb-iota-auth-token', JSON.stringify(session));
      sessionStorage.setItem('logistics_preview_auth', JSON.stringify({ email: injectedEmail }));
      localStorage.setItem('logisticsDashboardReadMode', 'primary-safe');
    }, { session: auth.session, email });
    const page = await context.newPage();
    page.on('pageerror', (error) => {
      const message = error?.message || String(error);
      if (/Cannot read properties of null \(reading '(?:capitalize|isArray|hasValue|TransitionQueue)'\)|Failed to execute 'removeChild' on 'Node'/u.test(message)) return;
      report.errors.push(message);
    });
    page.on('console', (message) => {
      if (message.type() === 'error' && !/favicon/iu.test(message.text())) report.warnings.push(`console: ${message.text()}`);
    });
    for (const route of routes) {
      const routeKey = route.replace(/[^\w-]+/gu, '-');
      const entry = { route, ok: false, screenshots: [], errors: [] };
      await page.goto(joinUrl(baseUrl, route), { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForFunction(() => /Market\s*Data/iu.test(document.body?.innerText || ''), undefined, { timeout: 60000 });
      await page.waitForFunction(() => {
        const panel = document.querySelector('[data-testid="market-map-panel"]');
        return panel
          && panel.getAttribute('data-map-provider') === 'naver'
          && panel.getAttribute('data-map-mode') === 'regions'
          && Number(panel.getAttribute('data-map-region-cluster-count') || 0) > 0;
      }, undefined, { timeout: 120000 });
      await page.waitForFunction(() => {
        const panel = document.querySelector('[data-testid="market-map-panel"]');
        if (!panel) return false;
        const sources = Array.from(panel.querySelectorAll('img[src]')).map((img) => img.getAttribute('src') || '');
        return sources.some((src) => /pstatic\.net|naver\.com/iu.test(src))
          && !sources.some((src) => /tile\.openstreetmap\.org/iu.test(src));
      }, undefined, { timeout: 60000 });
      entry.region_first_stats = (await visibleTileStats(page))[0] || {};
      const regionShot = path.join(OUT_DIR, `live-market-map-naver-region-flow-${routeKey}-01-region-first-${stamp}.png`);
      await screenshotElement(page, '[data-testid="market-map-panel"]', regionShot);
      entry.screenshots.push(regionShot);
      report.screenshots.push(regionShot);
      const firstCluster = page.locator('[data-region-cluster-button="true"]').first();
      await firstCluster.click({ timeout: 20000 });
      await page.waitForFunction(() => {
        const panel = document.querySelector('[data-testid="market-map-panel"]');
        return panel
          && panel.getAttribute('data-map-provider') === 'naver'
          && panel.getAttribute('data-map-mode') === 'points'
          && Number(panel.getAttribute('data-map-point-count') || 0) > 0
          && Number(panel.getAttribute('data-map-native-marker-count') || 0) > 0;
      }, undefined, { timeout: 60000 });
      await page.waitForFunction(() => {
        const panel = document.querySelector('[data-testid="market-map-panel"]');
        if (!panel) return false;
        const sources = Array.from(panel.querySelectorAll('img[src]')).map((img) => img.getAttribute('src') || '');
        return sources.some((src) => /marker|pin|sprite/iu.test(src))
          && sources.some((src) => /pstatic\.net|naver\.com/iu.test(src))
          && !sources.some((src) => /tile\.openstreetmap\.org/iu.test(src));
      }, undefined, { timeout: 60000 }).catch(() => {
        entry.errors.push('Naver marker image was not detected after region click.');
      });
      entry.point_stats = (await visibleTileStats(page))[0] || {};
      const pointShot = path.join(OUT_DIR, `live-market-map-naver-region-flow-${routeKey}-02-after-region-click-points-${stamp}.png`);
      await screenshotElement(page, '[data-testid="market-map-panel"]', pointShot);
      entry.screenshots.push(pointShot);
      report.screenshots.push(pointShot);
      entry.ok = entry.errors.length === 0
        && entry.region_first_stats.provider === 'naver'
        && entry.region_first_stats.mode === 'regions'
        && entry.region_first_stats.region_cluster_count > 0
        && entry.region_first_stats.naver_tile_count > 0
        && entry.region_first_stats.osm_tile_count === 0
        && entry.point_stats.provider === 'naver'
        && entry.point_stats.mode === 'points'
        && entry.point_stats.point_count > 0
        && entry.point_stats.native_marker_count > 0
        && entry.point_stats.naver_tile_count > 0
        && entry.point_stats.osm_tile_count === 0
        && entry.point_stats.marker_image_count > 0;
      report.routes.push(entry);
    }
  } catch (error) {
    report.errors.push(error?.stack || error?.message || String(error));
  } finally {
    if (browser) await browser.close().catch(() => null);
  }
  report.ok = report.errors.length === 0 && report.routes.length === routes.length && report.routes.every((entry) => entry.ok);
  const outJson = path.join(OUT_DIR, `live-market-map-naver-region-flow-${stamp}.json`);
  const latestJson = path.join(OUT_DIR, 'live-market-map-naver-region-flow-latest.json');
  fs.writeFileSync(outJson, JSON.stringify(report, null, 2));
  fs.writeFileSync(latestJson, JSON.stringify(report, null, 2));
  console.log(`live market map naver region flow ${report.ok ? 'PASS' : 'FAIL'}: ${outJson}`);
  if (!report.ok) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error?.stack || error?.message || error);
  process.exit(1);
});
