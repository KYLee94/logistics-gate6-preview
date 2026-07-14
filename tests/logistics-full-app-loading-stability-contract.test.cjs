const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const FULL_APP_PATH = path.join(ROOT, 'scripts', 'qa', 'logistics-full-app-loading-stability.cjs');
const IDLE_PATH = path.join(ROOT, 'scripts', 'qa', 'logistics-data-loading-idle.cjs');
const SURFACE_PATH = path.join(ROOT, 'scripts', 'qa', 'logistics-full-surface-audit.cjs');
const PACKAGE_PATH = path.join(ROOT, 'package.json');
const fullAppSource = fs.readFileSync(FULL_APP_PATH, 'utf8');
const idleSource = fs.readFileSync(IDLE_PATH, 'utf8');
const surfaceSource = fs.readFileSync(SURFACE_PATH, 'utf8');
const packageJson = JSON.parse(fs.readFileSync(PACKAGE_PATH, 'utf8'));

const REQUIRED_ROUTES = [
  'work-platform',
  'work-platform/archive',
  'home',
  'asset',
  'company',
  'investment-index',
  'asset-spec',
  'analysis-tools',
  'pivot-table',
  'data-quality',
  'market-data/overview',
  'market-data/lease-market',
  'market-data/supply-pipeline',
  'market-data/transactions',
  'market-data/source-update',
  'data-management/asset-data',
  'data-management/investment-data',
  'data-management/lease-contracts',
  'data-management/managers',
  'data-management/data-quality',
  'data-management/approval',
  'contract-data',
  'pdf-report',
];

function extractFunction(source, name) {
  const marker = `function ${name}`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `${name} must exist`);
  const open = source.indexOf('{', source.indexOf(')', start));
  let depth = 0;
  let quote = '';
  let escaped = false;
  for (let index = open; index < source.length; index += 1) {
    const char = source[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = '';
      continue;
    }
    if (char === '\'' || char === '"' || char === '`') {
      quote = char;
      continue;
    }
    if (char === '{') depth += 1;
    if (char === '}' && --depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`${name} does not close`);
}

function sourceFunction(source, name) {
  const declaration = extractFunction(source, name);
  return new Function(`${declaration}\nreturn ${name};`)();
}

test('full app loading stability covers the exact 23 release routes', () => {
  const routesBlock = fullAppSource.slice(fullAppSource.indexOf('const ROUTES = ['), fullAppSource.indexOf('];', fullAppSource.indexOf('const ROUTES = [')));
  const routes = [...routesBlock.matchAll(/route:\s*'([^']+)'/gu)].map((match) => match[1]);
  assert.deepEqual(routes, REQUIRED_ROUTES);
});

