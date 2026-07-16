const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const WORKSPACE_PATH = path.join(ROOT, 'src/components/system/workspace/WorkspaceLogistics.jsx');
const SECTOR_PATH = path.join(ROOT, 'src/components/system/workspace/LogisticsSectorModules.jsx');
const workspaceSource = fs.readFileSync(WORKSPACE_PATH, 'utf8');
const sectorSource = fs.readFileSync(SECTOR_PATH, 'utf8');

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

test('dashboard inflight staleness is based on startedAt, not missing cache age', () => {
  const isStale = sourceFunction(workspaceSource, 'isDashboardReadInflightStale');
  assert.equal(isStale({ startedAt: 9_000 }, 10_000, 5_000), false);
  assert.equal(isStale({ startedAt: 4_000 }, 10_000, 5_000), true);
  assert.equal(isStale(null, 10_000, 5_000), false);
});

test('lifecycle restart lock coalesces explicit invalidation events', () => {
  const isLocked = sourceFunction(workspaceSource, 'isDashboardLifecycleRefreshLocked');
  const lock = { cacheKey: 'dashboard/home', startedAt: 10_000 };
  assert.equal(isLocked(lock, 'dashboard/home', 10_100, 5_000), true);
  assert.equal(isLocked(lock, 'dashboard/home', 16_000, 5_000), false);
  assert.equal(isLocked(lock, 'dashboard/asset', 10_100, 5_000), false);
});

test('edge loading progress is monotonic within each lifecycle wave', () => {
  const createTrace = sourceFunction(sectorSource, 'createEdgeDataLoadingTrace');
  const progress = sourceFunction(sectorSource, 'edgeDataLoadingProgress');
  const cold = ['queued', 'loading', 'processing', 'ready'].map((stage, index) => progress(createTrace({ stage, attempt: index })));
  const previousWaveReady = progress(createTrace({ stage: 'ready', hasData: true }));
  const revalidate = ['refreshing', 'processing', 'ready'].map((stage) => progress(createTrace({ stage, hasData: true })));
  assert.ok(cold[0] > 0);
  assert.deepEqual(cold, [25, 50, 75, 100]);
  assert.equal(previousWaveReady, 100);
  assert.deepEqual(revalidate, [50, 75, 100]);
});

test('dashboard loading progress is monotonic within one visible request wave', () => {
  const nextProgress = sourceFunction(workspaceSource, 'nextDashboardLoadingProgress');
  assert.equal(nextProgress(8, 50, false), 50);
  assert.equal(nextProgress(50, 25, true), 50);
  assert.equal(nextProgress(50, 75, true), 75);
  assert.equal(nextProgress(75, 25, false), 25);
  const badge = extractFunction(workspaceSource, 'DashboardPageLoadingBadge');
  assert.match(badge, /waveRef\.current\.active && waveRef\.current\.scopeKey === normalizedScopeKey/u);
  assert.match(workspaceSource, /scopeKey=\{selected\?\.id\}/u);
});

