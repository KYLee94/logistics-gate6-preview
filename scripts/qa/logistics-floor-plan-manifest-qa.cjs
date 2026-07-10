const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const DEFAULT_MANIFEST = path.join(ROOT, 'scripts', 'ops', 'logistics-floor-plan-ingest-manifest.json');

function argumentValue(name, fallback = '') {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] || '' : fallback;
}

function check(checks, name, value) {
  checks[name] = Boolean(value);
}

function planKeys(asset) {
  return (asset.plans || []).map((plan) => plan.floor_key);
}

function main() {
  const manifestPath = path.resolve(argumentValue('--manifest', DEFAULT_MANIFEST));
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const checks = {};
  const assets = Array.isArray(manifest.assets) ? manifest.assets : [];
  const gyeongsan = assets.find((asset) => asset.asset_code === 'A120085001');
  const incheon = assets.find((asset) => asset.asset_code === 'A112721001');
  const expectedGyeongsan = ['B2', 'B1', '1F', '2F', '3F', '4F', '5F', '6F', '7F', '8F', '9F', '10F', '11F', '12F'];
  const expectedIncheon = ['B1', '1F', '2F', '3F', '4F', '5F', '6F', '7F', '8F', 'ROOF'];
  const allPlans = assets.flatMap((asset) => (asset.plans || []).map((plan) => ({ asset, plan })));
  const duplicateKeys = allPlans
    .map(({ asset, plan }) => `${asset.asset_code}:${plan.floor_key}`)
    .filter((key, index, array) => array.indexOf(key) !== index);
  const incheonUnresolved = (incheon?.plans || []).filter((plan) => !Number.isInteger(plan.source?.physical_page_number));

  check(checks, 'manifest_version_1', manifest.version === 1);
  check(checks, 'canonical_storage_bucket_present', typeof manifest.storage_bucket === 'string' && manifest.storage_bucket.length > 0);
  check(checks, 'two_target_assets', assets.length === 2 && gyeongsan && incheon);
  check(checks, 'gyeongsan_floor_coverage', JSON.stringify(planKeys(gyeongsan)) === JSON.stringify(expectedGyeongsan));
  check(checks, 'incheon_floor_coverage', JSON.stringify(planKeys(incheon)) === JSON.stringify(expectedIncheon));
  check(checks, 'no_duplicate_asset_floor_keys', duplicateKeys.length === 0);
  check(checks, 'gyeongsan_source_files_exist', (gyeongsan?.plans || []).every((plan) => fs.existsSync(plan.source?.path || '')));
  check(checks, 'incheon_source_file_exists', (incheon?.plans || []).every((plan) => fs.existsSync(plan.source?.path || '')));
  check(checks, 'incheon_unresolved_pages_are_explicit', incheonUnresolved.length === expectedIncheon.length);
  check(checks, 'all_staged_images_are_relative_png_paths', allPlans.every(({ plan }) => /^[a-z0-9][a-z0-9_/-]*\.png$/u.test(plan.staged_image || '')));

  const report = {
    ok: Object.values(checks).every(Boolean),
    manifest: manifestPath,
    planned_registration_count: allPlans.length,
    ready_for_apply: incheonUnresolved.length === 0,
    incheon_physical_page_blocker_count: incheonUnresolved.length,
    checks,
  };
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exit(1);
}

main();
