#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const DEFAULT_ENV_ROOT = path.resolve(ROOT, '..', 'IGIS-Fund-Production-DP');
const STATIC_ASSET_DIR = path.join(ROOT, 'src', 'components', 'system', 'workspace', 'logisticsAssetData');
const BUILDING_ACTION = 'building-register/summary';
const EXCLUDED_ASSET_CODES = new Set(['A112127001', 'AP00014001']);
const DEVELOPMENT_NO_REGISTER_ASSET_CODES = new Set(['A190013001']);
const OFFICIAL_FIELDS = Object.freeze([
  'plat_plc',
  'new_plat_plc',
  'bld_nm',
  'main_purps_cd_nm',
  'etc_purps',
  'strct_cd_nm',
  'grnd_flr_cnt',
  'ugrnd_flr_cnt',
  'plat_area',
  'arch_area',
  'tot_area',
  'vl_rat_estm_tot_area',
  'bc_rat',
  'vl_rat',
  'tot_pkng_cnt',
  'use_apr_day',
]);

function argValue(name, fallback = '') {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : (process.argv[index + 1] || fallback);
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  return Object.fromEntries(fs.readFileSync(filePath, 'utf8')
    .split(/\r?\n/gu)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => {
      const separator = line.indexOf('=');
      return [
        line.slice(0, separator).trim(),
        line.slice(separator + 1).trim().replace(/^['"]|['"]$/gu, ''),
      ];
    }));
}

function runtimeConfig() {
  const envRoot = path.resolve(argValue('env-root', DEFAULT_ENV_ROOT));
  const fileEnv = {
    ...readEnvFile(path.join(envRoot, '.env')),
    ...readEnvFile(path.join(envRoot, '.env.local')),
  };
  const envValue = (...names) => names
    .map((name) => process.env[name] || fileEnv[name] || '')
    .find(Boolean) || '';
  return {
    supabaseUrl: envValue('LOGISTICS_SUPABASE_URL', 'VITE_SUPABASE_URL').replace(/\/$/u, ''),
    anonKey: envValue('LOGISTICS_SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY'),
    accessToken: envValue('LOGISTICS_SUPABASE_ACCESS_TOKEN'),
    email: envValue('LOGISTICS_SUPABASE_EMAIL', 'LOGISTICS_SUPABASE_AUTH_EMAIL'),
    password: envValue('LOGISTICS_SUPABASE_PASSWORD', 'LOGISTICS_SUPABASE_AUTH_PASSWORD'),
  };
}

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== '');
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
    plat_gb_cd: String(platGbCd || '0'),
    bun: bun ? String(bun).padStart(4, '0') : '',
    ji: ji ? String(ji).padStart(4, '0') : '0000',
  };
}

function isCompletePayload(payload) {
  return /^\d{5}$/u.test(payload.sigungu_cd)
    && /^\d{5}$/u.test(payload.bjdong_cd)
    && /^\d{4}$/u.test(payload.bun)
    && /^\d{4}$/u.test(payload.ji);
}

function payloadFromQueryKey(queryKey) {
  const [sigunguCd, bjdongCd, platGbCd, bun, ji] = String(queryKey || '').split('|');
  return buildBuildingRegisterPayload({ sigunguCd, bjdongCd, platGbCd, bun, ji });
}

function loadBuildingRegisterPlan() {
  const plan = fs.readdirSync(STATIC_ASSET_DIR)
    .filter((name) => /^asset_.*\.json$/u.test(name))
    .map((name) => {
      const assetCode = name.slice('asset_'.length, -'.json'.length).toUpperCase();
      const document = JSON.parse(fs.readFileSync(path.join(STATIC_ASSET_DIR, name), 'utf8'));
      const rows = document.normalizedRows || document.rows || [];
      const sources = rows.filter((row) => {
        const asset = row?.asset || row || {};
        return firstDefined(asset.sigunguCd, asset.sigungu_cd);
      });
      if (sources.length === 0) sources.push(document.meta?.selection || document.overview || {});
      const payloadEntries = sources.map((source) => {
        const payload = buildBuildingRegisterPayload(source);
        return [JSON.stringify(payload), payload];
      });
      const selectionQueryKeys = [
        document.meta?.selection?.queryKey,
        ...sources.map((source) => (source.asset || source)?.queryKey),
      ]
        .filter(Boolean)
        .flatMap((value) => String(value)
        .split('||')
        .map((value) => value.trim())
        .filter(Boolean));
      for (const queryKey of selectionQueryKeys) {
        const payload = payloadFromQueryKey(queryKey);
        payloadEntries.push([JSON.stringify(payload), payload]);
      }
      const payloads = [...new Map(payloadEntries).values()];
      const firstAsset = sources[0]?.asset || sources[0] || {};
      return {
        asset_code: assetCode,
        asset_name: firstDefined(firstAsset.assetName, document.overview?.assetName, document.meta?.selection?.assetName) || null,
        source_file: name,
        query_keys: [...new Set(sources.map((source) => {
          const asset = source.asset || source;
          return firstDefined(asset.queryKey, document.meta?.selection?.queryKey) || null;
        }).filter(Boolean))],
        payloads,
      };
    })
    .filter((row) => !EXCLUDED_ASSET_CODES.has(row.asset_code))
    .sort((left, right) => left.asset_code.localeCompare(right.asset_code));
  assert.equal(plan.length, 17, 'Building-register refresh plan must contain exactly 17 visible assets');
  assert.equal(new Set(plan.map((row) => row.asset_code)).size, 17, 'Building-register refresh plan has duplicate assets');
  for (const row of plan) {
    assert.equal(row.payloads.length > 0, true, `${row.asset_code} has no parcel query`);
    for (const payload of row.payloads) {
      assert.equal(isCompletePayload(payload), true, `${row.asset_code} has incomplete parcel codes`);
    }
  }
  return plan;
}

