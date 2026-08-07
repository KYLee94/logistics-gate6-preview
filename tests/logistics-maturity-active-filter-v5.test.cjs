const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..');

function readMigration() {
  const migrationDir = path.join(ROOT, 'supabase', 'migrations');
  const candidates = fs.readdirSync(migrationDir)
    .filter((name) => /^\d+_logistics_rent_contract_terms_v5\.sql$/u.test(name));
  assert.equal(candidates.length, 1);
  return fs.readFileSync(path.join(migrationDir, candidates[0]), 'utf8');
}

test('maturities/read 반환 목록과 인앱 알림은 active source만 포함한다', () => {
  const sql = readMigration();
  assert.match(sql, /maturities_read_entry_v2/iu);
  assert.match(sql, /row_item\.value->>'status'\s*=\s*'active'/iu);
  assert.match(sql, /from logistics_core\.maturities maturity[\s\S]*maturity\.status\s*=\s*'active'/iu);
  assert.match(sql, /notification\.dedupe_key like 'v2:maturity:' \|\| maturity\.maturity_key \|\| ':%'/iu);
  assert.match(sql, /'delivery_channel',\s*'in_app_only'/iu);
});
