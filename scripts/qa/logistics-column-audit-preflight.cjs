const path = require('node:path');

const {
  collectAudit,
  defaultArtifactPath,
  parseArgs,
  verifyManifest,
  writeJson,
} = require('../lib/logistics-column-audit-core.cjs');

function assertAllowedArgs(args) {
  const allowed = new Set(['_', 'dryRun', 'out', 'timeoutMs', 'projectRef']);
  const unsupported = Object.keys(args).filter((key) => !allowed.has(key));
  if (unsupported.length) throw new Error(`Unsupported option(s): ${unsupported.join(', ')}. This audit has no apply or delete mode.`);
}

function main() {
  const args = parseArgs();
  assertAllowedArgs(args);
  const timeoutMs = Number(args.timeoutMs || 120000);
  if (!Number.isFinite(timeoutMs) || timeoutMs < 1000) throw new Error('--timeout-ms must be at least 1000.');
  const manifest = collectAudit({ dryRun: args.dryRun === true, timeoutMs, projectRef: args.projectRef || undefined });
  const validation = verifyManifest(manifest);
  if (!validation.ok) throw new Error(`Generated manifest validation failed: ${validation.errors.join('; ')}`);
  const output = path.resolve(args.out || defaultArtifactPath());
  writeJson(output, manifest);
  console.log(JSON.stringify({
    execution_ok: true,
    safety_gate: manifest.safety_gate,
    dry_run: manifest.execution.dry_run,
    database_snapshot_status: manifest.snapshot.status,
    project_ref: manifest.provenance.project_ref,
    output,
    summary: manifest.summary,
    manifest_sha256: manifest.manifest_sha256,
  }, null, 2));
  // A real preflight intentionally fails while the immutable hold gate is active.
  if (!manifest.execution.dry_run) process.exitCode = 1;
}

try {
  main();
} catch (error) {
  console.error(JSON.stringify({ execution_ok: false, safety_gate: { decision: 'hold', operation: 'none' }, error: error instanceof Error ? error.message : String(error) }, null, 2));
  process.exitCode = 1;
}
