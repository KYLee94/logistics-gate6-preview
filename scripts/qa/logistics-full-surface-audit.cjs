const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT_DIR = path.join(ROOT, 'qa-artifacts', 'logistics-gate6');
const SRC_DIR = path.join(ROOT, 'src');
const QA_DIR = path.join(ROOT, 'scripts', 'qa');

const SURFACES = [
  {
    id: 'global-auth-loading',
    axis: 'global-stability',
    screen: 'Global shell',
    route: 'all protected routes',
    components: ['AuthContext', 'IotaLeftNav', 'useEdgeData', 'invokeDashboardApi'],
    interactions: ['login', 'logout', 'session refresh', 'tab switch', 'browser back/forward', 'idle return'],
    dataContract: 'Auth session, permission scope, primary/cache/fallback state must be separated.',
    acceptance: ['no forced redirect after valid login', 'no blank data after idle', '401/403 cannot be treated as success'],
    requiredEvidence: ['live 50-cycle tab switch', 'idle return with real session', 'auth/permission matrix'],
  },
  {
    id: 'system-modals',
    axis: 'global-stability',
    screen: 'System modals',
    route: 'left navigation footer',
    components: ['feature access modal', 'login history modal', 'notification panel'],
    interactions: ['open', 'refresh', 'save/delete', 'close', 'reopen after idle'],
    dataContract: 'Modal UI must read back the server state after every mutation.',
    acceptance: ['feature access persists', 'login history reloads', 'notification dismiss readback matches server'],
    requiredEvidence: ['live modal refresh stability', 'notification dismiss readback', 'idle modal reopen'],
  },
  {
    id: 'work-platform',
    axis: 'screen-coverage',
    screen: 'Work Platform',
    route: '/work-platform',
    components: ['profile card', 'asset/fund assignment summary', 'search', 'shortcut buttons'],
    interactions: ['search', 'dashboard navigation', 'assignment readback'],
    dataContract: '19 assets and 17 funds must be visible to all-management users.',
    acceptance: ['manager sees all assets/funds', 'external PM only sees assigned assets', 'navigation does not reset auth'],
    requiredEvidence: ['live work platform smoke', 'permission-specific screenshots'],
  },
  {
    id: 'dashboard-home-asset-company',
    axis: 'screen-coverage',
    screen: 'Dashboard core tabs',
    route: '/home, /asset, /company',
    components: ['KPI cards', 'maps', 'asset/company selectors', 'tenant tables', 'DART refresh'],
    interactions: ['selector change', 'table sorting', 'row click', 'map hover/click', 'external refresh'],
    dataContract: 'Primary data, static fallback, provider fallback, and empty state must not be conflated.',
    acceptance: ['all visible tables sort', 'maps show real tiles/markers', 'refresh buttons report provider/store/fallback separately'],
    requiredEvidence: ['browser visible parity', 'map callout smoke', 'external refresh smoke'],
  },
  {
    id: 'dashboard-special-tabs',
    axis: 'screen-coverage',
    screen: 'Dashboard special tabs',
    route: '/investment-index, /asset-spec, /analysis-tools, /pivot-table, /data-quality, /pdf-report',
    components: ['investment charts', 'asset spec comparison', 'analysis matrix', 'pivot controls', 'data quality edit modal', 'PDF report builder'],
    interactions: ['slicer', 'chart hover/click', 'table sort', 'edit modal', 'link/open', 'PDF save/print'],
    dataContract: 'UI values must match Supabase/API readback and must not expose internal identifiers.',
    acceptance: ['no raw/internal IDs', 'chart popups expose full detail', 'every button changes UI or server state as expected'],
    requiredEvidence: ['tab-specific live smoke', 'internal-text denylist', 'readback parity'],
  },
  {
    id: 'market-data',
    axis: 'screen-coverage',
    screen: 'Market Data tabs',
    route: '/market-data/overview, /lease-market, /supply-pipeline, /transactions, /source-update',
    components: ['slicers', 'tables', 'charts', 'MarketMapPanel', 'explorer modals'],
    interactions: ['tab switch', 'slicer change', 'table sort/scroll', 'chart hover/click', 'map zoom/label/pin', 'modal explorer'],
    dataContract: 'Excel -> Supabase -> Edge API -> UI values must match; view readback cannot be skipped.',
    acceptance: ['no blank chart/table', 'map labels stay inside panel', 'all chart clicks open detailed rows', 'UI row count matches API'],
    requiredEvidence: ['market browser smoke', 'view readback for every tab', 'live Naver/OSM map flow', 'pin/address precision'],
  },
  {
    id: 'data-management',
    axis: 'screen-coverage',
    screen: 'Data Management',
    route: '/data-management',
    components: ['workspace tabs', 'business view table', 'fullscreen edit modal', 'change basket', 'approval/readback panel'],
    interactions: ['view switch', 'asset/fund bundle select', 'search', 'table sort/scroll', 'field edit', 'preview', 'submit', 'approve/reject', 'readback'],
    dataContract: 'Every public ll_* table must be cataloged; editable values use approval flow, readback-only tables are locked.',
    acceptance: ['no ll_/payload/source_row_id/internal ID visible', 'submit/write/readback is proven', 'ended contracts and past history are locked'],
    requiredEvidence: ['coverage audit', 'release gate with submit/write/readback', 'live browser flow', 'permission matrix'],
  },
  {
    id: 'data-parity',
    axis: 'data-consistency',
    screen: 'All data-backed UI',
    route: 'all',
    components: ['Supabase tables', 'Edge API actions', 'UI renderers'],
    interactions: ['read', 'filter', 'sort', 'mutate', 'readback'],
    dataContract: 'Supabase/API/UI row counts and displayed values must agree or show a clear blocked reason.',
    acceptance: ['no skipped readback accepted', 'fallback/cache states logged separately', 'screen count equals API count where applicable'],
    requiredEvidence: ['parity audit', 'source readback', 'visible parity', 'mutation readback'],
  },
];

