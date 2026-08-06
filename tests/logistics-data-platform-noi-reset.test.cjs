const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const migrationPath = path.resolve(
  __dirname,
  '../supabase/migrations/20260806060000_clear_all_noi_values.sql',
);
const liveSmokePath = path.resolve(
  __dirname,
  '../scripts/qa/logistics-data-platform-live-smoke.cjs',
);

test('전체 자산 NOI 값은 계정 서식을 남기고 월별 입력값과 조정값만 soft delete 한다', () => {
  assert.ok(fs.existsSync(migrationPath), 'NOI 초기화 migration이 필요합니다.');
  const sql = fs.readFileSync(migrationPath, 'utf8');
  assert.match(sql, /update logistics_core\.ledger_adjustments[\s\S]*deleted_at = clock_timestamp\(\)/iu);
  assert.match(sql, /update logistics_core\.monthly_ledger_entries[\s\S]*deleted_at = clock_timestamp\(\)/iu);
  assert.doesNotMatch(sql, /delete\s+from\s+logistics_core\.cashflow_accounts/iu);
  assert.match(sql, /NOI_RESET_ACTIVE_ENTRIES_REMAIN/u);
});

test('렌트롤 저장은 담당자가 비운 NOI 값을 다시 자동 생성하지 않는다', () => {
  const sql = fs.readFileSync(migrationPath, 'utf8');
  assert.match(sql, /create or replace function logistics_core\.sync_rent_roll_finance/iu);
  assert.match(sql, /return 0;/u);
  assert.doesNotMatch(sql, /insert into logistics_core\.monthly_ledger_entries/iu);
});

test('운영 검증은 전체 자산·전체 시나리오·전체 회계기준의 활성 금액 0건을 확인한다', () => {
  const smoke = fs.readFileSync(liveSmokePath, 'utf8');
  assert.match(smoke, /all-finance-empty-readback/u);
  assert.match(smoke, /\['actual', 'budget', 'forecast'\]/u);
  assert.match(smoke, /\['accrual', 'cash'\]/u);
  assert.match(smoke, /active_entries, 0/u);
});
