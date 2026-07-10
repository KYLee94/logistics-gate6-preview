const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const {
  ROOT,
  OUT_DIR,
  argsValue,
  chromeExecutablePath,
  envValue,
  joinUrl,
  signIn,
  timestampForFile,
} = require('./logistics-data-management-qa-utils.cjs');

const DEFAULT_BASE_URL = 'https://kylee94.github.io/logistics-gate6-preview/';
const PORTFOLIO_SOURCE = path.join(ROOT, 'src', 'components', 'system', 'workspace', 'WorkspaceLogistics.jsx');
const MARKET_SOURCE = path.join(ROOT, 'src', 'components', 'system', 'workspace', 'LogisticsSectorModules.jsx');
const PROVIDERS = ['naver', 'osm-fallback'];
const VIEWPORTS = [
  { key: 'desktop-1440x900', width: 1440, height: 900 },
  { key: 'desktop-1280x720', width: 1280, height: 720 },
  { key: 'tablet-768x1024', width: 768, height: 1024 },
  { key: 'mobile-390x844', width: 390, height: 844 },
];
const EDGE_TARGETS = [
  { key: 'left', x: 0.08, y: 0.5 },
  { key: 'right', x: 0.92, y: 0.5 },
  { key: 'top', x: 0.5, y: 0.1 },
  { key: 'bottom', x: 0.5, y: 0.9 },
  { key: 'top-left', x: 0.08, y: 0.1 },
  { key: 'top-right', x: 0.92, y: 0.1 },
  { key: 'bottom-left', x: 0.08, y: 0.9 },
  { key: 'bottom-right', x: 0.92, y: 0.9 },
];

const TITLES = {
  transactions: '\uAC70\uB798 \uC790\uC0B0 \uC704\uCE58',
  lease: '\uAD8C\uC5ED\uBCC4 \uC13C\uD130',
  newSupply: '\uB2F9\uBD84\uAE30 \uC2E0\uADDC\uACF5\uAE09',
  plannedSupply: '\uACF5\uAE09 \uC608\uC815 \uC9C0\uB3C4',
  cumulativeSupply: '\uB204\uC801 \uC2E0\uADDC\uACF5\uAE09',
};

const MARKET_ROUTE_TITLES = {
  'market-data/transactions': [TITLES.transactions],
  'market-data/lease-market': [TITLES.lease],
  'market-data/supply-pipeline': [TITLES.newSupply, TITLES.plannedSupply, TITLES.cumulativeSupply],
};

const SURFACES = [
  { id: 'home-portfolio', kind: 'portfolio', route: 'dashboard/home' },
  { id: 'company-tenant-assets', kind: 'portfolio', route: 'dashboard/company' },
  { id: 'company-tenant-assets-large', kind: 'portfolio-modal', route: 'dashboard/company', openButton: /\uC9C0\uB3C4 \uD06C\uAC8C \uBCF4\uAE30/u },
  { id: 'asset-location-popup', kind: 'portfolio-modal', route: 'dashboard/asset', openButton: /\uC790\uC0B0 \uC704\uCE58 \uBCF4\uAE30/u },
  { id: 'market-transactions', kind: 'market', route: 'market-data/transactions', title: TITLES.transactions },
  { id: 'market-transactions-large', kind: 'market-large', route: 'market-data/transactions', title: TITLES.transactions },
  { id: 'market-lease', kind: 'market', route: 'market-data/lease-market', title: TITLES.lease },
  { id: 'market-lease-large', kind: 'market-large', route: 'market-data/lease-market', title: TITLES.lease },
  { id: 'market-new-supply', kind: 'market', route: 'market-data/supply-pipeline', title: TITLES.newSupply },
  { id: 'market-new-supply-large', kind: 'market-large', route: 'market-data/supply-pipeline', title: TITLES.newSupply },
  { id: 'market-planned-supply', kind: 'market', route: 'market-data/supply-pipeline', title: TITLES.plannedSupply },
  { id: 'market-planned-supply-large', kind: 'market-large', route: 'market-data/supply-pipeline', title: TITLES.plannedSupply },
  { id: 'market-cumulative-supply', kind: 'market', route: 'market-data/supply-pipeline', title: TITLES.cumulativeSupply },
  { id: 'market-cumulative-supply-large', kind: 'market-large', route: 'market-data/supply-pipeline', title: TITLES.cumulativeSupply },
];