function summarizeBuildingRegisterData(data = {}) {
  return Object.fromEntries(OFFICIAL_FIELDS
    .filter((field) => data[field] !== undefined && data[field] !== null && data[field] !== '')
    .map((field) => [field, data[field]]));
}

function isExpectedNoRegisterResponse(assetCode, response, official = {}) {
  return DEVELOPMENT_NO_REGISTER_ASSET_CODES.has(assetCode)
    && response?.ok === true
    && response?.body?.ok === true
    && Object.keys(official).length === 0
    && Array.isArray(response.body?.provider_attempts)
    && response.body.provider_attempts.length > 0
    && response.body.provider_attempts.every((attempt) => attempt.status === 200 && attempt.has_data === false);
}

function emitReport(report) {
  const serialized = `${JSON.stringify(report, null, 2)}\n`;
  const outputPath = argValue('output');
  if (outputPath) fs.writeFileSync(path.resolve(outputPath), serialized, 'utf8');
  process.stdout.write(serialized);
}

async function acquireAuthenticatedSession(config) {
  assert.ok(config.supabaseUrl && config.anonKey, 'Supabase URL/anon key is missing');
  if (config.accessToken) return config.accessToken;
  assert.ok(config.email && config.password, 'Supabase QA login credentials are missing');
  const response = await fetch(`${config.supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: config.anonKey, 'content-type': 'application/json' },
    body: JSON.stringify({ email: config.email, password: config.password }),
  });
  const session = await response.json().catch(() => null);
  assert.equal(response.status, 200, 'Supabase password login failed');
  assert.ok(session?.access_token && session?.user?.id, 'Supabase auth session is incomplete');
  return session.access_token;
}

async function invokeBuildingRegister(config, token, payload) {
  const response = await fetch(`${config.supabaseUrl}/functions/v1/ll-dashboard-api`, {
    method: 'POST',
    headers: {
      apikey: config.anonKey,
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      origin: 'https://kylee94.github.io',
    },
    body: JSON.stringify({ action: BUILDING_ACTION, payload }),
  });
  const body = await response.json().catch(() => null);
  return { status: response.status, ok: response.ok, body };
}

async function main() {
  const plan = loadBuildingRegisterPlan();
  if (hasFlag('plan')) {
    emitReport({
      ok: true,
      mode: 'building_register_plan_only',
      operating_network_used: false,
      database_write_used: false,
      plan,
    });
    return;
  }
  assert.equal(hasFlag('allow-write'), true, 'Use --allow-write to permit exact building-register cache refresh writes');
  const config = runtimeConfig();
  const token = await acquireAuthenticatedSession(config);
  const assets = [];
  for (const row of plan) {
    const parcels = [];
    for (const payload of row.payloads) {
      const first = await invokeBuildingRegister(config, token, { ...payload, force_refresh: true });
      const second = await invokeBuildingRegister(config, token, payload);
      const official = summarizeBuildingRegisterData(first.body?.data || second.body?.data || {});
      const expectedNoRegister = isExpectedNoRegisterResponse(row.asset_code, first, official);
      const success = first.ok
        && first.body?.ok === true
        && Object.keys(official).length > 0
        && !first.body?.cache?.write_error
        && second.ok
        && second.body?.ok === true
        && second.body?.cache?.hit === true
        && second.body?.cache?.stale !== true;
      parcels.push({
        payload,
        success,
        expected_no_register: expectedNoRegister,
        development_status: expectedNoRegister ? 'in_progress' : null,
        refresh_status: first.status,
        provider_status: first.body?.provider_status || null,
        provider_attempts: first.body?.provider_attempts || [],
        cache_write_error: first.body?.cache?.write_error || null,
        readback_cache_hit: second.body?.cache?.hit === true,
        official,
      });
    }
    assets.push({
      ...row,
      success: parcels.every((parcel) => parcel.success || parcel.expected_no_register),
      parcels,
    });
  }
  const report = {
    ok: assets.length === 17 && assets.every((row) => row.success),
    mode: 'production_building_register_exact_refresh_audit',
    generated_at: new Date().toISOString(),
    action: BUILDING_ACTION,
    operating_network_used: true,
    database_write_used: true,
    database_write_scope: 'public.ll_cache_entries building-register/summary exact 18 parcel keys only',
    core_asset_write_used: false,
    excluded_asset_codes: [...EXCLUDED_ASSET_CODES],
    asset_count: assets.length,
    parcel_query_count: assets.reduce((sum, row) => sum + row.parcels.length, 0),
    success_count: assets.filter((row) => row.success).length,
    register_success_count: assets.filter((row) => row.parcels.every((parcel) => parcel.success)).length,
    expected_no_register_count: assets.filter((row) => row.parcels.every((parcel) => parcel.expected_no_register)).length,
    assets,
  };
  emitReport(report);
  if (!report.ok) process.exitCode = 1;
}

module.exports = {
  BUILDING_ACTION,
  DEVELOPMENT_NO_REGISTER_ASSET_CODES,
  EXCLUDED_ASSET_CODES,
  buildBuildingRegisterPayload,
  loadBuildingRegisterPlan,
  isExpectedNoRegisterResponse,
  summarizeBuildingRegisterData,
};

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`${JSON.stringify({ ok: false, error: error.message }, null, 2)}\n`);
    process.exit(1);
  });
}
