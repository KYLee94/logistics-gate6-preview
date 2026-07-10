const path = require('node:path');

const {
  collectPreflight,
  defaultArtifactPath,
  parseArgs,
  verifyManifest,
  writeJson,
} = require('../lib/logistics-db-cleanup-core.cjs');

function main() {
  const args = parseArgs();
  const timeoutMs = Number(args.timeoutMs || 15 * 60 * 1000);
  if (!Number.isFinite(timeoutMs) || timeoutMs < 1000) throw new Error('--timeout-ms must be at least 1000.');
  const manifest = collectPreflight({
    projectRef: args.projectRef || undefined,
    environment: args.environment || 'unknown',
    timeoutMs,
  });
  const validation = verifyManifest(manifest);
  if (!validation.ok) throw new Error(`Generated manifest validation failed: ${validation.errors.join('; ')}`);
  const outputPath = path.resolve(args.out || defaultArtifactPath('preflight'));
  writeJson(outputPath, manifest);
  console.log(JSON.stringify({
    ok: true,
    mode: 'read_only_repeatable_read',
    output: outputPath,
    project_ref: manifest.provenance.project_ref,
    git_sha: manifest.provenance.git_sha,
    local_migration_head: manifest.provenance.local_migration_head,
    database_migration_head: manifest.provenance.database_migration_head,
    manifest_sha256: manifest.manifest_sha256,
    object_count: manifest.objects.length,
    storage_bucket_count: manifest.storage.buckets.length,
    storage_object_count: manifest.storage.objects.length,
    mismatch: manifest.diagnostics,
  }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(JSON.stringify({
    ok: false,
    mode: 'read_only_repeatable_read',
    error: error instanceof Error ? error.message : String(error),
  }, null, 2));
  process.exitCode = 1;
}