function normalized(value) {
  return String(value || '').replace(/\s+/gu, ' ').trim();
}

function safeName(value) {
  return normalized(value).replace(/[^a-z0-9_-]+/giu, '-').replace(/^-+|-+$/gu, '').slice(0, 120) || 'item';
}

function assessGeometry(container, pin, callout) {
  const containerLeft = container.left ?? container.x;
  const containerTop = container.top ?? container.y;
  const pinLeft = pin.left ?? pin.x;
  const pinTop = pin.top ?? pin.y;
  const calloutLeft = callout.left ?? callout.x;
  const calloutTop = callout.top ?? callout.y;
  const centerDeltaX = Math.abs((calloutLeft + callout.width / 2) - (pinLeft + pin.width / 2));
  const verticalGap = pinTop - (calloutTop + callout.height);
  const insideContainer = calloutLeft >= containerLeft + 8
    && calloutTop >= containerTop + 8
    && calloutLeft + callout.width <= containerLeft + container.width - 8
    && calloutTop + callout.height <= containerTop + container.height - 8;
  return {
    center_delta_x: centerDeltaX,
    vertical_gap: verticalGap,
    centered: centerDeltaX <= 8,
    directly_above: verticalGap >= 4 && verticalGap <= 24,
    inside_container: insideContainer,
    ok: centerDeltaX <= 8 && verticalGap >= 4 && verticalGap <= 24 && insideContainer,
  };
}

function sourceRegistry() {
  const portfolioSource = fs.readFileSync(PORTFOLIO_SOURCE, 'utf8');
  const marketSource = fs.readFileSync(MARKET_SOURCE, 'utf8');
  const portfolioMapUsageCount = (portfolioSource.match(/<PortfolioMapPlot\b/gu) || []).length;
  const sourceMarketTitles = [...marketSource.matchAll(/<MarketMapPanel\s+title="([^"]+)"/gu)].map((match) => match[1]).sort();
  const expectedMarketTitles = Object.values(TITLES).sort();
  const surfaceIds = SURFACES.map((surface) => surface.id);
  const checks = {
    surface_ids_unique: new Set(surfaceIds).size === surfaceIds.length,
    viewport_matrix_exact: JSON.stringify(VIEWPORTS.map(({ width, height }) => [width, height]))
      === JSON.stringify([[1440, 900], [1280, 720], [768, 1024], [390, 844]]),
    portfolio_map_usages_registered: portfolioMapUsageCount === 4,
    market_map_titles_registered: JSON.stringify(sourceMarketTitles) === JSON.stringify(expectedMarketTitles),
    every_market_map_has_base_and_large_surface: expectedMarketTitles.every((title) => (
      SURFACES.some((surface) => surface.kind === 'market' && surface.title === title)
      && SURFACES.some((surface) => surface.kind === 'market-large' && surface.title === title)
    )),
  };
  return {
    ok: Object.values(checks).every(Boolean),
    checks,
    portfolio_map_usage_count: portfolioMapUsageCount,
    source_market_titles: sourceMarketTitles,
    expected_market_titles: expectedMarketTitles,
  };
}

