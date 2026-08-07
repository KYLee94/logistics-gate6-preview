const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { pathToFileURL } = require('node:url');

const ROOT = path.resolve(__dirname, '..');

async function importFresh(relativePath) {
  const target = path.join(ROOT, relativePath);
  return import(`${pathToFileURL(target).href}?test=${Date.now()}-${Math.random()}`);
}

function readMigration() {
  const migrationDir = path.join(ROOT, 'supabase', 'migrations');
  const candidates = fs.readdirSync(migrationDir)
    .filter((name) => /^\d+_logistics_rent_contract_terms_v5\.sql$/u.test(name))
    .sort();
  assert.equal(candidates.length, 1, '렌트프리·fit-out·인상률 계약 migration은 정확히 한 개여야 합니다.');
  return fs.readFileSync(path.join(migrationDir, candidates[0]), 'utf8');
}

test('v2 rent-roll API는 인상률 단위와 옵션 원문을 정규화하고 복수 렌트프리·fit-out 날짜를 검증한다', async () => {
  const router = await importFresh('supabase/functions/ll-dashboard-api/v2/router.ts');
  const request = router.buildRpcArguments('v2/rent-roll/batch-save', {
    client_request_id: '11111111-1111-4111-8111-111111111111',
    asset_key: 'asset-a',
    payload: {
      rows: [{
        operation: 'update',
        row_key: 'space-a',
        rent_escalation_rate: '0.03',
        cam_escalation_rate: '3',
        renewal_terms: 'N',
        termination_terms: 'no',
        fit_out_start_date: '2026-01-01',
        fit_out_end_date: '2026-02-28',
        rent_free_periods: [
          { start_date: '2026-03-01', end_date: '2026-03-31', months: 1, reason: '오픈 지원', notes: '원문 보존' },
          { months: 2, reason: '재계약 인센티브' },
        ],
      }],
    },
  });

  const [row] = request.p_payload.rows;
  assert.equal(row.rent_escalation_rate, '3%');
  assert.equal(row.cam_escalation_rate, '3%');
  assert.equal(row.renewal_terms, '없음');
  assert.equal(row.termination_terms, '없음');
  assert.equal(row.rent_free_periods.length, 2);
  assert.equal(row.fit_out_start_date, '2026-01-01');

  const [positiveOption] = router.buildRpcArguments('v2/rent-roll/batch-save', {
    client_request_id: '44444444-4444-4444-8444-444444444444',
    payload: { rows: [{ operation: 'update', row_key: 'x', renewal_terms: 'Y', termination_terms: 'yes' }] },
  }).p_payload.rows;
  assert.equal(positiveOption.renewal_terms, '있음');
  assert.equal(positiveOption.termination_terms, '있음');

  const [wholePercent] = router.buildRpcArguments('v2/rent-roll/batch-save', {
    client_request_id: '55555555-5555-4555-8555-555555555555',
    payload: { rows: [{ operation: 'update', row_key: 'x', rent_escalation_rate: '30', cam_escalation_rate: '100' }] },
  }).p_payload.rows;
  assert.equal(wholePercent.rent_escalation_rate, '30%');
  assert.equal(wholePercent.cam_escalation_rate, '100%');

  assert.throws(() => router.buildRpcArguments('v2/rent-roll/batch-save', {
    client_request_id: '22222222-2222-4222-8222-222222222222',
    payload: { rows: [{ operation: 'update', row_key: 'x', fit_out_start_date: '2026-03-01', fit_out_end_date: '2026-02-01' }] },
  }), /FIT_OUT_DATE_RANGE_INVALID/u);
  assert.throws(() => router.buildRpcArguments('v2/rent-roll/batch-save', {
    client_request_id: '33333333-3333-4333-8333-333333333333',
    payload: { rows: [{ operation: 'update', row_key: 'x', rent_free_periods: [{ start_date: 'invalid' }] }] },
  }), /INVALID_RENT_FREE_PERIOD/u);
});

test('private additive schema는 계약별 복수 렌트프리 원본·현재값·provenance와 fit-out 날짜를 보존한다', () => {
  const sql = readMigration();

  assert.match(sql, /create table logistics_core\.lease_rent_free_periods/iu);
  for (const field of ['contract_id', 'source_rent_term_id', 'sequence_no', 'start_date', 'end_date', 'months', 'reason', 'notes', 'original_source_payload', 'current_source_payload', 'provenance', 'revision', 'deleted_at']) {
    assert.match(sql, new RegExp(`\\b${field}\\b`, 'u'));
  }
  assert.match(sql, /alter table logistics_core\.rent_terms[\s\S]*add column if not exists fit_out_start_date date[\s\S]*add column if not exists fit_out_end_date date/iu);
  assert.match(sql, /alter table logistics_core\.lease_rent_free_periods enable row level security/iu);
  assert.match(sql, /revoke all on table logistics_core\.lease_rent_free_periods from public, anon, authenticated/iu);
  assert.doesNotMatch(sql, /(?:alter|drop|truncate)\s+table\s+public\.ll_/iu);
});

test('운영 인상률은 모든 active rent term을 1행씩 감사하고 fraction과 percent를 중복 보정하지 않는다', () => {
  const sql = readMigration();

  assert.match(sql, /create table logistics_core\.rent_escalation_normalization_audit/iu);
  assert.match(sql, /normalization_version[\s\S]*rent_before[\s\S]*rent_after[\s\S]*rent_provenance[\s\S]*cam_before[\s\S]*cam_after[\s\S]*cam_provenance/iu);
  assert.match(sql, /create or replace function logistics_core\.normalize_escalation_rate_percent\(raw_value text\)/iu);
  assert.match(sql, /security invoker[\s\S]*set search_path = pg_catalog/iu);
  assert.match(sql, /not v_has_percent and v_numeric > 0 and v_numeric < 1[\s\S]*v_numeric \* 100/iu);
  assert.match(sql, /fraction_to_percent/iu);
  assert.match(sql, /explicit_percent/iu);
  assert.match(sql, /percent_number/iu);
  assert.match(sql, /position\('\.' in v_numeric_text\) > 0/iu);
  assert.match(sql, /RATE_NORMALIZATION_AUDIT_ROW_COUNT_MISMATCH/iu);
  assert.match(sql, /RATE_NORMALIZATION_EXCEPTION/iu);
  assert.match(sql, /normalization_version = 'gate6-percent-v1'/iu);
});

test('read/save projection은 신규 필드와 없음 normalization을 왕복하고 기존 상세 writer를 감싼다', () => {
  const sql = readMigration();

  assert.match(sql, /rent_roll_read_entry_v5/iu);
  assert.match(sql, /rent_roll_batch_save_entry_v5/iu);
  assert.match(sql, /'rent_free_periods'/iu);
  assert.match(sql, /'fit_out_start_date'/iu);
  assert.match(sql, /'fit_out_end_date'/iu);
  assert.match(sql, /normalize_option_term/iu);
  assert.match(sql, /lower\(btrim\(raw_value\)\) in \('n', 'no'\)[\s\S]*then '없음'/iu);
  assert.match(sql, /lower\(btrim\(raw_value\)\) in \('y', 'yes'\)[\s\S]*then '있음'/iu);
  assert.match(sql, /RENT_FREE_PERIODS_ARRAY_REQUIRED/iu);
  assert.match(sql, /RENT_FREE_PERIOD_LIMIT_EXCEEDED/iu);
  assert.match(sql, /update logistics_core\.api_idempotency_keys/iu);
  assert.match(sql, /READBACK_MISMATCH/iu);
});
