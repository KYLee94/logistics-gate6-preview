const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..', '..');
const DEFAULT_BASE_URL = 'https://kylee94.github.io/logistics-gate6-preview/';
const PROTECTED_ANONYMOUS_ACTIONS = [
  'auth/me',
  'dashboard/home/read',
  'dashboard/asset/read',
  'data-management/views',
  'weekly-assets/latest-preview',
];
const READ_ONLY_ACTIONS = new Set([
  'auth/me',
  'auth/login-history/list',
  'auth/login-capability/list',
  'feature-access/get',
  'dashboard/home/read',
  'dashboard/asset/read',
  'dashboard/company/read',
  'dashboard/investment-index/read',
  'data-management/views',
  'data-management/view-rows',
  'data-management/catalog',
  'data-management/rows',
  'data-management/status',
  'notifications/list',
  'quality/findings',
  'sector-market/read',
  'investment-index/read',
  'asset-spec/read',
  'operating-costs/read',
  'weekly-assets/latest-preview',
  'weekly-assets/latest',
  'news/list',
  'work-platform/tasks/list',
  'work-platform/board-posts/list',
]);
const FEATURE_PROBES = [
  { feature: 'analysis_tools', route: 'dashboard/tools', navigation_label: '분석 도구', rendered_markers: ['Analysis 자산 비교', 'Analysis 기업 비교'], direct_route_guard: true },
  { feature: 'data_playground', route: 'dashboard/playground', navigation_label: '피벗 테이블', rendered_markers: ['피벗 테이블'], direct_route_guard: true },
  { feature: 'data_quality', route: 'data-management/data-quality', navigation_label: '데이터 품질', rendered_markers: ['데이터 무결성 검사 및 수정 요청'], direct_route_guard: true },
  { feature: 'ai_chat', route: 'dashboard/home', selector: '[data-testid="logistics-ai-dock-open"]' },
  { feature: 'login_history', route: 'dashboard/home', selector: '[data-testid="logistics-login-history-button"]' },
  { feature: 'building_register_refresh', route: 'dashboard/asset', selector: '[data-testid="building-register-refresh"]', requires_selected_asset: true },
  { feature: 'opendart_refresh', route: 'dashboard/asset', selector: '[data-testid="opendart-refresh"]', requires_selected_asset: true },
];

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

function argsValue(name, fallback = '') {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : (process.argv[index + 1] || fallback);
}

function timestampForFile() {
  return new Date().toISOString().replace(/[-:]/gu, '').replace(/\..+$/u, '').replace('T', '-');
}

function isLiveHttpsUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:'
      && !['localhost', '127.0.0.1', '::1'].includes(url.hostname);
  } catch {
    return false;
  }
}

function joinUrl(baseUrl, route) {
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  return new URL(route.replace(/^\/+/u, ''), normalizedBase).toString();
}

function normalizeAssetIds(assets) {
  return [...new Set((Array.isArray(assets) ? assets : [])
    .map((asset) => (typeof asset === 'string'
      ? asset
      : String(asset?.asset_id || asset?.assetId || ''))
    .trim())
    .filter(Boolean))].sort();
}

function sameItems(left, right) {
  return JSON.stringify([...left].sort()) === JSON.stringify([...right].sort());
}

function assessScope(permission, managedAssetIds, scopeAssetIds, payloadAssetIds) {
  const scopeMatchesPayload = sameItems(scopeAssetIds, payloadAssetIds);
  const broadRead = permission.otherAssetRead === true;
  const managedAssetsAreSubset = managedAssetIds.every((id) => scopeAssetIds.includes(id));
  if (broadRead) {
    return {
      status: 'unverified',
      reason: 'broad_read_permission_prevents_exact_managed_asset_comparison',
      scope_matches_payload: scopeMatchesPayload,
      managed_assets_are_subset: managedAssetsAreSubset,
    };
  }
  return {
    status: scopeMatchesPayload && sameItems(managedAssetIds, scopeAssetIds) ? 'verified' : 'failed',
    exact_match: sameItems(managedAssetIds, scopeAssetIds),
    scope_matches_payload: scopeMatchesPayload,
    managed_assets_are_subset: managedAssetsAreSubset,
  };
}

