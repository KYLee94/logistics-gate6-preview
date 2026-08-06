const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const MIGRATIONS_DIR = path.join(ROOT, 'supabase', 'migrations');

function readSyncMigration() {
  const candidates = fs.readdirSync(MIGRATIONS_DIR)
    .filter((name) => /^\d+_sync_logistics_core_maturity_projection\.sql$/u.test(name))
    .sort();

  assert.equal(candidates.length, 1, '만기 원천 동기화 migration은 정확히 한 개여야 합니다.');
  return fs.readFileSync(path.join(MIGRATIONS_DIR, candidates[0]), 'utf8');
}

test('임대차·펀드·대출 원천 변경은 기존 maturity key와 상세 조인을 보존하며 projection을 동기화한다', () => {
  const sql = readSyncMigration();

  assert.match(sql, /create or replace function logistics_core\.sync_maturity_projection\s*\(/iu);
  assert.match(sql, /language plpgsql[\s\S]*security invoker[\s\S]*set search_path = pg_catalog/iu);
  assert.doesNotMatch(sql, /security definer/iu);
  assert.doesNotMatch(sql, /create\s+table\s+public\./iu);
  assert.doesNotMatch(sql, /create or replace function logistics_core\.maturities_read_entry/iu);

  assert.match(sql, /from logistics_core\.lease_contracts contract[\s\S]*contract\.expiry_date/iu);
  assert.match(sql, /left join logistics_core\.tenants tenant/iu);
  assert.match(sql, /tenant\.legal_name_ko/iu);
  assert.match(sql, /from logistics_core\.funds fund[\s\S]*fund\.maturity_date/iu);
  assert.match(sql, /from logistics_core\.loans loan[\s\S]*loan\.maturity_date/iu);
  assert.match(sql, /coalesce\(nullif\(btrim\(loan\.tranche_name\), ''\), nullif\(btrim\(loan\.name_ko\), ''\)/iu);

  assert.match(sql, /'lease_maturity_'\s*\|\|\s*v_source_key/iu);
  assert.match(sql, /'fund_maturity_'\s*\|\|\s*v_source_key/iu);
  assert.match(sql, /'loan_maturity_'\s*\|\|\s*v_loan_source_tranche_id::text/iu);
  assert.match(sql, /on conflict \(maturity_key\) do update/iu);
  assert.match(sql, /is distinct from/iu);
});

test('INSERT·UPDATE·DELETE와 soft-delete는 maturity 및 자산 scope를 멱등 갱신·비활성화한다', () => {
  const sql = readSyncMigration();

  for (const table of ['lease_contracts', 'funds', 'loans']) {
    assert.match(
      sql,
      new RegExp(`create trigger ${table}_sync_maturity_projection[\\s\\S]*after insert or update or delete on logistics_core\\.${table}`, 'iu'),
    );
  }

  assert.match(sql, /v_source_deleted_at is not null\s+or\s+v_official_date is null/iu);
  assert.match(sql, /v_source_is_active is false/iu);
  assert.match(sql, /status = 'cancelled'[\s\S]*deleted_at = coalesce\(v_source_deleted_at, clock_timestamp\(\)\)/iu);
  assert.match(sql, /status = 'active'[\s\S]*deleted_at = null[\s\S]*deleted_by = null/iu);
  assert.match(sql, /update logistics_core\.maturity_asset_scopes[\s\S]*retired_at = clock_timestamp\(\)/iu);
  assert.match(sql, /insert into logistics_core\.maturity_asset_scopes[\s\S]*on conflict \(maturity_id, asset_id\) where retired_at is null do nothing/iu);
});

test('migration은 기존 행을 재동기화하고 불일치를 차단하며 함수 직접 실행 권한을 노출하지 않는다', () => {
  const sql = readSyncMigration();

  assert.match(sql, /for source_row in[\s\S]*logistics_core\.lease_contracts/iu);
  assert.match(sql, /for source_row in[\s\S]*logistics_core\.funds/iu);
  assert.match(sql, /for source_row in[\s\S]*logistics_core\.loans/iu);
  assert.match(sql, /MATURITY_SOURCE_SYNC_VALIDATION_FAILED/iu);
  assert.match(sql, /revoke execute on function logistics_core\.sync_maturity_projection\(text, uuid\) from public, anon, authenticated/iu);
  assert.match(sql, /^begin;/iu);
  assert.match(sql, /commit;\s*$/iu);
});
