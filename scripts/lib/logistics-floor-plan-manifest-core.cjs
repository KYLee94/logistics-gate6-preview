const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const FLOOR_ORDER = new Map(['B2', 'B1', '1F', '2F', '3F', '4F', '5F', '6F', '7F', '8F', '9F', '10F', '11F', '12F'].map((label, index) => [label, index]));
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;

function readManifest(manifestPath) {
  return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
}

function planEntries(manifest) {
  return (manifest.assets || []).flatMap((asset) => (asset.floor_plans || []).map((plan) => ({ asset, plan })));
}

function sortEntries(entries) {
  return [...entries].sort((left, right) => (
    left.asset.asset_id.localeCompare(right.asset.asset_id)
    || (FLOOR_ORDER.get(left.plan.floor_label) ?? Number.MAX_SAFE_INTEGER) - (FLOOR_ORDER.get(right.plan.floor_label) ?? Number.MAX_SAFE_INTEGER)
  ));
}

function validateManifest(manifest) {
  const errors = [];
  const entries = planEntries(manifest);
  if (manifest.schema_version !== 1) errors.push('schema_version must be 1');
  if (!manifest.storage?.path_prefix || !/^[a-z0-9][a-z0-9/_-]*$/u.test(manifest.storage.path_prefix)) {
    errors.push('storage.path_prefix must be a safe lowercase path');
  }
  const seenPlans = new Set();
  for (const { asset, plan } of entries) {
    const key = `${asset.asset_id}:${plan.floor_label}`;
    if (!asset.asset_id || !asset.asset_name) errors.push(`asset identity missing for ${key}`);
    if (!['verified', 'blocked'].includes(asset.asset_identity_status)) errors.push(`asset_identity_status invalid for ${key}`);
    if (!FLOOR_ORDER.has(plan.floor_label)) errors.push(`unsupported floor label for ${key}`);
    if (seenPlans.has(key)) errors.push(`duplicate plan entry ${key}`);
    seenPlans.add(key);
    if (!plan.title || !plan.drawing_number || !/^[a-z0-9][a-z0-9-]*\.png$/u.test(plan.output_filename || '')) {
      errors.push(`required plan metadata missing for ${key}`);
    }
    if (!['ready', 'blocked'].includes(plan.registration_status)) errors.push(`registration_status invalid for ${key}`);
    if (!Array.isArray(plan.source_candidates) || plan.source_candidates.length === 0) errors.push(`source candidates missing for ${key}`);
    if (plan.registration_status === 'ready' && (asset.asset_identity_status !== 'verified' || plan.source_candidates.length !== 1)) {
      errors.push(`ready registration must have verified asset identity and one source candidate for ${key}`);
    }
    if (plan.registration_status === 'blocked' && (!Array.isArray(plan.blockers) || plan.blockers.length === 0)) {
      errors.push(`blocked registration must declare blockers for ${key}`);
    }
    for (const source of plan.source_candidates || []) {
      if (!source.source_path || !source.source_file_name || !Number.isInteger(source.source_page) || source.source_page < 1 || !SHA256_PATTERN.test(source.sha256 || '')) {
        errors.push(`invalid source candidate for ${key}`);
      }
    }
  }
  const readyCount = entries.filter(({ asset, plan }) => asset.asset_identity_status === 'verified' && plan.registration_status === 'ready').length;
  return {
    ok: errors.length === 0,
    errors,
    summary: {
      asset_count: (manifest.assets || []).length,
      plan_count: entries.length,
      ready_count: readyCount,
      blocked_count: entries.length - readyCount,
    },
  };
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

function verifySources(manifest, { verifyHashes = false } = {}) {
  const cache = new Map();
  const checks = [];
  for (const { asset, plan } of sortEntries(planEntries(manifest))) {
    for (const source of plan.source_candidates || []) {
      const cacheKey = source.source_path;
      let checked = cache.get(cacheKey);
      if (!checked) {
        const exists = fs.existsSync(source.source_path);
        const actualHash = exists && verifyHashes ? sha256File(source.source_path) : null;
        checked = { exists, actual_hash: actualHash };
        cache.set(cacheKey, checked);
      }
      checks.push({
        asset_id: asset.asset_id,
        floor_label: plan.floor_label,
        source_file_name: source.source_file_name,
        source_page: source.source_page,
        exists: checked.exists,
        expected_sha256: source.sha256,
        actual_sha256: checked.actual_hash,
        hash_matches: verifyHashes ? checked.actual_hash === source.sha256 : null,
      });
    }
  }
  const errors = checks.filter((check) => !check.exists || (verifyHashes && !check.hash_matches));
  return { ok: errors.length === 0, verify_hashes: verifyHashes, checks, errors };
}

function sqlLiteral(value) {
  return `'${String(value).replace(/'/gu, "''")}'`;
}

function storagePath(manifest, asset, plan) {
  return `${manifest.storage.path_prefix}/${asset.asset_id}/${plan.output_filename}`;
}

function buildRegistrationPlan(manifest, storageBucket) {
  if (!storageBucket || !/^[a-z0-9][a-z0-9-]*$/u.test(storageBucket)) {
    throw new Error('Pass an existing lowercase --storage-bucket value. The script does not create buckets.');
  }
  const ready = [];
  const blocked = [];
  for (const { asset, plan } of sortEntries(planEntries(manifest))) {
    const isReady = asset.asset_identity_status === 'verified' && plan.registration_status === 'ready' && plan.source_candidates.length === 1;
    if (!isReady) {
      blocked.push({
        asset_id: asset.asset_id,
        asset_name: asset.asset_name,
        floor_label: plan.floor_label,
        drawing_number: plan.drawing_number,
        blockers: [...(plan.blockers || []), ...(asset.asset_identity_status === 'blocked' ? ['asset_identity_mismatch'] : [])],
      });
      continue;
    }
    const source = plan.source_candidates[0];
    ready.push({
      asset_id: asset.asset_id,
      asset_name: asset.asset_name,
      file_type: 'floor_plan',
      title: plan.title,
      storage_bucket: storageBucket,
      storage_path: storagePath(manifest, asset, plan),
      metadata: {
        floor_label: plan.floor_label,
        drawing_number: plan.drawing_number,
        source_file_name: source.source_file_name,
        source_page: source.source_page,
        source_sha256: source.sha256,
        render_format: manifest.render_defaults.format,
        render_dpi: manifest.render_defaults.dpi,
      },
    });
  }
  const statements = ready.map((row) => [
    'insert into public.ll_asset_spec_files (asset_id, file_type, title, storage_bucket, storage_path, metadata)',
    `values (${sqlLiteral(row.asset_id)}, ${sqlLiteral(row.file_type)}, ${sqlLiteral(row.title)}, ${sqlLiteral(row.storage_bucket)}, ${sqlLiteral(row.storage_path)}, ${sqlLiteral(JSON.stringify(row.metadata))}::jsonb)`,
    'on conflict (asset_id, file_type, storage_bucket, storage_path) do update',
    'set title = excluded.title, metadata = excluded.metadata;',
  ].join('\n'));
  const sql = [
    '-- Generated registration plan only. No storage object is uploaded by this file.',
    '-- Run only after the release owner confirms the matching Storage objects exist.',
    'begin;',
    ...statements,
    'commit;',
    '',
  ].join('\n\n');
  return {
    database_write_performed: false,
    storage_upload_performed: false,
    storage_bucket: storageBucket,
    ready,
    blocked,
    sql,
  };
}

module.exports = { buildRegistrationPlan, planEntries, readManifest, storagePath, validateManifest, verifySources };