const DETAILED_SURFACES = [
  ['dashboard-home', 'Dashboard Home', '/home', ['KPI cards', 'operation cost sections', 'asset comparison', 'map'], ['selector change', 'table sort', 'map hover/click', 'refresh']],
  ['dashboard-asset', 'Dashboard Asset', '/asset', ['asset selector', 'tenant status table', 'area composition', 'floor plan', '3D model link', 'maturity chart'], ['selector change', 'table sort', 'row click', 'modal open', 'external link']],
  ['dashboard-company', 'Dashboard Company', '/company', ['company selector', 'leased asset table', 'DART refresh', 'map'], ['selector change', 'table sort', 'row click', 'map expand', 'refresh']],
  ['investment-index', 'Investment Index', '/investment-index', ['fund equity/loan chart', 'maturity chart', 'loan rate chart', 'detail modals'], ['slicer', 'chart hover/click', 'modal table sort', 'readback']],
  ['asset-spec', 'Asset Spec', '/asset-spec', ['data input button', 'asset comparison', 'tenant occupied spec comparison', 'fullscreen table'], ['modal open', 'asset select', 'table view', 'readback']],
  ['analysis-tools', 'Analysis Tools', '/analysis-tools', ['asset/company selectors', 'metric controls', 'matrix detail'], ['selector change', 'metric change', 'raw table open', 'popup close']],
  ['pivot-table', 'Pivot Table', '/pivot-table', ['field selector', 'metric selector', 'filters', 'saved views', 'drilldown'], ['filter change', 'top N change', 'sort', 'save view', 'drilldown modal']],
  ['data-quality', 'Data Quality', '/data-management/data-quality', ['quality summary', 'issue table', 'edit popup', 'approval flow'], ['filter', 'row click', 'edit preview', 'submit', 'denylist scan']],
  ['pdf-report', 'PDF Report', '/pdf-report', ['component checkboxes', 'asset selection', 'ordering', 'preview/save/print'], ['select', 'reorder', 'open preview', 'save', 'print']],
  ['contract-data', 'Contract Data', '/contract-data', ['contract data route'], ['route access', 'data render', 'permission check']],
  ['ai-chatbot', 'AI Chatbot', 'global dock/work platform', ['chat dock', 'search/API response', 'source citations'], ['open', 'ask', 'response contract', 'fallback classification']],
  ['market-overview', 'Market Data Overview', '/market-data/overview', ['KPI cards', 'regional charts', 'supply timing chart'], ['slicer', 'legend click', 'chart click modal', 'row count parity']],
  ['market-lease', 'Lease Market', '/market-data/lease-market', ['latest lease statistics', 'regional center map/table', 'detail modals'], ['period/metric/temp/region slicers', 'table sort', 'map label/pin', 'chart popup']],
  ['market-supply', 'Supply Pipeline', '/market-data/supply-pipeline', ['new supply', 'pipeline', 'cumulative supply', 'area charts'], ['date range', 'reset', 'map label/pin', 'chart popup', 'table sort']],
  ['market-transactions', 'Transactions', '/market-data/transactions', ['deal comparison', 'market size', 'size buckets', 'cap rate'], ['period/region/temp/type slicers', 'chart popup', 'legend focus', 'table sort']],
  ['market-source-update', '업데이트', '/market-data/source-update', ['source coverage', 'raw/normalized counts', 'dry-run flow', 'Excel upload preservation'], ['source readback', 'count parity', 'validation result']],
  ['data-management-asset', 'Data Management - 자산 데이터', '/data-management/asset-data', ['asset overview', 'specs', 'operating costs', 'edit basket'], ['view switch', 'field edit', 'preview', 'submit', 'readback']],
  ['data-management-investment', 'Data Management - 투자 데이터', '/data-management/investment-data', ['funds', 'fund-asset links', 'equity/loan tranches', 'edit basket'], ['view switch', 'field edit', 'preview', 'submit', 'readback']],
  ['data-management-lease', 'Data Management - 임대차계약 데이터', '/data-management/lease-contracts', ['leases', 'lease spaces', 'rent history', 'required specs', 'edit basket'], ['view switch', 'field edit', 'preview', 'submit', 'readback']],
  ['data-management-managers', 'Data Management - 담당자 데이터', '/data-management/managers', ['asset managers', 'fund managers', 'user-readable columns'], ['view switch', 'filter', 'table sort', 'readback']],
  ['data-management-quality', 'Data Management - Data Quality', '/data-management/data-quality', ['quality findings', 'validation status', 'approval flow'], ['filter', 'row click', 'edit preview', 'submit', 'readback']],
];

function detailedSurface([id, screen, route, components, interactions]) {
  return {
    id,
    axis: 'detailed-screen-coverage',
    screen,
    route,
    components,
    interactions,
    dataContract: 'This surface requires live UI behavior evidence, API/readback evidence when data-backed, and denylist checks for internal terms.',
    acceptance: ['renders without blank/stuck state', 'all buttons and controls have observable effect', 'tables/charts/modals/maps meet component standards when present'],
    requiredEvidence: ['live screenshot/video', 'button/control interaction log', 'API/UI/readback parity where applicable'],
  };
}

function allSurfaces() {
  return [...SURFACES, ...DETAILED_SURFACES.map(detailedSurface)];
}

const KNOWN_BLOCKERS = [
  {
    id: 'known-notification-logout-failed-artifact',
    severity: 'blocking',
    area: 'global-stability',
    evidence: 'notification-logout-browser-smoke-latest.json',
    problem: 'Latest artifact is ok=false; notification button was not found and navigation ended at auth-setup.',
    requiredFix: 'Replace/repair with live URL notification/logout flow that proves panel, dismiss, logout, refresh-blocked protected route.',
  },
  {
    id: 'known-market-view-readback-skipped',
    severity: 'blocking',
    area: 'data-consistency',
    evidence: 'market-data-view-payload-audit-latest.json',
    problem: 'Overview/Lease/Supply/Transactions readback_status is skipped while ok=true.',
    requiredFix: 'Fail this QA unless every interactive market view has readback or an explicit non-applicable reason.',
  },
  {
    id: 'known-market-label-outside-panel',
    severity: 'blocking',
    area: 'component-behavior',
    evidence: 'live-market-map-naver-region-flow-latest.json',
    problem: 'Map region labels can have inside_panel=false after zoom while artifact remains ok=true.',
    requiredFix: 'Treat any map label outside panel as failure and capture screenshot.',
  },
  {
    id: 'known-data-management-release-gate-weak',
    severity: 'major',
    area: 'data-consistency',
    evidence: 'data-management-release-gate-latest.json',
    problem: 'Latest release gate uses edge_only/allow_submit=false/require_written_history=false and db_catalog.available=false.',
    requiredFix: 'Separate dry audit from mutation readback; do not mark approval/write/readback complete without an actual submit/write/readback artifact.',
  },
  {
    id: 'known-data-loading-scope-market-only',
    severity: 'blocking',
    area: 'global-stability',
    evidence: 'data-loading-stability-latest.json',
    problem: 'Current 50-cycle loading QA is centered on Market Data routes and does not prove Work Platform, Dashboard, Data Management, PDF Report, and system modal loading.',
    requiredFix: 'Add full-app live tab/button/modal loading stability coverage before closing the global loading defect.',
  },
  {
    id: 'known-idle-simulation-not-real-long-session',
    severity: 'major',
    area: 'global-stability',
    evidence: 'data-loading-idle-latest.json',
    problem: 'Idle QA simulates a pending request and release; it is not proof of a real long-running browser session recovering after auth/cache staleness.',
    requiredFix: 'Add a real-session idle/return scenario or explicit token/cache stale simulation covering auth/me, feature access, login history, sector-market/read, and data-management/view-rows.',
  },
];

