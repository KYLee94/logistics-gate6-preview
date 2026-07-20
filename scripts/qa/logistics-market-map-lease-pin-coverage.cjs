const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT_DIR = path.join(ROOT, 'qa-artifacts', 'logistics-gate6');
const DEFAULT_BASE_URL = 'https://kylee94.github.io/logistics-gate6-preview/';
const LEASE_ROUTE = 'market-data/lease-market';
const EXPECTED_VISIBLE_ASSET_COUNT = 927;
const EXPECTED_PIN_COUNT = 681;
const EXPECTED_REGION_PIN_COUNTS = {
  동남권: 247,
  남부권: 112,
  중앙권: 43,
  서부권: 98,
  서북권: 38,
  '수도권 기타권': 22,
  경남권: 39,
  충청권: 37,
  전라권: 22,
  경북권: 20,
  '지방 기타권': 3,
};
const REPRESENTATIVE_REGION = '동남권';
const MAP_SELECTOR = '[data-testid="market-map-panel"]';
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
  const prefix = `--${name}=`;
  const equalsArg = process.argv.find((arg) => arg.startsWith(prefix));
  if (equalsArg) return equalsArg.slice(prefix.length);
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : (process.argv[index + 1] || fallback);
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
  if (!session.expires_at && session.expires_in) session.expires_at = Math.round(Date.now() / 1000) + Number(session.expires_in);
  return { source: 'password_grant', session };
}

function mapStateOk(state, expectedPointCount = null) {
  return state.provider === 'naver'
    && state.naver_ready === true
    && state.osm_ready === false
    && state.fallback_ready === false
    && state.fallback_count === 0
    && state.stale === false
    && state.auth_failure_visible === false
    && state.coordinate_count >= state.point_count
    && state.coordinate_source_count >= state.point_count
    && state.native_marker_count >= state.point_count
    && (expectedPointCount === null || state.point_count === expectedPointCount);
}

async function collectMapState(page, selector = MAP_SELECTOR) {
  return page.evaluate((target) => {
    const panel = document.querySelector(target);
    if (!panel) return null;
    const bool = (name) => panel.getAttribute(name) === 'true';
    const stale = bool('data-map-stale')
      || panel.getAttribute('data-map-cache-state') === 'stale'
      || panel.getAttribute('data-map-data-status') === 'stale';
    return {
      provider: panel.getAttribute('data-map-provider') || '',
      mode: panel.getAttribute('data-map-mode') || '',
      selected_region: panel.getAttribute('data-map-selected-region') || '',
      visible_asset_count: Number(panel.getAttribute('data-map-visible-asset-count') || 0),
      point_count: Number(panel.getAttribute('data-map-point-count') || 0),
      native_marker_count: Number(panel.getAttribute('data-map-native-marker-count') || 0),
      coordinate_count: Number(panel.getAttribute('data-map-coordinate-count') || 0),
      coordinate_source_count: Number(panel.getAttribute('data-map-coordinate-source-count') || 0),
      fallback_count: Number(panel.getAttribute('data-map-fallback-count') || 0),
      naver_ready: bool('data-naver-map-ready'),
      osm_ready: bool('data-osm-map-ready'),
      fallback_ready: bool('data-map-fallback-ready'),
      stale,
      region_button_count: panel.querySelectorAll('[data-region-cluster-button="true"]').length,
      point_button_count: panel.querySelectorAll('[data-map-point-button="true"]').length,
      auth_failure_visible: /네이버\s*지도\s*Open\s*API\s*인증|Open API 인증|인증.*실패|unauthorized|authentication|forbidden|invalid\s*client/iu.test(panel.textContent || ''),
    };
  }, selector);
}

async function waitForOverview(page, selector = MAP_SELECTOR) {
  await page.waitForFunction(({ target, visibleAssetCount }) => {
    const panel = document.querySelector(target);
    return panel
      && panel.getAttribute('data-map-mode') === 'regions'
      && Number(panel.getAttribute('data-map-visible-asset-count') || 0) === visibleAssetCount
      && Number(panel.getAttribute('data-map-point-count') || 0) === 0
      && panel.getAttribute('data-map-provider') === 'naver'
      && panel.getAttribute('data-naver-map-ready') === 'true'
      && panel.getAttribute('data-osm-map-ready') === 'false'
      && panel.getAttribute('data-map-fallback-ready') === 'false';
  }, { target: selector, visibleAssetCount: EXPECTED_VISIBLE_ASSET_COUNT }, { timeout: 120000 });
}

