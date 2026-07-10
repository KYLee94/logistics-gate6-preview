const fs = require('fs');
const path = require('path');
const {
  buildRegistrationPlan,
  readManifest,
  validateManifest,
  verifySources,
} = require('../lib/logistics-floor-plan-manifest-core.cjs');

const ROOT = path.resolve(__dirname, '..', '..');
const MANIFEST_PATH = path.join(ROOT, 'ops', 'manifests', 'logistics-floor-plan-manifest.json');
const OUT_DIR = path.join(ROOT, 'qa-artifacts', 'logistics-gate6');
const COMPILER_PATH = path.join(ROOT, 'scripts', 'ops', 'logistics-floor-plan-registration-plan.cjs');

function main() {
  const manifest = readManifest(MANIFEST_PATH);
  const validation = validateManifest(manifest);
  const sources = verifySources(manifest, { verifyHashes: true });
  const plan = buildRegistrationPlan(manifest, 'qa-floor-plan-bucket');
  const compilerSource = fs.readFileSync(COMPILER_PATH, 'utf8');
  const checks = {
    manifest_valid: validation.ok,
    source_hashes_match: sources.ok,
    source_candidate_count: sources.checks.length === 25,
    incheon_ready_rows: plan.ready.length === 9,
    gyeongsan_blocked_rows: plan.blocked.filter((row) => row.asset_id === 'asset_a120085001').length === 14,
    idempotent_conflict_target: plan.sql.includes('on conflict (asset_id, file_type, storage_bucket, storage_path) do update'),
    no_upload_or_database_client: !/\b(fetch|createClient|SUPABASE|https?:\/\/|\.from\()/u.test(compilerSource),
  };
  const report = {
    ok: Object.values(checks).every(Boolean),
    generated_at: new Date().toISOString(),
    checks,
    validation: validation.summary,
    source_verification: { checked_sources: sources.checks.length, errors: sources.errors },
    registration_plan: { ready_count: plan.ready.length, blocked_count: plan.blocked.length, database_write_performed: false, storage_upload_performed: false },
  };
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const outPath = path.join(OUT_DIR, 'floor-plan-manifest-smoke-latest.json');
  fs.writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ ok: report.ok, artifact: outPath, checks }, null, 2));
  if (!report.ok) process.exit(1);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.stack : error);
  process.exit(1);
}