test('loading completion waits are mandatory and fixed Playwright sleeps are absent', () => {
  assert.doesNotMatch(extractFunction(fullAppSource, 'waitForRouteReady'), /\.catch\(\(\) => null\)/u);
  assert.doesNotMatch(extractFunction(idleSource, 'waitForRouteReady'), /\.catch\(\(\) => null\)/u);
  assert.doesNotMatch(fullAppSource, /waitForTimeout\s*\(/u);
  assert.doesNotMatch(idleSource, /waitForTimeout\s*\(/u);
});

test('idle defaults to two minutes in both live loading scripts', () => {
  assert.match(fullAppSource, /const DEFAULT_IDLE_MS = 120_000;/u);
  assert.match(fullAppSource, /numberArg\('idle-ms', DEFAULT_IDLE_MS\)/u);
  assert.match(idleSource, /const MIN_LIVE_IDLE_MS = 120_000;/u);
  assert.match(idleSource, /numberArg\('idle-ms', MIN_LIVE_IDLE_MS\)/u);
});

test('progress audit ignores transient no-request badges but rejects retained completion badges', () => {
  const assess = sourceFunction(fullAppSource, 'assessLoadingSamples');
  const transient = assess([
    { pending: 0, started: 0, wave: 0, reason: 'dom-mutation', badges: [{ id: 'dashboard', progress: 50 }] },
  ], { settled: true, finalPending: 0, finalBadges: [] });
  assert.equal(transient.ok, true);
  assert.equal(transient.regressions.length, 0);
  assert.equal(transient.badges_without_requests.length, 0);
  assert.equal(transient.retained_badges.length, 0);

  const regression = assess([
    { pending: 1, started: 1, wave: 1, badges: [{ id: 'dashboard', progress: 96 }] },
    { pending: 1, started: 1, wave: 1, badges: [{ id: 'dashboard', progress: 84 }] },
  ], { settled: true, finalPending: 0, finalBadges: [] });
  assert.equal(regression.ok, false);
  assert.equal(regression.regressions.length, 1);

  const completion = assess([], {
    settled: true,
    finalPending: 0,
    finalBadges: [{ id: 'dashboard', progress: 50 }],
  });
  assert.equal(completion.ok, false);
  assert.equal(completion.badges_without_requests.length, 1);
  assert.equal(completion.retained_badges.length, 1);

  const pending = assess([], { settled: false, finalPending: 1, finalBadges: [{ id: 'still-loading', progress: 50 }] });
  assert.equal(pending.ok, false);
  assert.equal(pending.pending_requests_at_timeout, 1);
  assert.equal(pending.retained_badges.length, 0);
});

test('full app QA observes actual dashboard requests and popup reopen lifecycle', () => {
  assert.match(fullAppSource, /__LOGISTICS_LOADING_QA__/u);
  assert.match(fullAppSource, /request-start/u);
  assert.match(fullAppSource, /request-end/u);
  assert.match(fullAppSource, /function checkPopupLifecycle/u);
  for (const field of ['opened', 'closed', 'reopened', 'reclosed']) {
    assert.match(fullAppSource, new RegExp(`\\b${field}\\b`, 'u'));
  }
});

test('modal checks clear residual fullscreen overlays before every popup lifecycle', () => {
  const dismissOverlays = extractFunction(fullAppSource, 'dismissResidualOverlays');
  const modalChecks = extractFunction(fullAppSource, 'checkSystemModals');
  assert.match(dismissOverlays, /div\.fixed\.inset-0\.z-40/u);
  assert.match(dismissOverlays, /keyboard\.press\('Escape'\)/u);
  assert.match(dismissOverlays, /mouse\.click\(12, 12\)/u);
  assert.equal((modalChecks.match(/await dismissResidualOverlays\(page\)/gu) || []).length, 3, 'each popup lifecycle must have its own overlay cleanup');

  const featureCleanup = modalChecks.indexOf('overlayCleanup.feature_access = await dismissResidualOverlays(page)');
  const featureLifecycle = modalChecks.indexOf('modalChecks.feature_access = await checkPopupLifecycle');
  const loginCleanup = modalChecks.indexOf('overlayCleanup.login_history = await dismissResidualOverlays(page)');
  const loginLifecycle = modalChecks.indexOf('modalChecks.login_history = await checkPopupLifecycle');
  const notificationCleanup = modalChecks.indexOf('overlayCleanup.notifications = await dismissResidualOverlays(page)');
  const notificationLifecycle = modalChecks.indexOf('modalChecks.notifications = await checkPopupLifecycle');

  assert.ok(featureCleanup >= 0 && featureCleanup < featureLifecycle, 'feature access cleanup must precede its lifecycle');
  assert.ok(loginCleanup >= 0 && loginCleanup < loginLifecycle, 'login history cleanup must precede its lifecycle');
  assert.ok(loginLifecycle < notificationCleanup && notificationCleanup < notificationLifecycle, 'notification cleanup must run after login history and before notification lifecycle');
  assert.match(modalChecks, /report\.overlay_cleanup = overlayCleanup/u);
  assert.match(fullAppSource, /overlayCleanupChecks\.length === 3/u);
  assert.match(fullAppSource, /overlayCleanupChecks\.every\(\(row\) => row\.ok\)/u);
});

test('401 and 403 are release failures reported separately from server errors', () => {
  for (const source of [fullAppSource, idleSource]) {
    assert.match(source, /auth_errors/u);
    assert.match(source, /server_errors/u);
    assert.match(source, /\[401, 403\]/u);
  }
});

test('full surface audit rejects stale loading artifacts and strict release runs current loading QA', () => {
  assert.match(surfaceSource, /const REQUIRED_LOADING_ROUTES = \[/u);
  assert.match(surfaceSource, /Number\(json\.route_count \|\| 0\) === REQUIRED_LOADING_ROUTES\.length/u);
  assert.match(surfaceSource, /Number\(json\.cycles \|\| 0\) >= 50/u);
  assert.match(surfaceSource, /Number\(json\.idle_ms \|\| 0\) >= 120_000/u);
  assert.match(surfaceSource, /progress_audit\?\.ok === true/u);
  const strict = packageJson.scripts['qa:release-gate:strict'];
  assert.ok(strict.includes('npm run qa:full-app:loading-stability'));
  assert.ok(strict.indexOf('npm run qa:full-app:loading-stability') < strict.indexOf('npm run qa:full-surface:audit'));
});
