const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT_DIR = path.join(ROOT, 'qa-artifacts', 'logistics-gate6');
const EDGE_FUNCTION = 'll-dashboard-api';
const DEFAULT_ORIGIN = 'https://kylee94.github.io';

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
  const flag = `--${name}`;
  const index = process.argv.indexOf(flag);
  return index === -1 ? fallback : (process.argv[index + 1] || fallback);
}

function timestampForFile() {
  return new Date().toISOString().replace(/[-:]/gu, '').replace(/\..+$/u, '').replace('T', '-');
}

function currentKstMonthEndDate() {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
}

async function signInForAccessToken(supabaseUrl, anonKey, email, password) {
  const response = await fetch(`${supabaseUrl.replace(/\/$/u, '')}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: anonKey, 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.access_token) {
    const message = body.msg || body.message || body.error_description || body.error || 'unknown auth error';
    throw new Error(`Supabase Auth login failed (${response.status}): ${message}`);
  }
  return body.access_token;
}

async function resolveAccessToken(supabaseUrl, anonKey) {
  const token = envValue('LOGISTICS_SUPABASE_ACCESS_TOKEN');
  if (token) return { token, source: 'LOGISTICS_SUPABASE_ACCESS_TOKEN' };
  const email = argsValue('email', envValue('LOGISTICS_SUPABASE_EMAIL', 'LOGISTICS_SUPABASE_AUTH_EMAIL'));
  const password = argsValue('password', envValue('LOGISTICS_SUPABASE_PASSWORD', 'LOGISTICS_SUPABASE_AUTH_PASSWORD'));
  if (!email || !password) throw new Error('Set LOGISTICS_SUPABASE_ACCESS_TOKEN, or LOGISTICS_SUPABASE_EMAIL and LOGISTICS_SUPABASE_PASSWORD.');
  return { token: await signInForAccessToken(supabaseUrl, anonKey, email, password), source: 'password_grant' };
}

async function invoke(endpoint, anonKey, origin, token, action, payload) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      authorization: token ? `Bearer ${token}` : '',
      'content-type': 'application/json',
      origin,
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
  return { action, status: response.status, ok: response.ok, body };
}

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== '');
}

function normalizeKey(value) {
  return String(value || '').replace(/\s+/gu, '').toLowerCase();
}

function loadStaticAssetPayloads() {
  const dir = path.join(ROOT, 'src', 'components', 'system', 'workspace', 'logisticsAssetData');
  return fs.readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .map((name) => JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8')));
}

function buildBuildingRegisterPayload(source = {}) {
  const asset = source.asset || source;
  const sigunguCd = firstDefined(asset.sigunguCd, asset.sigungu_cd, asset.sigungu);
  const bjdongCd = firstDefined(asset.bjdongCd, asset.bjdong_cd, asset.bjdong);
  const platGbCd = firstDefined(asset.platGbCd, asset.plat_gb_cd, '0');
  const bun = firstDefined(asset.bun, asset.mainBun);
  const ji = firstDefined(asset.ji, asset.subBun, '0');
  return {
    sigungu_cd: sigunguCd ? String(sigunguCd) : '',
    bjdong_cd: bjdongCd ? String(bjdongCd) : '',
    plat_gb_cd: platGbCd ? String(platGbCd) : '0',
    bun: bun ? String(bun).padStart(4, '0') : '',
    ji: ji ? String(ji).padStart(4, '0') : '0000',
  };
}

function isCompleteBuildingPayload(payload = {}) {
  return Boolean(payload.sigungu_cd && payload.bjdong_cd && payload.bun && payload.ji);
}

function staticPayloadForAsset(staticPayloads, asset) {
  const assetId = normalizeKey(asset.asset_id || asset.assetId);
  const assetName = normalizeKey(asset.asset_name || asset.assetName);
  return staticPayloads.find((payload) => (
    normalizeKey(payload.overview?.assetId || payload.meta?.selection?.assetId) === assetId
    || normalizeKey(payload.overview?.assetName) === assetName
  ));
}

function payloadForAsset(staticPayloads, asset) {
  const staticPayload = staticPayloadForAsset(staticPayloads, asset) || {};
  const rows = staticPayload.normalizedRows || staticPayload.rows || [];
  const source = rows.find((row) => row.asset?.sigunguCd || row.sigunguCd || row.asset?.sigungu_cd || row.sigungu_cd)
    || staticPayload.overview
    || asset;
  return buildBuildingRegisterPayload(source);
}

function summarizeExternalBody(body) {
  if (!body || typeof body !== 'object') return body || null;
  return {
    ok: body.ok,
    provider_status: body.provider_status,
    provider_code: body.provider_code,
    provider_message: body.provider_message,
    provider_warning: body.provider_warning,
    cache: body.cache || null,
    detail: body.detail || null,
    data_keys: body.data && typeof body.data === 'object' ? Object.keys(body.data).slice(0, 18) : [],
  };
}

function assertNoSecrets(label, value) {
  const serialized = JSON.stringify(value);
  if (/(crtfc_key|serviceKey)=|Bearer\s+[A-Za-z0-9._~-]+|OPENDART_API_KEY|BUILDING_REGISTER_API_KEY|SUPABASE_SERVICE_ROLE_KEY/iu.test(serialized)) {
    throw new Error(`${label} leaked a secret-like value`);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function invokeWithRetry(endpoint, anonKey, origin, token, action, payload, options = {}) {
  const attempts = options.attempts || 3;
  const delayMs = options.delayMs || 1500;
  let last = null;
  for (let index = 0; index < attempts; index += 1) {
    last = await invoke(endpoint, anonKey, origin, token, action, payload);
    if (last.status === 200 && last.body?.ok !== false) return last;
    if (index < attempts - 1) await sleep(delayMs * (index + 1));
  }
  return last;
}

function classifyOpenDart(result) {
  const body = result.body || {};
  if (result.status === 200 && body.cache?.stale === true) return 'stale_cache';
  if (result.status === 200 && body.ok !== false && body.provider_status === 200 && body.cache?.hit === true && body.cache?.stale === false && body.cache?.source !== 'll_tenants') return 'fresh_cache';
  if (result.status === 200 && body.ok !== false && body.provider_status === 200 && body.cache?.hit !== true && body.cache?.source !== 'll_tenants') return 'provider_success';
  if (result.status === 200 && body.provider_status === 206 && body.cache?.source === 'll_tenants') return 'tenant_fallback';
  if (result.status === 502 && /HandshakeFailure|provider request failed/iu.test(JSON.stringify(body))) return 'provider_tls_failure';
  if (result.status === 503) return 'not_configured';
  return 'provider_failure';
}

async function main() {
  const supabaseUrl = envValue('LOGISTICS_SUPABASE_URL', 'VITE_SUPABASE_URL');
  const anonKey = envValue('LOGISTICS_SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY');
  const origin = argsValue('origin', DEFAULT_ORIGIN);
  const basisDate = argsValue('basis-date', envValue('LOGISTICS_BASIS_DATE') || currentKstMonthEndDate());
  if (!supabaseUrl || !anonKey) throw new Error('Missing Supabase URL or anon key.');
  const endpoint = `${supabaseUrl.replace(/\/$/u, '')}/functions/v1/${EDGE_FUNCTION}`;
  const auth = await resolveAccessToken(supabaseUrl, anonKey);

  const checks = [];
  const maps = await invoke(endpoint, anonKey, origin, auth.token, 'naver/maps-config', {});
  checks.push({ name: 'naver/maps-config', status: maps.status, ok: maps.status === 200 && maps.body?.ok === true });

  const homeRead = await invoke(endpoint, anonKey, origin, auth.token, 'dashboard/home/read', { basis_date: basisDate });
  if (homeRead.status !== 200 || homeRead.body?.ok !== true) throw new Error(`dashboard/home/read failed: ${homeRead.status}`);
  const assets = homeRead.body?.data?.assets || [];
  const staticPayloads = loadStaticAssetPayloads();

  const buildingAssetChecks = [];
  for (const asset of assets) {
    const assetName = asset.asset_name || asset.assetName || '';
    const payload = payloadForAsset(staticPayloads, asset);
    if (!isCompleteBuildingPayload(payload)) {
      buildingAssetChecks.push({
        asset_name: assetName,
        asset_id_redacted: String(asset.asset_id || asset.assetId || '').replace(/^asset_/u, 'asset_[redacted]_'),
        payload,
        provider_status: 'parameter_missing',
        cache_hit: false,
        stored_readback: false,
        ok: false,
        reason: 'building-register payload is incomplete',
      });
      continue;
    }
    const first = await invokeWithRetry(endpoint, anonKey, origin, auth.token, 'building-register/summary', payload, { attempts: 4, delayMs: 2000 });
    await sleep(350);
    const second = await invokeWithRetry(endpoint, anonKey, origin, auth.token, 'building-register/summary', payload, { attempts: 3, delayMs: 1000 });
    assertNoSecrets(`building-register ${assetName}`, { first: first.body, second: second.body });
    const data = second.body?.data || first.body?.data || {};
    const hasProviderData = Boolean(data.plat_plc || data.new_plat_plc || data.tot_area || data.main_purps_cd_nm);
    const ok = first.status === 200
      && first.body?.ok !== false
      && second.status === 200
      && second.body?.ok !== false
      && second.body?.cache?.hit === true
      && !first.body?.cache?.write_error;
    buildingAssetChecks.push({
      asset_name: assetName,
      payload,
      provider_status: first.body?.provider_status || first.status,
      cache_hit: Boolean(first.body?.cache?.hit),
      readback_cache_hit: Boolean(second.body?.cache?.hit),
      stored_readback: Boolean(second.body?.cache?.hit && second.body?.cache?.stale === false),
      data_presence: {
        plat_plc: Boolean(data.plat_plc),
        new_plat_plc: Boolean(data.new_plat_plc),
        tot_area: Boolean(data.tot_area),
        main_purps_cd_nm: Boolean(data.main_purps_cd_nm),
        use_apr_day: Boolean(data.use_apr_day),
      },
      provider_result: hasProviderData ? 'data' : 'empty',
      ok,
      first: summarizeExternalBody(first.body),
      second: summarizeExternalBody(second.body),
    });
    await sleep(250);
  }

  const buildingOk = buildingAssetChecks.length === 17 && buildingAssetChecks.every((row) => row.ok);
  checks.push({
    name: 'building-register/summary-all-assets',
    status: buildingOk ? 200 : 502,
    ok: buildingOk,
    asset_count: buildingAssetChecks.length,
    passed: buildingAssetChecks.filter((row) => row.ok).length,
    failed: buildingAssetChecks.filter((row) => !row.ok).length,
  });

  const companyRead = await invoke(endpoint, anonKey, origin, auth.token, 'dashboard/company/read', { basis_date: basisDate });
  const corpCode = argsValue('corp-code', envValue('LOGISTICS_DART_CORP_CODE') || companyRead.body?.data?.tenant?.dart_corp_code || companyRead.body?.data?.tenant?.dartCorpCode || '');
  let openDartCheck = null;
  let openDartForceCheck = null;
  if (corpCode) {
    const dart = await invoke(endpoint, anonKey, origin, auth.token, 'opendart/company', { corp_code: corpCode, include_financials: true });
    assertNoSecrets('opendart/company', dart.body);
    const classification = classifyOpenDart(dart);
    const proxyUrlConfigured = Boolean(envValue('OPENDART_PROXY_URL'));
    const needsProviderResolution = !proxyUrlConfigured && ['tenant_fallback', 'provider_tls_failure', 'provider_failure'].includes(classification);
    openDartCheck = {
      name: 'opendart/company-provider-separated',
      status: dart.status,
      ok: ['provider_success', 'fresh_cache', 'tenant_fallback', 'stale_cache', 'provider_tls_failure'].includes(classification),
      provider_success: classification === 'provider_success',
      cache_success: classification === 'fresh_cache',
      fallback_success: ['tenant_fallback', 'stale_cache'].includes(classification),
      classification,
      proxy_url_configured: proxyUrlConfigured,
      required_user_action: needsProviderResolution
        ? {
          action: 'Run monthly OpenDART ingest with a local/GitHub OPENDART_API_KEY, or configure OPENDART_PROXY_URL only if realtime provider calls are required.',
          reason: classification === 'tenant_fallback'
            ? 'Supabase Edge secret OPENDART_API_KEY는 존재하지만 Edge에서 OpenDART 원천 provider 호출이 성공하지 못해 ll_tenants 검증 fallback으로 응답했습니다. 월 1회 적재 구조에서는 로컬/GitHub 작업이 OpenDART를 직접 호출한 뒤 Edge cache-upsert로 저장해야 합니다.'
            : 'Supabase Edge direct OpenDART HTTPS call is failing before a verified provider payload is returned.',
          monthly_ingest: {
            command: 'npm run opendart:monthly-ingest',
            required_secret: 'OPENDART_API_KEY in the local environment or GitHub Actions secret',
            stores_to: 'll_cache_entries via opendart/company/cache-upsert',
          },
          contract: {
            method: 'POST',
            request: { corp_code: 'string', include_financials: 'boolean' },
            success: { ok: true, provider: 'opendart', provider_success: true, provider_status: 200, provider_code: '000', data: { corp_code: 'string', corp_name: 'string', financials: [] } },
            failure: { ok: false, provider_success: false, provider_code: 'string', provider_message: 'redacted provider message' },
          },
        }
        : null,
      body: summarizeExternalBody(dart.body),
    };
    const dartForce = await invoke(endpoint, anonKey, origin, auth.token, 'opendart/company', { corp_code: corpCode, include_financials: true, force_refresh: true });
    assertNoSecrets('opendart/company force_refresh', dartForce.body);
    const forceClassification = classifyOpenDart(dartForce);
    openDartForceCheck = {
      name: 'opendart/company-provider-force-refresh',
      status: dartForce.status,
      ok: ['provider_success', 'stale_cache', 'provider_tls_failure'].includes(forceClassification),
      provider_success: forceClassification === 'provider_success',
      cache_success: false,
      fallback_success: forceClassification === 'stale_cache',
      classification: forceClassification,
      force_refresh: true,
      body: summarizeExternalBody(dartForce.body),
    };
  } else {
    openDartCheck = { name: 'opendart/company-provider-separated', status: 'skipped', ok: false, provider_success: false, fallback_success: false, classification: 'corp_code_missing' };
    openDartForceCheck = { name: 'opendart/company-provider-force-refresh', status: 'skipped', ok: false, provider_success: false, fallback_success: false, classification: 'corp_code_missing', force_refresh: true };
  }
  checks.push(openDartCheck);
  checks.push(openDartForceCheck);

  const cacheUpsertReject = await invoke(endpoint, anonKey, origin, auth.token, 'opendart/company/cache-upsert', {
    corp_code: '00000000',
    include_financials: true,
    provider_status: 200,
    data: {
      corp_code: '00000000',
      corp_name: 'QA secret reject canary',
      status: '000',
      api_key: 'must-not-be-accepted',
    },
  });
  assertNoSecrets('opendart/company/cache-upsert secret reject', cacheUpsertReject.body);
  checks.push({
    name: 'opendart/company-cache-upsert-secret-reject',
    status: cacheUpsertReject.status,
    ok: cacheUpsertReject.status === 400 && cacheUpsertReject.body?.ok === false,
  });

  const geocodeQuery = argsValue('geocode-query', envValue('LOGISTICS_GEOCODE_QUERY'));
  if (geocodeQuery) {
    const geocode = await invoke(endpoint, anonKey, origin, auth.token, 'naver/geocode', { query: geocodeQuery });
    assertNoSecrets('naver/geocode', geocode.body);
    checks.push({
      name: 'naver/geocode',
      status: geocode.status,
      ok: geocode.status === 200 && geocode.body?.ok !== false,
      count: Array.isArray(geocode.body?.data) ? geocode.body.data.length : 0,
      body: summarizeExternalBody(geocode.body),
    });
  } else {
    checks.push({ name: 'naver/geocode', status: 'skipped', ok: false, reason: 'LOGISTICS_GEOCODE_QUERY not set' });
  }

  const output = {
    ok: checks.filter((row) => row.status !== 'skipped').every((row) => row.ok),
    generated_at: new Date().toISOString(),
    origin,
    basis_date: basisDate,
    auth_source: auth.source,
    checks,
    building_register_assets: buildingAssetChecks,
    opendart_provider_success: Boolean(openDartForceCheck?.provider_success || openDartCheck?.provider_success),
    opendart_force_provider_success: Boolean(openDartForceCheck?.provider_success),
    opendart_cache_success: Boolean(openDartCheck?.cache_success),
    opendart_fallback_success: Boolean(openDartForceCheck?.fallback_success || openDartCheck?.fallback_success),
    opendart_requires_external_provider_resolution: Boolean(openDartCheck?.required_user_action),
  };
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const outJson = path.join(OUT_DIR, `external-api-smoke-${timestampForFile()}.json`);
  fs.writeFileSync(outJson, JSON.stringify(output, null, 2), 'utf8');
  fs.writeFileSync(path.join(OUT_DIR, 'external-api-smoke-latest.json'), JSON.stringify(output, null, 2), 'utf8');
  console.log(JSON.stringify({ ...output, artifact: outJson }, null, 2));
  if (!output.ok) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
