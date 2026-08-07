const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { pathToFileURL } = require('node:url');

const ROOT = path.resolve(__dirname, '..');

async function importFresh(relativePath) {
  const target = path.join(ROOT, relativePath);
  return import(`${pathToFileURL(target).href}?test=${Date.now()}-${Math.random()}`);
}

test('deposit, rent, and CAM escalation inputs share the canonical 3% text contract', async () => {
  const router = await importFresh('supabase/functions/ll-dashboard-api/v2/router.ts');
  const request = router.buildRpcArguments('v2/rent-roll/batch-save', {
    client_request_id: '10101010-1010-4010-8010-101010101010',
    asset_key: 'asset-a',
    payload: {
      rows: [{
        operation: 'update',
        row_key: 'space-a',
        deposit_escalation_rate: 0.03,
        rent_escalation_rate: 3,
        cam_escalation_rate: '3%',
      }],
    },
  });

  assert.equal(request.p_payload.rows[0].deposit_escalation_rate, '3%');
  assert.equal(request.p_payload.rows[0].rent_escalation_rate, '3%');
  assert.equal(request.p_payload.rows[0].cam_escalation_rate, '3%');

  const sql = readMigration();
  assert.match(sql, /create or replace function logistics_core\.normalize_deposit_escalation_row/iu);
  assert.match(sql, /normalize_escalation_rate_percent\(p_row->>'deposit_escalation_rate'\)/iu);
  assert.match(sql, /jsonb_agg\([\s\S]*normalize_deposit_escalation_row\(/iu);
  assert.match(sql, /for v_input_row[\s\S]*v_input_row := logistics_core\.normalize_deposit_escalation_row\(v_input_row\)/iu);
});

function readMigration() {
  const migrationDir = path.join(ROOT, 'supabase', 'migrations');
  const candidates = fs.readdirSync(migrationDir)
    .filter((name) => /^\d+_logistics_editable_contracts_v6\.sql$/u.test(name))
    .sort();
  assert.equal(candidates.length, 1, 'editable contract v6 migration은 정확히 한 개여야 합니다.');
  return fs.readFileSync(path.join(migrationDir, candidates[0]), 'utf8');
}

function readRentTermFallbackMigration() {
  const migrationDir = path.join(ROOT, 'supabase', 'migrations');
  const candidates = fs.readdirSync(migrationDir)
    .filter((name) => /^\d+_logistics_rent_term_key_fallback_v7\.sql$/u.test(name))
    .sort();
  assert.equal(candidates.length, 1, 'rent-term key fallback v7 migration must be unique');
  return fs.readFileSync(path.join(migrationDir, candidates[0]), 'utf8');
}

function readSharedLenderRevisionMigration() {
  const migrationDir = path.join(ROOT, 'supabase', 'migrations');
  const candidates = fs.readdirSync(migrationDir)
    .filter((name) => /^\d+_logistics_home_shared_lender_revision_v8\.sql$/u.test(name))
    .sort();
  assert.equal(candidates.length, 1, 'shared lender revision v8 migration must be unique');
  return fs.readFileSync(path.join(migrationDir, candidates[0]), 'utf8');
}

function readSharedLenderRevisionCompatMigration() {
  const migrationDir = path.join(ROOT, 'supabase', 'migrations');
  const candidates = fs.readdirSync(migrationDir)
    .filter((name) => /^\d+_logistics_home_shared_lender_revision_compat_v9\.sql$/u.test(name))
    .sort();
  assert.equal(candidates.length, 1, 'shared lender revision compatibility v9 migration must be unique');
  return fs.readFileSync(path.join(migrationDir, candidates[0]), 'utf8');
}

function migrationSha256(suffix) {
  const migrationDir = path.join(ROOT, 'supabase', 'migrations');
  const candidates = fs.readdirSync(migrationDir)
    .filter((name) => name.endsWith(suffix))
    .sort();
  assert.equal(candidates.length, 1, `${suffix} migration must be unique`);
  return crypto.createHash('sha256')
    .update(fs.readFileSync(path.join(migrationDir, candidates[0])))
    .digest('hex');
}

test('rent-roll API는 운영 원문의 없음 토큰과 복수 렌트프리를 정규화해 RPC로 전달한다', async () => {
  const router = await importFresh('supabase/functions/ll-dashboard-api/v2/router.ts');
  const request = router.buildRpcArguments('v2/rent-roll/batch-save', {
    client_request_id: '11111111-1111-4111-8111-111111111111',
    asset_key: 'asset-a',
    payload: {
      rows: [{
        operation: 'update',
        row_key: 'space-a',
        renewal_terms: '기타(N)',
        termination_terms: '기타 (no)',
        rent_free_periods: [
          { start_date: '2026-01-01', end_date: '2026-01-31', months: 1 },
          { months: 2, reason: '재계약' },
        ],
      }],
    },
  });
  assert.equal(request.p_payload.rows[0].renewal_terms, '없음');
  assert.equal(request.p_payload.rows[0].termination_terms, '없음');
  assert.equal(request.p_payload.rows[0].rent_free_periods.length, 2);
  const sql = readMigration();
  assert.match(sql, /'기타\(n\)'/iu);
  assert.match(sql, /'기타\(no\)'/iu);
  assert.match(sql, /regexp_replace\(lower\(btrim\(raw_value\)\), '\[\[:space:\]\]\+'/iu);
});

test('finance API는 계정 생성·선택만 있는 저장도 허용하고 UUID 참조 계약을 검증한다', async () => {
  const router = await importFresh('supabase/functions/ll-dashboard-api/v2/router.ts');
  const request = router.buildRpcArguments('v2/finance/batch-save', {
    client_request_id: '22222222-2222-4222-8222-222222222222',
    asset_key: 'asset-a',
    payload: {
      account_operations: [{
        operation: 'create',
        account_code: 'CUSTOM:33333333-3333-4333-8333-333333333333',
        client_account_key: '33333333-3333-4333-8333-333333333333',
        record: {
          name_ko: '저온설비 특별수선',
          statement_section: 'operating_expense',
          normal_sign: -1,
          display_order: 999,
        },
      }],
      selection_operations: [{
        operation: 'upsert',
        account_code: 'CUSTOM:33333333-3333-4333-8333-333333333333',
        client_account_key: '33333333-3333-4333-8333-333333333333',
        selected: true,
      }],
    },
  });
  assert.deepEqual(request.p_payload.operations, []);
  assert.equal(request.p_payload.account_operations.length, 1);
  assert.equal(request.p_payload.selection_operations.length, 1);

  assert.throws(() => router.buildRpcArguments('v2/finance/batch-save', {
    client_request_id: '44444444-4444-4444-8444-444444444444',
    payload: {
      account_operations: [{
        operation: 'create',
        client_account_key: 'not-a-uuid',
        record: { name_ko: '기타', statement_section: 'operating_expense' },
      }],
    },
  }), /FINANCE_CLIENT_ACCOUNT_KEY_INVALID/u);
});

test('home save는 화면의 전 필드별 실제 revision과 ownership link를 왕복한다', () => {
  const sql = readMigration();
  assert.match(sql, /'fund_revision', fund\.revision/iu);
  assert.match(sql, /'link_revision', link\.revision/iu);
  assert.match(sql, /'loan_revision', loan\.revision/iu);
  assert.match(sql, /'lender_revision', lender\.revision/iu);
  assert.match(sql, /home_save_contract_preflight/iu);
  assert.match(sql, /field_name = ''ownership_ratio''/iu);
  assert.match(sql, /logistics_core\.fund_asset_links/iu);
  assert.match(sql, /HOME_READBACK_MISMATCH/iu);
  assert.match(sql, /complete_idempotency/iu);
  for (const field of [
    'zoning_text', 'building_area_sqm', 'primary_use', 'building_coverage_ratio',
    'floor_area_ratio', 'structure_text', 'parking_count', 'completion_date',
  ]) assert.match(sql, new RegExp(`'${field}'`, 'iu'));
  assert.match(sql, /home_overview_writer_preflight/iu);
  assert.match(sql, /coalesce\(source_payload->''data_platform_overrides'', ''\{\}''::jsonb\)[\s\S]*jsonb_build_object\(\$1, \$2\)/iu);
});

test('home read는 건축물 원천과 임대현황을 기존값 우선순위와 provenance로 반환한다', () => {
  const sql = readMigration();
  assert.match(sql, /asset_source_provenance/iu);
  assert.match(sql, /data_platform_overrides/iu);
  assert.match(sql, /building_area_sqm/iu);
  assert.match(sql, /gross_area_sqm/iu);
  assert.match(sql, /leasable_area_sqm/iu);
  assert.match(sql, /occupancy_summary/iu);
  assert.match(sql, /occupied_area_sqm/iu);
  assert.match(sql, /tenant_count/iu);
  assert.match(sql, /v_space_denominator := coalesce\(v_explicit_leasable, v_gross_area, v_space_area_sum\)/iu);
  assert.match(sql, /'leasable_area_sqm', v_explicit_leasable/iu);
  assert.match(sql, /when v_gross_area is not null then 'asset_gross_area'/iu);
});

test('finance 사용자 정의 계정과 자산별 선택은 private schema, 감사, revision, readback을 갖는다', () => {
  const sql = readMigration();
  assert.match(sql, /alter table logistics_core\.cashflow_accounts[\s\S]*add column if not exists asset_id uuid/iu);
  assert.match(sql, /create table if not exists logistics_core\.finance_account_selections/iu);
  assert.match(sql, /add column if not exists selected boolean/iu);
  assert.match(sql, /create unique index if not exists finance_account_selections_asset_account_uidx/iu);
  assert.match(sql, /drop trigger if exists finance_account_selections_set_updated_revision/iu);
  assert.match(sql, /alter table logistics_core\.finance_account_selections enable row level security/iu);
  assert.match(sql, /revoke all on table logistics_core\.finance_account_selections from public, anon, authenticated/iu);
  assert.match(sql, /account_operations/iu);
  assert.match(sql, /selection_operations/iu);
  assert.match(sql, /client_account_key/iu);
  assert.match(sql, /accounts_readback/iu);
  assert.match(sql, /selection_readback/iu);
  assert.match(sql, /REVISION_CONFLICT/iu);
  assert.match(sql, /claim_idempotency/iu);
  assert.match(sql, /insert into logistics_core\.audit_events/iu);
});

test('full-row 기존 렌트롤은 archived v1 writer에서도 row space key로 update되고 unique 충돌은 409다', async () => {
  const sql = readMigration();
  const router = await importFresh('supabase/functions/ll-dashboard-api/v2/router.ts');
  assert.match(sql, /repair_rent_roll_v1_row_space_key/iu);
  assert.match(sql, /row_record->>''space_key''/iu);
  assert.match(sql, /rent_roll_batch_save_entry_v1/iu);
  assert.match(sql, /replace\(v_definition, v_erroneous, v_repaired\)/iu);
  assert.deepEqual(
    router.mapV2RpcError({ code: '23505', message: 'duplicate key value violates unique constraint "spaces_space_key_key"' }),
    { httpStatus: 409, code: 'RESOURCE_CONFLICT', retryable: false },
  );
});

test('렌트롤 sparse 셀 저장은 현재 행과 병합하고 복합 만기일은 editable date에서 제거한다', () => {
  const sql = readMigration();
  assert.match(sql, /rent_roll_batch_save_entry_v6/iu);
  assert.match(sql, /v_input_row := \(v_current_row - 'migration_exceptions'\) \|\| v_input_row/iu);
  assert.match(sql, /v2\/rent-roll\/batch-save-sparse-v6/iu);
  assert.match(sql, /rows_readback/iu);
  assert.match(sql, /LEGACY_MULTIPLE_DATE_CONFLICT/iu);
  assert.match(sql, /LEGACY_DATE_NORMALIZED_TO_CORE/iu);
  assert.match(sql, /'\{expiry_date\}'[\s\S]*contract\.expiry_date/iu);
});

test('복합 legacy 만기 원문은 관련 없는 sparse 셀 저장 전후에 source lineage가 동일해야 한다', () => {
  const sql = readMigration();
  assert.match(sql, /not \(v_input_row \? 'expiry_date'\)[\s\S]*LEGACY_MULTIPLE_DATE_CONFLICT/iu);
  assert.match(sql, /v_legacy_snapshots := v_legacy_snapshots \|\|/iu);
  assert.match(sql, /lease_source_row_hash/iu);
  assert.match(sql, /space_source_row_hash/iu);
  assert.match(sql, /v_after_snapshot is distinct from v_snapshot->'fingerprint'/iu);
  assert.match(sql, /LEGACY_COMPOUND_DATE_SOURCE_LOST/iu);
  assert.match(sql, /legacy_source_readback/iu);
});

test('신규 행 readback은 client space key가 달라도 안정된 component key로 server key를 찾는다', () => {
  const sql = readMigration();
  assert.match(sql, /row_item\.value->>'contract_space_key' = v_input_row->>'contract_space_key'/iu);
  assert.match(sql, /row_item\.value->>'rent_term_key' = v_input_row->>'rent_term_key'/iu);
  assert.match(sql, /'client_space_key', v_space_key/iu);
  assert.match(sql, /'server_space_key'/iu);
  assert.match(sql, /'\{data,key_mappings\}'/iu);
});

test('occupied rows without a legacy rent-term key receive the same deterministic key as the base writer', () => {
  const sql = readRentTermFallbackMigration();
  assert.match(sql, /contract_space_key[\s\S]*contract_key[\s\S]*space_key/iu);
  assert.match(sql, /\|\| ':current'/iu);
  assert.match(sql, /jsonb_set\([\s\S]*?v_input_row,[\s\S]*?'\{rent_term_key\}'/iu);
  assert.match(sql, /v_transformed[\s\S]*array\['rows', v_row_index::text\][\s\S]*v_input_row/iu);
  assert.match(sql, /RENT_TERM_KEY_FALLBACK_PATCH_FAILED/iu);
});

test('multiple loan rows sharing one lender use the lender entity as a single revision scope', () => {
  const sql = readSharedLenderRevisionMigration();
  assert.match(sql, /'lender:'\s*\|\|\s*entity_id::text/iu);
  assert.match(sql, /'loan_lender:'\s*\|\|\s*entity_key/iu);
  assert.match(sql, /HOME_SHARED_LENDER_REVISION_PATCH_FAILED/iu);
});

test('already-applied v6, v7, and v8 migrations remain byte-for-byte immutable', () => {
  assert.equal(
    migrationSha256('_logistics_editable_contracts_v6.sql'),
    'c66db543f8d6d5e40d5064aa342d91a93ea636a4cbe8325a9702abcca64c0d9a',
  );
  assert.equal(
    migrationSha256('_logistics_rent_term_key_fallback_v7.sql'),
    '9214913b5a78cf09419c7f7d3a80d0cc8a38a6f2cb5913682c3c3e9dd5bbbada',
  );
  assert.equal(
    migrationSha256('_logistics_home_shared_lender_revision_v8.sql'),
    '8761ec3ff66f7dd8d417b7698d6e2323a18a23df652c8bf271794fe3c08302b5',
  );
});

test('shared lender revision v9 preserves the legacy public expected-revision key without changing v8', () => {
  const v8 = readSharedLenderRevisionMigration();
  const v9 = readSharedLenderRevisionCompatMigration();
  assert.doesNotMatch(v8, /HOME_SHARED_LENDER_LEGACY_REVISION_KEY_V9/iu);
  assert.match(v9, /HOME_SHARED_LENDER_REVISION_V8/iu);
  assert.match(v9, /HOME_SHARED_LENDER_LEGACY_REVISION_KEY_V9/iu);
  assert.match(v9, /p_expected_revisions->>\('loan_lender:'\s*\|\|\s*entity_key\)/iu);
  assert.match(v9, /position\(v_old in v_definition\) > 0/iu);
  assert.match(v9, /revoke all on function logistics_core\.home_batch_save_entry_v5/iu);
  assert.match(v9, /HOME_SHARED_LENDER_REVISION_COMPAT_PATCH_FAILED/iu);
});

test('v9 backfills a verified legacy lender and guards a source-blank missing link', () => {
  const sql = readSharedLenderRevisionCompatMigration();
  assert.match(sql, /HOME_MISSING_LENDER_BLANK_NOOP_V9/iu);
  assert.match(sql, /HOME_MISSING_LENDER_CREATE_V9/iu);
  assert.match(sql, /public\.ll_fund_capital_tranches legacy[\s\S]*legacy\.id = loan\.source_tranche_id/iu);
  assert.match(sql, /legacy\.tranche_type = 'loan'/iu);
  assert.match(sql, /nullif\(btrim\(legacy\.party_name\), ''\) is not null/iu);
  assert.match(sql, /'lender_'\s*\|\|\s*substr\(md5\(lower\(v_source\.lender_name\)\), 1, 24\)/iu);
  assert.match(sql, /'loan_lender_'\s*\|\|\s*v_source\.source_tranche_id::text/iu);
  assert.match(sql, /insert into logistics_core\.lenders/iu);
  assert.match(sql, /insert into logistics_core\.loan_lenders/iu);
  assert.match(sql, /insert into logistics_core\.audit_events/iu);
  assert.match(sql, /'legacy_table', 'public\.ll_fund_capital_tranches'/iu);
  assert.match(sql, /'source_hash', v_source_hash/iu);
  assert.match(sql, /HOME_MISSING_LENDER_READBACK_MISMATCH/iu);
  assert.match(sql, /nullif\(btrim\(operation->>'value'\), ''\) is null[\s\S]*continue/iu);
  assert.match(sql, /errcode = 'PT422', message = 'LENDER_LINK_REQUIRED'/iu);
});