function assessAnonymousActions(results) {
  const exposedActions = results.filter((row) => ![401, 403].includes(Number(row.status))).map((row) => row.action);
  return { ok: exposedActions.length === 0, exposed_actions: exposedActions, results };
}

function chromeExecutablePath() {
  return [
    process.env.CHROME_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ].filter(Boolean).find((candidate) => fs.existsSync(candidate)) || undefined;
}

async function requestAction(endpoint, anonKey, action, payload = {}, token = '') {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      'content-type': 'application/json',
      origin: 'https://kylee94.github.io',
    },
    body: JSON.stringify({ action, payload }),
  });
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text.slice(0, 500) };
  }
  return { action, status: response.status, body };
}

async function validateTokenUser(supabaseUrl, anonKey, token) {
  const response = await fetch(`${supabaseUrl.replace(/\/$/u, '')}/auth/v1/user`, {
    headers: { apikey: anonKey, authorization: `Bearer ${token}` },
  });
  const user = await response.json().catch(() => null);
  if (!response.ok || !user?.id || !user?.email) throw new Error(`Live token validation failed (${response.status}).`);
  return user;
}

async function resolveLiveSession(supabaseUrl, anonKey, token, email, password) {
  if (token) {
    const user = await validateTokenUser(supabaseUrl, anonKey, token);
    return {
      access_token: token,
      token_type: 'bearer',
      expires_in: 3600,
      expires_at: Math.round(Date.now() / 1000) + 3600,
      refresh_token: '',
      user,
      credential_source: 'access_token',
    };
  }
  if (!email || !password) {
    throw new Error('Provide LOGISTICS_SUPABASE_ACCESS_TOKEN or the real LOGISTICS_SUPABASE_EMAIL and LOGISTICS_SUPABASE_PASSWORD.');
  }
  const response = await fetch(`${supabaseUrl.replace(/\/$/u, '')}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: anonKey, 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const passwordSession = await response.json().catch(() => null);
  if (!response.ok || !passwordSession?.access_token) throw new Error(`Password grant failed (${response.status}).`);
  const user = await validateTokenUser(supabaseUrl, anonKey, passwordSession.access_token);
  if (String(email).trim().toLowerCase() !== String(user.email).trim().toLowerCase()) {
    throw new Error('Password grant token user does not match LOGISTICS_SUPABASE_EMAIL; UI email substitution is forbidden.');
  }
  return {
    ...passwordSession,
    user,
    credential_source: 'password_grant',
  };
}

async function selectReadableAsset(page, assetId) {
  if (!assetId) return false;
  const selects = page.locator('select');
  const selectCount = await selects.count().catch(() => 0);
  for (let index = 0; index < selectCount; index += 1) {
    const select = selects.nth(index);
    const optionExists = await select.locator(`option[value="${assetId}"]`).count().then((count) => count > 0).catch(() => false);
    if (optionExists) {
      await select.selectOption(assetId);
      return true;
    }
  }
  return false;
}

async function inspectFeatureRoutes(context, baseUrl, featurePermissions, readableAssetId, writeAttempts) {
  const page = await context.newPage();
  const results = [];
  for (const probe of FEATURE_PROBES) {
    const granted = featurePermissions[probe.feature] === true;
    const writesBeforeRoute = writeAttempts.length;
    const authMeResponse = page.waitForResponse((response) => {
      const request = response.request();
      return response.url().includes('/functions/v1/ll-dashboard-api')
        && request.method() === 'POST'
        && (request.postData() || '').includes('"action":"auth/me"');
    }, { timeout: 30000 }).catch(() => null);
    await page.goto(`${joinUrl(baseUrl, probe.route)}?permission_qa=${timestampForFile()}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    const authMeCompleted = await authMeResponse;
    const headerVisible = await page.locator('header').first().waitFor({ state: 'visible', timeout: 30000 }).then(() => true).catch(() => false);
    const selectedReadableAsset = probe.requires_selected_asset
      ? await selectReadableAsset(page, readableAssetId).catch(() => false)
      : 'not_required';
    const body = await page.locator('body').innerText({ timeout: 10000 }).catch(() => '');
    const navigationVisible = probe.navigation_label
      ? await page.getByText(probe.navigation_label, { exact: true }).first().isVisible().catch(() => false)
      : null;
    const selectorVisible = probe.selector
      ? await page.locator(probe.selector).first().isVisible().catch(() => false)
      : null;
    const featureUiVisible = probe.selector ? selectorVisible : navigationVisible;
    const featureUiMatchesPermission = selectedReadableAsset === false
      ? 'unverified_no_native_asset_selector_for_readable_asset'
      : featureUiVisible === granted;
    const renderedMarkerCount = (probe.rendered_markers || []).filter((marker) => body.includes(marker)).length;
    results.push({
      feature: probe.feature,
      route: probe.route,
      granted,
      auth_me_response_observed: Boolean(authMeCompleted),
      header_visible: headerVisible,
      selected_readable_asset: selectedReadableAsset,
      navigation_visible: navigationVisible,
      selector_visible: selectorVisible,
      feature_ui_visible: featureUiVisible,
      rendered_marker_count: renderedMarkerCount,
      expected_feature_ui_visible: granted,
      feature_ui_matches_permission: featureUiMatchesPermission,
      direct_url_denied_does_not_render: probe.direct_route_guard && !granted ? renderedMarkerCount === 0 : 'unverified_no_dedicated_read_only_route',
      direct_url_granted_renders: probe.direct_route_guard && granted ? renderedMarkerCount > 0 : 'unverified_no_dedicated_read_only_route',
      write_attempts_during_route: writeAttempts.length - writesBeforeRoute,
    });
  }
  await page.close();
  return results;
}

