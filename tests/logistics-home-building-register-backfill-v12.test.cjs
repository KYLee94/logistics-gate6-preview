const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..');

function readMigration() {
  const candidates = fs.readdirSync(path.join(ROOT, 'supabase', 'migrations'))
    .filter((name) => /^\d+_logistics_home_building_register_backfill_v12\.sql$/u.test(name));
  assert.equal(candidates.length, 1, 'building-register v12 migration must exist exactly once');
  return fs.readFileSync(path.join(ROOT, 'supabase', 'migrations', candidates[0]), 'utf8');
}

test('v12는 공식 대장 16자산 중 현재 누락된 6개 자산의 주 건물 값만 보완한다', () => {
  const sql = readMigration();
  assert.match(sql, /LOGISTICS_HOME_BUILDING_REGISTER_BACKFILL_V12/iu);
  for (const code of ['A112755001', 'A112299001', 'A112505001', 'A112500003', 'A112721001', 'A112642001']) {
    assert.match(sql, new RegExp(`'${code}'`, 'u'));
  }
  for (const value of ['31919.43', '24075.12', '29845.16', '30823.89', '37407.23', '29633.14']) {
    assert.match(sql, new RegExp(value.replace('.', '\\.'), 'u'));
  }
  assert.match(sql, /프리케스트콘크리트구조/iu);
  assert.match(sql, /철골철근콘크리트합성구조/iu);
  assert.match(sql, /coalesce\(asset\.building_area_sqm,\s*source\.building_area_sqm\)/iu);
  assert.match(sql, /HOME_BUILDING_REGISTER_SOURCE_CONFLICT/iu);
  assert.match(sql, /HOME_BUILDING_REGISTER_READBACK_MISMATCH/iu);
});

test('v12는 기존 사용자 값을 덮지 않고 대장 비대상 필드를 만들지 않는다', () => {
  const sql = readMigration();
  assert.doesNotMatch(sql, /set\s+(?:zoning_text|leasable_area_sqm|land_area_sqm|gross_area_sqm|floor_count|completion_date)\s*=/iu);
  assert.doesNotMatch(sql, /(?:create|alter|drop)\s+table\s+public\./iu);
  assert.match(sql, /visible_asset_count\s*<>\s*17/iu);
  assert.match(sql, /source_row_count\s*<>\s*8/iu);
});

test('포천 정교리는 개발 중 예외로 고정하고 대장·준공값을 추정하지 않는다', () => {
  const sql = readMigration();
  assert.match(sql, /A190013001[\s\S]*development[\s\S]*no building register/iu);
  assert.match(sql, /where asset_code = 'A190013001'[\s\S]*completion_date is null/iu);
  assert.match(sql, /HOME_DEVELOPMENT_STATUS_MISMATCH/iu);
  assert.match(sql, /A190013001 completion_date is not null/iu);
  assert.doesNotMatch(sql, /\('A190013001'\s*,\s*\d/iu);
});

test('주차대수는 대장 또는 사용자 제공 스펙 근거가 있는 세 자산만 채운다', () => {
  const sql = readMigration();
  assert.match(sql, /A112505001[\s\S]*415[\s\S]*user_reference_workbook/iu);
  assert.match(sql, /A112721001[\s\S]*416[\s\S]*user_reference_workbook/iu);
  assert.match(sql, /A112642001[\s\S]*441[\s\S]*official_building_register/iu);
});
