const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '..');
const migrationPath = path.join(repoRoot, 'supabase', 'migrations', '20260714130000_repair_gyeongsan_floor_count.sql');
const yangsanMigrationPath = path.join(repoRoot, 'supabase', 'migrations', '20260714131000_repair_yangsan_floor_count.sql');
const packagePath = path.join(repoRoot, 'package.json');
const floorIntegrity = require(path.join(repoRoot, 'scripts', 'qa', 'logistics-floor-count-integrity.cjs'));

test('parses master floor counts and expands supported single and range labels', () => {
  assert.deepEqual(floorIntegrity.parseFloorCount('12F / B2'), { above: 12, below: 2 });
  assert.deepEqual(floorIntegrity.expandFloorLabel('B1~8'), ['B1', '1F', '2F', '3F', '4F', '5F', '6F', '7F', '8F']);
  assert.deepEqual(floorIntegrity.expandFloorLabel('B2~3'), ['B2', 'B1', '1F', '2F', '3F']);
  assert.deepEqual(floorIntegrity.expandFloorLabel('B2~B1'), ['B2', 'B1']);
  assert.deepEqual(floorIntegrity.expandFloorLabel('B1, 3~4'), ['B1', '3F', '4F']);
  assert.deepEqual(floorIntegrity.expandFloorLabel('4'), ['4F']);
});

test('reports only expanded labels outside the master range and ignores missing or non-positional labels', () => {
  const result = floorIntegrity.collectFloorCountViolations(
    [{ asset_id: 'asset_a', floor_count: '4F / B2' }],
    [
      { lease_space_id: 'inside-range', asset_id: 'asset_a', floor_label: 'B2~3' },
      { lease_space_id: 'outside-range', asset_id: 'asset_a', floor_label: 'B2~5' },
      { lease_space_id: 'outside-comma-range', asset_id: 'asset_a', floor_label: 'B1, 3~5' },
      { lease_space_id: 'missing-label', asset_id: 'asset_a', floor_label: null },
      { lease_space_id: 'all-asset', asset_id: 'asset_a', floor_label: '전체' },
    ],
  );

  assert.deepEqual(result.violations, [{
    asset_id: 'asset_a',
    lease_space_id: 'outside-range',
    lease_id: '',
    floor_label: 'B2~5',
    expanded_floor_labels: ['B2', 'B1', '1F', '2F', '3F', '4F', '5F'],
    outside_floor_labels: ['5F'],
  }, {
    asset_id: 'asset_a',
    lease_space_id: 'outside-comma-range',
    lease_id: '',
    floor_label: 'B1, 3~5',
    expanded_floor_labels: ['B1', '3F', '4F', '5F'],
    outside_floor_labels: ['5F'],
  }]);
  assert.equal(result.ignored.floor_label_missing, 1);
  assert.equal(result.ignored.floor_label_non_positional, 1);
});

test('migration is idempotent and repairs exactly the canonical Yangsan asset without touching lease spaces', () => {
  const migration = fs.readFileSync(yangsanMigrationPath, 'utf8');
  assert.match(migration, /target_asset_id constant text := 'asset_s00002001'/u);
  assert.match(migration, /target_asset_code constant text := 'S00002001'/u);
  assert.match(migration, /target_asset_name constant text := '양산 유산동 물류센터'/u);
  assert.match(migration, /current_floor_count constant text := '1F \/ 0B'/u);
  assert.match(migration, /canonical_floor_count constant text := '3F \/ B1'/u);
  assert.match(migration, /where asset_id = target_asset_id/u);
  assert.match(migration, /and asset_code = target_asset_code/u);
  assert.match(migration, /and asset_name = target_asset_name/u);
  assert.match(migration, /and floor_count = current_floor_count/u);
  assert.doesNotMatch(migration, /ll_lease_spaces|delete\s+from|drop\s+/iu);
});

test('migration is idempotent and repairs exactly the canonical Gyeongsan asset without touching lease spaces', () => {
  const migration = fs.readFileSync(migrationPath, 'utf8');
  assert.match(migration, /canonical_floor_count constant text := '12F \/ B2'/u);
  assert.match(migration, /current_floor_count constant text := '1F \/ 0B'/u);
  assert.match(migration, /where asset_id = target_asset_id/u);
  assert.match(migration, /and asset_code = target_asset_code/u);
  assert.match(migration, /and asset_name = target_asset_name/u);
  assert.match(migration, /and floor_count = current_floor_count/u);
  assert.doesNotMatch(migration, /ll_lease_spaces/iu);
  assert.doesNotMatch(migration, /delete\s+from|drop\s+/iu);
});

test('package exposes the live floor-count integrity QA command', () => {
  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  assert.equal(packageJson.scripts['qa:floor-count:integrity'], 'node scripts/qa/logistics-floor-count-integrity.cjs');
});
