const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const SECTOR_MODULES_PATH = path.join(ROOT, 'src', 'components', 'system', 'workspace', 'LogisticsSectorModules.jsx');
const WORKSPACE_PATH = path.join(ROOT, 'src', 'components', 'system', 'workspace', 'WorkspaceLogistics.jsx');

function lineNumber(source, index) {
  return source.slice(0, Math.max(0, index)).split(/\r?\n/u).length;
}

function extractBlock(source, marker, label) {
  const start = source.indexOf(marker);
  if (start === -1) throw new Error(`${label}: marker not found (${marker})`);
  const open = source.indexOf('{', start + marker.length - 1);
  if (open === -1) throw new Error(`${label}: opening brace not found`);

  let depth = 0;
  let quote = '';
  let escaped = false;
  let lineComment = false;
  let blockComment = false;
  for (let index = open; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];
    if (lineComment) {
      if (char === '\n') lineComment = false;
      continue;
    }
    if (blockComment) {
      if (char === '*' && next === '/') {
        blockComment = false;
        index += 1;
      }
      continue;
    }
    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === quote) {
        quote = '';
      }
      continue;
    }
    if (char === '/' && next === '/') {
      lineComment = true;
      index += 1;
      continue;
    }
    if (char === '/' && next === '*') {
      blockComment = true;
      index += 1;
      continue;
    }
    if (char === '\'' || char === '"' || char === '`') {
      quote = char;
      continue;
    }
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error(`${label}: closing brace not found`);
}

function evaluateCheck(report, id, description, fn) {
  try {
    const evidence = fn();
    report.checks.push({ id, description, ok: true, evidence });
  } catch (error) {
    report.checks.push({ id, description, ok: false, error: error?.message || String(error) });
  }
}

function requireMatch(source, pattern, label) {
  const match = source.match(pattern);
  if (!match) throw new Error(`Missing contract: ${label}`);
  return { line: lineNumber(source, match.index), match: match[0].replace(/\s+/gu, ' ').slice(0, 180) };
}

function requireOrdered(source, entries, label) {
  let cursor = -1;
  const evidence = [];
  for (const [name, pattern] of entries) {
    const match = pattern instanceof RegExp
      ? source.slice(cursor + 1).match(pattern)
      : { index: source.slice(cursor + 1).indexOf(pattern), 0: pattern };
    if (!match || match.index === -1) throw new Error(`${label}: missing ${name}`);
    cursor += match.index + 1;
    evidence.push({ name, line: lineNumber(source, cursor) });
  }
  return evidence;
}

