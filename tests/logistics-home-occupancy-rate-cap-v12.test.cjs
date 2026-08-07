const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const ROOT = path.resolve(__dirname, '..');
const MIGRATION = path.join(
  ROOT,
  'supabase',
  'migrations',
  '20260807170000_logistics_home_occupancy_rate_cap_v12.sql',
);

test('홈 임대율은 원본 면적을 보존한 채 API 표시값만 0~100%로 제한한다', () => {
  assert.equal(fs.existsSync(MIGRATION), true, 'v12 occupancy-rate migration is missing');
  const sql = fs.readFileSync(MIGRATION, 'utf8');
  assert.match(sql, /HOME_OCCUPANCY_RATE_CAP_V12/u);
  assert.match(sql, /least\(100::numeric/iu);
  assert.match(sql, /greatest\(0::numeric/iu);
  assert.match(sql, /round\(v_occupied_area\s*\/\s*v_space_denominator\s*\*\s*100,\s*2\)/iu);
  assert.doesNotMatch(sql, /update\s+(?:logistics_core\.)?(?:spaces|contract_spaces|lease_contracts)/iu);
});