function readText(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
}

function ensureOutDir() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

function timestampForFile() {
  return new Date().toISOString().replace(/[-:]/gu, '').replace(/\.\d{3}Z$/u, 'Z').replace('T', '-');
}

function safeJson(filePath) {
  try {
    return JSON.parse(readText(filePath));
  } catch {
    return null;
  }
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function latestArtifactOk(name, predicate = () => true) {
  const json = safeJson(path.join(OUT_DIR, name));
  return Boolean(json?.ok === true && predicate(json));
}

function latestArtifact(name) {
  return safeJson(path.join(OUT_DIR, name));
}

function fullAppLoadingOk() {
  return latestArtifactOk('full-app-loading-stability-latest.json', (json) => (
    Number(json.summary?.failed_routes || 0) === 0
    && Number(json.summary?.failed_modals || 0) === 0
  ));
}

function idleLoadingOk() {
  return latestArtifactOk('data-loading-idle-latest.json', (json) => (
    json.idle_model === 'live_browser_wait'
    && Number(json.idle_ms || 0) >= 95_000
    && Number(json.summary?.failed_routes || 0) === 0
    && Number(json.summary?.failed_modals || 0) === 0
    && safeArray(json.routes).length >= 5
    && safeArray(json.routes).every((route) => route.ok === true)
    && Object.values(json.modal_checks || {}).every((modal) => modal?.ok === true)
  ));
}

function fullAppRoutesOk(routes) {
  const json = latestArtifact('full-app-loading-stability-latest.json');
  if (!json?.ok || Number(json.summary?.failed_routes || 0) > 0) return false;
  const seen = new Set(safeArray(json.routes).filter((route) => route.ok === true).map((route) => route.route));
  return routes.every((route) => seen.has(route));
}

function marketViewReadbackOk() {
  return latestArtifactOk('market-data-view-payload-audit-latest.json', (json) => {
    const interactiveViews = (json.views || []).filter((view) => ['overview', 'lease', 'supply', 'transactions'].includes(view.view));
    return interactiveViews.length === 4
      && interactiveViews.every((view) => view.readback_required === true && view.readback_status === 'checked' && view.readback_ok === true)
      && json.checks?.interactive_readback_checked_or_explicit_na === true
      && json.checks?.interactive_readback_skipped_is_failure === true;
  });
}

function liveMarketMapOk() {
  return latestArtifactOk('live-market-map-naver-region-flow-latest.json', (json) => {
    const routes = json.routes || [];
    return routes.length >= 3
      && routes.every((route) => (
        route.ok === true
        && route.region_first_stats?.provider === 'naver'
        && route.point_stats?.provider === 'naver'
        && route.region_labels_inside_panel_before_zoom === true
        && route.region_labels_inside_panel_after_zoom === true
        && safeArray(route.region_label_positions_before_zoom).every((label) => label.inside_panel === true)
        && safeArray(route.region_label_positions_after_zoom).every((label) => label.inside_panel === true)
      ));
  });
}

function dataManagementReleaseGateOk() {
  return latestArtifactOk('data-management-release-gate-latest.json', (json) => (
    json.options?.edge_only === false
    && json.options?.allow_submit === true
    && json.options?.require_written_history === true
    && json.db_catalog?.available === true
    && json.checks?.db_catalog_available === true
    && json.checks?.catalog_complete_against_db === true
    && json.checks?.row_count_parity_against_db === true
    && json.checks?.view_field_preview_auto_write_readback === true
    && json.checks?.view_field_submit_readback_checked === true
    && json.checks?.written_history_present_when_required === true
    && json.view_field_submit_probe?.ok === true
    && Boolean(json.view_field_submit_probe?.id)
  ));
}

function notificationsAndLogoutOk() {
  const notificationsOk = latestArtifactOk('full-app-loading-stability-latest.json', (json) => (
    json.modal_checks?.notifications?.ok === true
    && json.modal_checks?.notifications?.visible === true
    && Number(json.summary?.failed_modals || 0) === 0
  ));
  const logoutOk = latestArtifactOk('logout-browser-smoke-latest.json', (json) => (
    json.checks?.logout_button_visible === true
    && json.checks?.logout_navigated === true
    && json.checks?.storage_cleared === true
    && json.checks?.protected_route_blocked_after_logout === true
  ));
  return notificationsOk && logoutOk;
}

function activeKnownBlockers() {
  return KNOWN_BLOCKERS.filter((item) => {
    if (item.id === 'known-notification-logout-failed-artifact') {
      return !notificationsAndLogoutOk();
    }
    if (item.id === 'known-market-view-readback-skipped') {
      return !marketViewReadbackOk();
    }
    if (item.id === 'known-market-label-outside-panel') {
      return !liveMarketMapOk();
    }
    if (item.id === 'known-data-loading-scope-market-only') {
      return !fullAppLoadingOk();
    }
    if (item.id === 'known-idle-simulation-not-real-long-session') {
      return !idleLoadingOk();
    }
    if (item.id === 'known-data-management-release-gate-weak') {
      return !dataManagementReleaseGateOk();
    }
    return true;
  });
}

function listFiles(dir, predicate) {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...listFiles(full, predicate));
    else if (!predicate || predicate(full)) files.push(full);
  }
  return files;
}