async function selectRegion(page, region, expectedPointCount, selector = MAP_SELECTOR) {
  const encodedRegion = encodeURIComponent(region);
  const button = page.locator(`${selector} [data-region-cluster-button="true"][data-region-key="${encodedRegion}"]`).first();
  await button.waitFor({ state: 'visible', timeout: 30000 });
  await button.click({ timeout: 20000 }).catch(() => button.click({ force: true, timeout: 5000 }));
  await page.waitForFunction(({ target, expectedRegion, expectedCount }) => {
    const panel = document.querySelector(target);
    return panel
      && panel.getAttribute('data-map-mode') === 'points'
      && panel.getAttribute('data-map-selected-region') === expectedRegion
      && Number(panel.getAttribute('data-map-point-count') || 0) === expectedCount
      && Number(panel.getAttribute('data-map-fallback-count') || 0) === 0
      && panel.getAttribute('data-map-provider') === 'naver'
      && panel.getAttribute('data-naver-map-ready') === 'true'
      && panel.getAttribute('data-osm-map-ready') === 'false'
      && panel.getAttribute('data-map-fallback-ready') === 'false';
  }, { target: selector, expectedRegion: region, expectedCount: expectedPointCount }, { timeout: 120000 });
  return collectMapState(page, selector);
}

async function resetToOverview(page, selector = MAP_SELECTOR) {
  const reset = page.locator(`${selector} [data-testid="market-map-region-reset"]`).first();
  await reset.click({ timeout: 15000 });
  await waitForOverview(page, selector);
}

async function findRepresentativePin(page, selector = MAP_SELECTOR) {
  return page.evaluate((target) => {
    const panel = document.querySelector(target);
    if (!panel) return null;
    const panelRect = panel.getBoundingClientRect();
    const controls = /zoom|layer|map type|cadastral|satellite|normal|확대|축소|지도/iu;
    const candidates = Array.from(panel.querySelectorAll('[data-map-point-button="true"], .leaflet-marker-icon, [title]'))
      .filter((node) => !node.closest('[data-region-cluster-button="true"]') && !node.closest('.logistics-map-callout'))
      .map((node) => {
        const rect = node.getBoundingClientRect();
        const style = getComputedStyle(node);
        const label = node.getAttribute('title') || node.getAttribute('aria-label') || node.getAttribute('data-map-asset-name') || '';
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        return { node, rect, style, label, centerX, centerY };
      })
      .filter(({ rect, style, label, centerX, centerY }) => (
        label
        && !controls.test(label)
        && rect.width >= 6 && rect.width <= 120
        && rect.height >= 6 && rect.height <= 120
        && style.display !== 'none'
        && style.visibility !== 'hidden'
        && Number(style.opacity || 1) > 0
        && centerX >= panelRect.left && centerX <= panelRect.right
        && centerY >= panelRect.top && centerY <= panelRect.bottom
      ));
    const candidate = candidates[0];
    if (!candidate) return null;
    return { label: candidate.label, x: candidate.centerX, y: candidate.centerY };
  }, selector);
}

async function hoverRepresentativePinAndVerifyCallout(page, selector = MAP_SELECTOR) {
  const pin = await findRepresentativePin(page, selector);
  if (!pin) return { ok: false, error: 'No representative pin could be located for hover.' };
  await page.mouse.move(pin.x, pin.y);
  const visible = await page.waitForFunction((target) => {
    const panel = document.querySelector(target);
    return Array.from(panel?.querySelectorAll('.logistics-map-callout') || []).some((node) => {
      const rect = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
    });
  }, selector, { timeout: 10000 }).then(() => true).catch(() => false);
  return { ok: visible, pin_label: pin.label };
}

function writeArtifact(report) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const stamp = timestampForFile();
  const artifact = path.join(OUT_DIR, `market-map-lease-pin-coverage-${stamp}.json`);
  fs.writeFileSync(artifact, JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(OUT_DIR, 'market-map-lease-pin-coverage-latest.json'), JSON.stringify(report, null, 2));
  return artifact;
}

