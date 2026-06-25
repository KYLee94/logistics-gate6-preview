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

const MIN_NAVER_TILE_COUNT = 2;
const MIN_NAVER_TILE_COVERAGE = 0.6;
const NAVER_MAP_AUTH_FAILURE_RE = /네이버\s*지도\s*Open\s*API\s*인증|Open API 인증|인증.*실패|unauthorized|authentication|forbidden|invalid\s*client/iu;

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

function hasRequiredRows(apiBody, key) {
  const views = apiBody?.data?.views || {};
  if (key === 'overview') return Boolean(views.overview?.kpis);
  if (key === 'lease') return Array.isArray(views.lease?.latest_rows) && views.lease.latest_rows.length > 0;
  if (key === 'supply') return Array.isArray(views.supply?.rows) && views.supply.rows.length > 0;
  if (key === 'transactions') return Array.isArray(views.transactions?.rows) && views.transactions.rows.length > 0;
  if (key === 'source') return Array.isArray(views.source?.sheet_readback) && views.source.sheet_readback.length > 0;
  return false;
}

async function evaluateMapButtonOverlap(page, containerSelector, buttonSelector, minCenterDistancePx) {
  return page.evaluate(({ containerSelector: outerSelector, buttonSelector: innerSelector, minCenterDistance }) => {
    const containers = Array.from(document.querySelectorAll(outerSelector));
    return containers.map((container, index) => {
      const buttons = Array.from(container.querySelectorAll(innerSelector));
      const rects = buttons
        .map((button) => {
          const rect = button.getBoundingClientRect();
          return {
            left: rect.left,
            top: rect.top,
            right: rect.right,
            bottom: rect.bottom,
            width: rect.width,
            height: rect.height,
            cx: rect.left + (rect.width / 2),
            cy: rect.top + (rect.height / 2),
            label: (button.getAttribute('title') || button.textContent || '').trim(),
          };
        })
        .filter((rect) => rect.width > 0 && rect.height > 0);
      let nearPairCount = 0;
      let overlapPairCount = 0;
      let minObservedDistance = Number.POSITIVE_INFINITY;
      let maxOverlapArea = 0;
      for (let leftIndex = 0; leftIndex < rects.length; leftIndex += 1) {
        for (let rightIndex = leftIndex + 1; rightIndex < rects.length; rightIndex += 1) {
          const left = rects[leftIndex];
          const right = rects[rightIndex];
          const distance = Math.hypot(left.cx - right.cx, left.cy - right.cy);
          minObservedDistance = Math.min(minObservedDistance, distance);
          if (distance < minCenterDistance) nearPairCount += 1;
          const overlapWidth = Math.max(0, Math.min(left.right, right.right) - Math.max(left.left, right.left));
          const overlapHeight = Math.max(0, Math.min(left.bottom, right.bottom) - Math.max(left.top, right.top));
          const overlapArea = overlapWidth * overlapHeight;
          maxOverlapArea = Math.max(maxOverlapArea, overlapArea);
          if (overlapArea > 2) overlapPairCount += 1;
        }
      }
      return {
        index,
        button_count: rects.length,
        near_pair_count: nearPairCount,
        overlap_pair_count: overlapPairCount,
        min_center_distance_px: Number.isFinite(minObservedDistance) ? Math.round(minObservedDistance * 10) / 10 : null,
        max_overlap_area_px: Math.round(maxOverlapArea * 10) / 10,
        ok: nearPairCount === 0 && (overlapPairCount === 0 || maxOverlapArea <= 650),
      };
    });
  }, { containerSelector, buttonSelector, minCenterDistance: minCenterDistancePx }).catch((error) => ([{ error: error?.message || String(error), ok: false }]));
}