function relative(filePath) {
  return path.relative(ROOT, filePath).replace(/\\/gu, '/');
}

function deepFind(value, visitor, pathParts = []) {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => deepFind(item, visitor, pathParts.concat(String(index))));
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    visitor(key, child, pathParts.concat(key), value);
    deepFind(child, visitor, pathParts.concat(key));
  }
}

function summarizeArtifact(filePath) {
  const json = safeJson(filePath);
  const name = path.basename(filePath);
  if (!json) {
    return {
      name,
      artifact: relative(filePath),
      status: 'parse-failed',
      severity: 'blocking',
      findings: ['JSON parse failed'],
    };
  }
  if (name === 'notification-logout-browser-smoke-latest.json') {
    const notificationsOk = latestArtifactOk('full-app-loading-stability-latest.json', (latest) => (
      latest.modal_checks?.notifications?.ok === true
      && latest.modal_checks?.notifications?.visible === true
      && Number(latest.summary?.failed_modals || 0) === 0
    ));
    const logoutOk = latestArtifactOk('logout-browser-smoke-latest.json', (latest) => (
      latest.checks?.logout_button_visible === true
      && latest.checks?.logout_navigated === true
      && latest.checks?.storage_cleared === true
      && latest.checks?.protected_route_blocked_after_logout === true
    ));
    if (notificationsOk && logoutOk) {
      return {
        name,
        artifact: relative(filePath),
        status: 'superseded-by-live-artifacts',
        severity: 'ok',
        findings: [],
      };
    }
  }

  const findings = [];
  let severity = 'ok';
  const isStrongDataManagementReleaseGate = name === 'data-management-release-gate-latest.json'
    && json?.ok === true
    && json?.options?.edge_only === false
    && json?.options?.allow_submit === true
    && json?.options?.require_written_history === true
    && json?.db_catalog?.available === true
    && json?.checks?.view_field_preview_auto_write_readback === true
    && json?.checks?.view_field_submit_readback_checked === true
    && json?.view_field_submit_probe?.ok === true;

  const add = (level, message) => {
    findings.push(message);
    if (level === 'blocking') severity = 'blocking';
    else if (level === 'major' && severity !== 'blocking') severity = 'major';
    else if (level === 'minor' && severity === 'ok') severity = 'minor';
  };

  if (json.ok === false || json.success === false || json.passed === false) add('blocking', 'top-level pass flag is false');
  if (Array.isArray(json.errors) && json.errors.length > 0) add('blocking', `errors=${json.errors.length}`);
  if (Number(json.failed || 0) > 0) add('blocking', `failed=${json.failed}`);
  if (Array.isArray(json.warnings) && json.warnings.length > 0) add('major', `warnings=${json.warnings.length}`);
  if (Array.isArray(json.skipped) && json.skipped.length > 0) add('major', `skipped=${json.skipped.length}`);
  if (typeof json.status === 'string' && !/^(ok|pass|passed|success)$/iu.test(json.status)) add('major', `status=${json.status}`);
  if (json.options?.edge_only === true) add('major', 'edge_only=true');
  if (json.options?.allow_submit === false) add('major', 'allow_submit=false');
  if (json.options?.require_written_history === false) add('major', 'require_written_history=false');
  if (json.db_catalog?.available === false) add('major', 'db_catalog.available=false');

  deepFind(json, (key, child, pathParts, parent) => {
    const pathLabel = pathParts.join('.');
    const optionalPassingParent = parent
      && typeof parent === 'object'
      && parent.required === false
      && parent.ok === true;
    const diagnosticOrSkippedParent = parent
      && typeof parent === 'object'
      && (parent.diagnostic === true || parent.status === 'skipped');
    const providerDiagnosticPath = name === 'ai-chatbot-model-sample-latest.json'
      && (pathParts[0] === 'diagnostics' || pathParts[0] === 'checks');
    if (key === 'readback_status' && child === 'skipped') add('major', `${pathLabel}=skipped`);
    if (key === 'skipped' && child === true && !isStrongDataManagementReleaseGate) add('major', `${pathLabel}=true`);
    if (key === 'inside_panel' && child === false) add('blocking', `${pathLabel}=false`);
    if (key === 'ok' && child === false && pathParts.length > 1 && !optionalPassingParent && !diagnosticOrSkippedParent && !providerDiagnosticPath) add('blocking', `${pathLabel}=false`);
    if (key === 'success' && child === false && pathParts.length > 1 && !diagnosticOrSkippedParent) add('blocking', `${pathLabel}=false`);
    if (/_ok$/iu.test(key) && child === false && !optionalPassingParent && !diagnosticOrSkippedParent && !providerDiagnosticPath) add('blocking', `${pathLabel}=false`);
    if (/^(base_url|baseUrl|target_url|targetUrl)$/u.test(key) && typeof child === 'string' && /127\.0\.0\.1|localhost/iu.test(child)) {
      add('major', `${pathLabel}=local-url`);
    }
    if (key === 'simulation' && typeof child === 'string' && child !== 'real') add('major', `${pathLabel}=${child}`);
    const explicitFallbackKey = /(fallback_(used|active|success|only|mode)|used_fallback|provider_fallback|fallback_provider)/iu;
    if (explicitFallbackKey.test(key) && child === true) add('major', `${pathLabel}=true`);
    if (/fallback/i.test(key) && typeof child === 'string' && /^(fallback|fallback-only|osm-fallback)$/iu.test(child)) {
      add('major', `${pathLabel}=${child}`);
    }
    if (typeof child === 'string' && /qa_fake_session/iu.test(child)) add('major', `${pathLabel}=qa_fake_session`);
  });

  return {
    name,
    artifact: relative(filePath),
    status: severity === 'ok' ? 'usable' : 'incomplete-or-failed',
    severity,
    findings: Array.from(new Set(findings)).slice(0, 30),
  };
}