async function main() {
  const expectedCountTotal = Object.values(EXPECTED_REGION_PIN_COUNTS).reduce((sum, count) => sum + count, 0);
  if (expectedCountTotal !== EXPECTED_PIN_COUNT) throw new Error('The regional pin baseline does not add up to EXPECTED_PIN_COUNT.');

  const baseUrl = argValue('base-url', DEFAULT_BASE_URL);
  const report = {
    ok: false,
    generated_at: new Date().toISOString(),
    script: 'qa:market-map:lease-pin-coverage',
    base_url: baseUrl,
    route: LEASE_ROUTE,
    expected_visible_asset_count: EXPECTED_VISIBLE_ASSET_COUNT,
    expected_pin_count: EXPECTED_PIN_COUNT,
    representative_region: REPRESENTATIVE_REGION,
    regions: [],
    errors: [],
    warnings: [],
  };
  let browser;
  try {
    const auth = await signInSession();
    report.auth_source = auth.source;
    const email = auth.session.user?.email || envValue('LOGISTICS_BROWSER_UI_EMAIL') || 'kylee@igisam.com';
    browser = await chromium.launch({ headless: true, executablePath: chromeExecutablePath() });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block' });
    await context.addInitScript(({ session, injectedEmail }) => {
      sessionStorage.setItem('sb-iota-auth-token', JSON.stringify(session));
      sessionStorage.setItem('logistics_preview_auth', JSON.stringify({ email: injectedEmail }));
      localStorage.setItem('logisticsDashboardReadMode', 'primary-safe');
    }, { session: auth.session, injectedEmail: email });
    const page = await context.newPage();
    page.on('pageerror', (error) => report.errors.push(`pageerror: ${error?.message || String(error)}`));
    page.on('console', (message) => {
      if (message.type() !== 'error' || /favicon/iu.test(message.text())) return;
      const text = message.text();
      if (NAVER_MAP_AUTH_FAILURE_RE.test(text)) report.errors.push(`console: ${text}`);
      else report.warnings.push(`console: ${text}`);
    });

    await page.goto(joinUrl(baseUrl, LEASE_ROUTE), { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('[data-testid="market-data-dashboard"]', { timeout: 60000 });
    await waitForOverview(page);
    report.overview = await collectMapState(page);
    if (!mapStateOk(report.overview) || report.overview.visible_asset_count !== EXPECTED_VISIBLE_ASSET_COUNT || report.overview.region_button_count !== Object.keys(EXPECTED_REGION_PIN_COUNTS).length) {
      report.errors.push('Initial overview is not the required 927-asset Naver-only region map.');
    }

    for (const [region, expectedPointCount] of Object.entries(EXPECTED_REGION_PIN_COUNTS)) {
      const state = await selectRegion(page, region, expectedPointCount);
      const row = {
        region,
        expected_point_count: expectedPointCount,
        observed: state,
        ok: mapStateOk(state, expectedPointCount) && state.selected_region === region,
      };
      report.regions.push(row);
      if (!row.ok) report.errors.push(`${region} did not expose the required Naver-only point count.`);
      await resetToOverview(page);
    }

    report.region_point_sum = report.regions.reduce((sum, row) => sum + Number(row.observed?.point_count || 0), 0);
    if (report.region_point_sum !== EXPECTED_PIN_COUNT) report.errors.push(`Regional pin total was ${report.region_point_sum}, expected ${EXPECTED_PIN_COUNT}.`);

    const representativeState = await selectRegion(page, REPRESENTATIVE_REGION, EXPECTED_REGION_PIN_COUNTS[REPRESENTATIVE_REGION]);
    report.representative = { region: REPRESENTATIVE_REGION, state: representativeState };
    const expandButton = page.locator('[data-testid="market-map-expand-button"]').first();
    await expandButton.click({ timeout: 15000 });
    const dialog = page.locator('[role="dialog"]').last();
    await dialog.waitFor({ state: 'visible', timeout: 15000 });
    const largeSelector = '[role="dialog"] [data-testid="market-map-panel"]';
    await page.waitForFunction(({ target, region, expectedCount }) => {
      const panel = document.querySelector(target);
      return panel
        && panel.getAttribute('data-map-selected-region') === region
        && Number(panel.getAttribute('data-map-point-count') || 0) === expectedCount
        && panel.getAttribute('data-map-provider') === 'naver'
        && panel.getAttribute('data-naver-map-ready') === 'true'
        && panel.getAttribute('data-osm-map-ready') === 'false'
        && panel.getAttribute('data-map-fallback-ready') === 'false';
    }, { target: largeSelector, region: REPRESENTATIVE_REGION, expectedCount: EXPECTED_REGION_PIN_COUNTS[REPRESENTATIVE_REGION] }, { timeout: 60000 });
    report.large_map = await collectMapState(page, largeSelector);
    report.large_map.ok = mapStateOk(report.large_map, EXPECTED_REGION_PIN_COUNTS[REPRESENTATIVE_REGION]);
    if (!report.large_map.ok) report.errors.push('Representative large map did not preserve the required Naver-only pin state.');
    await dialog.locator('button').first().click({ timeout: 10000 });
    await dialog.waitFor({ state: 'detached', timeout: 10000 }).catch(() => null);

    await page.goto(joinUrl(baseUrl, 'market-data/overview'), { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('[data-testid="market-data-dashboard"]', { timeout: 60000 });
    await page.goto(joinUrl(baseUrl, LEASE_ROUTE), { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('[data-testid="market-data-dashboard"]', { timeout: 60000 });
    await waitForOverview(page);
    report.reentry = { overview: await collectMapState(page) };
    report.reentry.overview_ok = mapStateOk(report.reentry.overview)
      && report.reentry.overview.visible_asset_count === EXPECTED_VISIBLE_ASSET_COUNT;
    report.reentry.representative = await selectRegion(page, REPRESENTATIVE_REGION, EXPECTED_REGION_PIN_COUNTS[REPRESENTATIVE_REGION]);
    report.reentry.representative_ok = mapStateOk(report.reentry.representative, EXPECTED_REGION_PIN_COUNTS[REPRESENTATIVE_REGION]);
    if (!report.reentry.overview_ok || !report.reentry.representative_ok) report.errors.push('Lease-market tab reentry did not reproduce the required map counts.');

    report.hover_callout = await hoverRepresentativePinAndVerifyCallout(page);
    if (!report.hover_callout.ok) report.errors.push(report.hover_callout.error || 'Representative pin hover did not show a callout.');

    await resetToOverview(page);
    const leaseCenterTable = page.locator('table').filter({
      has: page.getByRole('columnheader', { name: /센터명/u }),
    }).last();
    const firstLeaseCenterRow = leaseCenterTable.locator('tbody tr').first();
    await firstLeaseCenterRow.click({ timeout: 15000 });
    const detailDialog = page.locator('[role="dialog"]').last();
    await detailDialog.waitFor({ state: 'visible', timeout: 15000 });
    const detailMapButton = detailDialog.locator('[data-testid="lease-center-map-button"]');
    const detailMapButtonEnabled = await detailMapButton.isEnabled().catch(() => false);
    if (detailMapButtonEnabled) await detailMapButton.click({ timeout: 15000 });
    const nestedMapDialog = page.locator('[role="dialog"]').last();
    const nestedMapReady = detailMapButtonEnabled
      ? await page.waitForFunction(() => {
        const dialogs = Array.from(document.querySelectorAll('[role="dialog"]'));
        const panel = dialogs.at(-1)?.querySelector('[data-testid="market-map-panel"]');
        return dialogs.length >= 2
          && panel?.getAttribute('data-map-provider') === 'naver'
          && panel?.getAttribute('data-naver-map-ready') === 'true'
          && panel?.getAttribute('data-osm-map-ready') === 'false'
          && panel?.getAttribute('data-map-fallback-ready') === 'false'
          && Number(panel?.getAttribute('data-map-point-count') || 0) === 1
          && Number(panel?.getAttribute('data-map-fallback-count') || 0) === 0;
      }, undefined, { timeout: 60000 }).then(() => true).catch(() => false)
      : false;
    let detailMapScreenshot = '';
    if (nestedMapReady) {
      fs.mkdirSync(OUT_DIR, { recursive: true });
      detailMapScreenshot = path.join(OUT_DIR, `market-map-lease-center-detail-${timestampForFile()}.png`);
      await nestedMapDialog.screenshot({ path: detailMapScreenshot });
    }
    report.lease_center_detail_map = {
      button_enabled: detailMapButtonEnabled,
      nested_dialog_visible: detailMapButtonEnabled && (await nestedMapDialog.isVisible().catch(() => false)),
      naver_single_pin_ready: nestedMapReady,
      screenshot: detailMapScreenshot ? path.relative(ROOT, detailMapScreenshot) : '',
    };
    if (!detailMapButtonEnabled || !nestedMapReady) report.errors.push('Lease center detail map did not open as an exact one-pin Naver map.');
  } catch (error) {
    report.errors.push(error?.stack || error?.message || String(error));
  } finally {
    if (browser) await browser.close().catch(() => null);
  }

  report.ok = report.errors.length === 0
    && report.regions.length === Object.keys(EXPECTED_REGION_PIN_COUNTS).length
    && report.regions.every((row) => row.ok)
    && report.region_point_sum === EXPECTED_PIN_COUNT
    && report.large_map?.ok === true
    && report.reentry?.overview_ok === true
    && report.reentry?.representative_ok === true
    && report.hover_callout?.ok === true
    && report.lease_center_detail_map?.naver_single_pin_ready === true;
  report.artifact = writeArtifact(report);
  console.log(`market map lease pin coverage ${report.ok ? 'PASS' : 'FAIL'}: ${report.artifact}`);
  if (!report.ok) process.exitCode = 1;
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error?.stack || error?.message || error);
    process.exit(1);
  });
}

module.exports = { EXPECTED_REGION_PIN_COUNTS, EXPECTED_PIN_COUNT, EXPECTED_VISIBLE_ASSET_COUNT, main };
