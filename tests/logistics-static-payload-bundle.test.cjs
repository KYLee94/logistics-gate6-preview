const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const WORKSPACE_PATH = path.join(ROOT, 'src', 'components', 'system', 'workspace', 'WorkspaceLogistics.jsx');
const DIST_ASSETS_PATH = path.join(ROOT, 'dist', 'assets');

test('static asset and tenant detail payloads are not bundled', () => {
  const source = fs.readFileSync(WORKSPACE_PATH, 'utf8');
  assert.doesNotMatch(source, /import\.meta\.glob\(['"]\.\/logisticsAssetData\/\*\.json['"]\)/u);
  assert.doesNotMatch(source, /import\.meta\.glob\(['"]\.\/logisticsCompanyData\/\*\.json['"]\)/u);
  assert.ok(fs.existsSync(DIST_ASSETS_PATH), 'Run the production build before this bundle regression test.');

  const detailedChunks = fs.readdirSync(DIST_ASSETS_PATH)
    .filter((name) => /^(?:asset|tenant)_[^.]+\.js$/u.test(name));
  assert.deepEqual(detailedChunks, [], `Static detail chunks must not be emitted: ${detailedChunks.join(', ')}`);
});
