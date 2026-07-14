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

test('lifecycle restart lock coalesces focus, visibility, and online events', () => {
  const isLocked = sourceFunction(workspaceSource, 'isDashboardLifecycleRefreshLocked');
  const lock = { cacheKey: 'dashboard/home', startedAt: 10_000 };
  assert.equal(isLocked(lock, 'dashboard/home', 10_100, 5_000), true);
  assert.equal(isLocked(lock, 'dashboard/home', 16_000, 5_000), false);
  assert.equal(isLocked(lock, 'dashboard/asset', 10_100, 5_000), false);
});

test('edge loading progress starts above zero and never regresses', () => {
  const createTrace = sourceFunction(sectorSource, 'createEdgeDataLoadingTrace');
  const progress = sourceFunction(sectorSource, 'edgeDataLoadingProgress');
  const cold = ['queued', 'loading', 'retrying', 'ready'].map((stage, index) => progress(createTrace({ stage, attempt: index })));
  const revalidate = ['ready', 'refreshing', 'ready'].map((stage) => progress(createTrace({ stage, hasData: true })));
  assert.ok(cold[0] > 0);
  assert.deepEqual(cold, [...cold].sort((a, b) => a - b));
  assert.deepEqual(revalidate, [...revalidate].sort((a, b) => a - b));
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

test('protected floorplan and transaction fullscreen changes remain present', () => {
  assert.match(workspaceSource, /bg-black\/50/u);
  assert.match(sectorSource, /title:\s*text\(row\.asset_name\)[\s\S]{0,260}fullscreen:\s*true/u);
});
