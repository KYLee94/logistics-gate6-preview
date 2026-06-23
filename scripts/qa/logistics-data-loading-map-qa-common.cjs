const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT_DIR = path.join(ROOT, 'qa-artifacts', 'logistics-gate6');
const DEFAULT_BASE_URL = 'http://127.0.0.1:5173/';
const LOAD_TEXT = '시장자료를 불러오는 중입니다.';
const LOAD_ERROR_TEXT = '데이터를 불러오지 못했습니다.';
const INTERNAL_TOKEN_PATTERN = /\bll_|source_row_id|source_file_id|source_sheet_id|natural_key|natural\s+key|row_hash|row\s+hash|payload|\bPNU\b|\bpnu\b|법정동코드/iu;
const TABS = [
  { key: 'overview', route: 'market-data/overview', needsTable: false, needsChart: true, needsMap: false },
  { key: 'lease-market', route: 'market-data/lease-market', needsTable: true, needsChart: true, needsMap: true },
  { key: 'supply-pipeline', route: 'market-data/supply-pipeline', needsTable: true, needsChart: true, needsMap: true },
  { key: 'transactions', route: 'market-data/transactions', needsTable: true, needsChart: true, needsMap: true },
  { key: 'source-update', route: 'market-data/source-update', needsTable: true, needsChart: false, needsMap: false },
];

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

function joinUrl(baseUrl, route) {
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const url = new URL(route.replace(/^\/+/u, ''), normalizedBase);
  if (hasFlag('cache-bust')) url.searchParams.set('qa_cache_bust', timestampForFile());
  return url.toString();
}

async function gotoDomContentLoaded(page, url, timeout = 45000) {
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout });
  } catch (error) {
    if (!/ERR_ABORTED|Navigation interrupted/iu.test(error?.message || String(error))) throw error;
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout });
  }
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

function png1x1() {
  return Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=',
    'base64',
  );
}