function inspectLatestArtifacts() {
  const files = fs.readdirSync(OUT_DIR, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /latest\.json$/iu.test(entry.name) && entry.name !== 'full-surface-audit-latest.json')
    .map((entry) => path.join(OUT_DIR, entry.name));
  return files.map(summarizeArtifact).sort((a, b) => {
    const order = { blocking: 0, major: 1, minor: 2, ok: 3 };
    return (order[a.severity] ?? 9) - (order[b.severity] ?? 9) || a.name.localeCompare(b.name);
  });
}

function inspectQaScriptRisks() {
  const patterns = [
    { id: 'fixed-wait', regex: /waitForTimeout\s*\(/u, severity: 'major', problem: 'fixed wait can hide async races' },
    { id: 'fake-session', regex: /qa_fake_session|buildSession\s*\(/u, severity: 'major', problem: 'fake session cannot prove live auth behavior' },
    { id: 'network-intercept', regex: /\.route\s*\(|route\.fulfill\s*\(/u, severity: 'major', problem: 'network intercept cannot prove live backend behavior' },
    { id: 'service-worker-blocked', regex: /serviceWorkers\s*:\s*['"]block['"]/u, severity: 'minor', problem: 'blocking service workers may miss production cache behavior' },
    { id: 'unconditional-ok', regex: /ok\s*:\s*true\s*,\s*data\s*:\s*\{\s*\}/u, severity: 'major', problem: 'empty ok response can mask unsupported actions' },
  ];
  const files = listFiles(QA_DIR, (filePath) => filePath.endsWith('.cjs') && path.basename(filePath) !== path.basename(__filename));
  const findings = [];
  for (const filePath of files) {
    const text = readText(filePath);
    const lines = text.split(/\r?\n/u);
    patterns.forEach((pattern) => {
      lines.forEach((line, index) => {
        if (pattern.regex.test(line)) {
          findings.push({
            id: pattern.id,
            severity: pattern.severity,
            file: relative(filePath),
            line: index + 1,
            problem: pattern.problem,
            excerpt: line.trim().slice(0, 180),
          });
        }
      });
    });
  }
  return findings;
}

function inspectUiInventory() {
  const files = listFiles(SRC_DIR, (filePath) => /\.(jsx?|tsx?)$/iu.test(filePath));
  const inventory = [];
  const dataTestIds = new Set();
  let buttonCount = 0;
  let onClickCount = 0;
  let modalCount = 0;
  let tableCount = 0;
  let chartCount = 0;

  for (const filePath of files) {
    const text = readText(filePath);
    const item = {
      file: relative(filePath),
      buttons: (text.match(/<button\b/giu) || []).length,
      onClicks: (text.match(/\bonClick\s*=/gu) || []).length,
      dataTestIds: Array.from(text.matchAll(/data-testid\s*=\s*["']([^"']+)["']/gu)).map((m) => m[1]),
      modals: (text.match(/<Modal\b|\bModal\(/gu) || []).length,
      tables: (text.match(/<SortableTable\b|<DataTable\b|<Table\b/gu) || []).length,
      charts: (text.match(/\bChart\b|<GroupedBarChart\b|<MultiLineChart\b|<Stacked|<SupplyAreaChart\b|<Loan/gu) || []).length,
    };
    if (item.buttons || item.onClicks || item.dataTestIds.length || item.modals || item.tables || item.charts) {
      inventory.push(item);
      buttonCount += item.buttons;
      onClickCount += item.onClicks;
      modalCount += item.modals;
      tableCount += item.tables;
      chartCount += item.charts;
      item.dataTestIds.forEach((id) => dataTestIds.add(id));
    }
  }

  return {
    totals: {
      files_with_interactions: inventory.length,
      buttons: buttonCount,
      onClicks: onClickCount,
      modals: modalCount,
      tables: tableCount,
      chart_mentions: chartCount,
      data_testids: dataTestIds.size,
    },
    by_file: inventory.sort((a, b) => (b.onClicks + b.buttons + b.modals + b.tables + b.charts) - (a.onClicks + a.buttons + a.modals + a.tables + a.charts)).slice(0, 80),
    data_testids: Array.from(dataTestIds).sort(),
  };
}

const SURFACE_EVIDENCE = {
  'global-auth-loading': [
    ['full-app-loading-stability-latest.json', fullAppLoadingOk],
    ['data-loading-idle-latest.json', idleLoadingOk],
    ['auth-permission-matrix-latest.json', () => latestArtifactOk('auth-permission-matrix-latest.json')],
  ],
  'system-modals': [
    ['full-app-loading-stability-latest.json', (json) => fullAppLoadingOk() && json?.modal_checks?.feature_access?.ok === true && json?.modal_checks?.login_history?.ok === true && json?.modal_checks?.notifications?.ok === true],
    ['access-modal-refresh-stability-latest.json', () => latestArtifactOk('access-modal-refresh-stability-latest.json')],
    ['login-history-browser-smoke-latest.json', () => latestArtifactOk('login-history-browser-smoke-latest.json')],
    ['logout-browser-smoke-latest.json', () => notificationsAndLogoutOk()],
  ],
  'work-platform': [
    ['full-app-loading-stability-latest.json', () => fullAppRoutesOk(['work-platform'])],
    ['work-platform-browser-smoke-latest.json', () => latestArtifactOk('work-platform-browser-smoke-latest.json')],
  ],
  'dashboard-home-asset-company': [
    ['full-app-loading-stability-latest.json', () => fullAppRoutesOk(['home', 'asset', 'company'])],
    ['sector-tabs-browser-smoke-latest.json', () => latestArtifactOk('sector-tabs-browser-smoke-latest.json')],
    ['out-of-scope-regression-inventory-latest.json', () => latestArtifactOk('out-of-scope-regression-inventory-latest.json')],
  ],
  'dashboard-special-tabs': [
    ['full-app-loading-stability-latest.json', () => fullAppRoutesOk(['investment-index', 'asset-spec', 'analysis-tools', 'pivot-table', 'data-quality', 'pdf-report'])],
    ['sector-tabs-browser-smoke-latest.json', () => latestArtifactOk('sector-tabs-browser-smoke-latest.json')],
    ['investment-index-browser-smoke-latest.json', () => latestArtifactOk('investment-index-browser-smoke-latest.json')],
    ['asset-spec-browser-smoke-latest.json', () => latestArtifactOk('asset-spec-browser-smoke-latest.json')],
  ],
  'market-data': [
    ['full-app-loading-stability-latest.json', () => fullAppRoutesOk(['market-data/overview', 'market-data/lease-market', 'market-data/supply-pipeline', 'market-data/transactions', 'market-data/source-update'])],
    ['market-data-browser-smoke-latest.json', () => latestArtifactOk('market-data-browser-smoke-latest.json')],
    ['market-data-view-payload-audit-latest.json', marketViewReadbackOk],
    ['live-market-map-naver-region-flow-latest.json', liveMarketMapOk],
    ['market-data-readback-smoke-latest.json', () => latestArtifactOk('market-data-readback-smoke-latest.json')],
    ['market-data-parity-audit-latest.json', () => latestArtifactOk('market-data-parity-audit-latest.json')],
    ['market-map-address-precision-audit-latest.json', () => latestArtifactOk('market-map-address-precision-audit-latest.json')],
  ],
  'data-management': [
    ['full-app-loading-stability-latest.json', () => fullAppRoutesOk(['data-management'])],
    ['data-management-browser-readback-smoke-latest.json', () => latestArtifactOk('data-management-browser-readback-smoke-latest.json')],
    ['data-management-live-browser-flow-latest.json', () => latestArtifactOk('data-management-live-browser-flow-latest.json')],
    ['data-management-release-gate-latest.json', dataManagementReleaseGateOk],
    ['data-management-coverage-audit-latest.json', () => latestArtifactOk('data-management-coverage-audit-latest.json')],
  ],
  'data-parity': [
    ['market-data-view-payload-audit-latest.json', marketViewReadbackOk],
    ['market-data-readback-smoke-latest.json', () => latestArtifactOk('market-data-readback-smoke-latest.json')],
    ['market-data-parity-audit-latest.json', () => latestArtifactOk('market-data-parity-audit-latest.json')],
    ['data-management-release-gate-latest.json', dataManagementReleaseGateOk],
    ['data-management-browser-readback-smoke-latest.json', () => latestArtifactOk('data-management-browser-readback-smoke-latest.json')],
  ],
  'dashboard-home': [
    ['full-app-loading-stability-latest.json', () => fullAppRoutesOk(['home'])],
    ['sector-tabs-browser-smoke-latest.json', () => latestArtifactOk('sector-tabs-browser-smoke-latest.json', (json) => json.checks?.home === true)],
  ],
  'dashboard-asset': [
    ['full-app-loading-stability-latest.json', () => fullAppRoutesOk(['asset'])],
    ['sector-tabs-browser-smoke-latest.json', () => latestArtifactOk('sector-tabs-browser-smoke-latest.json', (json) => json.checks?.asset === true)],
  ],
  'dashboard-company': [
    ['full-app-loading-stability-latest.json', () => fullAppRoutesOk(['company'])],
    ['sector-tabs-browser-smoke-latest.json', () => latestArtifactOk('sector-tabs-browser-smoke-latest.json')],
  ],
  'investment-index': [
    ['full-app-loading-stability-latest.json', () => fullAppRoutesOk(['investment-index'])],
    ['investment-index-browser-smoke-latest.json', () => latestArtifactOk('investment-index-browser-smoke-latest.json')],
  ],
  'asset-spec': [
    ['full-app-loading-stability-latest.json', () => fullAppRoutesOk(['asset-spec'])],
    ['asset-spec-browser-smoke-latest.json', () => latestArtifactOk('asset-spec-browser-smoke-latest.json')],
    ['asset-spec-readback-smoke-latest.json', () => latestArtifactOk('asset-spec-readback-smoke-latest.json')],
  ],
  'analysis-tools': [
    ['full-app-loading-stability-latest.json', () => fullAppRoutesOk(['analysis-tools'])],
    ['sector-tabs-browser-smoke-latest.json', () => latestArtifactOk('sector-tabs-browser-smoke-latest.json')],
  ],
  'pivot-table': [
    ['full-app-loading-stability-latest.json', () => fullAppRoutesOk(['pivot-table'])],
    ['sector-tabs-browser-smoke-latest.json', () => latestArtifactOk('sector-tabs-browser-smoke-latest.json')],
  ],
  'data-quality': [
    ['full-app-loading-stability-latest.json', () => fullAppRoutesOk(['data-management/data-quality'])],
    ['sector-tabs-browser-smoke-latest.json', () => latestArtifactOk('sector-tabs-browser-smoke-latest.json')],
  ],
  'pdf-report': [
    ['full-app-loading-stability-latest.json', () => fullAppRoutesOk(['pdf-report'])],
  ],
  'contract-data': [
    ['full-app-loading-stability-latest.json', () => fullAppRoutesOk(['contract-data'])],
  ],
  'ai-chatbot': [
    ['ai-chatbot-browser-smoke-latest.json', () => latestArtifactOk('ai-chatbot-browser-smoke-latest.json')],
    ['ai-chatbot-qa-latest.json', () => latestArtifactOk('ai-chatbot-qa-latest.json')],
  ],
  'market-overview': [
    ['full-app-loading-stability-latest.json', () => fullAppRoutesOk(['market-data/overview'])],
    ['market-data-browser-smoke-latest.json', () => latestArtifactOk('market-data-browser-smoke-latest.json')],
    ['market-data-view-payload-audit-latest.json', marketViewReadbackOk],
  ],
  'market-lease': [
    ['full-app-loading-stability-latest.json', () => fullAppRoutesOk(['market-data/lease-market'])],
    ['market-data-browser-smoke-latest.json', () => latestArtifactOk('market-data-browser-smoke-latest.json')],
    ['live-market-map-naver-region-flow-latest.json', liveMarketMapOk],
  ],
  'market-supply': [
    ['full-app-loading-stability-latest.json', () => fullAppRoutesOk(['market-data/supply-pipeline'])],
    ['market-data-browser-smoke-latest.json', () => latestArtifactOk('market-data-browser-smoke-latest.json')],
    ['live-market-map-naver-region-flow-latest.json', liveMarketMapOk],
    ['supply-period-slicer-flow-latest.json', () => latestArtifactOk('supply-period-slicer-flow-latest.json')],
  ],
  'market-transactions': [
    ['full-app-loading-stability-latest.json', () => fullAppRoutesOk(['market-data/transactions'])],
    ['market-data-browser-smoke-latest.json', () => latestArtifactOk('market-data-browser-smoke-latest.json')],
    ['live-market-map-naver-region-flow-latest.json', liveMarketMapOk],
  ],
  'market-source-update': [
    ['full-app-loading-stability-latest.json', () => fullAppRoutesOk(['market-data/source-update'])],
    ['market-data-browser-smoke-latest.json', () => latestArtifactOk('market-data-browser-smoke-latest.json')],
    ['market-data-readback-smoke-latest.json', () => latestArtifactOk('market-data-readback-smoke-latest.json')],
  ],
  'data-management-asset': [
    ['full-app-loading-stability-latest.json', () => fullAppRoutesOk(['data-management/asset-data'])],
    ['data-management-browser-readback-smoke-latest.json', () => latestArtifactOk('data-management-browser-readback-smoke-latest.json', (json) => json.checks?.default_view_has_rows === true)],
    ['data-management-live-browser-flow-latest.json', () => latestArtifactOk('data-management-live-browser-flow-latest.json')],
  ],
  'data-management-investment': [
    ['full-app-loading-stability-latest.json', () => fullAppRoutesOk(['data-management/investment-data'])],
    ['data-management-browser-readback-smoke-latest.json', () => latestArtifactOk('data-management-browser-readback-smoke-latest.json', (json) => json.subtab_checks?.investment?.rows > 0)],
  ],
  'data-management-lease': [
    ['full-app-loading-stability-latest.json', () => fullAppRoutesOk(['data-management/lease-contracts'])],
    ['data-management-browser-readback-smoke-latest.json', () => latestArtifactOk('data-management-browser-readback-smoke-latest.json', (json) => json.subtab_checks?.lease?.rows > 0)],
  ],
  'data-management-managers': [
    ['full-app-loading-stability-latest.json', () => fullAppRoutesOk(['data-management/managers'])],
    ['data-management-browser-readback-smoke-latest.json', () => latestArtifactOk('data-management-browser-readback-smoke-latest.json', (json) => json.subtab_checks?.managers?.rows > 0)],
  ],
  'data-management-quality': [
    ['full-app-loading-stability-latest.json', () => fullAppRoutesOk(['data-management/data-quality'])],
    ['data-management-browser-readback-smoke-latest.json', () => latestArtifactOk('data-management-browser-readback-smoke-latest.json', (json) => json.subtab_checks?.quality?.rows > 0)],
  ],
};

function evaluateEvidenceList(evidenceList = []) {
  return evidenceList.map(([artifact, predicate]) => {
    const json = latestArtifact(artifact);
    let ok = false;
    if (json) {
      try {
        ok = Boolean(predicate(json));
      } catch {
        ok = false;
      }
    }
    return {
      artifact,
      ok,
      generated_at: json?.generated_at || null,
    };
  });
}

function surfaceWithEvidence(surface) {
  const evidence = evaluateEvidenceList(SURFACE_EVIDENCE[surface.id] || []);
  const status = evidence.length > 0 && evidence.every((item) => item.ok) ? 'complete' : 'needs-evidence';
  return {
    ...surface,
    evidence,
    status,
  };
}

function allSurfacesWithEvidence() {
  return allSurfaces().map(surfaceWithEvidence);
}

function buildCoverageGaps(artifactSummaries, scriptRisks) {
  const gaps = [];
  const mustHave = [
    ['notification-logout-browser-smoke-latest.json', 'notification/logout live flow', notificationsAndLogoutOk],
    ['market-data-view-payload-audit-latest.json', 'market data view readback', marketViewReadbackOk],
    ['live-market-map-naver-region-flow-latest.json', 'live market map region flow', liveMarketMapOk],
    ['data-management-release-gate-latest.json', 'data management release gate', dataManagementReleaseGateOk],
    ['full-app-loading-stability-latest.json', 'full app loading stability', fullAppLoadingOk],
    ...(fullAppLoadingOk() ? [] : [['data-loading-stability-latest.json', 'market data loading stability', () => latestArtifactOk('data-loading-stability-latest.json')]]),
    ['data-loading-idle-latest.json', 'idle return loading stability', idleLoadingOk],
    ['logout-browser-smoke-latest.json', 'logout live flow', notificationsAndLogoutOk],
    ['access-modal-refresh-stability-latest.json', 'feature access modal refresh', () => latestArtifactOk('access-modal-refresh-stability-latest.json')],
    ['login-history-browser-smoke-latest.json', 'login history modal browser flow', () => latestArtifactOk('login-history-browser-smoke-latest.json')],
    ['work-platform-browser-smoke-latest.json', 'work platform browser flow', () => latestArtifactOk('work-platform-browser-smoke-latest.json')],
    ['sector-tabs-browser-smoke-latest.json', 'sector tabs browser flow', () => latestArtifactOk('sector-tabs-browser-smoke-latest.json')],
    ['market-data-browser-smoke-latest.json', 'market data browser flow', () => latestArtifactOk('market-data-browser-smoke-latest.json')],
    ['data-management-browser-readback-smoke-latest.json', 'data management browser readback', () => latestArtifactOk('data-management-browser-readback-smoke-latest.json')],
    ['investment-index-browser-smoke-latest.json', 'investment index browser flow', () => latestArtifactOk('investment-index-browser-smoke-latest.json')],
    ['asset-spec-browser-smoke-latest.json', 'asset spec browser flow', () => latestArtifactOk('asset-spec-browser-smoke-latest.json')],
  ];

  for (const [name, label, predicate] of mustHave) {
    if (!latestArtifact(name)) {
      gaps.push({ severity: 'blocking', label, problem: `${name} is missing` });
    } else if (!predicate()) {
      const artifactSummary = artifactSummaries.find((item) => item.name === name);
      gaps.push({
        severity: artifactSummary?.severity === 'blocking' ? 'blocking' : 'major',
        label,
        problem: artifactSummary?.findings?.join('; ') || `${name} did not satisfy current live evidence predicate`,
      });
    }
  }

  allSurfacesWithEvidence().forEach((surface) => {
    if (surface.status !== 'complete') {
      const missing = surface.evidence.filter((item) => !item.ok).map((item) => item.artifact).join(', ') || 'no evidence mapping';
      gaps.push({
        severity: 'major',
        label: `surface-manifest:${surface.id}`,
        problem: `Required live evidence missing or failed: ${missing}`,
      });
    }
  });

  return gaps;
}

function markdown(report) {
  const artifactRows = report.latest_artifacts
    .filter((item) => item.severity !== 'ok')
    .map((item) => `| ${item.severity} | ${item.name} | ${item.findings.join('<br>')} |`)
    .join('\n') || '| ok | none | No suspicious latest artifacts found. |';

  const surfaceRows = report.surface_manifest
    .map((item) => {
      const evidence = safeArray(item.evidence)
        .map((evidenceItem) => `${evidenceItem.ok ? 'OK' : 'MISS'} ${evidenceItem.artifact}`)
        .join('<br>');
      return `| ${item.id} | ${item.axis} | ${item.screen} | ${item.route} | ${item.acceptance.join('<br>')} | ${evidence || item.requiredEvidence.join('<br>')} | ${item.status} |`;
    })
    .join('\n');

  const riskRows = report.qa_script_risks.slice(0, 60)
    .map((item) => `| ${item.severity} | ${item.id} | ${item.file}:${item.line} | ${item.problem} |`)
    .join('\n') || '| ok | none | - | No script risk patterns found. |';

  const knownRows = report.known_blockers
    .map((item) => `| ${item.severity} | ${item.id} | ${item.evidence} | ${item.problem} |`)
    .join('\n');

  const verdictText = report.ok
    ? 'Complete for the required live URL evidence currently mapped in this audit. Older stale artifacts and QA script risk patterns are listed separately so they do not hide current live results.'
    : 'Not complete. This audit found missing or failed required live evidence. No screen or component group should be marked complete until the required live URL evidence is produced.';

  const nextEvidence = report.ok
    ? '- Keep running live URL 50-cycle and idle-return checks after every deploy.\n- Add narrower button-by-button evidence when a surface receives new behavior changes.\n- Keep Supabase/API/UI parity artifacts attached to each data-backed change.'
    : '- Live URL tab switch 50-cycle result with no blank table/chart, stuck loading, forced redirect, or fatal console error.\n- Live URL idle-return result covering Work Platform, Market Data, Data Management, feature access, login history, and notifications.\n- Table, chart, map, modal, and button action evidence for every surface manifest row.\n- Supabase/API/UI count and value parity for every data-backed view.';

  return `# Gate 6 Full Surface Audit Manifest

Generated at: ${report.generated_at}

## Verdict

${verdictText}

## Known Blockers

| Severity | ID | Evidence | Problem |
| --- | --- | --- | --- |
${knownRows}

## Surface Manifest

| ID | Axis | Screen | Route | Acceptance | Required evidence | Status |
| --- | --- | --- | --- | --- | --- | --- |
${surfaceRows}

## Suspicious Latest Artifacts

| Severity | Artifact | Findings |
| --- | --- | --- |
${artifactRows}

## QA Script Risk Patterns

| Severity | Risk | Location | Problem |
| --- | --- | --- | --- |
${riskRows}

## UI Inventory Summary

- Files with interactions: ${report.ui_inventory.totals.files_with_interactions}
- Buttons: ${report.ui_inventory.totals.buttons}
- onClick handlers: ${report.ui_inventory.totals.onClicks}
- Modal references: ${report.ui_inventory.totals.modals}
- Table references: ${report.ui_inventory.totals.tables}
- Chart references: ${report.ui_inventory.totals.chart_mentions}
- data-testid count: ${report.ui_inventory.totals.data_testids}

## Required Next Evidence

${nextEvidence}
`;
}

function main() {
  ensureOutDir();
  const generatedAt = new Date().toISOString();
  const latestArtifacts = inspectLatestArtifacts();
  const qaScriptRisks = inspectQaScriptRisks();
  const uiInventory = inspectUiInventory();
  const coverageGaps = buildCoverageGaps(latestArtifacts, qaScriptRisks);
  const knownBlockers = activeKnownBlockers();
  const surfaceManifest = allSurfacesWithEvidence();
  const blockingCoverageGaps = coverageGaps.filter((item) => item.severity === 'blocking');
  const majorCoverageGaps = coverageGaps.filter((item) => item.severity === 'major');
  const allSurfacesHaveLiveEvidence = surfaceManifest.every((item) => item.status === 'complete');
  const ok = knownBlockers.length === 0 && blockingCoverageGaps.length === 0 && majorCoverageGaps.length === 0 && allSurfacesHaveLiveEvidence;
  const report = {
    ok,
    generated_at: generatedAt,
    repo: {
      root: ROOT,
      live_url: 'https://kylee94.github.io/logistics-gate6-preview/',
    },
    verdict: ok ? 'complete' : 'not_complete',
    known_blockers: knownBlockers,
    surface_manifest: surfaceManifest,
    latest_artifacts: latestArtifacts,
    qa_script_risks: qaScriptRisks,
    ui_inventory: uiInventory,
    coverage_gaps: coverageGaps,
    checks: {
      has_blocking_known_issues: knownBlockers.some((item) => item.severity === 'blocking'),
      latest_artifacts_all_usable: latestArtifacts.every((item) => item.severity === 'ok'),
      no_qa_script_risk_patterns: qaScriptRisks.length === 0,
      required_live_evidence_complete: blockingCoverageGaps.length === 0 && majorCoverageGaps.length === 0,
      all_surfaces_have_live_evidence: allSurfacesHaveLiveEvidence,
    },
  };

  const stamp = timestampForFile();
  const jsonFile = path.join(OUT_DIR, `full-surface-audit-${stamp}.json`);
  const latestJsonFile = path.join(OUT_DIR, 'full-surface-audit-latest.json');
  const mdFile = path.join(OUT_DIR, `full-surface-audit-${stamp}.md`);
  const latestMdFile = path.join(OUT_DIR, 'full-surface-audit-latest.md');
  fs.writeFileSync(jsonFile, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(latestJsonFile, `${JSON.stringify(report, null, 2)}\n`);
  const md = markdown(report);
  fs.writeFileSync(mdFile, md);
  fs.writeFileSync(latestMdFile, md);

  console.log(`full surface audit ${report.ok ? 'PASS' : 'INCOMPLETE'}: ${relative(jsonFile)}`);
  console.log(`markdown: ${relative(mdFile)}`);
  if (!report.ok) process.exitCode = 1;
}

main();