function runSelfTest() {
  const registry = sourceRegistry();
  const container = { left: 0, top: 0, width: 400, height: 300 };
  const pin = { left: 196, top: 180, width: 8, height: 16 };
  const passing = assessGeometry(container, pin, { left: 100, top: 116, width: 200, height: 48 });
  const offCenter = assessGeometry(container, pin, { left: 80, top: 116, width: 200, height: 48 });
  const tooFarAbove = assessGeometry(container, pin, { left: 100, top: 90, width: 200, height: 48 });
  const clipped = assessGeometry(container, { left: 14, top: 180, width: 8, height: 16 }, { left: -86, top: 116, width: 200, height: 48 });
  const checks = {
    source_registry: registry.ok,
    passing_geometry: passing.ok,
    off_center_rejected: !offCenter.ok && !offCenter.centered,
    excessive_vertical_gap_rejected: !tooFarAbove.ok && !tooFarAbove.directly_above,
    clipped_callout_rejected: !clipped.ok && !clipped.inside_container,
  };
  const report = { ok: Object.values(checks).every(Boolean), checks, registry };
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exitCode = 1;
}

function logisticsRoute(route) {
  return `platform/iotaseoul/workspace/logistics/${route}`;
}

function providerFromRoot(root) {
  const explicit = root.getAttribute('data-map-provider');
  if (explicit) return explicit;
  if (root.querySelector('.leaflet-pane')) return 'osm';
  const text = String(root.textContent || '').replace(/\s+/gu, ' ').trim();
  if (/\uB124\uC774\uBC84 \uC9C0\uB3C4/u.test(text)) return 'naver';
  if (/\uB300\uCCB4 \uC9C0\uB3C4|OpenStreetMap/iu.test(text)) return 'osm';
  return 'fallback';
}

async function waitForRouteReady(page, expectedRoute) {
  await page.waitForFunction((route) => {
    const text = document.body?.innerText || '';
    return location.pathname.includes(route) && text.trim().length >= 200 && !location.pathname.includes('/auth-setup');
  }, expectedRoute, { timeout: 90000 });
}

async function marketPanelInventory(page) {
  return page.locator('[data-testid="market-map-panel"]').evaluateAll((nodes) => nodes.map((node, index) => {
    const rect = node.getBoundingClientRect();
    const header = node.parentElement?.firstElementChild?.firstElementChild?.textContent || '';
    return {
      index,
      title: header.replace(/\s+/gu, ' ').trim(),
      visible: rect.width > 0 && rect.height > 0,
      provider: node.getAttribute('data-map-provider') || '',
    };
  }));
}

async function assertRuntimeMarketRegistry(page, route) {
  const expected = [...(MARKET_ROUTE_TITLES[route] || [])].sort();
  await page.waitForFunction((count) => {
    const nodes = [...document.querySelectorAll('[data-testid="market-map-panel"]')];
    return nodes.filter((node) => {
      const rect = node.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    }).length >= count;
  }, expected.length, { timeout: 90000 });
  const actual = (await marketPanelInventory(page)).filter((item) => item.visible).map((item) => item.title).sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`Unregistered market map on ${route}: expected ${JSON.stringify(expected)}, found ${JSON.stringify(actual)}`);
  }
}

async function locateMarketPanel(page, title, useLast = false) {
  const inventory = await marketPanelInventory(page);
  const matches = inventory.filter((item) => item.visible && item.title === title);
  if (!matches.length) throw new Error(`Market map panel not found: ${title}`);
  const selected = useLast ? matches[matches.length - 1] : matches[0];
  return page.locator('[data-testid="market-map-panel"]').nth(selected.index);
}

async function tagRoot(root, token) {
  await root.evaluate((node, value) => node.setAttribute('data-qa-map-matrix-root', value), token);
  return `[data-qa-map-matrix-root="${token}"]`;
}