async function main() {
  const baseUrl = argsValue('base-url', envValue('LOGISTICS_PERMISSION_LIVE_URL') || DEFAULT_BASE_URL);
  const supabaseUrl = envValue('LOGISTICS_SUPABASE_URL', 'VITE_SUPABASE_URL');
  const anonKey = envValue('LOGISTICS_SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY');
  const token = envValue('LOGISTICS_SUPABASE_ACCESS_TOKEN');
  const email = envValue('LOGISTICS_SUPABASE_EMAIL');
  const password = envValue('LOGISTICS_SUPABASE_PASSWORD');
  if (!isLiveHttpsUrl(baseUrl)) throw new Error('A non-local HTTPS live URL is required.');
  if (!supabaseUrl || !anonKey) throw new Error('LOGISTICS_SUPABASE_URL and LOGISTICS_SUPABASE_ANON_KEY are required.');

  const endpoint = `${supabaseUrl.replace(/\/$/u, '')}/functions/v1/ll-dashboard-api`;
  const session = await resolveLiveSession(supabaseUrl, anonKey, token, email, password);
  const authMe = await requestAction(endpoint, anonKey, 'auth/me', {}, session.access_token);
  if (authMe.status !== 200 || authMe.body?.ok !== true) throw new Error(`auth/me failed (${authMe.status}).`);
  const profile = authMe.body.data || {};
  const tokenEmail = String(session.user.email).trim().toLowerCase();
  const authMeEmail = String(profile.email || '').trim().toLowerCase();
  const passwordEmail = String(email || '').trim().toLowerCase();
  if (!authMeEmail || authMeEmail !== tokenEmail || (session.credential_source === 'password_grant' && passwordEmail !== tokenEmail)) {
    throw new Error('The password-grant/token user and auth/me email must match exactly; UI email substitution is forbidden.');
  }

  const home = await requestAction(endpoint, anonKey, 'dashboard/home/read', {}, session.access_token);
  const homeData = home.body?.data || {};
  const scopeAssetIds = normalizeAssetIds(home.body?.scope?.readable_asset_ids || []);
  const payloadAssetIds = normalizeAssetIds(homeData.assets || []);
  const managedAssetIds = normalizeAssetIds(profile.managedAssets || []);
  const permission = {
    role: String(profile.logistics_role || ''),
    managedAssetRead: profile.permissions?.managedAsset?.read === true,
    otherAssetRead: profile.permissions?.otherAsset?.read === true,
  };
  const scope = home.status === 200 && home.body?.ok === true
    ? assessScope(permission, managedAssetIds, scopeAssetIds, payloadAssetIds)
    : { status: 'failed', reason: `dashboard_home_read_failed_${home.status}` };

  const firstReadableAssetId = scopeAssetIds[0] || payloadAssetIds[0] || '';
  const assetRead = firstReadableAssetId
    ? await requestAction(endpoint, anonKey, 'dashboard/asset/read', { asset_id: firstReadableAssetId }, session.access_token)
    : { action: 'dashboard/asset/read', status: null, body: null, unverified: 'no_readable_asset_for_token' };
  const assetReadMatchesScope = firstReadableAssetId
    ? assetRead.status === 200 && String(assetRead.body?.data?.asset?.asset_id || '') === firstReadableAssetId
    : 'unverified';

  const anonymous = assessAnonymousActions(await Promise.all(PROTECTED_ANONYMOUS_ACTIONS.map((action) => requestAction(endpoint, anonKey, action))));
  const writeAttempts = [];
  let browser;
  let featureRoutes = [];
  try {
    browser = await chromium.launch({ headless: true, executablePath: chromeExecutablePath() });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block' });
    await context.addInitScript((liveSession) => {
      sessionStorage.setItem('sb-iota-auth-token', JSON.stringify(liveSession));
      localStorage.setItem('logisticsDashboardReadMode', 'primary-safe');
    }, session);
    await context.route('**/functions/v1/ll-dashboard-api', async (route) => {
      let requestBody = {};
      try {
        requestBody = JSON.parse(route.request().postData() || '{}');
      } catch {
        await route.continue();
        return;
      }
      if (READ_ONLY_ACTIONS.has(requestBody.action)) {
        await route.continue();
        return;
      }
      writeAttempts.push({ action: requestBody.action || 'unknown', route: new URL(route.request().url()).pathname });
      await route.abort('blockedbyclient');
    });
    featureRoutes = await inspectFeatureRoutes(context, baseUrl, profile.feature_permissions || {}, firstReadableAssetId, writeAttempts);
    await context.close();
  } finally {
    if (browser) await browser.close();
  }

  const featureChecks = featureRoutes.every((row) => (row.auth_me_response_observed || row.header_visible)
    && row.feature_ui_matches_permission !== false
    && row.direct_url_denied_does_not_render !== false);
  const report = {
    ok: tokenEmail === authMeEmail
      && home.status === 200
      && scope.status !== 'failed'
      && assetReadMatchesScope !== false
      && anonymous.ok
      && featureChecks,
    generated_at: new Date().toISOString(),
    live_url: baseUrl,
    auth: {
      token_user_email: tokenEmail,
      auth_me_email: authMeEmail,
      token_matches_auth_me: tokenEmail === authMeEmail,
      password_email_matches_token: session.credential_source === 'password_grant' ? passwordEmail === tokenEmail : 'not_applicable',
      credential_source: session.credential_source,
      browser_ui_email_override: false,
      auth_me_mock: false,
      password_login_supported: true,
    },
    legacy_mock_warning: 'Existing qa:access-ui:browser --mode non-admin fulfills auth/me with synthetic data and is not live permission evidence.',
    feature_permissions: profile.feature_permissions || {},
    dashboard_scope: {
      canonical_scope_contract: {
        authority: 'auth_me.managedAssets and auth_me.permissions.managedAsset/otherAsset.read',
        legacy_profile_json_or_merge_used: false,
        other_assets_means_broad_scope: true,
      },
      permission,
      managed_asset_ids: managedAssetIds,
      response_scope_asset_ids: scopeAssetIds,
      response_payload_asset_ids: payloadAssetIds,
      assessment: scope,
      home_status: home.status,
      asset_read_status: assetRead.status,
      asset_read_matches_scope: assetReadMatchesScope,
    },
    anonymous_protected_actions: anonymous,
    feature_routes: featureRoutes,
    read_only_enforcement: {
      writes_committed: 0,
      write_request_attempts_blocked: writeAttempts.length,
      blocked_actions: writeAttempts,
    },
  };
  console.log(JSON.stringify({
    ok: report.ok,
    anonymous: anonymous.results,
    scope: report.dashboard_scope.assessment,
    feature_routes: featureRoutes,
    read_only_enforcement: report.read_only_enforcement,
  }, null, 2));
  if (!report.ok) process.exitCode = 1;
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error?.stack || error?.message || error);
    process.exit(1);
  });
}

module.exports = {
  assessAnonymousActions,
  assessScope,
  isLiveHttpsUrl,
  normalizeAssetIds,
};
