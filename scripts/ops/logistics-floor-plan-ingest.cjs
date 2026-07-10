#!/usr/bin/env node
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const DEFAULT_MANIFEST = path.join(ROOT, 'ops', 'manifests', 'logistics-floor-plan-manifest.json');
const DEFAULT_IMAGE_ROOT = path.join(ROOT, 'qa-artifacts', 'logistics-gate6', 'floor-plan-prepared-images');
const OUT_DIR = path.join(ROOT, 'qa-artifacts', 'logistics-gate6');
const TARGET_ASSET_ID = 'asset_a112721001';
const TARGET_ASSET_CODE = 'A112721001';
const TARGET_ASSET_NAME_FRAGMENT = '인천석남';

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

function argValue(name, fallback = '') {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] || fallback : fallback;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function requiredText(value, label) {
  const text = String(value || '').trim();
  if (!text) throw new Error(`${label} is required.`);
  return text;
}

function timestampForFile() {
  return new Date().toISOString().replace(/[-:]/gu, '').replace(/\..+$/u, '').replace('T', '-');
}

function compact(value) {
  return String(value || '').replace(/\s+/gu, '').toLowerCase();
}

function sha256File(filePath) {
  const hash = crypto.createHash('sha256');
  const descriptor = fs.openSync(filePath, 'r');
  try {
    const buffer = Buffer.allocUnsafe(1024 * 1024);
    let bytesRead = 0;
    do {
      bytesRead = fs.readSync(descriptor, buffer, 0, buffer.length, null);
      if (bytesRead) hash.update(buffer.subarray(0, bytesRead));
    } while (bytesRead);
  } finally {
    fs.closeSync(descriptor);
  }
  return hash.digest('hex');
}

function readManifest(manifestPath) {
  return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
}

function floorKeyFromLabel(label) {
  const normalized = String(label || '').replace(/\s+/gu, '').toUpperCase();
  return normalized === 'ROOF' ? 'roof' : normalized.toLowerCase();
}

function imagePathForPlan(imageRoot, asset, plan) {
  return path.join(imageRoot, 'asset-spec', 'floor-plans', asset.asset_id, plan.output_filename);
}

function selectIncheonPlans(manifest) {
  const assets = Array.isArray(manifest.assets) ? manifest.assets : [];
  const asset = assets.find((row) => (
    String(row.asset_id || '') === TARGET_ASSET_ID
    || String(row.asset_code || '').toUpperCase() === TARGET_ASSET_CODE
    || compact(row.asset_name).includes(compact(TARGET_ASSET_NAME_FRAGMENT))
  ));
  if (!asset) throw new Error(`Target asset ${TARGET_ASSET_ID} was not found in ${path.basename(DEFAULT_MANIFEST)}.`);
  const plans = (asset.floor_plans || []).filter((plan) => (
    asset.asset_identity_status === 'verified'
    && plan.registration_status === 'ready'
    && Array.isArray(plan.source_candidates)
    && plan.source_candidates.length === 1
  ));
  if (!plans.length) throw new Error('No ready Incheon Seoknam floor plans were found in the canonical manifest.');
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
  if (!response.ok || !body.access_token) {
    const message = body.msg || body.message || body.error_description || body.error || 'unknown auth error';
    throw new Error(`Supabase Auth login failed (${response.status}): ${message}`);
  }
  return { token: body.access_token, source: 'password_grant' };
}

