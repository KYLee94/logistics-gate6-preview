const path = require('node:path');

const {
  PRODUCTION_PROJECT_REF,
  buildRollbackDrillContract,
  defaultArtifactPath,
  parseArgs,
  readJson,
  verifyManifest,
  writeJson,
} = require('../lib/logistics-db-cleanup-core.cjs');

function required(args, key, flag) {
  if (!args[key]) throw new Error(`${flag} is required.`);
  return args[key];
}

function main() {
  const args = parseArgs();
  const manifestPath = required(args, 'manifest', '--manifest');
  const deltaPath = required(args, 'approvedDelta', '--approved-delta');
  const projectRef = required(args, 'projectRef', '--project-ref');
  const environment = required(args, 'environment', '--environment');
  const manifest = readJson(manifestPath);
  const manifestValidation = verifyManifest(manifest);
  if (!manifestValidation.ok) throw new Error(`Manifest validation failed: ${manifestValidation.errors.join('; ')}`);
  const delta = readJson(deltaPath);
  const contract = buildRollbackDrillContract(manifest, delta, {
    environment,
    projectRef,
    productionProjectRef: args.productionProjectRef || PRODUCTION_PROJECT_REF,
  });
  const outputPath = path.resolve(args.out || defaultArtifactPath('rehearsal'));
  writeJson(outputPath, contract);
  console.log(JSON.stringify({
    ok: contract.ok,
    mode: 'manifest_only_staging_rehearsal',
    output: outputPath,
    project_ref: contract.project_ref,
    production_forbidden: contract.production_forbidden,
    approved_operation_count: contract.approved_operation_count,
    blockers: contract.blockers,
  }, null, 2));
  if (!contract.ok) process.exitCode = 1;
}

try {
  main();
} catch (error) {
  console.error(JSON.stringify({ ok: false, mode: 'manifest_only_staging_rehearsal', error: error instanceof Error ? error.message : String(error) }, null, 2));
  process.exitCode = 1;
}
