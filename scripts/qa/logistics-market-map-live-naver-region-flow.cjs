const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT_DIR = path.join(ROOT, 'qa-artifacts', 'logistics-gate6');
const DEFAULT_BASE_URL = 'https://kylee94.github.io/logistics-gate6-preview/';
const NAVER_MAP_AUTH_FAILURE_RE = /네이버\s*지도\s*Open\s*API\s*인증|Open API 인증|인증.*실패|unauthorized|authentication|forbidden|invalid\s*client/iu;

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

function numberArg(name, fallback) {
  const value = Number(argValue(name, String(fallback)));
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
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
      const panelText = el.innerText || el.textContent || '';
      const authFailureRe = /네이버\s*지도\s*Open\s*API\s*인증|Open API 인증|인증.*실패|unauthorized|authentication|forbidden|invalid\s*client/iu;
      return {
        mode: el.getAttribute('data-map-mode') || '',
        provider: el.getAttribute('data-map-provider') || '',
        auth_failure_visible: authFailureRe.test(panelText),
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
        zoom: Number(el.getAttribute('data-map-zoom') || 0),
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

async function regionLabelPositions(page) {
  return page.evaluate(() => {
    const panel = document.querySelector('[data-testid="market-map-panel"]');
    if (!panel) return [];
    const panelRect = panel.getBoundingClientRect();
    return Array.from(panel.querySelectorAll('[data-region-cluster-button="true"]')).map((node) => {
    const rect = node.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    return {
      region: node.getAttribute('data-region-name') || node.getAttribute('aria-label') || '',
      x: Math.round(centerX),
      y: Math.round(centerY),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      inside_panel: centerX >= panelRect.left + 4
        && centerX <= panelRect.right - 4
        && centerY >= panelRect.top + 4
        && centerY <= panelRect.bottom - 4,
    };
  });
  });
}

async function visibleRegionClusterIndex(page) {
  return page.evaluate(() => {
    const panel = document.querySelector('[data-testid="market-map-panel"]');
    if (!panel) return -1;
    const panelRect = panel.getBoundingClientRect();
    const candidates = Array.from(panel.querySelectorAll('[data-region-cluster-button="true"]'))
      .map((node, index) => {
        const rect = node.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        return {
          index,
          centerX,
          centerY,
          inside: centerX >= panelRect.left + 4
            && centerX <= panelRect.right - 4
            && centerY >= panelRect.top + 4
            && centerY <= panelRect.bottom - 4,
        };
      })
      .filter((item) => item.inside)
      .sort((a, b) => a.centerY - b.centerY || a.centerX - b.centerX);
    return candidates[0]?.index ?? -1;
  });
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const stamp = timestampForFile();
  const baseUrl = argValue('base-url', DEFAULT_BASE_URL);
  const maxRegionClickMs = numberArg('max-click-ms', 800);
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
    max_region_click_ms: maxRegionClickMs,
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
      if (message.type() === 'error' && !/favicon/iu.test(message.text())) {
        const text = message.text();
        if (NAVER_MAP_AUTH_FAILURE_RE.test(text)) report.errors.push(`console: ${text}`);
        else report.warnings.push(`console: ${text}`);
      }
    });
    for (const route of routes) {
      const routeKey = route.replace(/[^\w-]+/gu, '-');
      const entry = { route, ok: false, screenshots: [], errors: [] };
      await page.goto(joinUrl(baseUrl, route), { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForFunction(() => Boolean(document.querySelector('[data-testid="market-data-dashboard"]')), undefined, { timeout: 60000 });
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
      entry.region_label_positions_before_zoom = await regionLabelPositions(page);
      const regionZoomBefore = Number(await page.locator('[data-testid="market-map-panel"]').first().getAttribute('data-map-zoom') || 0);
      const regionPanelBox = await page.locator('[data-testid="market-map-panel"]').first().boundingBox();
      if (regionPanelBox) {
        await page.mouse.move(regionPanelBox.x + regionPanelBox.width / 2, regionPanelBox.y + regionPanelBox.height / 2);
        await page.mouse.wheel(0, -540);
      }
      await page.waitForFunction((beforeZoom) => {
        const panel = document.querySelector('[data-testid="market-map-panel"]');
        const nextZoom = Number(panel?.getAttribute('data-map-zoom') || 0);
        return panel?.getAttribute('data-map-provider') === 'naver'
          && panel?.getAttribute('data-map-mode') === 'regions'
          && Number.isFinite(nextZoom)
          && nextZoom !== Number(beforeZoom || 0);
      }, regionZoomBefore, { timeout: 8000 }).catch(() => {
        entry.errors.push('Mouse wheel zoom did not update the Naver region map zoom.');
      });
      entry.region_label_positions_after_zoom = await regionLabelPositions(page);
      entry.region_labels_moved_on_zoom = entry.region_label_positions_before_zoom.some((before) => {
        const after = entry.region_label_positions_after_zoom.find((item) => item.region === before.region);
        if (!after) return false;
        return Math.abs(after.x - before.x) + Math.abs(after.y - before.y) >= 4;
      });
      if (!entry.region_labels_moved_on_zoom) {
        entry.errors.push('Region labels did not move with Naver map zoom.');
      }
      const visibleClusterIndex = await visibleRegionClusterIndex(page);
      entry.visible_region_cluster_index = visibleClusterIndex;
      if (visibleClusterIndex < 0) {
        entry.errors.push('No visible region cluster remained inside the map panel after zoom.');
      }
      const firstCluster = page.locator('[data-testid="market-map-panel"] [data-region-cluster-button="true"]').nth(Math.max(0, visibleClusterIndex));
      const clickStartedAt = Date.now();
      await firstCluster.click({ timeout: 20000 }).catch(async () => {
        await firstCluster.click({ force: true, timeout: 5000 });
      });
      await page.waitForFunction(() => {
        const panel = document.querySelector('[data-testid="market-map-panel"]');
        return panel
          && panel.getAttribute('data-map-provider') === 'naver'
          && panel.getAttribute('data-map-mode') === 'points'
          && Number(panel.getAttribute('data-map-point-count') || 0) > 0
          && Number(panel.getAttribute('data-map-native-marker-count') || 0) > 0;
      }, undefined, { timeout: 60000 });
      entry.click_to_points_ms = Date.now() - clickStartedAt;
      entry.click_to_points_within_threshold = entry.click_to_points_ms <= maxRegionClickMs;
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
      const zoomBefore = Number(await page.locator('[data-testid="market-map-panel"]').first().getAttribute('data-map-zoom') || 0);
      const panelBox = await page.locator('[data-testid="market-map-panel"]').first().boundingBox();
      if (panelBox) {
        await page.mouse.move(panelBox.x + panelBox.width / 2, panelBox.y + panelBox.height / 2);
        await page.mouse.wheel(0, -620);
      }
      await page.waitForFunction((beforeZoom) => {
        const panel = document.querySelector('[data-testid="market-map-panel"]');
        if (!panel) return false;
        const nextZoom = Number(panel.getAttribute('data-map-zoom') || 0);
        return panel.getAttribute('data-map-provider') === 'naver'
          && panel.getAttribute('data-map-mode') === 'points'
          && Number(panel.getAttribute('data-map-point-count') || 0) > 0
          && Number.isFinite(nextZoom)
          && nextZoom !== Number(beforeZoom || 0);
      }, zoomBefore, { timeout: 8000 }).catch(() => {
        entry.errors.push('Mouse wheel zoom did not update the Naver points map without leaving points mode.');
      });
      entry.after_wheel_zoom_stats = (await visibleTileStats(page))[0] || {};
      entry.wheel_zoom_changed = Number(entry.after_wheel_zoom_stats.zoom || 0) !== zoomBefore;
      entry.wheel_zoom_kept_naver_points = entry.after_wheel_zoom_stats.provider === 'naver'
        && entry.after_wheel_zoom_stats.mode === 'points'
        && entry.after_wheel_zoom_stats.point_count > 0
        && entry.after_wheel_zoom_stats.naver_tile_count > 0
        && entry.after_wheel_zoom_stats.osm_tile_count === 0;
      const zoomBeforeButton = Number(entry.after_wheel_zoom_stats.zoom || 0);
      await page.locator('[data-testid="market-map-panel"] [data-testid="market-map-zoom-out"]').first().click({ timeout: 10000 });
      await page.waitForFunction((beforeZoom) => {
        const panel = document.querySelector('[data-testid="market-map-panel"]');
        const nextZoom = Number(panel?.getAttribute('data-map-zoom') || 0);
        return Number.isFinite(nextZoom) && nextZoom < Number(beforeZoom || 0);
      }, zoomBeforeButton, { timeout: 8000 }).catch(() => {
        entry.errors.push('Map zoom-out button did not decrease the Naver points map zoom.');
      });
      entry.after_button_zoom_out_stats = (await visibleTileStats(page))[0] || {};
      const zoomAfterButtonOut = Number(entry.after_button_zoom_out_stats.zoom || 0);
      await page.locator('[data-testid="market-map-panel"] [data-testid="market-map-zoom-in"]').first().click({ timeout: 10000 });
      await page.waitForFunction((beforeZoom) => {
        const panel = document.querySelector('[data-testid="market-map-panel"]');
        const nextZoom = Number(panel?.getAttribute('data-map-zoom') || 0);
        return Number.isFinite(nextZoom) && nextZoom > Number(beforeZoom || 0);
      }, zoomAfterButtonOut, { timeout: 8000 }).catch(() => {
        entry.errors.push('Map zoom-in button did not increase the Naver points map zoom.');
      });
      entry.after_button_zoom_in_stats = (await visibleTileStats(page))[0] || {};
      entry.button_zoom_out_changed = Number(entry.after_button_zoom_out_stats.zoom || 0) < zoomBeforeButton;
      entry.button_zoom_in_changed = Number(entry.after_button_zoom_in_stats.zoom || 0) > zoomAfterButtonOut;
      entry.button_zoom_kept_naver_points = entry.after_button_zoom_in_stats.provider === 'naver'
        && entry.after_button_zoom_in_stats.mode === 'points'
        && entry.after_button_zoom_in_stats.point_count > 0
        && entry.after_button_zoom_in_stats.naver_tile_count > 0
        && entry.after_button_zoom_in_stats.osm_tile_count === 0;
      entry.ok = entry.errors.length === 0
        && entry.region_first_stats.provider === 'naver'
        && entry.region_first_stats.mode === 'regions'
        && !entry.region_first_stats.auth_failure_visible
        && entry.region_first_stats.region_cluster_count > 0
        && entry.region_first_stats.point_count === 0
        && entry.region_first_stats.naver_tile_count > 0
        && entry.region_first_stats.osm_tile_count === 0
        && entry.region_labels_moved_on_zoom
        && entry.click_to_points_within_threshold
        && entry.point_stats.provider === 'naver'
        && entry.point_stats.mode === 'points'
        && !entry.point_stats.auth_failure_visible
        && entry.point_stats.point_count > 0
        && entry.point_stats.native_marker_count > 0
        && entry.point_stats.naver_tile_count > 0
        && entry.point_stats.osm_tile_count === 0
        && entry.point_stats.marker_image_count > 0
        && entry.wheel_zoom_changed
        && entry.wheel_zoom_kept_naver_points
        && !entry.after_wheel_zoom_stats.auth_failure_visible
        && entry.button_zoom_out_changed
        && entry.button_zoom_in_changed
        && entry.button_zoom_kept_naver_points
        && !entry.after_button_zoom_in_stats.auth_failure_visible;
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