async function invokeUpload({ supabaseUrl, anonKey, token, bucket, asset, plan, imagePath, fileSha256, fileSize }) {
  const fileBuffer = fs.readFileSync(imagePath);
  const source = (plan.source_candidates || [])[0] || {};
  const form = new FormData();
  form.set('action', 'asset-floor-plans/register');
  form.set('payload', JSON.stringify({
    asset_id: asset.asset_id,
    title: plan.title,
    floor_label: plan.floor_label,
    floor_key: floorKeyFromLabel(plan.floor_label),
    storage_bucket: bucket,
    expected_sha256: fileSha256,
    upload_origin: 'logistics-floor-plan-ingest-script',
    metadata: {
      drawing_number: source.drawing_number || '',
      drawing_name: source.drawing_name || '',
      source_page: source.source_page || '',
      source_file_sha256: source.sha256 || '',
    },
  }));
  form.set('file', new Blob([fileBuffer], { type: 'image/png' }), path.basename(imagePath));
  const response = await fetch(`${supabaseUrl.replace(/\/$/u, '')}/functions/v1/ll-dashboard-api`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      authorization: `Bearer ${token}`,
      origin: 'https://kylee94.github.io',
    },
    body: form,
  });
  const body = await response.json().catch(() => ({}));
  return {
    ok: response.ok && body?.ok === true,
    status: response.status,
    file_size: fileSize,
    file_sha256: fileSha256,
    response: body,
  };
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const manifestPath = path.resolve(argValue('--manifest', DEFAULT_MANIFEST));
  const imageRoot = path.resolve(argValue('--image-root', DEFAULT_IMAGE_ROOT));
  const storageBucket = requiredText(argValue('--storage-bucket', envValue('LOGISTICS_FLOOR_PLAN_STORAGE_BUCKET')), '--storage-bucket');
  const apply = hasFlag('--apply');
  const manifest = readManifest(manifestPath);
  const { asset, plans } = selectIncheonPlans(manifest);
  const prepared = plans.map((plan) => {
    const imagePath = imagePathForPlan(imageRoot, asset, plan);
    const exists = fs.existsSync(imagePath);
    return {
      floor_label: plan.floor_label,
      title: plan.title,
      drawing_number: plan.source_candidates[0]?.drawing_number || '',
      image_path: imagePath,
      exists,
      file_size: exists ? fs.statSync(imagePath).size : 0,
      file_sha256: exists ? sha256File(imagePath) : '',
    };
  });
  const missing = prepared.filter((row) => !row.exists);
  const report = {
    ok: !apply && missing.length === 0,
    mode: apply ? 'apply' : 'dry-run',
    generated_at: new Date().toISOString(),
    manifest: manifestPath,
    image_root: imageRoot,
    storage_bucket: storageBucket,
    target_asset: {
      asset_id: asset.asset_id,
      asset_name: asset.asset_name,
      ready_plan_count: plans.length,
    },
    prepared,
    missing_images: missing.map((row) => row.image_path),
    storage_upload_performed: false,
    database_write_performed: false,
  };

  if (!apply) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  if (missing.length) throw new Error(`Missing prepared PNG files:\n${missing.map((row) => row.image_path).join('\n')}`);

  const supabaseUrl = requiredText(envValue('LOGISTICS_SUPABASE_URL', 'VITE_SUPABASE_URL'), 'LOGISTICS_SUPABASE_URL');
  const anonKey = requiredText(envValue('LOGISTICS_SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY'), 'LOGISTICS_SUPABASE_ANON_KEY');
  const auth = await signIn(supabaseUrl, anonKey);
  const results = [];
  for (let index = 0; index < plans.length; index += 1) {
    const plan = plans[index];
    const file = prepared[index];
    const result = await invokeUpload({
      supabaseUrl,
      anonKey,
      token: auth.token,
      bucket: storageBucket,
      asset,
      plan,
      imagePath: file.image_path,
      fileSha256: file.file_sha256,
      fileSize: file.file_size,
    });
    results.push({
      floor_label: plan.floor_label,
      title: plan.title,
      image_path: file.image_path,
      ...result,
    });
    if (!result.ok) throw new Error(`asset-floor-plans/register failed for ${plan.floor_label} (${result.status}): ${JSON.stringify(result.response)}`);
  }

  const outPath = path.join(OUT_DIR, `floor-plan-edge-ingest-${timestampForFile()}.json`);
  const latestPath = path.join(OUT_DIR, 'floor-plan-edge-ingest-latest.json');
  const finalReport = {
    ...report,
    ok: results.every((row) => row.ok),
    auth_source: auth.source,
    storage_upload_performed: true,
    database_write_performed: true,
    results,
  };
  fs.writeFileSync(outPath, `${JSON.stringify(finalReport, null, 2)}\n`);
  fs.writeFileSync(latestPath, `${JSON.stringify(finalReport, null, 2)}\n`);
  console.log(JSON.stringify({
    ok: finalReport.ok,
    artifact: outPath,
    uploaded_count: results.length,
    readback_ok_count: results.filter((row) => row.response?.data?.readback_ok === true).length,
  }, null, 2));
  if (!finalReport.ok) process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
