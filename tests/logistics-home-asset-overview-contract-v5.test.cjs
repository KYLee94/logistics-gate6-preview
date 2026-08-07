const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..');

function readMigration() {
  const migrationDir = path.join(ROOT, 'supabase', 'migrations');
  const candidates = fs.readdirSync(migrationDir)
    .filter((name) => /^\d+_logistics_rent_contract_terms_v5\.sql$/u.test(name))
    .sort();
  assert.equal(candidates.length, 1);
  return fs.readFileSync(path.join(migrationDir, candidates[0]), 'utf8');
}

test('home asset overview v5는 원천 없는 개요 필드를 nullable private columns로만 추가한다', () => {
  const sql = readMigration();
  assert.match(sql, /alter table logistics_core\.assets[\s\S]*add column if not exists zoning_text text[\s\S]*add column if not exists building_area_sqm numeric[\s\S]*add column if not exists primary_use text[\s\S]*add column if not exists building_coverage_ratio numeric[\s\S]*add column if not exists floor_area_ratio numeric[\s\S]*add column if not exists structure_text text[\s\S]*add column if not exists parking_count integer[\s\S]*add column if not exists completion_date date/iu);
  assert.doesNotMatch(sql, /update logistics_core\.assets[\s\S]*(?:zoning_text|building_area_sqm|primary_use|building_coverage_ratio|floor_area_ratio|structure_text|parking_count|completion_date)\s*=/iu);
  assert.doesNotMatch(sql, /(?:alter|drop|truncate)\s+table\s+public\.ll_assets/iu);
});

test('home read/save v5는 8개 개요 필드를 허용하고 감사·호환 투영·readback을 수행한다', () => {
  const sql = readMigration();
  for (const field of [
    'zoning_text', 'building_area_sqm', 'primary_use', 'building_coverage_ratio',
    'floor_area_ratio', 'structure_text', 'parking_count', 'completion_date',
  ]) {
    assert.match(sql, new RegExp(`'${field}'`, 'u'));
  }
  assert.match(sql, /home_read_entry_v5/iu);
  assert.match(sql, /home_batch_save_entry_v5/iu);
  assert.match(sql, /logistics_core\.set_core_field/iu);
  assert.match(sql, /insert into logistics_core\.audit_events/iu);
  assert.match(sql, /data_platform_overrides/iu);
  assert.match(sql, /jsonb_set[\s\S]*source_payload/iu);
  assert.match(sql, /HOME_ASSET_OVERVIEW_READBACK_MISMATCH/iu);
  assert.match(sql, /update logistics_core\.api_idempotency_keys/iu);
});