test('dashboard loading progress is driven by visible lifecycle request units, not a fixed 50 to 100 transition', () => {
  const shell = extractFunction(workspaceSource, 'DashboardShell');
  const reportStart = shell.indexOf('const reportModuleLoading');
  const reportEnd = shell.indexOf('const activeModuleLoadingEntries');
  assert.ok(reportStart >= 0 && reportEnd > reportStart, 'DashboardShell must define the module loading reporter');
  const reportModuleLoading = shell.slice(reportStart, reportEnd);
  const badge = extractFunction(workspaceSource, 'DashboardPageLoadingBadge');

  // A request report must carry completed/total lifecycle units. A default 50 percent
  // makes every pending request look half complete regardless of its real lifecycle.
  assert.doesNotMatch(reportModuleLoading, /progress\s*=\s*50/u, 'module loading must not default to 50 percent');
  assert.doesNotMatch(shell, /activeShellDatasetLoading\s*\?\s*\[50\]/u, 'home loading must not inject a fixed 50 percent value');
  assert.match(reportModuleLoading, /completed(?:Units|Requests|Steps)/u, 'module loading reports completed request units');
  assert.match(reportModuleLoading, /total(?:Units|Requests|Steps)/u, 'module loading reports total request units');

  // Completion belongs only to a settled wave. Pending work must retain a value below 100.
  assert.match(shell, /activeDashboardLoading[\s\S]{0,700}Math\.min\([^)]*99/u, 'pending dashboard work is capped below 100 percent');

  // Retry updates share a wave and hidden modules are excluded before the aggregate is computed.
  assert.match(reportModuleLoading, /previous[\s\S]{0,500}Math\.max\(previous\.progress/u, 'retry progress cannot move backward');
  assert.match(shell, /filter\(\(entry\)\s*=>\s*entry\.moduleId\s*===\s*selected\?\.id/u, 'hidden tabs cannot contribute to the visible loading total');
  assert.match(badge, /data-loading-progress="true"/u, 'visible badge remains available to browser QA');
});

test('OpenDART navigation is cache-only while explicit refresh remains provider-backed', () => {
  assert.match(workspaceSource, /corp_code: selectedCorpCode, include_financials: true, cache_only: true/u);
  assert.match(workspaceSource, /corp_code: selectedCorpCode, include_financials: true, force_refresh: true/u);
  assert.match(workspaceSource, /force_refresh: true \},\s*\{ retryTimeout: false \}/u);
});

test('edge cache commits require both local and global latest request ids', () => {
  const hook = extractFunction(sectorSource, 'useEdgeData');
  assert.match(hook, /requestRef\.current === requestId/u);
  assert.match(hook, /EDGE_DATA_LATEST_REQUEST_ID\.get\(requestKey\) === inflight\.requestId/u);
});

test('hidden dashboard modules keep component state but disable data refresh subscriptions', () => {
  const shell = extractFunction(workspaceSource, 'DashboardShell');
  const bridge = extractFunction(workspaceSource, 'useDashboardReadBridge');
  const edgeHook = extractFunction(sectorSource, 'useEdgeData');
  assert.match(shell, /DashboardModuleLifecycleContext\.Provider/u);
  assert.match(shell, /active:\s*selected\.id === item\.id/u);
  assert.match(bridge, /if \(!lifecycleActive\) return undefined;/u);
  assert.match(edgeHook, /if \(!lifecycleActive\)[\s\S]{0,100}mountedRef\.current = false;/u);
  assert.match(edgeHook, /mountedRef\.current = false;\s*requestRef\.current \+= 1;/u);
  assert.match(bridge, /const ownsRequest = \(\) => !cancelled && requestOwnerRef\.current === requestOwner/u);
  assert.match(bridge, /return \(\) => \{\s*cancelled = true;/u);
  assert.match(shell, /const activeShellDatasetLoading = selected\?\.id === 'home' && dashboardDataset\.loading;/u);
  assert.match(shell, /const activeDashboardLoading = activeShellDatasetLoading \|\| activeModuleLoadingEntries\.length > 0;/u);
});

test('market data reads only the active tab and invalidates explicitly after approved updates', () => {
  const marketDashboard = extractFunction(sectorSource, 'MarketDataDashboardContent');
  const edgeHook = extractFunction(sectorSource, 'useEdgeData');
  const edgeRefreshListeners = extractFunction(sectorSource, 'ensureEdgeDataRefreshListeners');
  const approvalDashboard = extractFunction(sectorSource, 'DataManagementApprovalDashboard');

  assert.match(marketDashboard, /useEdgeData\('sector-market\/read', marketReadPayload\)/u);
  assert.doesNotMatch(marketDashboard, /primeEdgeData\('sector-market\/read'/u);
  assert.doesNotMatch(workspaceSource, /primeEdgeData\('sector-market\/read'/u);
  assert.doesNotMatch(workspaceSource, /setInterval\(runWhenIdle, 75_000\)/u);

  assert.match(edgeRefreshListeners, /window\.addEventListener\('logistics-data-refresh', notify\)/u);
  assert.match(edgeRefreshListeners, /window\.addEventListener\('focus', notify\)/u);
  assert.match(edgeRefreshListeners, /window\.addEventListener\('online', notify\)/u);
  assert.match(edgeRefreshListeners, /document\.addEventListener\('visibilitychange', notify\)/u);
  assert.match(edgeHook, /if \(event\?\.detail\?\.action && event\.detail\.action !== action\) return;/u);
  assert.match(workspaceSource, /window\.addEventListener\('focus', refreshIfNeeded\)/u);
  assert.match(workspaceSource, /window\.addEventListener\('online', refreshIfNeeded\)/u);
  assert.match(workspaceSource, /document\.addEventListener\('visibilitychange', refreshIfNeeded\)/u);

  assert.match(sectorSource, /function invalidateSectorMarketEdgeCache\(\) \{[\s\S]*:sector-market\/read:/u);
  assert.match(approvalDashboard, /if \(action === 'approve'\) \{[\s\S]*invalidateSectorMarketEdgeCache\(\);[\s\S]*action: 'sector-market\/read'/u);
  assert.match(marketDashboard, /const uploadMarketSourceWorkbook[\s\S]*invalidateSectorMarketEdgeCache\(\);[\s\S]*notifyLogisticsDataRefresh\(\{ source: 'market-docs-upload', action: 'sector-market\/read' \}\)/u);
});

test('market data uses a longer automatic revalidation window but refreshes immediately after invalidation', () => {
  const prime = extractFunction(sectorSource, 'primeEdgeData');
  const edgeHook = extractFunction(sectorSource, 'useEdgeData');
  const revalidationPolicy = extractFunction(sectorSource, 'edgeDataRevalidateMs');
  const cacheTtlPolicy = extractFunction(sectorSource, 'edgeDataCacheTtlMs');

  assert.match(sectorSource, /const SECTOR_MARKET_REVALIDATE_MS = 30 \* 60 \* 1000;/u);
  assert.match(sectorSource, /const SECTOR_MARKET_CACHE_TTL_MS = 30 \* 60 \* 1000;/u);
  assert.match(revalidationPolicy, /action === 'sector-market\/read' \? SECTOR_MARKET_REVALIDATE_MS : EDGE_DATA_REVALIDATE_MS/u);
  assert.match(cacheTtlPolicy, /action === 'sector-market\/read' \? SECTOR_MARKET_CACHE_TTL_MS : EDGE_DATA_CACHE_TTL_MS/u);
  assert.match(prime, /Date\.now\(\) - cached\.loadedAt < edgeDataRevalidateMs\(action\)/u);
  assert.match(edgeHook, /cachedAge < edgeDataCacheTtlMs\(action\)/u);
  assert.match(edgeHook, /const forcedRefresh = event\?\.detail\?\.action === action;/u);
  assert.match(edgeHook, /if \(!forcedRefresh && !current\.error && hasEdgeDataValue\(current\.data\) && !stale\) return;/u);
  assert.match(edgeHook, /reload\(\{\}, \{ silent: Boolean\(current\.data\), force: true \}\)/u);
});

test('protected floorplan and transaction fullscreen changes remain present', () => {
  assert.match(workspaceSource, /bg-black\/50/u);
  assert.match(sectorSource, /title:\s*text\(row\.asset_name\)[\s\S]{0,260}fullscreen:\s*true/u);
});
