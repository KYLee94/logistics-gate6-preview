const fs = require('node:fs');
const path = require('node:path');

const {
  PRODUCTION_PROJECT_REF,
  parseArgs,
  readJson,
  readLinkedProjectRef,
  runSupabaseDbQuery,
  validateApprovedDelta,
  verifyManifest,
} = require('../lib/logistics-db-cleanup-core.cjs');
const { buildApplySql } = require('../lib/logistics-db-cleanup-sql.cjs');

function required(args, key, flag) {
  if (!args[key]) throw new Error(`${flag} is required.`);
  return args[key];
}

function assertApplyGuards(args, manifest, delta) {
  if (process.env.CI || process.env.GITHUB_ACTIONS) throw new Error('--apply is forbidden in CI and automatic release environments.');
  const projectRef = required(args, 'projectRef', '--project-ref');
  const expectedCount = Number(required(args, 'expectedCount', '--expected-count'));
  const manifestSha = required(args, 'manifestSha', '--manifest-sha');
  const environment = required(args, 'environment', '--environment');
  if (!Number.isInteger(expectedCount) || expectedCount < 0) throw new Error('--expected-count must be a non-negative integer.');
  if (projectRef !== manifest.provenance.project_ref || projectRef !== delta.project_ref) throw new Error('--project-ref does not match manifest and approved delta.');
  if (manifestSha !== manifest.manifest_sha256) throw new Error('--manifest-sha does not match the pre-manifest.');
  if (expectedCount !== delta.operations.length) throw new Error('--expected-count does not match approved operation count.');
  const linkedProjectRef = readLinkedProjectRef();
  if (!linkedProjectRef || linkedProjectRef !== projectRef) throw new Error(`Linked project ref ${linkedProjectRef || '(missing)'} does not match --project-ref ${projectRef}.`);
  if (!['staging', 'production'].includes(environment)) throw new Error('--environment must be staging or production.');
  if (environment === 'production') {
    if (args.confirmProductionRef !== projectRef) throw new Error('--confirm-production-ref must exactly match --project-ref for production apply.');
    const rehearsal = readJson(required(args, 'rehearsalReport', '--rehearsal-report'));
    if (!rehearsal.ok || rehearsal.environment !== 'staging' || rehearsal.production_forbidden !== true) throw new Error('A successful staging rehearsal report is required before production apply.');
    if (rehearsal.pre_manifest_sha256 !== manifest.manifest_sha256) throw new Error('Staging rehearsal manifest SHA does not match the pre-manifest.');
  } else if (projectRef === (args.productionProjectRef || PRODUCTION_PROJECT_REF)) {
    throw new Error('A staging apply cannot target the production project ref.');
  }
  return { projectRef, expectedCount, manifestSha, environment };
}

function main() {
  const args = parseArgs();
  const manifest = readJson(required(args, 'preManifest', '--pre-manifest'));
  const delta = readJson(required(args, 'approvedDelta', '--approved-delta'));
  const manifestValidation = verifyManifest(manifest);
  if (!manifestValidation.ok) throw new Error(`Pre-manifest validation failed: ${manifestValidation.errors.join('; ')}`);
  const deltaValidation = validateApprovedDelta(delta, manifest);
  if (!deltaValidation.ok) throw new Error(`Approved delta validation failed: ${deltaValidation.errors.join('; ')}`);
  const sql = buildApplySql(manifest, delta);
  if (args.outSql) {
    const outputPath = path.resolve(args.outSql);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, sql, 'utf8');
  }

  if (args.apply !== true) {
    console.log(JSON.stringify({
      ok: true,
      mode: 'dry_run',
      apply_executed: false,
      project_ref: manifest.provenance.project_ref,
      manifest_sha256: manifest.manifest_sha256,
      approved_operation_count: delta.operations.length,
      generated_sql_has_forbidden_drop_mode: /\bdrop\b[^;]+\bcascade\b/iu.test(sql),
      generated_sql_drop_restrict_count: (sql.match(/\bdrop\s+(?:materialized\s+view|view|table)\b[^;]+\brestrict\s*;/giu) || []).length,
      out_sql: args.outSql ? path.resolve(args.outSql) : null,
    }, null, 2));
    if (!args.outSql) process.stdout.write(`\n${sql}`);
    return;
  }

  const guards = assertApplyGuards(args, manifest, delta);
  const rows = runSupabaseDbQuery(sql, { prefix: 'gate6-db-cleanup-apply', timeoutMs: 10 * 60 * 1000 });
  console.log(JSON.stringify({
    ok: true,
    mode: 'apply',
    apply_executed: true,
    project_ref: guards.projectRef,
    environment: guards.environment,
    manifest_sha256: guards.manifestSha,
    approved_operation_count: guards.expectedCount,
    database_result: rows,
  }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(JSON.stringify({ ok: false, apply_executed: false, error: error instanceof Error ? error.message : String(error) }, null, 2));
  process.exitCode = 1;
}
