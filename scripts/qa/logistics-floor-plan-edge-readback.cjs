#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT_DIR = path.join(ROOT, 'qa-artifacts', 'logistics-gate6');
const MANIFEST_PATH = path.join(ROOT, 'ops', 'manifests', 'logistics-floor-plan-manifest.json');
const IMAGE_ROOT = path.join(ROOT, 'qa-artifacts', 'logistics-gate6', 'floor-plan-prepared-images');
const EDGE_PATH = path.join(ROOT, 'supabase', 'functions', 'll-dashboard-api', 'index.ts');
const OPS_PATH = path.join(ROOT, 'scripts', 'ops', 'logistics-floor-plan-ingest.cjs');
const TARGET_ASSET_ID = 'asset_a112721001';

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

function hasFlag(name) {
  return process.argv.includes(name);
}

function argValue(name, fallback = '') {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] || fallback : fallback;
}

function timestampForFile() {
  return new Date().toISOString().replace(/[-:]/gu, '').replace(/\..+$/u, '').replace('T', '-');
}

function selectPlans(manifest) {
  const asset = (manifest.assets || []).find((row) => row.asset_id === TARGET_ASSET_ID);
  if (!asset) throw new Error(`Target asset ${TARGET_ASSET_ID} not found in manifest.`);
  const plans = (asset.floor_plans || []).filter((plan) => asset.asset_identity_status === 'verified' && plan.registration_status === 'ready');
  return { asset, plans };
}

async function signIn(supabaseUrl, anonKey) {
  const accessToken = envValue('LOGISTICS_SUPABASE_ACCESS_TOKEN');
  if (accessToken) return { token: accessToken, source: 'LOGISTICS_SUPABASE_ACCESS_TOKEN' };
  const email = envValue('LOGISTICS_SUPABASE_EMAIL', 'LOGISTICS_SUPABASE_AUTH_EMAIL');
  const password = envValue('LOGISTICS_SUPABASE_PASSWORD', 'LOGISTICS_SUPABASE_AUTH_PASSWORD');
  if (!email || !password) throw new Error('Set LOGISTICS_SUPABASE_ACCESS_TOKEN, or set LOGISTICS_SUPABASE_EMAIL and LOGISTICS_SUPABASE_PASSWORD.');
  const response = await fetch(`${supabaseUrl.replace(/\/$/u, '')}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: anonKey, 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.access_token) throw new Error(`Supabase Auth login failed (${response.status}).`);
  return { token: body.access_token, source: 'password_grant' };
}

async function invoke(supabaseUrl, anonKey, token, action, payload = {}) {
  const response = await fetch(`${supabaseUrl.replace(/\/$/u, '')}/functions/v1/ll-dashboard-api`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      origin: 'https://kylee94.github.io',
    },
    body: JSON.stringify({ action, payload }),
  });
  const body = await response.json().catch(() => ({}));
  return { ok: response.ok && body?.ok === true, status: response.status, body };
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  const { asset, plans } = selectPlans(manifest);
  const edgeSource = fs.readFileSync(EDGE_PATH, 'utf8');
  const opsSource = fs.readFileSync(OPS_PATH, 'utf8');
  const checks = {
    edge_action_registered: edgeSource.includes("action === 'asset-floor-plans/register'"),
    ui_response_hides_storage_fields: edgeSource.includes('record: publicFloorPlanRecord(readbackRow)'),
    ops_script_uses_edge_action: opsSource.includes('asset-floor-plans/register'),
    ops_script_avoids_service_role: !/SERVICE_ROLE_KEY/u.test(opsSource),
    incheon_ready_plan_count: plans.length === 9,
    incheon_images_exist: plans.every((plan) => fs.existsSync(path.join(IMAGE_ROOT, 'asset-spec', 'floor-plans', asset.asset_id, plan.output_filename))),
    gyeongsan_not_selected_by_ops: !opsSource.includes('asset_a120085001'),
  };
  const report = {
    ok: Object.values(checks).every(Boolean),
    generated_at: new Date().toISOString(),
    checks,
    live: null,
  };

  if (hasFlag('--live')) {
    const supabaseUrl = envValue('LOGISTICS_SUPABASE_URL', 'VITE_SUPABASE_URL');
    const anonKey = envValue('LOGISTICS_SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY');
    const bucket = argValue('--storage-bucket', envValue('LOGISTICS_FLOOR_PLAN_STORAGE_BUCKET'));
    if (!supabaseUrl || !anonKey || !bucket) throw new Error('Live QA needs LOGISTICS_SUPABASE_URL, LOGISTICS_SUPABASE_ANON_KEY, and --storage-bucket (or LOGISTICS_FLOOR_PLAN_STORAGE_BUCKET).');
    const auth = await signIn(supabaseUrl, anonKey);
    const result = await invoke(supabaseUrl, anonKey, auth.token, 'dashboard/asset/read', { asset_id: TARGET_ASSET_ID });
    const floorPlans = Array.isArray(result.body?.data?.floor_plans) ? result.body.data.floor_plans : [];
    report.live = {
      ok: result.ok,
      http_status: result.status,
      auth_source: auth.source,
      floor_plan_count: floorPlans.length,
      storage_fields_hidden: floorPlans.every((row) => !JSON.stringify(row).match(/storage_bucket|storage_path/iu)),
    };
    report.ok = report.ok && result.ok && report.live.floor_plan_count >= 9 && report.live.storage_fields_hidden;
  }

  const outPath = path.join(OUT_DIR, `floor-plan-edge-readback-${timestampForFile()}.json`);
  const latestPath = path.join(OUT_DIR, 'floor-plan-edge-readback-latest.json');
  fs.writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(latestPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ ok: report.ok, artifact: outPath, checks: report.checks, live: report.live }, null, 2));
  if (!report.ok) process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
