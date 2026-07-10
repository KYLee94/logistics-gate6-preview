const fs = require('fs');
const path = require('path');
const {
  buildRegistrationPlan,
  readManifest,
  validateManifest,
  verifySources,
} = require('../lib/logistics-floor-plan-manifest-core.cjs');

const ROOT = path.resolve(__dirname, '..', '..');
const DEFAULT_MANIFEST = path.join(ROOT, 'ops', 'manifests', 'logistics-floor-plan-manifest.json');
const DEFAULT_OUT_DIR = path.join(ROOT, 'qa-artifacts', 'logistics-gate6', 'floor-plan-registration-plan');

function argumentValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : '';
}

function main() {
  const manifestPath = path.resolve(argumentValue('--manifest') || DEFAULT_MANIFEST);
  const storageBucket = argumentValue('--storage-bucket');
  const outDir = path.resolve(argumentValue('--out-dir') || DEFAULT_OUT_DIR);
  const verifyHashes = process.argv.includes('--verify-source-hashes');
  if (!storageBucket) throw new Error('Pass --storage-bucket <existing-bucket>. This script cannot create buckets, upload files, or write to Supabase.');

  const manifest = readManifest(manifestPath);
  const validation = validateManifest(manifest);
  if (!validation.ok) throw new Error(`Manifest validation failed:\n${validation.errors.join('\n')}`);
  const sourceVerification = verifySources(manifest, { verifyHashes });
  if (!sourceVerification.ok) throw new Error(`Source verification failed:\n${JSON.stringify(sourceVerification.errors, null, 2)}`);

  const plan = buildRegistrationPlan(manifest, storageBucket);
  fs.mkdirSync(outDir, { recursive: true });
  const planPath = path.join(outDir, 'floor-plan-registration-plan.json');
  const sqlPath = path.join(outDir, 'floor-plan-registration-plan.sql');
  const report = {
    generated_at: new Date().toISOString(),
    manifest: manifestPath,
    validation: validation.summary,
    source_verification: { ok: sourceVerification.ok, verify_hashes: verifyHashes, checked_sources: sourceVerification.checks.length },
    registration_plan: {
      storage_bucket: plan.storage_bucket,
      ready_count: plan.ready.length,
      blocked_count: plan.blocked.length,
      database_write_performed: false,
      storage_upload_performed: false,
      ready: plan.ready,
      blocked: plan.blocked,
    },
  };
  fs.writeFileSync(planPath, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(sqlPath, plan.sql);
  console.log(JSON.stringify({ ok: true, plan_path: planPath, sql_path: sqlPath, ready_count: plan.ready.length, blocked_count: plan.blocked.length }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