async function listPins(page, rootSelector) {
  return page.evaluate((selector) => {
    const root = document.querySelector(selector);
    if (!root) return [];
    const rootRect = root.getBoundingClientRect();
    const nodes = [...root.querySelectorAll('[data-map-point-button="true"], .leaflet-marker-icon:not(.market-map-region-cluster-icon), [title]')];
    const controls = /zoom|layer|map type|cadastral|satellite|normal|\uD655\uB300|\uCD95\uC18C|\uC9C0\uB3C4/iu;
    const candidates = nodes.map((node) => {
      const rect = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      const label = node.getAttribute('data-map-asset-id')
        || node.getAttribute('data-map-asset-name')
        || node.getAttribute('title')
        || node.getAttribute('aria-label')
        || '';
      return { node, rect, style, label: label.replace(/\s+/gu, ' ').trim() };
    }).filter(({ node, rect, style, label }) => (
      label
      && !controls.test(label)
      && !node.closest('[data-region-cluster-button="true"]')
      && !node.querySelector?.('[data-region-cluster-button="true"]')
      && !node.closest('.logistics-map-callout')
      && style.display !== 'none'
      && style.visibility !== 'hidden'
      && Number(style.opacity || 1) > 0
      && rect.width >= 6 && rect.width <= 120
      && rect.height >= 6 && rect.height <= 120
      && rect.right > rootRect.left && rect.left < rootRect.right
      && rect.bottom > rootRect.top && rect.top < rootRect.bottom
    )).sort((left, right) => left.label.localeCompare(right.label) || left.rect.top - right.rect.top || left.rect.left - right.rect.left);
    const occurrence = new Map();
    return candidates.map(({ node, rect, label }) => {
      const count = occurrence.get(label) || 0;
      occurrence.set(label, count + 1);
      const key = `${label}#${count}`;
      node.setAttribute('data-qa-pin-key', key);
      return {
        key,
        label,
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
        center_x: rect.left + rect.width / 2,
        center_y: rect.top + rect.height / 2,
      };
    });
  }, rootSelector);
}

async function waitForCalloutStable(page, rootSelector) {
  await page.waitForFunction((selector) => {
    const root = document.querySelector(selector);
    if (!root) return false;
    const callouts = [...root.querySelectorAll('.logistics-map-callout')].filter((node) => {
      const rect = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
    });
    if (!callouts.length) return false;
    const rect = callouts[callouts.length - 1].getBoundingClientRect();
    const value = [rect.left, rect.top, rect.width, rect.height];
    const stateKey = `__qa_callout_${selector}`;
    const previous = window[stateKey];
    const stable = previous && value.every((item, index) => Math.abs(item - previous.value[index]) <= 0.5);
    window[stateKey] = { value, count: stable ? previous.count + 1 : 0 };
    return window[stateKey].count >= 2;
  }, rootSelector, { timeout: 8000, polling: 100 });
}

async function measurePin(page, rootSelector, pinKey) {
  await listPins(page, rootSelector);
  const pin = page.locator(`${rootSelector} [data-qa-pin-key="${pinKey.replace(/"/gu, '\\"')}"]`).first();
  if (!(await pin.count())) throw new Error(`Pin disappeared before hover: ${pinKey}`);
  await pin.hover({ timeout: 10000, force: true });
  await waitForCalloutStable(page, rootSelector);
  await listPins(page, rootSelector);
  const currentPin = page.locator(`${rootSelector} [data-qa-pin-key="${pinKey.replace(/"/gu, '\\"')}"]`).first();
  const callout = page.locator(`${rootSelector} .logistics-map-callout:visible`).last();
  const [containerBox, pinBox, calloutBox] = await Promise.all([
    page.locator(rootSelector).boundingBox(),
    currentPin.boundingBox(),
    callout.boundingBox(),
  ]);
  if (!containerBox || !pinBox || !calloutBox) throw new Error(`Geometry was unavailable for pin: ${pinKey}`);
  return {
    pin_key: pinKey,
    pin: pinBox,
    callout: calloutBox,
    container: containerBox,
    geometry: assessGeometry(containerBox, pinBox, calloutBox),
  };
}

