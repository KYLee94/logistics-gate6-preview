const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const ROOT = path.resolve(__dirname, '..');
const MIGRATION = path.join(
  ROOT,
  'supabase',
  'migrations',
  '20260807160000_logistics_home_building_register_link_v11.sql',
);

function readMigration() {
  assert.equal(fs.existsSync(MIGRATION), true, 'v11 building-register migration is missing');
  return fs.readFileSync(MIGRATION, 'utf8');
}

test('홈 건축물대장은 자산 직접 연결을 우선하고 1㎡ 이내 면적차와 승인일은 고유 후보만 허용한다', () => {
  const sql = readMigration();
  assert.match(sql, /HOME_BUILDING_REGISTER_CACHE_LINK_V11/u);
  const deployedFragment = sql.split('$new_link$')[1] || '';
  assert.match(deployedFragment, /HOME_BUILDING_REGISTER_CACHE_LINK_V11/u, 'function replacement must retain its marker');
  assert.match(sql, /cache\.asset_id\s*=\s*v_legacy\.asset_id/iu);
  assert.match(sql, /abs\([^\n]*plat_area[^\n]*land_area_sqm[^\n]*\)\s*<=\s*1/iu);
  assert.match(sql, /abs\([^\n]*tot_area[^\n]*gross_floor_area_sqm[^\n]*\)\s*<=\s*1/iu);
  assert.match(sql, /use_apr_day/iu);
  assert.match(sql, /candidate_count\s*=\s*1/iu);
  assert.doesNotMatch(sql, /(?:asset|candidate)\.deleted_at/iu, 'legacy ll_assets has no deleted_at column');
  assert.doesNotMatch(deployedFragment, /plat_area[^\n]+is not distinct from[^\n]+land_area_sqm/iu);
  assert.doesNotMatch(deployedFragment, /tot_area[^\n]+is not distinct from[^\n]+gross_floor_area_sqm/iu);
});

test('홈 건축물 필드 provenance는 실제 값이 있을 때만 모든 필드에 기록한다', () => {
  const sql = readMigration();
  for (const field of [
    'zoning_text',
    'land_area_sqm',
    'building_area_sqm',
    'gross_area_sqm',
    'leasable_area_sqm',
    'primary_use',
    'building_coverage_ratio',
    'floor_area_ratio',
    'floor_count',
    'structure_text',
    'parking_count',
    'completion_date',
  ]) {
    assert.match(sql, new RegExp(`'${field}'`, 'iu'), `missing provenance field: ${field}`);
  }
  assert.match(sql, /nullif\(v_overrides->>'leasable_area_sqm',\s*''\)\s+is not null/iu);
  assert.match(sql, /HOME_BUILDING_REGISTER_PROVENANCE_V11/u);
});

test('자산-건축물대장 연결 backfill은 원천 행을 바꾸지 않고 cache metadata만 채운다', () => {
  const sql = readMigration();
  assert.match(sql, /update\s+public\.ll_cache_entries/iu);
  assert.match(sql, /set\s+asset_id\s*=\s*candidate\.asset_id/iu);
  assert.doesNotMatch(sql, /update\s+public\.ll_assets/iu);
  assert.doesNotMatch(sql, /insert\s+into\s+public\.ll_assets/iu);
});