async function waitForStableMarketDataPage(page, tab) {
  const result = {
    shell_ready: false,
    loading_gone: false,
    chart_ready: tab.key === 'source-update',
    naver_ready: !tab.needsMap,
    table_ready: false,
  };
  result.shell_ready = await page.waitForFunction(() => /Market\s*Data/iu.test(document.body?.innerText || ''), { timeout: 60000 }).then(() => true).catch(() => false);
  result.loading_gone = await page.waitForFunction(() => {
    const text = document.body?.innerText || '';
    return !text.includes('\uc2dc\uc7a5\uc790\ub8cc\ub97c \ubd88\ub7ec\uc624\ub294 \uc911\uc785\ub2c8\ub2e4.');
  }, { timeout: 90000 }).then(() => true).catch(() => false);
  result.table_ready = tab.key === 'overview'
    ? true
    : await page.waitForFunction(() => document.querySelectorAll('table tbody tr').length > 0, { timeout: 90000 }).then(() => true).catch(() => false);
  if (tab.key !== 'source-update') {
    result.chart_ready = await page.waitForFunction(() => document.querySelector('[data-chart-role][data-chart-empty="false"]'), { timeout: 90000 }).then(() => true).catch(() => false);
  }
  if (tab.needsMap) {
    result.map_provider_ready = await page.waitForFunction(() => {
      const panels = Array.from(document.querySelectorAll('[data-testid="market-map-panel"]')).filter((panel) => {
        const rect = panel.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      });
      return panels.length > 0
        && panels.every((panel) => (
          (
            (panel.getAttribute('data-naver-map-ready') === 'true' && panel.getAttribute('data-map-provider') === 'naver')
            || (panel.getAttribute('data-osm-map-ready') === 'true' && panel.getAttribute('data-map-provider') === 'osm')
          )
          && panel.getAttribute('data-map-mode') === 'regions'
          && Number(panel.getAttribute('data-map-region-cluster-count') || 0) > 0
        ));
    }, { timeout: 90000 }).then(() => true).catch(() => false);
    await page.waitForFunction(() => (
      Array.from(document.querySelectorAll('[data-testid="market-map-panel"]')).every((panel) => (
        panel.getAttribute('data-naver-map-ready') === 'true'
        || panel.getAttribute('data-osm-map-ready') === 'true'
        || panel.getAttribute('data-map-fallback-ready') === 'true'
      ))
    ), undefined, { timeout: 10000 }).catch(() => null);
    result.naver_sdk_ready = (await page.locator('[data-naver-map-ready="true"]').count().catch(() => 0)) > 0;
    result.osm_ready = (await page.locator('[data-osm-map-ready="true"]').count().catch(() => 0)) > 0;
    result.map_fallback_ready = (await page.locator('[data-map-fallback-ready="true"]').count().catch(() => 0)) > 0;
    result.naver_ready = result.map_provider_ready && (result.naver_sdk_ready || result.osm_ready) && !result.map_fallback_ready;
    result.map_region_cluster_ready = result.map_provider_ready;
    result.map_region_cluster_overlap = result.map_region_cluster_ready
      ? await evaluateMapButtonOverlap(page, '[data-map-mode="regions"]', '[data-region-cluster-button="true"]', 8)
      : [];
    result.map_region_cluster_overlap_ok = result.map_region_cluster_ready
      && result.map_region_cluster_overlap.every((item) => item.ok);
    for (let index = 0; index < 8; index += 1) {
      const firstCluster = page.locator('[data-map-mode="regions"] [data-region-cluster-button="true"]').first();
      if (!(await firstCluster.count().catch(() => 0))) break;
      const previousClusterCount = await page.locator('[data-map-mode="regions"] [data-region-cluster-button="true"]').count().catch(() => 0);
      await firstCluster.click({ timeout: 20000 }).catch(() => null);
      await page.waitForFunction((beforeCount) => {
        const currentRegionButtons = document.querySelectorAll('[data-map-mode="regions"] [data-region-cluster-button="true"]').length;
        const pointMaps = document.querySelectorAll('[data-map-mode="points"][data-map-provider="naver"]').length;
        return pointMaps > 0 || currentRegionButtons < beforeCount;
      }, previousClusterCount, { timeout: 10000 }).catch(() => null);
    }
    result.map_points_coordinate_ready = await page.waitForFunction(() => {
      const maps = Array.from(document.querySelectorAll('[data-map-point-count]'));
      return maps.length > 0 && maps.every((el) => {
        if (el.getAttribute('data-map-mode') !== 'points') return false;
        const pointCount = Number(el.getAttribute('data-map-point-count') || 0);
        const coordinateCount = Number(el.getAttribute('data-map-coordinate-count') || 0);
        const fallbackCount = Number(el.getAttribute('data-map-fallback-count') || 0);
        const coordinateSourceCount = Number(el.getAttribute('data-map-coordinate-source-count') || 0);
        const nativeMarkerCount = Number(el.getAttribute('data-map-native-marker-count') || 0);
        return pointCount > 0
          && nativeMarkerCount >= pointCount
          && coordinateCount >= pointCount
          && fallbackCount === 0
          && coordinateSourceCount >= pointCount;
      });
    }, { timeout: 120000 }).then(() => true).catch(() => false);
    result.map_points_provider_ready = await page.waitForFunction(() => {
      const maps = Array.from(document.querySelectorAll('[data-map-point-count]'));
      const visibleTileStats = (el) => {
        const containerRect = el.getBoundingClientRect();
        const containerArea = Math.max(1, containerRect.width * containerRect.height);
        const tiles = Array.from(el.querySelectorAll('img[src], canvas, .leaflet-tile, [data-qa-fake-naver-tile="true"]')).filter((node) => {
          const rect = node.getBoundingClientRect();
          const style = getComputedStyle(node);
          const src = node.getAttribute('src') || '';
          const className = typeof node.className === 'string' ? node.className : '';
          const looksLikeControl = /marker|pin|sprite|logo|control|zoom|scale|dot\.gif|blank|transparent/iu.test(`${src} ${className}`);
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
        return { count: tiles.length, coverage: Math.min(1, coveredArea / containerArea) };
      };
      return maps.length > 0 && maps.every((el) => (
        el.getAttribute('data-map-mode') === 'points'
        && (
          el.getAttribute('data-naver-map-ready') === 'true'
          || el.getAttribute('data-osm-map-ready') === 'true'
        )
        && visibleTileStats(el).count >= 2
        && visibleTileStats(el).coverage >= 0.6
        && Number(el.getAttribute('data-map-native-marker-count') || 0) >= Number(el.getAttribute('data-map-point-count') || 0)
        && el.querySelectorAll('[data-region-cluster-button="true"]').length === 0
      ));
    }, { timeout: 60000 }).then(() => true).catch(() => false);
    result.map_large_button_ready = await page.locator('[data-testid="market-map-expand-button"]').count().then((count) => count > 0).catch(() => false);
    const pointButtonCount = await page.locator('[data-map-mode="points"] [data-map-point-button="true"]').count().catch(() => 0);
    result.map_point_overlap = result.map_points_provider_ready && pointButtonCount > 1
      ? await evaluateMapButtonOverlap(page, '[data-map-mode="points"]', '[data-map-point-button="true"]', 12)
      : [];
    result.map_point_overlap_ok = result.map_points_provider_ready
      && result.map_region_cluster_overlap_ok
      && result.map_point_overlap.every((item) => item.ok);
    result.naver_ready = result.naver_ready && result.map_points_provider_ready && result.map_points_coordinate_ready;
  }
  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => null);
  return result;
}

async function invokeMarketData(session) {
  const supabaseUrl = envValue('LOGISTICS_SUPABASE_URL', 'VITE_SUPABASE_URL');
  const anonKey = envValue('LOGISTICS_SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY');
  const response = await fetch(`${supabaseUrl.replace(/\/$/u, '')}/functions/v1/ll-dashboard-api`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      authorization: `Bearer ${session.access_token}`,
      'content-type': 'application/json',
      origin: 'https://kylee94.github.io',
    },
    body: JSON.stringify({ action: 'sector-market/read', payload: { limit: 12000 } }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body?.ok === false) throw new Error(`sector-market/read failed (${response.status}): ${body.message || body.error || 'unknown error'}`);
  return body;
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const stamp = timestampForFile();
  const outJson = path.join(OUT_DIR, `market-data-browser-smoke-${stamp}.json`);
  const latestJson = path.join(OUT_DIR, 'market-data-browser-smoke-latest.json');
  const baseUrl = argsValue('base-url', DEFAULT_BASE_URL);
  const auth = await signInSession();
  const apiBody = await invokeMarketData(auth.session);
  const uiEmail = auth.session.user?.email || envValue('LOGISTICS_BROWSER_UI_EMAIL') || 'kylee@igisam.com';
  const browserSession = auth.session;
  const report = {
    ok: false,
    generated_at: new Date().toISOString(),
    base_url: baseUrl,
    auth_source: auth.source,
    tabs: [],
    errors: [],
  };
  const tabs = [
    { key: 'overview', route: 'market-data/overview', viewKey: 'overview', needsMap: false },
    { key: 'lease-market', route: 'market-data/lease-market', viewKey: 'lease', needsMap: true },
    { key: 'supply-pipeline', route: 'market-data/supply-pipeline', viewKey: 'supply', needsMap: true },
    { key: 'transactions', route: 'market-data/transactions', viewKey: 'transactions', needsMap: true },
    { key: 'source-update', route: 'market-data/source-update', viewKey: 'source', needsMap: false },
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
    page.on('pageerror', (error) => {
      const message = error.message || '';
      if (/Cannot read properties of null \(reading '(?:capitalize|isArray|hasValue)'\)|Failed to execute 'removeChild' on 'Node'/u.test(message)) return;
      report.errors.push(message);
    });
    page.on('response', (response) => {
      if (response.url().includes('/functions/v1/ll-dashboard-api') && response.status() >= 500) {
        report.errors.push(`edge ${response.status()} ${response.url()}`);
      }
    });
    for (const tab of tabs) {
      const url = joinUrl(baseUrl, tab.route);
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      const waitState = await waitForStableMarketDataPage(page, tab);
      const body = await page.locator('body').innerText({ timeout: 20000 });
      const screenshot = path.join(OUT_DIR, `market-data-${tab.key}-${stamp}.png`);
      await page.screenshot({ path: screenshot, fullPage: false });
      const mapCount = await page.locator('div[aria-label] button[title]').count().catch(() => 0);
      const naverMapCount = await page.locator('[data-naver-map-ready="true"]').count().catch(() => 0);
      const osmMapCount = await page.locator('[data-osm-map-ready="true"]').count().catch(() => 0);
      const fallbackMapCount = await page.locator('[data-map-fallback-ready="true"]').count().catch(() => 0);
      const mapCoordinateStats = await page.evaluate(() => {
        const visibleTileStats = (el) => {
          const containerRect = el.getBoundingClientRect();
          const containerArea = Math.max(1, containerRect.width * containerRect.height);
          const tiles = Array.from(el.querySelectorAll('img[src], canvas, .leaflet-tile, [data-qa-fake-naver-tile="true"]')).filter((node) => {
            const rect = node.getBoundingClientRect();
            const style = getComputedStyle(node);
            const src = node.getAttribute('src') || '';
            const className = typeof node.className === 'string' ? node.className : '';
            const looksLikeControl = /marker|pin|sprite|logo|control|zoom|scale|dot\.gif|blank|transparent/iu.test(`${src} ${className}`);
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
          return { count: tiles.length, coverage: Math.min(1, coveredArea / containerArea) };
        };
        return Array.from(document.querySelectorAll('[data-map-point-count]')).map((el) => {
          const tileStats = visibleTileStats(el);
          return {
            mode: el.getAttribute('data-map-mode') || '',
            selected_region: el.getAttribute('data-map-selected-region') || '',
            region_cluster_count: Number(el.getAttribute('data-map-region-cluster-count') || 0),
            visible_asset_count: Number(el.getAttribute('data-map-visible-asset-count') || 0),
            point_count: Number(el.getAttribute('data-map-point-count') || 0),
            native_marker_count: Number(el.getAttribute('data-map-native-marker-count') || 0),
            coordinate_count: Number(el.getAttribute('data-map-coordinate-count') || 0),
            fallback_count: Number(el.getAttribute('data-map-fallback-count') || 0),
            geocoded_count: Number(el.getAttribute('data-map-geocoded-count') || 0),
            coordinate_source_count: Number(el.getAttribute('data-map-coordinate-source-count') || 0),
            tile_dom_count: el.querySelectorAll('img[src], canvas, .leaflet-tile, [data-qa-fake-naver-tile="true"]').length,
            visible_tile_count: tileStats.count,
            visible_tile_coverage: Math.round(tileStats.coverage * 1000) / 1000,
            point_button_count: el.querySelectorAll('[data-map-point-button="true"]').length,
            region_button_count: el.querySelectorAll('[data-region-cluster-button="true"]').length,
          };
        });
      }).catch(() => []);
      const allVisibleMapPointsCoordinateReady = !tab.needsMap || mapCoordinateStats.every((item) => (
        item.mode === 'points'
        && item.point_count > 0
        && item.coordinate_count >= item.point_count
        && item.fallback_count === 0
        && item.coordinate_source_count >= item.point_count
        && item.native_marker_count >= item.point_count
        && item.visible_tile_count >= MIN_NAVER_TILE_COUNT
        && item.visible_tile_coverage >= MIN_NAVER_TILE_COVERAGE
        && item.region_button_count === 0
      ));
      const mapProviderStateOk = !tab.needsMap
        || (naverMapCount > 0 && osmMapCount === 0);
      const mapOverlapStateOk = !tab.needsMap
        || waitState.map_point_overlap_ok === true;
      const mapWarningPresent = body.includes('지도 API 미설정') || body.includes('좌표 부족');
      const mapRegionSummaryVisible = /권역\s*\d+개\s*표시|\d+건\s*축약/u.test(body);
      const mapExpandButtonCount = await page.locator('[data-testid="market-map-expand-button"]').count().catch(() => 0);
      const tableCount = await page.locator('table').count().catch(() => 0);
      const sortableTableCount = await page.locator('[data-sortable-table="true"]').count().catch(() => 0);
      const tableHeaderCount = await page.locator('table thead th').count().catch(() => 0);
      const sortableHeaderCount = await page.locator('table thead th[data-sortable-column="true"]').count().catch(() => 0);
      const passiveHeaderCount = await page.locator('table thead th[data-sortable-column="false"]').count().catch(() => 0);
      const nonSortableHeaders = await page.evaluate(() => Array.from(document.querySelectorAll('table thead th'))
        .filter((th) => !th.hasAttribute('data-sortable-column'))
        .map((th) => (th.textContent || '').trim())
        .filter(Boolean)).catch(() => []);
      let sortableHeaderClickOk = true;
      const firstSortableHeaderButton = page.locator('table thead th[data-sortable-column="true"] button').first();
      if (await firstSortableHeaderButton.count().catch(() => 0)) {
        await firstSortableHeaderButton.click().catch(() => null);
        const headerTextAfterClick = await firstSortableHeaderButton.innerText({ timeout: 5000 }).catch(() => '');
        sortableHeaderClickOk = /[\u25b2\u25bc\u2191\u2193]/u.test(headerTextAfterClick);
      }
      const chartCount = await page.locator('[data-chart-role]').count().catch(() => 0);
      const emptyChartCount = await page.locator('[data-chart-empty="true"]').count().catch(() => 0);
      const chartVisualCount = await page.locator('[data-chart-role] rect, [data-chart-role] circle, [data-chart-role] polyline, [data-chart-role] [style*="width:"]').count().catch(() => 0);
      const titleDomCount = await page.getByText(/market\s*data/iu).count().catch(() => 0);
      const regionPrefixDomCount = await page.getByText(/\((수도권|지방)\)/u).count().catch(() => 0);
      const titlePresent = /market\s*data/iu.test(body) || titleDomCount > 0;
      const regionPrefixPresent = /\((수도권|지방)\)/u.test(body) || regionPrefixDomCount > 0;
      const leaseSlicerPresent = body.includes('상/저온') && body.includes('지표');
      const supplySlicerPresent = tab.key !== 'supply-pipeline'
        || (body.includes('유형')
          && body.includes('기간')
          && (await page.locator('input[type="date"]').count().catch(() => 0)) >= 2
          && (await page.locator('[data-supply-range-reset="true"]').count().catch(() => 0)) > 0);
      const transactionSlicerPresent = body.includes('기간') && body.includes('권역') && body.includes('상/저온') && body.includes('실물/선매입');
      const transactionSizeSlicerPresent = tab.key !== 'transactions' || (body.includes('규모별 평당 거래가') && body.includes('규모별 평당 거래가 및 거래시장 규모') && body.includes('규모'));
      const loadingStillPresent = body.includes('시장자료를 불러오는 중입니다.');
      const leaseSlicerPresentClean = tab.key !== 'lease-market'
        || ((await page.getByText('상/저온 구분').count().catch(() => 0)) > 0
          && (await page.getByText('지표').count().catch(() => 0)) > 0
          && (await page.getByText('시점').count().catch(() => 0)) > 0);
      const supplySlicerPresentClean = tab.key !== 'supply-pipeline'
        || ((await page.locator('input[type="date"]').count().catch(() => 0)) >= 2
          && (await page.locator('[data-supply-range-reset="true"]').count().catch(() => 0)) > 0);
      const transactionSlicerPresentClean = tab.key !== 'transactions'
        || ((await page.getByText('기간').count().catch(() => 0)) > 0
          && (await page.getByText('권역').count().catch(() => 0)) > 0
          && (await page.getByText('상/저온').count().catch(() => 0)) > 0);
      const transactionSizeSlicerPresentClean = tab.key !== 'transactions'
        || ((await page.getByText('규모별 평당 거래가').count().catch(() => 0)) > 0
          && (await page.getByText('규모').count().catch(() => 0)) > 0);
      const supplyChartClick = {
        required: tab.key === 'overview',
        ok: tab.key !== 'overview',
        bar_count: 0,
        dialog_visible: false,
        fullscreen_width_ok: false,
        detail_row_count: 0,
        screenshot: '',
      };
      const supplyLegendFocus = {
        required: tab.key === 'overview',
        ok: tab.key !== 'overview',
        legend_count: 0,
        active_count: 0,
        muted_count: 0,
      };
      const transactionMarketChart = {
        required: tab.key === 'transactions',
        ok: tab.key !== 'transactions',
        legend_count: 0,
        detailed_region_legend: false,
        active_count: 0,
        muted_count: 0,
        total_label_count: 0,
        axis_2jo_visible: false,
        dialog_visible: false,
        modal_no_map_attribution: false,
        detail_row_count: 0,
        screenshot: '',
      };
      const capRateChart = {
        required: tab.key === 'transactions',
        ok: tab.key !== 'transactions',
        title_ok: tab.key !== 'transactions',
        axis_ok: false,
        legend_focus_ok: false,
      };
      const transactionSizeExplorer = {
        required: tab.key === 'transactions',
        ok: tab.key !== 'transactions',
        trigger_count: 0,
        dialog_visible: false,
        slicer_visible: false,
        detail_row_count: 0,
      };
      const leaseStatisticExplorer = {
        required: tab.key === 'lease-market',
        ok: tab.key !== 'lease-market',
        trigger_count: 0,
        dialog_visible: false,
        slicer_visible: false,
        detail_row_count: 0,
      };
      const supplyAreaCharts = {
        required: tab.key === 'supply-pipeline',
        ok: tab.key !== 'supply-pipeline',
        title_ok: tab.key !== 'supply-pipeline',
        quarter_axis_ok: false,
        cumulative_modal_visible: tab.key !== 'supply-pipeline',
        cumulative_modal_table_rows: 0,
      };
      if (tab.key === 'overview') {
        const supplyLegends = page.locator('[data-supply-chart-legend="true"]');
        supplyLegendFocus.legend_count = await supplyLegends.count().catch(() => 0);
        if (supplyLegendFocus.legend_count > 1) {
          await supplyLegends.first().click({ timeout: 10000 }).catch(() => null);
          await page.waitForTimeout(150);
          supplyLegendFocus.active_count = await page.locator('[data-supply-chart-legend-active="true"]').count().catch(() => 0);
          supplyLegendFocus.muted_count = await page.locator('[data-supply-chart-legend-muted="true"]').count().catch(() => 0);
          await supplyLegends.first().click({ timeout: 10000 }).catch(() => null);
        }
        supplyLegendFocus.ok = supplyLegendFocus.legend_count > 1
          && supplyLegendFocus.active_count === 1
          && supplyLegendFocus.muted_count >= supplyLegendFocus.legend_count - 1;

        const supplyBars = page.locator('[data-supply-chart-bar="true"][data-supply-chart-clickable="true"]');
        supplyChartClick.bar_count = await supplyBars.count().catch(() => 0);
        if (supplyChartClick.bar_count > 0) {
          await supplyBars.first().click({ timeout: 20000 }).catch(() => null);
          const dialog = page.locator('[role="dialog"]').last();
          supplyChartClick.dialog_visible = await dialog.waitFor({ state: 'visible', timeout: 10000 }).then(() => true).catch(() => false);
          if (supplyChartClick.dialog_visible) {
            const box = await dialog.boundingBox().catch(() => null);
            const viewport = page.viewportSize() || { width: 1440, height: 1100 };
            supplyChartClick.fullscreen_width_ok = Boolean(box && box.width >= viewport.width * 0.9);
            supplyChartClick.detail_row_count = await dialog.locator('table tbody tr').count().catch(() => 0);
            const modalShot = path.join(OUT_DIR, `market-data-supply-period-modal-${stamp}.png`);
            await page.screenshot({ path: modalShot, fullPage: false }).catch(() => null);
            supplyChartClick.screenshot = path.relative(ROOT, modalShot).replace(/\\/gu, '/');
            await page.keyboard.press('Escape').catch(() => null);
          }
        }
        supplyChartClick.ok = supplyChartClick.bar_count > 0
          && supplyChartClick.dialog_visible
          && supplyChartClick.fullscreen_width_ok
          && supplyChartClick.detail_row_count > 0;
      }
      if (tab.key === 'lease-market') {
        const leaseTriggers = page.locator('[data-scoped-bar-clickable="true"], [data-scoped-grouped-bar-clickable="true"]');
        leaseStatisticExplorer.trigger_count = await leaseTriggers.count().catch(() => 0);
        if (leaseStatisticExplorer.trigger_count > 0) {
          await leaseTriggers.first().click({ timeout: 20000, force: true }).catch(() => null);
          const dialog = page.locator('[role="dialog"]').last();
          leaseStatisticExplorer.dialog_visible = await dialog.waitFor({ state: 'visible', timeout: 10000 }).then(() => true).catch(() => false);
          if (leaseStatisticExplorer.dialog_visible) {
            leaseStatisticExplorer.slicer_visible = await dialog.locator('[data-testid="lease-statistic-explorer"]').count().then((count) => count > 0).catch(() => false);
            leaseStatisticExplorer.detail_row_count = await dialog.locator('table tbody tr').count().catch(() => 0);
            await page.keyboard.press('Escape').catch(() => null);
          }
        }
        leaseStatisticExplorer.ok = leaseStatisticExplorer.trigger_count > 0
          && leaseStatisticExplorer.dialog_visible
          && leaseStatisticExplorer.slicer_visible
          && leaseStatisticExplorer.detail_row_count > 0;
      }
      if (tab.key === 'transactions') {
        const marketChart = page.locator('[data-chart-role="stacked-period-bar"]').first();
        transactionMarketChart.total_label_count = await marketChart.locator('[data-stacked-total-label="true"]').count().catch(() => 0);
        const axisTexts = await marketChart.locator('text').allTextContents().catch(() => []);
        transactionMarketChart.axis_2jo_visible = axisTexts.some((item) => item.trim() === '2조');
        const legends = marketChart.locator('[data-stacked-legend="true"]');
        transactionMarketChart.legend_count = await legends.count().catch(() => 0);
        const legendTexts = await legends.allTextContents().catch(() => []);
        transactionMarketChart.detailed_region_legend = legendTexts.some((item) => /\((수도권|지방)\)\s*\S+권/u.test(item.trim()));
        if (transactionMarketChart.legend_count > 1) {
          await legends.first().click({ timeout: 10000 }).catch(() => null);
          await page.waitForTimeout(150);
          transactionMarketChart.active_count = await marketChart.locator('[data-stacked-legend-active="true"]').count().catch(() => 0);
          transactionMarketChart.muted_count = await marketChart.locator('[data-stacked-legend-muted="true"]').count().catch(() => 0);
          await legends.first().click({ timeout: 10000 }).catch(() => null);
        }
        const bars = marketChart.locator('[data-stacked-bar="true"]');
        if ((await bars.count().catch(() => 0)) > 0) {
          await bars.first().click({ timeout: 20000, force: true }).catch(() => null);
          const dialog = page.locator('[role="dialog"]').last();
          transactionMarketChart.dialog_visible = await dialog.waitFor({ state: 'visible', timeout: 10000 }).then(() => true).catch(() => false);
          if (transactionMarketChart.dialog_visible) {
            const dialogText = await dialog.innerText({ timeout: 5000 }).catch(() => '');
            transactionMarketChart.modal_no_map_attribution = !/(NAVER Corp|OpenStreetMap|Map data)/iu.test(dialogText);
            transactionMarketChart.detail_row_count = await dialog.locator('table tbody tr').count().catch(() => 0);
            const modalShot = path.join(OUT_DIR, `market-data-transactions-market-modal-${stamp}.png`);
            await page.screenshot({ path: modalShot, fullPage: false }).catch(() => null);
            transactionMarketChart.screenshot = path.relative(ROOT, modalShot).replace(/\\/gu, '/');
            await page.keyboard.press('Escape').catch(() => null);
          }
        }
        transactionMarketChart.ok = transactionMarketChart.legend_count > 1
          && transactionMarketChart.detailed_region_legend
          && transactionMarketChart.active_count === 1
          && transactionMarketChart.muted_count >= transactionMarketChart.legend_count - 1
          && transactionMarketChart.total_label_count > 0
          && transactionMarketChart.axis_2jo_visible
          && transactionMarketChart.dialog_visible
          && transactionMarketChart.modal_no_map_attribution
          && transactionMarketChart.detail_row_count > 0;
        capRateChart.title_ok = body.includes('Cap Rate 추이') && !body.includes('Cap Rate 일반 추이');
        const capRateAxisTexts = await page.locator('[data-chart-role="multi-line"] text').allTextContents().catch(() => []);
        capRateChart.axis_ok = ['0.00%', '2.00%', '4.00%', '6.00%', '8.00%', '10.00%'].every((tick) => capRateAxisTexts.includes(tick))
          && capRateAxisTexts.some((tick) => /[1-4]Q/u.test(tick))
          && capRateAxisTexts.some((tick) => /20\d{2}년/u.test(tick));
        const capRateLegends = page.locator('[data-chart-role="multi-line"] button');
        const capRateLegendCount = await capRateLegends.count().catch(() => 0);
        if (capRateLegendCount > 1) {
          await capRateLegends.first().click({ timeout: 10000 }).catch(() => null);
          await page.waitForTimeout(150);
          const activeStrokeCount = await page.locator('[data-chart-role="multi-line"] polyline[opacity="0.95"]').count().catch(() => 0);
          const mutedStrokeCount = await page.locator('[data-chart-role="multi-line"] polyline[opacity="0.38"]').count().catch(() => 0);
          capRateChart.legend_focus_ok = activeStrokeCount >= 1 && mutedStrokeCount >= 1;
          await capRateLegends.first().click({ timeout: 10000 }).catch(() => null);
        }
        capRateChart.ok = capRateChart.title_ok && capRateChart.axis_ok && capRateChart.legend_focus_ok;
        const sizeTriggers = page.locator('[data-bar-list-clickable="true"]');
        transactionSizeExplorer.trigger_count = await sizeTriggers.count().catch(() => 0);
        if (transactionSizeExplorer.trigger_count > 0) {
          await sizeTriggers.first().click({ timeout: 20000 }).catch(() => null);
          const dialog = page.locator('[role="dialog"]').last();
          transactionSizeExplorer.dialog_visible = await dialog.waitFor({ state: 'visible', timeout: 10000 }).then(() => true).catch(() => false);
          if (transactionSizeExplorer.dialog_visible) {
            transactionSizeExplorer.slicer_visible = await dialog.locator('[data-testid="transaction-size-explorer"]').count().then((count) => count > 0).catch(() => false);
            transactionSizeExplorer.detail_row_count = await dialog.locator('table tbody tr').count().catch(() => 0);
            await page.keyboard.press('Escape').catch(() => null);
          }
        }
        transactionSizeExplorer.ok = transactionSizeExplorer.trigger_count > 0
          && transactionSizeExplorer.dialog_visible
          && transactionSizeExplorer.slicer_visible
          && transactionSizeExplorer.detail_row_count > 0;
      }
      if (tab.key === 'supply-pipeline') {
        const supplyChartLabels = await page.locator('[data-chart-role="supply-area"]').evaluateAll((nodes) => nodes
          .map((node) => node.getAttribute('aria-label') || '')
          .filter(Boolean)).catch(() => []);
        supplyAreaCharts.title_ok = supplyChartLabels.includes('향후 공급 예정 물량') && supplyChartLabels.includes('누적 공급 면적');
        const supplyAxisTexts = await page.locator('[data-chart-role="supply-area"] text').allTextContents().catch(() => []);
        supplyAreaCharts.quarter_axis_ok = supplyAxisTexts.some((item) => /[1-4]Q/u.test(item))
          && supplyAxisTexts.some((item) => /20\d{2}년/u.test(item));
        const cumulativeChart = page.locator('[data-chart-role="supply-area"][aria-label="누적 공급 면적"]').first();
        const cumulativeBars = cumulativeChart.locator('[data-supply-chart-bar="true"][data-supply-chart-clickable="true"]');
        const cumulativeBarCount = await cumulativeBars.count().catch(() => 0);
        if (cumulativeBarCount > 0) {
          await cumulativeBars.first().click({ timeout: 20000 }).catch(() => null);
          const dialog = page.locator('[role="dialog"]').last();
          supplyAreaCharts.cumulative_modal_visible = await dialog.waitFor({ state: 'visible', timeout: 10000 }).then(() => true).catch(() => false);
          if (supplyAreaCharts.cumulative_modal_visible) {
            supplyAreaCharts.cumulative_modal_table_rows = await dialog.locator('[data-testid="supply-area-value-explorer"] ~ [data-sortable-table="true"] tbody tr').count().catch(() => 0);
            await page.keyboard.press('Escape').catch(() => null);
          }
        }
        supplyAreaCharts.ok = supplyAreaCharts.title_ok
          && supplyAreaCharts.quarter_axis_ok
          && supplyAreaCharts.cumulative_modal_visible
          && supplyAreaCharts.cumulative_modal_table_rows > 0;
      }
      const requiresTable = tab.key !== 'overview';
      const requiresRegionPrefix = ['lease-market', 'supply-pipeline', 'transactions'].includes(tab.key);
      const requiresChart = tab.key !== 'source-update';
      const row = {
        key: tab.key,
        url: page.url(),
        screenshot: path.relative(ROOT, screenshot).replace(/\\/gu, '/'),
        api_ok: apiBody?.ok === true && apiBody?.data?.summary?.status === 'ready',
        view_present: Boolean(apiBody?.data?.views?.[tab.viewKey]),
        view_has_rows: hasRequiredRows(apiBody, tab.viewKey),
        api_data_quality: apiBody?.data?.summary?.data_quality || null,
        wait_state: waitState,
        map_coordinate_stats: mapCoordinateStats,
        all_visible_map_points_coordinate_ready: allVisibleMapPointsCoordinateReady,
        map_provider_state_ok: mapProviderStateOk,
        map_overlap_state_ok: mapOverlapStateOk,
        map_region_summary_visible: mapRegionSummaryVisible,
        map_expand_button_count: mapExpandButtonCount,
        map_region_cluster_overlap: waitState.map_region_cluster_overlap || [],
        map_point_overlap: waitState.map_point_overlap || [],
        loading_still_present: loadingStillPresent,
        title_present: titlePresent,
        has_broken_question_marks: /\?{4,}/u.test(body),
        internal_tokens_visible: /\bll_|source_row_id|source_file_id|payload|natural_key|natural\s+key|row_hash|row\s+hash|\bPNU\b|\bpnu\b|법정동코드/iu.test(body),
        naver_auth_failure_present: NAVER_MAP_AUTH_FAILURE_RE.test(body),
        map_count: mapCount,
        naver_map_count: naverMapCount,
        osm_map_count: osmMapCount,
        fallback_map_count: fallbackMapCount,
        map_warning_present: mapWarningPresent,
        table_count: tableCount,
        sortable_table_count: sortableTableCount,
        table_header_count: tableHeaderCount,
        sortable_header_count: sortableHeaderCount,
        passive_header_count: passiveHeaderCount,
        non_sortable_headers: nonSortableHeaders,
        sortable_header_click_ok: sortableHeaderClickOk,
        chart_count: chartCount,
        empty_chart_count: emptyChartCount,
        chart_visual_count: chartVisualCount,
        region_prefix_present: regionPrefixPresent,
        lease_slicer_present: leaseSlicerPresentClean,
        supply_slicer_present: supplySlicerPresentClean,
        transaction_slicer_present: transactionSlicerPresentClean,
        transaction_size_slicer_present: transactionSizeSlicerPresentClean,
        supply_chart_click: supplyChartClick,
        supply_legend_focus: supplyLegendFocus,
        transaction_market_chart: transactionMarketChart,
        transaction_size_explorer: transactionSizeExplorer,
        lease_statistic_explorer: leaseStatisticExplorer,
        cap_rate_chart: capRateChart,
        supply_area_charts: supplyAreaCharts,
      };
      row.ok = row.api_ok
        && waitState.shell_ready
        && waitState.loading_gone
        && (!requiresTable || waitState.table_ready)
        && waitState.chart_ready
        && waitState.naver_ready
        && !row.loading_still_present
        && row.view_present
        && row.view_has_rows
        && row.title_present
        && !row.has_broken_question_marks
        && !row.internal_tokens_visible
        && !row.naver_auth_failure_present
        && !row.map_warning_present
        && (!requiresTable || tableCount > 0)
        && (!requiresTable || sortableTableCount === tableCount)
        && sortableHeaderCount + passiveHeaderCount === tableHeaderCount
        && nonSortableHeaders.length === 0
        && sortableHeaderClickOk
        && mapProviderStateOk
        && (!tab.needsMap || waitState.map_large_button_ready)
        && (!tab.needsMap || waitState.map_points_coordinate_ready)
        && allVisibleMapPointsCoordinateReady
        && (tab.key !== 'overview' || supplyLegendFocus.ok)
        && (!tab.needsMap || !mapRegionSummaryVisible)
        && (!tab.needsMap || mapExpandButtonCount > 0)
        && mapOverlapStateOk
        && (!requiresChart || chartCount > 0)
        && emptyChartCount === 0
        && (!requiresChart || chartVisualCount > 0)
        && (!requiresRegionPrefix || row.region_prefix_present)
        && (tab.key !== 'lease-market' || row.lease_slicer_present)
        && (tab.key !== 'supply-pipeline' || row.supply_slicer_present)
        && (tab.key !== 'supply-pipeline' || row.supply_area_charts.ok)
        && (tab.key !== 'overview' || row.supply_chart_click.ok)
        && (tab.key !== 'lease-market' || row.lease_statistic_explorer.ok)
        && (tab.key !== 'transactions' || (row.transaction_slicer_present && row.transaction_size_slicer_present && row.transaction_market_chart.ok && row.transaction_size_explorer.ok && row.cap_rate_chart.ok));
      report.tabs.push(row);
    }
    report.ok = report.tabs.every((tab) => tab.ok) && report.errors.length === 0;
  } catch (error) {
    report.errors.push(error?.message || String(error));
  } finally {
    if (browser) await browser.close();
  }
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(latestJson, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`market data browser smoke ${report.ok ? 'PASS' : 'FAIL'}: ${path.relative(ROOT, outJson)}`);
  if (!report.ok) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