async function dragPinToward(page, rootSelector, pinKey, target) {
  const maxAttempts = 2;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    await listPins(page, rootSelector);
    const rootBox = await page.locator(rootSelector).boundingBox();
    const pinBox = await page.locator(`${rootSelector} [data-qa-pin-key="${pinKey.replace(/"/gu, '\\"')}"]`).first().boundingBox();
    if (!rootBox || !pinBox) throw new Error(`Cannot prepare edge probe for ${pinKey}`);
    const rootLeft = rootBox.x;
    const rootTop = rootBox.y;
    const currentX = pinBox.x + pinBox.width / 2;
    const currentY = pinBox.y + pinBox.height / 2;
    const targetX = rootLeft + rootBox.width * target.x;
    const targetY = rootTop + rootBox.height * target.y;
    const toleranceX = Math.max(8, rootBox.width * 0.025);
    const toleranceY = Math.max(8, rootBox.height * 0.025);
    const errorX = targetX - currentX;
    const errorY = targetY - currentY;
    if (Math.abs(errorX) <= toleranceX && Math.abs(errorY) <= toleranceY) {
      return {
        reached: true,
        attempt_count: attempt,
        target_x: targetX,
        target_y: targetY,
        pin_x: currentX,
        pin_y: currentY,
        tolerance_x: toleranceX,
        tolerance_y: toleranceY,
      };
    }

    const deltaX = Math.max(-rootBox.width * 0.38, Math.min(rootBox.width * 0.38, errorX));
    const deltaY = Math.max(-rootBox.height * 0.38, Math.min(rootBox.height * 0.38, errorY));
    const startX = rootLeft + rootBox.width * 0.5;
    const startY = rootTop + rootBox.height * 0.5;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + deltaX, startY + deltaY, { steps: 8 });
    await page.mouse.up();
    await page.waitForFunction(({ selector, key, beforeX, beforeY }) => {
      const node = document.querySelector(`${selector} [data-qa-pin-key="${CSS.escape(key)}"]`);
      if (!node) return false;
      const rect = node.getBoundingClientRect();
      return Math.abs(rect.left + rect.width / 2 - beforeX) >= 2 || Math.abs(rect.top + rect.height / 2 - beforeY) >= 2;
    }, { selector: rootSelector, key: pinKey, beforeX: currentX, beforeY: currentY }, { timeout: 1000 }).catch(() => null);
  }

  await listPins(page, rootSelector);
  const [rootBox, pinBox] = await Promise.all([
    page.locator(rootSelector).boundingBox(),
    page.locator(`${rootSelector} [data-qa-pin-key="${pinKey.replace(/"/gu, '\\"')}"]`).first().boundingBox(),
  ]);
  if (!rootBox || !pinBox) throw new Error(`Cannot verify edge probe for ${pinKey}`);
  const pinX = pinBox.x + pinBox.width / 2;
  const pinY = pinBox.y + pinBox.height / 2;
  const targetX = rootBox.x + rootBox.width * target.x;
  const targetY = rootBox.y + rootBox.height * target.y;
  const toleranceX = Math.max(8, rootBox.width * 0.025);
  const toleranceY = Math.max(8, rootBox.height * 0.025);
  return {
    reached: Math.abs(targetX - pinX) <= toleranceX && Math.abs(targetY - pinY) <= toleranceY,
    attempt_count: maxAttempts,
    target_x: targetX,
    target_y: targetY,
    pin_x: pinX,
    pin_y: pinY,
    tolerance_x: toleranceX,
    tolerance_y: toleranceY,
  };
}

