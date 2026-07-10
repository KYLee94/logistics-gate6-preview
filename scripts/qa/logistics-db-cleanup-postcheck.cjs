const path = require('node:path');

const {
  compareManifests,
  defaultArtifactPath,
  parseArgs,
  readJson,
  writeJson,
} = require('../lib/logistics-db-cleanup-core.cjs');

function required(args, key, flag) {
  if (!args[key]) throw new Error(`${flag} is required.`);
  return args[key];
}

function main() {
  const args = parseArgs();
  const pre = readJson(required(args, 'preManifest', '--pre-manifest'));
  const post = readJson(required(args, 'postManifest', '--post-manifest'));
  const delta = readJson(required(args, 'approvedDelta', '--approved-delta'));
  const report = compareManifests(pre, post, delta);
  const outputPath = path.resolve(args.out || defaultArtifactPath('postcheck'));
  writeJson(outputPath, report);
  console.log(JSON.stringify({
    ok: report.ok,
    output: outputPath,
    project_ref: report.project_ref,
    approved_drops: report.approved_drops,
    protected_object_count: report.protected_object_count,
    violations: report.violations,
  }, null, 2));
  if (!report.ok) process.exitCode = 1;
}

try {
  main();
} catch (error) {
  console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }, null, 2));
  process.exitCode = 1;
}