function buildSession(email = 'kylee@igisam.com') {
  const now = Math.round(Date.now() / 1000);
  const b64 = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const accessToken = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({
    iss: 'https://qvegpozwrcmspdvjokiz.supabase.co/auth/v1',
    sub: 'qa-user',
    aud: 'authenticated',
    exp: now + 3600,
    iat: now,
    email,
    role: 'authenticated',
  })}.qa`;
  return {
    access_token: accessToken,
    refresh_token: 'qa-refresh-token',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: now + 3600,
    user: {
      id: 'qa-user',
      aud: 'authenticated',
      role: 'authenticated',
      email,
      app_metadata: { provider: 'email', providers: ['email'] },
      user_metadata: { email },
    },
  };
}

function authMeBody(email = 'kylee@igisam.com') {
  return {
    ok: true,
    data: {
      id: 'qa-user',
      email,
      permission_email: email,
      staff_name: 'QA User',
      name: 'QA User',
      organization: 'QA',
      department: 'QA',
      team_name: 'QA',
      logistics_role: 'Admin',
      feature_permissions: {},
    },
  };
}

function marketFixture() {
  const leases = [
    ['QA 수도권 동남 센터', '동남권', 37.205, 127.313, 42000, 5.8, '상온'],
    ['QA 수도권 중앙 센터', '중앙권', 37.389, 127.111, 36000, 6.1, '복합 상온'],
    ['QA 수도권 서부 센터', '서부권', 37.478, 126.642, 31000, 5.2, '저온'],
    ['QA 충청 허브', '충청권', 36.817, 127.115, 52000, 4.7, '상온'],
    ['QA 경남 물류센터', '경남권', 35.235, 128.675, 28000, 4.4, '복합 저온'],
    ['QA 전라 거점', '전라권', 35.824, 127.148, 26000, 4.1, '상온'],
  ].map(([center, region, latitude, longitude, area, rent, temp], index) => ({
    row_key: `lease-${index}`,
    report_period: '2026 1Q',
    center_name: center,
    asset_name: center,
    region,
    temperature_type: temp,
    gross_area_py: area,
    leasable_area_py: Math.round(area * 0.86),
    rent_manwon_per_py: rent,
    management_fee_manwon_per_py: 0.8,
    rent_free_months_per_year: 1.2,
    vacancy_rate: 0.04 + index * 0.01,
    legal_address: `${region} QA 테스트 주소 ${index + 1}`,
    latitude,
    longitude,
    lat: latitude,
    lng: longitude,
    coordinate_source: 'qa.fixture',
  }));
  const supply = [
    ['QA 신규공급 A', '동남권', 37.151, 127.21, 51000, 'new_supply', '2026 1Q'],
    ['QA 신규공급 B', '충청권', 36.621, 127.287, 64000, 'new_supply', '2026 1Q'],
    ['QA 공급예정 C', '서부권', 37.49, 126.78, 73000, 'pipeline', '2027 2Q'],
    ['QA 공급예정 D', '경남권', 35.19, 128.78, 59000, 'pipeline', '2028 1Q'],
  ].map(([center, region, latitude, longitude, area, kind, period], index) => ({
    row_key: `supply-${index}`,
    center_name: center,
    asset_name: center,
    warehouse_name: center,
    region,
    temperature_type: index % 2 ? '저온' : '상온',
    gross_area_py: area,
    supply_area_py: area,
    supply_kind: kind,
    completion_period: period,
    expected_year: Number(String(period).slice(0, 4)),
    status: kind === 'new_supply' ? '준공' : '예정',
    owner_or_developer: 'QA 시행사',
    legal_address: `${region} QA 공급 주소 ${index + 1}`,
    latitude,
    longitude,
    lat: latitude,
    lng: longitude,
    coordinate_source: 'qa.fixture',
  }));
  const transactions = [
    ['QA 거래 A', '동남권', 37.221, 127.333, 2026, 120000000000, 33000],
    ['QA 거래 B', '중앙권', 37.411, 127.094, 2025, 89000000000, 22000],
    ['QA 거래 C', '충청권', 36.843, 127.103, 2024, 76000000000, 27000],
    ['QA 거래 D', '경남권', 35.244, 128.665, 2026, 61000000000, 19000],
  ].map(([asset, region, latitude, longitude, year, amount, area], index) => ({
    row_key: `transaction-${index}`,
    asset_name: asset,
    center_name: asset,
    region,
    temperature_type: index % 2 ? '저온' : '상온',
    transaction_type: index % 2 ? '선매입' : '실물',
    transaction_year: year,
    transaction_period: `${year} 1Q`,
    transaction_date: `${year}-03-31`,
    transaction_amount_krw: amount,
    area_py: area,
    unit_price_krw_per_py: Math.round(amount / area),
    buyer_name: 'QA 매수인',
    seller_name: 'QA 매도인',
    size_bucket: area >= 30000 ? '3만평 이상' : '3만평 미만',
    cap_rate: 0.047 + index * 0.002,
    legal_address: `${region} QA 거래 주소 ${index + 1}`,
    latitude,
    longitude,
    lat: latitude,
    lng: longitude,
    coordinate_source: 'qa.fixture',
  }));
  const capRates = [
    { period_label: '2024 4Q', region: '수도권', cap_rate: 0.047 },
    { period_label: '2025 4Q', region: '수도권', cap_rate: 0.049 },
    { period_label: '2026 1Q', region: '수도권', cap_rate: 0.05 },
    { period_label: '2026 1Q', region: '지방', cap_rate: 0.055 },
  ];
  const sourceAudit = {
    sheet_count: 4,
    source_row_count: leases.length + supply.length + transactions.length + capRates.length,
    source_column_count: 36,
    sheet_readback: [
      { sheet_name: '임대', expected_rows: leases.length, actual_rows: leases.length, column_count: 12, header_row_number: 1, status: 'ok' },
      { sheet_name: '공급', expected_rows: supply.length, actual_rows: supply.length, column_count: 11, header_row_number: 1, status: 'ok' },
      { sheet_name: '거래', expected_rows: transactions.length, actual_rows: transactions.length, column_count: 14, header_row_number: 1, status: 'ok' },
    ],
  };
  return {
    summary: {
      status: 'ready',
      source: { file_name: 'qa-market-fixture.xlsx', source_version: 'qa-simulated' },
      source_audit: sourceAudit,
      expected_counts: {
        lease_observations: leases.length,
        supply_cases: supply.length,
        pipeline_supply_cases: supply.filter((row) => row.supply_kind === 'pipeline').length,
        new_supply_cases: supply.filter((row) => row.supply_kind === 'new_supply').length,
        transaction_cases: transactions.length,
        cap_rate_series: capRates.length,
      },
      readback: {
        lease: { ok: true },
        supply: { ok: true },
        transactions: { ok: true },
      },
      latest_lease_period: '2026 1Q',
      latest_lease_center_count: leases.length,
      lease_observation_count: leases.length,
      supply_case_count: supply.length,
      pipeline_supply_count: supply.filter((row) => row.supply_kind === 'pipeline').length,
      new_supply_count: supply.filter((row) => row.supply_kind === 'new_supply').length,
      transaction_case_count: transactions.length,
      cap_rate_series_count: capRates.length,
      weighted_rent_manwon_per_py: 5.2,
      weighted_vacancy_rate: 0.065,
      new_supply_total_gross_area_py: supply.filter((row) => row.supply_kind === 'new_supply').reduce((sum, row) => sum + row.gross_area_py, 0),
      latest_cap_rate: { region: '수도권', cap_rate: 0.05 },
    },
    leases,
    supply,
    transactions,
    cap_rates: capRates,
    sources: [{ file_name: 'qa-market-fixture.xlsx', source_version: 'qa-simulated', active_version: true, parse_status: 'ready' }],
    charts: {
      lease_rent_by_region: leases.slice(0, 4).map((row) => ({ label: row.region, value: row.rent_manwon_per_py })),
      lease_rent_by_temperature: [{ label: '상온', value: 5.2 }, { label: '저온', value: 5.7 }],
      lease_vacancy_by_region: leases.slice(0, 4).map((row) => ({ label: row.region, value: row.vacancy_rate })),
      supply_by_period: supply.map((row) => ({ label: row.completion_period, value: row.gross_area_py })),
      transactions_by_region: transactions.map((row) => ({ label: row.region, value: row.transaction_amount_krw })),
    },
    views: {
      overview: { kpis: true },
      lease: {
        latest_rows: leases,
        statistics_latest_period: '2026 1Q',
        statistics_periods: ['2026 1Q'],
        statistics_rows: leases.map((row) => ({
          period_label: '2026 1Q',
          metric_key: 'rent_manwon_per_py',
          dimension_type: 'region',
          segment_label: '복합 상온',
          region: row.region,
          label: row.region,
          value: row.rent_manwon_per_py,
          is_average: false,
        })),
      },
      supply: {
        rows: supply,
        statistics_rows: supply.map((row) => ({
          period_label: row.completion_period,
          supply_kind: row.supply_kind,
          new_supply: row.supply_kind === 'new_supply' ? row.gross_area_py : 0,
          cumulative_supply: row.gross_area_py,
          value: row.gross_area_py,
        })),
      },
      transactions: { rows: transactions },
      source: { sheet_readback: sourceAudit.sheet_readback },
    },
  };
}

function fakeNaverMapsSdk() {
  return `
    (() => {
      class LatLng {
        constructor(lat, lng) { this.lat = lat; this.lng = lng; }
      }
      class Map {
        constructor(el, options = {}) {
          this.el = el;
          this.zoom = options.zoom || 7;
          [0, 1, 2, 3].forEach((index) => {
            const canvas = document.createElement('canvas');
            canvas.width = 256;
            canvas.height = 256;
            canvas.setAttribute('data-qa-fake-naver-tile', 'true');
            canvas.style.cssText = 'position:absolute;width:50%;height:50%;background:#d7e8f7;';
            canvas.style.left = index % 2 === 0 ? '0' : '50%';
            canvas.style.top = index < 2 ? '0' : '50%';
            el.appendChild(canvas);
          });
        }
        setCenter(center) { this.center = center; }
        setZoom(zoom) { this.zoom = zoom; }
        getZoom() { return this.zoom; }
        setMapTypeId(type) { this.type = type; }
        fitBounds(bounds) { this.bounds = bounds; }
      }
      class LatLngBounds {
        constructor(sw, ne) { this.points = [sw, ne].filter(Boolean); }
        extend(point) { this.points.push(point); }
      }
      class Marker {
        constructor(options = {}) {
          this.options = options;
          if (options.map?.el) {
            const marker = document.createElement('span');
            marker.setAttribute('data-qa-fake-naver-marker', 'true');
            marker.title = options.title || '';
            options.map.el.appendChild(marker);
          }
        }
        setMap(map) { this.map = map; }
        remove() {}
      }
      class CadastralLayer { setMap(map) { this.map = map; } }
      window.naver = {
        maps: {
          LatLng,
          LatLngBounds,
          Map,
          Marker,
          CadastralLayer,
          MapTypeId: { NORMAL: 'normal', SATELLITE: 'satellite' },
          Event: { addListener: () => ({ remove: () => {} }) },
          Service: { geocode: () => {} },
        },
      };
    })();
  `;
}

async function installSession(context, email) {
  const session = buildSession(email);
  await context.addInitScript(({ session: browserSession, email: userEmail }) => {
    try {
      Object.defineProperty(navigator, 'locks', {
        configurable: true,
        value: {
          request: async (_name, optionsOrCallback, maybeCallback) => {
            const callback = typeof optionsOrCallback === 'function' ? optionsOrCallback : maybeCallback;
            return callback ? callback({ name: _name, mode: 'exclusive' }) : undefined;
          },
        },
      });
    } catch {
      // The QA browser can keep the native Web Locks implementation when it is not configurable.
    }
    sessionStorage.setItem('sb-iota-auth-token', JSON.stringify(browserSession));
    sessionStorage.setItem('sb-iota-auth-token-user', JSON.stringify({ user: browserSession.user }));
    sessionStorage.setItem('logistics_preview_auth', JSON.stringify({ email: userEmail }));
    sessionStorage.setItem('iota_last_activity', String(Date.now()));
    localStorage.setItem('logisticsDashboardReadMode', 'primary-safe');
  }, { session, email });
}

async function installNetworkControls(context, options = {}) {
  const simulation = options.simulation || 'success';
  const mapProvider = options.mapProvider || 'osm-config-missing';
  const email = options.email || 'kylee@igisam.com';
  const state = {
    calls: [],
    idleRoutes: [],
    idleSeen: false,
    releaseIdle: null,
  };
  let releaseIdle;
  const idleGate = new Promise((resolve) => { releaseIdle = resolve; });
  state.releaseIdle = releaseIdle;

  await context.route('**/openapi/v3/maps.js**', async (route) => {
    if (simulation === 'real') {
      await route.continue();
      return;
    }
    if (mapProvider === 'naver-simulated') {
      await route.fulfill({ status: 200, contentType: 'application/javascript; charset=utf-8', body: fakeNaverMapsSdk() });
      return;
    }
    await route.abort('failed');
  });
  await context.route('**/tile.openstreetmap.org/**', async (route) => {
    if (simulation === 'real') {
      await route.continue();
      return;
    }
    await route.fulfill({ status: 200, contentType: 'image/png', body: png1x1() });
  });
  await context.route('**/functions/v1/ll-dashboard-api', async (route) => {
    const action = normalizeActionFromPostData(route.request().postData());
    state.calls.push({ action, url: route.request().url(), method: route.request().method(), at: new Date().toISOString() });
    if (simulation === 'real') {
      await route.continue();
      return;
    }
    if (action === 'auth/me') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(authMeBody(email)) });
      return;
    }
    if (action === 'naver/maps-config') {
      if (mapProvider === 'naver-simulated') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: { ncp_key_id: 'qa-naver-client' } }) });
        return;
      }
      if (mapProvider === 'osm-config-error') {
        await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ ok: false, message: 'QA simulated naver maps-config failure.' }) });
        return;
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: {} }) });
      return;
    }
    if (action === 'naver/geocode-batch') {
      const queries = JSON.parse(route.request().postData() || '{}')?.payload?.queries || [];
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          data: {
            rows: queries.map((query, index) => ({
              query,
              status: 'ok',
              lat: 37.2 + index * 0.01,
              lng: 127.1 + index * 0.01,
              coordinate_source: 'qa.geocode.fixture',
            })),
          },
        }),
      });
      return;
    }
    if (action === 'sector-market/read') {
      if (simulation === 'failure') {
        await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ ok: false, message: 'QA simulated sector-market/read failure.' }) });
        return;
      }
      if (simulation === 'idle') {
        state.idleSeen = true;
        state.idleRoutes.push(route);
        await idleGate;
        await route.abort('failed').catch(() => {});
        return;
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: marketFixture() }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: {} }) });
  });
  return state;
}

async function releaseNetworkControls(state) {
  if (state?.releaseIdle) state.releaseIdle();
  await Promise.allSettled((state?.idleRoutes || []).map((route) => route.abort('failed')));
}

async function withPage(options, callback) {
  const baseUrl = options.baseUrl || argValue('base-url', process.env.QA_BASE_URL || DEFAULT_BASE_URL);
  const simulation = options.simulation || argValue('simulate', 'success');
  const mapProvider = options.mapProvider || argValue('map-provider', 'osm-config-missing');
  const email = options.email || argValue('email', 'kylee@igisam.com');
  const browser = await chromium.launch({ headless: !hasFlag('headed'), executablePath: chromeExecutablePath() });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, serviceWorkers: 'block' });
  const reportRuntime = { errors: [], warnings: [] };
  let controls;
  try {
    await installSession(context, email);
    controls = await installNetworkControls(context, { simulation, mapProvider, email });
    const page = await context.newPage();
    page.on('pageerror', (error) => {
      const message = error?.message || String(error);
      if (/Cannot read properties of null \(reading '(?:capitalize|isArray|hasValue|TransitionQueue)'\)|Failed to execute 'removeChild' on 'Node'/u.test(message)) return;
      reportRuntime.errors.push(message);
    });
    page.on('console', (message) => {
      if (message.type() === 'error' && !/favicon|Failed to load resource|Naver Maps SDK/iu.test(message.text())) {
        reportRuntime.warnings.push(message.text().slice(0, 400));
      }
    });
    try {
      return await callback({ page, context, controls, baseUrl, simulation, mapProvider, runtime: reportRuntime });
    } catch (error) {
      error.qaRuntime = reportRuntime;
      throw error;
    }
  } finally {
    await releaseNetworkControls(controls);
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}

async function waitForMarketShell(page) {
  await page.waitForFunction(() => /Market\s*Data/iu.test(document.body?.innerText || ''), { timeout: 45000 });
}

async function waitForLoadingGone(page) {
  await page.waitForFunction((loadingText) => !(document.body?.innerText || '').includes(loadingText), LOAD_TEXT, { timeout: 45000 });
}

async function waitForContentReady(page, tab) {
  await page.waitForFunction(({ loadingText, needsTable, needsChart, needsMap }) => {
    const text = document.body?.innerText || '';
    if (!/Market\s*Data/iu.test(text) || text.includes(loadingText)) return false;
    if (needsTable && document.querySelectorAll('[data-sortable-table="true"], table').length === 0) return false;
    if (needsChart && document.querySelectorAll('[data-chart-role][data-chart-empty="false"]').length === 0) return false;
    if (needsMap) {
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
      const hasExpandButton = document.querySelectorAll('[data-testid="market-map-expand-button"]').length > 0;
      const hasReadyMap = Array.from(document.querySelectorAll('[data-map-provider]')).some((el) => {
        const provider = el.getAttribute('data-map-provider') || '';
        const mode = el.getAttribute('data-map-mode') || '';
        const pointCount = Number(el.getAttribute('data-map-point-count') || 0);
        const tileStats = visibleTileStats(el);
        const pointButtons = el.querySelectorAll('[data-map-point-button="true"]').length;
        const regionButtons = el.querySelectorAll('[data-region-cluster-button]').length;
        const nativeMarkerCount = Number(el.getAttribute('data-map-native-marker-count') || 0);
        const regionClusterCount = Number(el.getAttribute('data-map-region-cluster-count') || 0);
        const pointReady = mode === 'points'
          && pointCount > 0
          && (pointButtons > 0 || nativeMarkerCount >= pointCount)
          && regionButtons === 0;
        const regionReady = mode === 'regions'
          && regionClusterCount > 0
          && regionButtons > 0;
        return ['naver', 'osm'].includes(provider)
          && tileStats.count >= 3
          && tileStats.coverage >= 0.65
          && (pointReady || regionReady);
      });
      if (!hasExpandButton || !hasReadyMap) return false;
    }
    return true;
  }, { loadingText: LOAD_TEXT, needsTable: tab.needsTable, needsChart: tab.needsChart, needsMap: tab.needsMap }, { timeout: 45000 });
}

async function collectPageState(page) {
  return page.evaluate(({ loadingText, errorText, internalPattern }) => {
    const body = document.body?.innerText || '';
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
    const mapStats = Array.from(document.querySelectorAll('[data-map-provider]')).map((el, index) => {
      const tileStats = visibleTileStats(el);
      return {
        index,
        mode: el.getAttribute('data-map-mode') || '',
        provider: el.getAttribute('data-map-provider') || '',
        selected_region: el.getAttribute('data-map-selected-region') || '',
        region_cluster_count: Number(el.getAttribute('data-map-region-cluster-count') || 0),
        visible_asset_count: Number(el.getAttribute('data-map-visible-asset-count') || 0),
        point_count: Number(el.getAttribute('data-map-point-count') || 0),
        coordinate_count: Number(el.getAttribute('data-map-coordinate-count') || 0),
        fallback_count: Number(el.getAttribute('data-map-fallback-count') || 0),
        geocoded_count: Number(el.getAttribute('data-map-geocoded-count') || 0),
        coordinate_source_count: Number(el.getAttribute('data-map-coordinate-source-count') || 0),
        native_marker_count: Number(el.getAttribute('data-map-native-marker-count') || 0),
        naver_ready: el.getAttribute('data-naver-map-ready') === 'true',
        osm_ready: el.getAttribute('data-osm-map-ready') === 'true',
        fallback_ready: el.getAttribute('data-map-fallback-ready') === 'true',
        tile_dom_count: el.querySelectorAll('img[src], canvas, .leaflet-tile, [data-qa-fake-naver-tile="true"]').length,
        visible_tile_count: tileStats.count,
        visible_tile_coverage: Math.round(tileStats.coverage * 1000) / 1000,
        region_buttons: el.querySelectorAll('[data-region-cluster-button="true"]').length,
        point_buttons: el.querySelectorAll('[data-map-point-button="true"]').length,
      };
    });
    return {
      loading_visible: body.includes(loadingText),
      error_visible: body.includes(errorText),
      market_data_visible: /Market\s*Data/iu.test(body),
      table_count: document.querySelectorAll('[data-sortable-table="true"], table').length,
      chart_ready_count: document.querySelectorAll('[data-chart-role][data-chart-empty="false"]').length,
      internal_tokens_visible: new RegExp(internalPattern, 'iu').test(body),
      broken_question_marks_visible: /\?{4,}/u.test(body),
      region_summary_visible: /권역\s*\d+개\s*표시|\d+건\s*축약/u.test(body),
      map_expand_button_count: document.querySelectorAll('[data-testid="market-map-expand-button"]').length,
      map_stats: mapStats,
      excerpt: body.slice(0, 800),
    };
  }, { loadingText: LOAD_TEXT, errorText: LOAD_ERROR_TEXT, internalPattern: INTERNAL_TOKEN_PATTERN.source });
}

async function waitForProvider(page, expectedProvider) {
  await page.waitForFunction((provider) => (
    Array.from(document.querySelectorAll('[data-map-provider]')).some((el) => el.getAttribute('data-map-provider') === provider)
  ), expectedProvider, { timeout: 45000 });
}

async function collectPointGeometry(page) {
  return page.evaluate(() => {
    const map = document.querySelector('[data-map-mode="points"]');
    if (!map) return { ok: false, reason: 'points map not found', points: [] };
    const mapRect = map.getBoundingClientRect();
    const pointCount = Number(map.getAttribute('data-map-point-count') || 0);
    const nativeMarkerCount = Number(map.getAttribute('data-map-native-marker-count') || 0);
    const points = Array.from(map.querySelectorAll('[data-map-point-button="true"]')).map((button, index) => {
      const rect = button.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      return {
        index,
        title: button.getAttribute('title') || '',
        width: rect.width,
        height: rect.height,
        center_x: Math.round((centerX - mapRect.left) * 10) / 10,
        center_y: Math.round((centerY - mapRect.top) * 10) / 10,
        in_bounds: centerX >= mapRect.left && centerX <= mapRect.right && centerY >= mapRect.top && centerY <= mapRect.bottom,
      };
    });
    let minDistance = Number.POSITIVE_INFINITY;
    let overlapPairs = 0;
    for (let left = 0; left < points.length; left += 1) {
      for (let right = left + 1; right < points.length; right += 1) {
        const dx = points[left].center_x - points[right].center_x;
        const dy = points[left].center_y - points[right].center_y;
        const distance = Math.hypot(dx, dy);
        minDistance = Math.min(minDistance, distance);
        if (distance < 10) overlapPairs += 1;
      }
    }
    return {
      ok: points.length > 0
        ? points.every((point) => point.in_bounds && point.title) && overlapPairs === 0
        : (pointCount > 0 && nativeMarkerCount >= pointCount),
      map: { width: Math.round(mapRect.width), height: Math.round(mapRect.height) },
      points,
      point_count: points.length || pointCount,
      native_marker_count: nativeMarkerCount,
      min_center_distance_px: Number.isFinite(minDistance) ? Math.round(minDistance * 10) / 10 : null,
      overlap_pairs_lt_10px: overlapPairs,
    };
  });
}

function writeReport(slug, report) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const stamp = timestampForFile();
  const outJson = path.join(OUT_DIR, `${slug}-${stamp}.json`);
  const latestJson = path.join(OUT_DIR, `${slug}-latest.json`);
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(latestJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  return path.relative(ROOT, outJson).replace(/\\/gu, '/');
}

async function runDataLoadingStability() {
  const simulation = argValue('simulate', 'success');
  const cycles = numberArg('cycles', 50);
  const report = {
    ok: false,
    generated_at: new Date().toISOString(),
    script: 'qa:data-loading:stability',
    simulation,
    cycles,
    base_url: argValue('base-url', process.env.QA_BASE_URL || DEFAULT_BASE_URL),
    routes: [],
    errors: [],
    warnings: [],
    summary: {},
  };
  try {
    await withPage({ simulation, mapProvider: argValue('map-provider', 'naver-simulated') }, async ({ page, baseUrl, runtime }) => {
      if (simulation === 'success' && !hasFlag('no-warmup')) {
        const warmupTab = TABS[0];
        await gotoDomContentLoaded(page, joinUrl(baseUrl, warmupTab.route), 45000);
        await waitForMarketShell(page);
        await waitForContentReady(page, warmupTab);
        await waitForLoadingGone(page);
      }
      for (let cycle = 0; cycle < cycles; cycle += 1) {
        const tab = TABS[cycle % TABS.length];
        const url = joinUrl(baseUrl, tab.route);
        const startedAt = Date.now();
        await gotoDomContentLoaded(page, url, 45000);
        await waitForMarketShell(page);
        if (simulation === 'failure') {
          await waitForLoadingGone(page);
        } else {
          await waitForContentReady(page, tab);
          await waitForLoadingGone(page);
        }
        const elapsedMs = Date.now() - startedAt;
        const state = await collectPageState(page);
        const row = {
          cycle: cycle + 1,
          key: tab.key,
          url: page.url(),
          elapsed_ms: elapsedMs,
          ...state,
        };
        row.ok = row.market_data_visible
          && !row.loading_visible
          && !row.internal_tokens_visible
          && !row.broken_question_marks_visible
          && (simulation === 'failure'
            ? row.error_visible
            : (!row.error_visible
              && (!tab.needsTable || row.table_count > 0)
              && (!tab.needsChart || row.chart_ready_count > 0)
              && (!tab.needsMap || row.map_stats.some((item) => (
                ['naver', 'osm'].includes(item.provider)
                && ((item.mode === 'points' && item.point_count > 0 && item.native_marker_count >= item.point_count)
                  || (item.mode === 'regions' && item.region_cluster_count > 0 && item.region_buttons > 0))
                && item.visible_tile_count >= 3
                && item.visible_tile_coverage >= 0.65
              )))
              && (!tab.needsMap || row.map_expand_button_count > 0)
              && (!tab.needsMap || !row.region_summary_visible)))
          && (simulation === 'failure' || elapsedMs <= 15000);
        report.routes.push(row);
      }
      report.errors.push(...runtime.errors);
      report.warnings.push(...runtime.warnings);
    });
  } catch (error) {
    report.errors.push(error?.message || String(error));
    report.errors.push(...(error?.qaRuntime?.errors || []));
    report.warnings.push(...(error?.qaRuntime?.warnings || []));
  }
  const elapsedValues = report.routes.map((route) => route.elapsed_ms).filter((value) => Number.isFinite(value));
  report.summary = {
    route_checks: report.routes.length,
    failed_route_checks: report.routes.filter((route) => !route.ok).length,
    max_elapsed_ms: elapsedValues.length ? Math.max(...elapsedValues) : null,
    avg_elapsed_ms: elapsedValues.length ? Math.round(elapsedValues.reduce((sum, value) => sum + value, 0) / elapsedValues.length) : null,
  };
  report.ok = report.routes.length >= cycles && report.routes.every((route) => route.ok) && report.errors.length === 0;
  report.artifact = writeReport('data-loading-stability', report);
  console.log(`data loading stability ${report.ok ? 'PASS' : 'FAIL'}: ${report.artifact}`);
  if (!report.ok) process.exitCode = 1;
}

async function runDataLoadingIdle() {
  const report = {
    ok: false,
    generated_at: new Date().toISOString(),
    script: 'qa:data-loading:idle',
    simulation: argValue('simulate', 'idle'),
    base_url: argValue('base-url', process.env.QA_BASE_URL || DEFAULT_BASE_URL),
    checks: {},
    errors: [],
    warnings: [],
  };
  try {
    await withPage({ simulation: report.simulation, mapProvider: argValue('map-provider', 'osm-config-missing') }, async ({ page, baseUrl, controls, runtime }) => {
    await gotoDomContentLoaded(page, joinUrl(baseUrl, 'market-data/overview'), 45000);
    await waitForMarketShell(page);
    await page.waitForFunction((loadingText) => (document.body?.innerText || '').includes(loadingText), LOAD_TEXT, { timeout: 45000 });
    const state = await collectPageState(page);
    report.checks = {
      idle_request_simulated: controls.idleSeen || report.simulation !== 'idle',
      loading_visible_while_pending: state.loading_visible,
      no_user_facing_error_before_release: !state.error_visible,
      market_shell_visible: state.market_data_visible,
      no_internal_tokens: !state.internal_tokens_visible,
      no_broken_question_marks: !state.broken_question_marks_visible,
    };
    report.state = state;
    report.api_calls = controls.calls.map((call) => call.action);
      report.errors.push(...runtime.errors);
      report.warnings.push(...runtime.warnings);
    });
  } catch (error) {
    report.errors.push(error?.message || String(error));
    report.errors.push(...(error?.qaRuntime?.errors || []));
    report.warnings.push(...(error?.qaRuntime?.warnings || []));
  }
  report.ok = Object.values(report.checks).every(Boolean) && report.errors.length === 0;
  report.artifact = writeReport('data-loading-idle', report);
  console.log(`data loading idle ${report.ok ? 'PASS' : 'FAIL'}: ${report.artifact}`);
  if (!report.ok) process.exitCode = 1;
}

async function runMarketMapPinpoint() {
  const mapProvider = argValue('map-provider', 'naver-simulated');
  const simulation = argValue('simulate', 'success');
  const expectedProvider = (mapProvider === 'naver-simulated' || simulation === 'real') ? 'naver' : 'osm';
  const targetRoute = argValue('route', 'market-data/lease-market');
  const report = {
    ok: false,
    generated_at: new Date().toISOString(),
    script: 'qa:market-map:pinpoint',
    simulation,
    map_provider: mapProvider,
    expected_provider: expectedProvider,
    target_route: targetRoute,
    base_url: argValue('base-url', process.env.QA_BASE_URL || DEFAULT_BASE_URL),
    errors: [],
    warnings: [],
  };
  try {
    await withPage({ simulation: report.simulation, mapProvider }, async ({ page, baseUrl, runtime }) => {
    await gotoDomContentLoaded(page, joinUrl(baseUrl, targetRoute), 45000);
    await waitForMarketShell(page);
    await waitForContentReady(page, { needsTable: true, needsChart: true, needsMap: true });
    await waitForProvider(page, expectedProvider);
    const firstCluster = page.locator('[data-map-mode="regions"] [data-region-cluster-button="true"]').first();
    if (await firstCluster.count().catch(() => 0)) {
      report.region_cluster_clicked = true;
      await firstCluster.click({ timeout: 20000 }).catch(async () => {
        await firstCluster.click({ force: true, timeout: 5000 });
      });
      await page.waitForTimeout(900);
    } else {
      report.region_cluster_clicked = false;
    }
    await page.waitForFunction((provider) => {
      const maps = Array.from(document.querySelectorAll('[data-map-provider]'));
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
      return maps.some((el) => {
        const tileStats = visibleTileStats(el);
          return el.getAttribute('data-map-provider') === provider
          && el.getAttribute('data-map-mode') === 'points'
          && Number(el.getAttribute('data-map-point-count') || 0) > 0
          && Number(el.getAttribute('data-map-fallback-count') || 0) === 0
          && Number(el.getAttribute('data-map-native-marker-count') || 0) >= Number(el.getAttribute('data-map-point-count') || 0)
          && tileStats.count >= 3
          && tileStats.coverage >= 0.65
          && el.querySelectorAll('[data-region-cluster-button="true"]').length === 0;
      });
    }, expectedProvider, { timeout: 60000 });
    const state = await collectPageState(page);
    const activeMap = state.map_stats.find((item) => item.mode === 'points' && item.provider === expectedProvider) || null;
    const geometry = await collectPointGeometry(page);
    const firstPoint = page.locator('[data-map-provider][data-map-mode="points"] [data-map-point-button="true"]').first();
    report.point_button_visible = await firstPoint.isVisible({ timeout: 10000 }).catch(() => false);
    report.point_button_title = report.point_button_visible ? await firstPoint.getAttribute('title').catch(() => '') : '';
    if (report.point_button_visible) {
      await firstPoint.click();
      report.point_click_detail_ready = await page.locator('[role="dialog"]').first().isVisible({ timeout: 10000 }).catch(() => false);
      if (report.point_click_detail_ready) {
        const dialog = page.locator('[role="dialog"]').first();
        await dialog.locator('button').first().click({ timeout: 10000 }).catch(() => null);
        await dialog.waitFor({ state: 'detached', timeout: 10000 }).catch(() => null);
      }
    } else {
      report.point_click_detail_ready = activeMap?.native_marker_count >= activeMap?.point_count;
    }
    const expandButton = page.locator('[data-testid="market-map-expand-button"]').first();
    report.large_button_visible = await expandButton.isVisible({ timeout: 10000 }).catch(() => false);
    if (report.large_button_visible) {
      await expandButton.click();
      report.large_modal_ready = await page.waitForFunction((provider) => {
        const dialog = document.querySelector('[role="dialog"]');
        if (!dialog) return false;
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
        return Array.from(dialog.querySelectorAll('[data-map-provider]')).some((el) => {
          const tileStats = visibleTileStats(el);
          return el.getAttribute('data-map-provider') === provider
            && el.getAttribute('data-map-mode') === 'points'
            && Number(el.getAttribute('data-map-point-count') || 0) > 0
            && Number(el.getAttribute('data-map-native-marker-count') || 0) >= Number(el.getAttribute('data-map-point-count') || 0)
            && tileStats.count >= 3
            && tileStats.coverage >= 0.65
            && el.querySelectorAll('[data-region-cluster-button="true"]').length === 0;
        });
      }, expectedProvider, { timeout: 60000 }).then(() => true).catch(() => false);
    } else {
      report.large_modal_ready = false;
    }
    report.state = state;
    report.active_map = activeMap;
    report.geometry = geometry;
      report.errors.push(...runtime.errors);
      report.warnings.push(...runtime.warnings);
    });
  } catch (error) {
    report.errors.push(error?.message || String(error));
    report.errors.push(...(error?.qaRuntime?.errors || []));
    report.warnings.push(...(error?.qaRuntime?.warnings || []));
  }
  report.ok = Boolean(report.active_map)
    && report.active_map.provider === report.expected_provider
    && report.active_map.point_count > 0
    && report.active_map.native_marker_count >= report.active_map.point_count
    && report.active_map.coordinate_count >= report.active_map.point_count
    && report.active_map.fallback_count === 0
    && report.active_map.coordinate_source_count >= report.active_map.point_count
    && report.active_map.visible_tile_count >= 3
    && report.active_map.visible_tile_coverage >= 0.65
    && report.active_map.region_buttons === 0
    && report.state?.region_summary_visible === false
    && report.point_click_detail_ready === true
    && report.large_button_visible === true
    && report.large_modal_ready === true
    && report.geometry?.ok === true
    && report.errors.length === 0;
  report.artifact = writeReport('market-map-pinpoint', report);
  console.log(`market map pinpoint ${report.ok ? 'PASS' : 'FAIL'}: ${report.artifact}`);
  if (!report.ok) process.exitCode = 1;
}

async function runMapProviderMatrix() {
  const matrix = [
    { key: 'naver-simulated', provider: 'naver-simulated', expected: 'naver' },
    { key: 'osm-config-missing', provider: 'osm-config-missing', expected: 'osm' },
    { key: 'osm-config-error', provider: 'osm-config-error', expected: 'osm' },
  ];
  const report = {
    ok: false,
    generated_at: new Date().toISOString(),
    script: 'qa:map-provider-matrix',
    simulation: argValue('simulate', 'success'),
    base_url: argValue('base-url', process.env.QA_BASE_URL || DEFAULT_BASE_URL),
    matrix: [],
    errors: [],
    warnings: [],
  };
  for (const row of matrix) {
    try {
      await withPage({ simulation: report.simulation, mapProvider: row.provider }, async ({ page, baseUrl, runtime }) => {
      await gotoDomContentLoaded(page, joinUrl(baseUrl, 'market-data/lease-market'), 45000);
      await waitForMarketShell(page);
      await waitForContentReady(page, { needsTable: true, needsChart: true, needsMap: true });
      await waitForProvider(page, row.expected);
      const state = await collectPageState(page);
      const providers = [...new Set(state.map_stats.map((item) => item.provider))];
      const result = {
        key: row.key,
        expected_provider: row.expected,
        observed_providers: providers,
        map_stats: state.map_stats,
        api_calls: [],
        ok: providers.includes(row.expected)
          && state.map_stats.every((item) => (
            item.provider === row.expected
            && item.mode === 'points'
            && item.visible_tile_count >= 3
            && item.visible_tile_coverage >= 0.65
            && item.point_count > 0
            && item.point_buttons > 0
            && item.region_buttons === 0
            && item.coordinate_count >= item.point_count
          ))
          && state.map_expand_button_count > 0
          && !state.region_summary_visible,
      };
      report.matrix.push(result);
      report.errors.push(...runtime.errors.map((message) => `${row.key}: ${message}`));
        report.warnings.push(...runtime.warnings.map((message) => `${row.key}: ${message}`));
      });
    } catch (error) {
      report.matrix.push({
        key: row.key,
        expected_provider: row.expected,
        observed_providers: [],
        map_stats: [],
        ok: false,
        error: error?.message || String(error),
      });
      report.errors.push(`${row.key}: ${error?.message || String(error)}`);
      report.errors.push(...(error?.qaRuntime?.errors || []).map((message) => `${row.key}: ${message}`));
      report.warnings.push(...(error?.qaRuntime?.warnings || []).map((message) => `${row.key}: ${message}`));
    }
  }
  report.ok = report.matrix.every((row) => row.ok) && report.errors.length === 0;
  report.artifact = writeReport('map-provider-matrix', report);
  console.log(`map provider matrix ${report.ok ? 'PASS' : 'FAIL'}: ${report.artifact}`);
  if (!report.ok) process.exitCode = 1;
}

module.exports = {
  runDataLoadingStability,
  runDataLoadingIdle,
  runMarketMapPinpoint,
  runMapProviderMatrix,
};