async function failureScreenshot(page, provider, viewport, surface, suffix) {
  const dir = path.join(OUT_DIR, 'map-callout-matrix', provider, viewport.key, surface.id);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${safeName(suffix)}.png`);
  await page.screenshot({ path: file, fullPage: false }).catch(() => null);
  return path.relative(ROOT, file).replace(/\\/gu, '/');
}

async function testPins(page, rootSelector, provider, viewport, surface, scope) {
  const pins = await listPins(page, rootSelector);
  if (!pins.length) throw new Error(`No hoverable pins found for ${surface.id} (${scope})`);
  const results = [];
  for (const pin of pins) {
    try {
      const measured = await measurePin(page, rootSelector, pin.key);
      if (!measured.geometry.ok) measured.screenshot = await failureScreenshot(page, provider, viewport, surface, `${scope}-${pin.key}`);
      results.push({ ...measured, scope });
    } catch (error) {
      results.push({
        pin_key: pin.key,
        scope,
        ok: false,
        error: error.message,
        screenshot: await failureScreenshot(page, provider, viewport, surface, `${scope}-${pin.key}-error`),
      });
    }
  }
  const edgeResults = [];
  const edgePin = pins[0];
  for (const target of EDGE_TARGETS) {
    try {
      const edgePosition = await dragPinToward(page, rootSelector, edgePin.key, target);
      if (!edgePosition.reached) throw new Error(`Pin did not reach the ${target.key} edge probe target.`);
      const measured = await measurePin(page, rootSelector, edgePin.key);
      if (!measured.geometry.ok) measured.screenshot = await failureScreenshot(page, provider, viewport, surface, `edge-${target.key}`);
      edgeResults.push({ ...measured, edge: target.key, edge_position: edgePosition });
    } catch (error) {
      edgeResults.push({
        pin_key: edgePin.key,
        edge: target.key,
        ok: false,
        error: error.message,
        screenshot: await failureScreenshot(page, provider, viewport, surface, `edge-${target.key}-error`),
      });
    }
  }
  return {
    scope,
    pin_count: pins.length,
    pins: results,
    edge_probes: edgeResults,
    ok: results.every((item) => item.geometry?.ok === true)
      && edgeResults.every((item) => item.geometry?.ok === true),
  };
}

async function waitForExpectedProvider(page, rootSelector, provider) {
  const expected = provider === 'naver' ? 'naver' : 'osm';
  await page.waitForFunction(({ selector, value }) => {
    const root = document.querySelector(selector);
    if (!root) return false;
    const explicit = root.getAttribute('data-map-provider');
    if (explicit) return explicit === value;
    if (value === 'osm') return Boolean(root.querySelector('.leaflet-pane')) || /\uB300\uCCB4 \uC9C0\uB3C4|OpenStreetMap/iu.test(root.textContent || '');
    return /\uB124\uC774\uBC84 \uC9C0\uB3C4/u.test(root.textContent || '') && !root.querySelector('.leaflet-pane');
  }, { selector: rootSelector, value: expected }, { timeout: 90000 });
  const actual = await page.locator(rootSelector).evaluate(providerFromRoot);
  if (actual !== expected) throw new Error(`Provider mismatch: expected ${expected}, found ${actual}`);
  return actual;
}

async function testMarketRegions(page, rootSelector, provider, viewport, surface) {
  const scopes = [];
  const mode = await page.locator(rootSelector).getAttribute('data-map-mode');
  if (mode === 'points') return [await testPins(page, rootSelector, provider, viewport, surface, 'points')];
  const regionNames = await page.locator(`${rootSelector} [data-region-cluster-button="true"]`).evaluateAll((nodes) => (
    [...new Set(nodes
      .map((node) => String(node.getAttribute('data-region-name') || node.textContent || '').replace(/\s+/gu, ' ').trim())
      .filter(Boolean))]
  ));
  if (!regionNames.length) throw new Error(`No region clusters found for ${surface.id}`);
  for (const regionName of regionNames) {
    const cluster = page.locator(`${rootSelector} [data-region-cluster-button="true"]`).filter({ hasText: regionName }).first();
    await cluster.click({ timeout: 15000 });
    await page.waitForFunction((selector) => {
      const root = document.querySelector(selector);
      return root?.getAttribute('data-map-mode') === 'points' && Number(root.getAttribute('data-map-point-count') || 0) > 0;
    }, rootSelector, { timeout: 90000 });
    await waitForExpectedProvider(page, rootSelector, provider);
    scopes.push(await testPins(page, rootSelector, provider, viewport, surface, `region:${regionName}`));
    const reset = page.locator(`${rootSelector} [data-testid="market-map-region-reset"]`).first();
    await reset.click({ timeout: 15000 });
    await page.waitForFunction((selector) => document.querySelector(selector)?.getAttribute('data-map-mode') === 'regions', rootSelector, { timeout: 30000 });
  }
  return scopes;
}

async function prepareSurface(page, baseUrl, provider, viewport, surface) {
  const url = joinUrl(baseUrl, logisticsRoute(surface.route));
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await waitForRouteReady(page, surface.route);

  if (surface.kind.startsWith('market')) {
    await assertRuntimeMarketRegistry(page, surface.route);
    let panel = await locateMarketPanel(page, surface.title, false);
    if (surface.kind === 'market-large') {
      const parent = panel.locator('xpath=..');
      await parent.locator('[data-testid="market-map-expand-button"]').click({ timeout: 15000 });
      await page.locator('[role="dialog"]').last().waitFor({ state: 'visible', timeout: 15000 });
      panel = await locateMarketPanel(page, surface.title, true);
    }
    const rootSelector = await tagRoot(panel, safeName(`${provider}-${viewport.key}-${surface.id}`));
    await page.locator(rootSelector).scrollIntoViewIfNeeded();
    await waitForExpectedProvider(page, rootSelector, provider);
    return { rootSelector, provider: await panel.evaluate(providerFromRoot) };
  }

  if (surface.kind === 'portfolio-modal') {
    const button = page.getByRole('button', { name: surface.openButton }).last();
    await button.waitFor({ state: 'visible', timeout: 60000 });
    await button.evaluate((node) => node.click());
    await page.locator('[role="dialog"]').last().waitFor({ state: 'visible', timeout: 15000 });
  }
  await page.locator('.logistics-map-canvas:visible').last().waitFor({ state: 'visible', timeout: 90000 });
  const visibleCanvases = page.locator('.logistics-map-canvas:visible');
  if (surface.kind === 'portfolio' && await visibleCanvases.count() !== 1) {
    throw new Error(`Unregistered portfolio map on ${surface.route}: found ${await visibleCanvases.count()} visible canvases`);
  }
  const root = visibleCanvases.last().locator('xpath=..');
  const rootSelector = await tagRoot(root, safeName(`${provider}-${viewport.key}-${surface.id}`));
  await page.locator(rootSelector).scrollIntoViewIfNeeded();
  await waitForExpectedProvider(page, rootSelector, provider);
  return { rootSelector, provider: await root.evaluate(providerFromRoot) };
}

async function runSurface(page, baseUrl, provider, viewport, surface) {
  const startedAt = Date.now();
  try {
    const prepared = await prepareSurface(page, baseUrl, provider, viewport, surface);
    const scopes = surface.kind.startsWith('market')
      ? await testMarketRegions(page, prepared.rootSelector, provider, viewport, surface)
      : [await testPins(page, prepared.rootSelector, provider, viewport, surface, 'all-pins')];
    return {
      id: surface.id,
      route: surface.route,
      provider: prepared.provider,
      elapsed_ms: Date.now() - startedAt,
      scopes,
      ok: scopes.every((scope) => scope.ok),
    };
  } catch (error) {
    return {
      id: surface.id,
      route: surface.route,
      elapsed_ms: Date.now() - startedAt,
      ok: false,
      error: error.message,
      screenshot: await failureScreenshot(page, provider, viewport, surface, 'surface-error'),
    };
  }
}

async function configureContext(context, provider, session, email) {
  await context.addInitScript(({ browserSession, uiEmail }) => {
    sessionStorage.setItem('sb-iota-auth-token', JSON.stringify(browserSession));
    sessionStorage.setItem('logistics_preview_auth', JSON.stringify({ email: uiEmail }));
    localStorage.setItem('logisticsDashboardReadMode', 'primary-safe');
  }, { browserSession: session, uiEmail: email });
  if (provider === 'osm-fallback') {
    await context.route('**/functions/v1/ll-dashboard-api', async (route) => {
      let action = '';
      try {
        action = JSON.parse(route.request().postData() || '{}').action || '';
      } catch {
        action = '';
      }
      if (action === 'naver/maps-config') {
        await route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ ok: false, message: 'QA forces the OpenStreetMap fallback path.' }),
        });
        return;
      }
      await route.continue();
    });
  }
}

async function runProvider(browser, baseUrl, provider, auth, registry, stamp, viewports = VIEWPORTS) {
  const report = {
    ok: false,
    generated_at: new Date().toISOString(),
    base_url: baseUrl,
    provider,
    expected_runtime_provider: provider === 'naver' ? 'naver' : 'osm',
    registry,
    viewports: [],
    errors: [],
  };
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, serviceWorkers: 'block' });
    await configureContext(context, provider, auth.session, auth.user?.email || envValue('LOGISTICS_BROWSER_UI_EMAIL'));
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    const surfaceResults = [];
    for (const surface of SURFACES) surfaceResults.push(await runSurface(page, baseUrl, provider, viewport, surface));
    report.viewports.push({
      ...viewport,
      ok: surfaceResults.every((surface) => surface.ok) && pageErrors.length === 0,
      surfaces: surfaceResults,
      page_errors: pageErrors,
    });
    await context.close();
  }
  report.ok = registry.ok && report.viewports.every((viewport) => viewport.ok) && report.errors.length === 0;
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const viewportSuffix = viewports.length === 1 ? `-${viewports[0].key}` : '';
  const outJson = path.join(OUT_DIR, `map-callout-matrix-${provider}${viewportSuffix}-${stamp}.json`);
  const latestJson = path.join(OUT_DIR, `map-callout-matrix-${provider}${viewportSuffix}-latest.json`);
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(latestJson, `${JSON.stringify(report, null, 2)}\n`);
  return { ...report, artifact: path.relative(ROOT, outJson).replace(/\\/gu, '/') };
}

async function main() {
  if (process.argv.includes('--self-test')) {
    runSelfTest();
    return;
  }
  const registry = sourceRegistry();
  if (!registry.ok) throw new Error(`Map registry is incomplete: ${JSON.stringify(registry.checks)}`);
  const requestedProvider = argsValue('provider', 'all');
  const providers = requestedProvider === 'all' ? PROVIDERS : [requestedProvider];
  if (!providers.every((provider) => PROVIDERS.includes(provider))) throw new Error(`Unknown provider: ${requestedProvider}`);
  const requestedViewport = argsValue('viewport', 'all');
  const viewports = requestedViewport === 'all'
    ? VIEWPORTS
    : VIEWPORTS.filter((viewport) => viewport.key === requestedViewport);
  if (!viewports.length) throw new Error(`Unknown viewport: ${requestedViewport}`);
  const baseUrl = argsValue('base-url', DEFAULT_BASE_URL);
  const supabaseUrl = envValue('LOGISTICS_SUPABASE_URL', 'VITE_SUPABASE_URL');
  const anonKey = envValue('LOGISTICS_SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY');
  if (!supabaseUrl || !anonKey) throw new Error('Missing Supabase URL or anon key.');
  const auth = await signIn(supabaseUrl, anonKey);
  const browser = await chromium.launch({ headless: true, executablePath: chromeExecutablePath() });
  const stamp = timestampForFile();
  try {
    const reports = [];
    for (const provider of providers) reports.push(await runProvider(browser, baseUrl, provider, auth, registry, stamp, viewports));
    const ok = reports.every((report) => report.ok);
    console.log(JSON.stringify({ ok, base_url: baseUrl, reports: reports.map((report) => ({ provider: report.provider, ok: report.ok, artifact: report.artifact })) }, null, 2));
    if (!ok) process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error.stack || error.message || error);
  process.exit(1);
});