function main() {
  const sectorSource = fs.readFileSync(SECTOR_MODULES_PATH, 'utf8');
  const workspaceSource = fs.readFileSync(WORKSPACE_PATH, 'utf8');
  const edgeHook = extractBlock(sectorSource, 'function useEdgeData(action, payload = {})', 'useEdgeData');
  const edgeListeners = extractBlock(sectorSource, 'function ensureEdgeDataRefreshListeners()', 'ensureEdgeDataRefreshListeners');
  const dashboardBridge = extractBlock(workspaceSource, 'function useDashboardReadBridge(', 'useDashboardReadBridge');
  const dataManagement = extractBlock(sectorSource, "export function DataManagementDashboard({ activeTab = 'lease' })", 'DataManagementDashboard');
  const report = {
    ok: false,
    script: 'qa:data-loading:red-team',
    mode: 'source-trace-contract',
    primary_success: 'direct source contract assertions',
    artifact_freshness_used: false,
    local_only_artifact_used: false,
    live_url_used: false,
    sources: [
      path.relative(ROOT, SECTOR_MODULES_PATH).replace(/\\/gu, '/'),
      path.relative(ROOT, WORKSPACE_PATH).replace(/\\/gu, '/'),
    ],
    checks: [],
  };

  evaluateCheck(report, 'tab-switch-version-gate', 'A response from the previous tab cannot commit after its payload key changes.', () => {
    const version = requireMatch(edgeHook, /requestRef\.current\s*\+=\s*1\s*;/u, 'payload-key version increment');
    const commit = requireMatch(edgeHook, /mountedRef\.current\s*&&\s*requestRef\.current\s*===\s*requestId/u, 'latest-request commit guard');
    const retryAbort = requireMatch(edgeHook, /!mountedRef\.current\s*\|\|\s*requestRef\.current\s*!==\s*requestId/u, 'stale retry abort guard');
    return { version, commit, retryAbort };
  });

  evaluateCheck(report, 'stale-dashboard-response-rejected', 'Only an inflight read whose startedAt exceeds the stale threshold is superseded, and its late response is discarded.', () => {
    return requireOrdered(dashboardBridge, [
      ['read current inflight', /const staleInflight = DASHBOARD_READ_INFLIGHT\.get\(cacheKey\);/u],
      ['check startedAt staleness', /if \(isDashboardReadInflightStale\(staleInflight\)\)/u],
      ['supersede stale inflight', /staleInflight\.superseded = true;/u],
      ['remove only matching inflight entry', /if \(DASHBOARD_READ_INFLIGHT\.get\(cacheKey\) === staleInflight\) DASHBOARD_READ_INFLIGHT\.delete\(cacheKey\);/u],
      ['ignore superseded response', /if \(inflight\.superseded\) return;/u],
    ], 'dashboard stale response contract');
  });

  evaluateCheck(report, 'data-management-view-key-gate', 'Rows that belong to a previously selected Data Management view remain non-blocking until the active view has matching data.', () => {
    const staleView = requireMatch(dataManagement, /const rowsDataStaleForView\s*=\s*Boolean\(rowsData\s*&&\s*rowsDataViewKey\s*&&\s*rowsDataViewKey\s*!==\s*effectiveViewKey\)/u, 'stale view-key detection');
    const currentRows = requireMatch(dataManagement, /const currentRowsData\s*=\s*rowsDataMatchesView\s*\?\s*rowsData\s*:\s*null/u, 'stale view data exclusion');
    const errorGate = requireMatch(dataManagement, /!rowsDataStaleForView/u, 'stale view error suppression');
    return { staleView, currentRows, errorGate };
  });

  evaluateCheck(report, 'visibility-hidden-does-not-refresh', 'Focus and visibility events are ignored while the document is hidden.', () => {
    const notifyGuard = requireMatch(edgeListeners, /const notify = \(event\) => \{\s*if \(document\.visibilityState && document\.visibilityState !== 'visible'\) return;/u, 'immediate refresh visibility guard');
    const activityGuard = requireMatch(edgeListeners, /const notifyAfterActivity = \(\) => \{\s*if \(document\.visibilityState && document\.visibilityState !== 'visible'\) return;/u, 'activity refresh visibility guard');
    return { notifyGuard, activityGuard };
  });

  evaluateCheck(report, 'idle-return-and-visibility-subscriptions', 'A visible tab return can notify active subscribers after focus, online, explicit refresh, or visibility change without route-wide fan-out.', () => {
    const evidence = requireOrdered(edgeListeners, [
      ['focus listener', "window.addEventListener('focus', notifyAfterActivity);"],
      ['online listener', "window.addEventListener('online', notify);"],
      ['explicit refresh listener', "window.addEventListener('logistics-data-refresh', notify);"],
      ['visibility listener', "document.addEventListener('visibilitychange', notifyAfterActivity);"],
    ], 'edge activity listener contract');
    if (/addEventListener\('popstate'/u.test(edgeListeners)) throw new Error('Route navigation must not fan out refreshes to every edge subscriber.');
    return evidence;
  });

  evaluateCheck(report, 'dashboard-visibility-return-revalidates-stale-data', 'Dashboard reads coalesce visible-return recovery and restart only missing or stale loading requests.', () => {
    const visibleGuard = requireMatch(dashboardBridge, /if \(document\.visibilityState && document\.visibilityState !== 'visible'\) return;/u, 'dashboard visibility guard');
    const staleDecision = requireMatch(dashboardBridge, /const staleLoading = current\?\.status === 'loading'[\s\S]{0,160}isDashboardReadInflightStale\(inflight, now\)/u, 'dashboard stale loading decision');
    const freshLoadingGuard = requireMatch(dashboardBridge, /if \(current\?\.status === 'loading' && !staleLoading\) return;/u, 'fresh loading guard');
    const restartLock = requireMatch(dashboardBridge, /isDashboardLifecycleRefreshLocked\(lifecycleRefreshLockRef\.current, cacheKey, now\)/u, 'single restart lock');
    const listener = requireMatch(dashboardBridge, /document\.addEventListener\('visibilitychange', refreshIfNeeded\);/u, 'dashboard visibility listener');
    return { visibleGuard, staleDecision, freshLoadingGuard, restartLock, listener };
  });

  report.ok = report.checks.every((check) => check.ok);
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exitCode = 1;
}

try {
  main();
} catch (error) {
  console.error(error?.stack || error?.message || error);
  process.exit(1);
}
