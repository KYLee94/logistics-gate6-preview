const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const MATRIX_SCRIPT = path.join(ROOT, 'scripts', 'qa', 'logistics-home-finance-live-matrix.cjs');
const ALERT_SCRIPT = path.join(ROOT, 'scripts', 'qa', 'logistics-notification-panels-live-browser.cjs');
const REPORT = path.join(ROOT, 'reports', 'gate6-data-platform-rebuild', '27-home-finance-notification-cross-validation-20260807.md');
const RELEASE_REPORT = path.join(ROOT, 'reports', 'gate6-data-platform-rebuild', '28-home-finance-notification-release-crosscheck-20260807.md');

test('홈 편집 계약은 asset 14·fund 6·beneficiary 4·loan 10필드를 정확히 전수화한다', () => {
  assert.equal(fs.existsSync(MATRIX_SCRIPT), true);
  const matrix = require(MATRIX_SCRIPT);
  assert.deepEqual(Object.fromEntries(matrix.HOME_ENTITY_MATRIX.map((entry) => [entry.entity, entry.fields.length])), {
    asset: 14,
    fund: 6,
    beneficiary: 4,
    loan: 10,
  });
  assert.equal(matrix.HOME_ENTITY_MATRIX.flatMap((entry) => entry.fields).length, 34);
});

test('홈 동일값 operation은 필드별 실제 revision을 사용하고 readback mismatch를 식별한다', () => {
  const matrix = require(MATRIX_SCRIPT);
  const source = {
    asset: { asset_key: 'asset-a', name: 'A', revision: 11 },
    funds: [{ fund_key: 'fund-a', name: 'F', ownership_ratio: 0.5, fund_revision: 21, link_revision: 22 }],
    investments: [{ beneficiary_key: 'beneficiary-a', tranche: 'A', revision: 31 }],
    loans: [{ loan_key: 'loan-a', tranche: 'A', lender_name: '은행', loan_revision: 41, lender_revision: 42 }],
  };
  const operations = matrix.buildHomeSameValueOperations(source);
  assert.equal(operations.length, 34);
  assert.equal(operations.find((row) => row.entity === 'fund' && row.field === 'name').expected_revision, 21);
  assert.equal(operations.find((row) => row.entity === 'fund' && row.field === 'ownership_ratio').expected_revision, 22);
  assert.equal(operations.find((row) => row.entity === 'loan' && row.field === 'tranche').expected_revision, 41);
  assert.equal(operations.find((row) => row.entity === 'loan' && row.field === 'lender_name').expected_revision, 42);
  assert.deepEqual(matrix.compareHomeReadback(source, source), []);
  const changed = structuredClone(source);
  changed.asset.name = 'B';
  assert.deepEqual(matrix.compareHomeReadback(source, changed).map((row) => `${row.entity}.${row.field}`), ['asset.name']);
});

test('홈 projection 검증은 서버 임대율 계산과 건축물대장 출처를 판정한다', () => {
  const matrix = require(MATRIX_SCRIPT);
  const valid = matrix.validateHomeProjection({
    tenant_summary: {
      occupied_area_sqm: 75,
      denominator_area_sqm: 100,
      denominator_source: 'asset_leasable_area',
      occupancy_rate: 75,
    },
    asset_source_provenance: {
      building_area_sqm: 'building_register_cache',
      occupancy_summary: 'logistics_core.current_contract_spaces',
    },
  });
  assert.deepEqual(valid.errors, []);
  assert.deepEqual(valid.building_source_fields, ['building_area_sqm']);
  assert.equal(valid.occupancy_rate, 75);

  const mismatch = matrix.validateHomeProjection({
    tenant_summary: { occupied_area_sqm: 75, denominator_area_sqm: 100, occupancy_rate: 50 },
    asset_source_provenance: {},
  });
  assert.deepEqual(mismatch.errors, ['HOME_OCCUPANCY_RATE_MISMATCH']);
});

test('수익비용 검증은 선택 상태만 동일값 upsert하고 금액 원장을 절대 만들지 않는다', () => {
  const matrix = require(MATRIX_SCRIPT);
  const operations = matrix.buildFinanceSelectionOperations([
    { account_code: 'PM_FEE', selected: true, selection_revision: 3, account_kind: 'atomic' },
    { account_code: 'CAPEX', selected: false, selection_revision: null, account_kind: 'atomic' },
    { account_code: 'NOI', selected: false, selection_revision: null, account_kind: 'derived' },
  ]);
  assert.deepEqual(operations, [
    { operation: 'upsert', account_code: 'PM_FEE', selected: true, expected_revision: 3 },
    { operation: 'upsert', account_code: 'CAPEX', selected: false },
  ]);
  const empty = matrix.buildEmptyFinanceSaveRequest('asset-a');
  assert.deepEqual(empty.entries, []);
  assert.deepEqual(empty.account_operations, []);
  assert.deepEqual(empty.selection_operations, []);
  assert.equal(JSON.stringify(empty).includes('amount'), false);

  const source = fs.readFileSync(MATRIX_SCRIPT, 'utf8');
  assert.match(source, /--execute-safe-noop/u);
  assert.match(source, /--confirm-live-same-value-writes/u);
  assert.match(source, /ledger_write_operation_count:\s*0/u);
  assert.doesNotMatch(source, /amount:\s*[-+]?\d/u);
});

test('수익비용 필수 6개 계정은 운영 readback에서 모두 존재하고 선택돼야 한다', () => {
  const matrix = require(MATRIX_SCRIPT);
  const accounts = matrix.REQUIRED_DEFAULT_FINANCE_CODES.map((accountCode) => ({
    account_code: accountCode,
    selected: true,
  }));
  assert.equal(matrix.REQUIRED_DEFAULT_FINANCE_CODES.length, 6);
  assert.deepEqual(matrix.validateFinanceDefaults(accounts), []);
  accounts[0].selected = false;
  assert.deepEqual(matrix.validateFinanceDefaults(accounts), [{
    account_code: matrix.REQUIRED_DEFAULT_FINANCE_CODES[0],
    error: 'FINANCE_DEFAULT_ACCOUNT_NOT_SELECTED',
  }]);
});

test('두 알림 UI는 라이브 브라우저에서 실제 읽기·사람용 명칭·쓰기 0건을 함께 판정한다', () => {
  assert.equal(fs.existsSync(ALERT_SCRIPT), true);
  const source = fs.readFileSync(ALERT_SCRIPT, 'utf8');
  for (const marker of [
    'data-platform-maturity-button',
    'xpath=following-sibling::section[1]',
    'logistics-notification-button',
    'logistics-notification-panel',
    'v2/maturities/read',
    'stacking-plan-tooltip',
    'HOME_OCCUPANCY_UI_READBACK_MISMATCH',
    'asset_source_provenance',
    'notifications/list',
    'write_action_count',
    'internal_identifier_exposed',
  ]) assert.equal(source.includes(marker), true, `missing live alert evidence marker: ${marker}`);
});

test('교차검증 보고서는 읽기·운영 저장·두 알림 라이브 명령과 판정 기준을 한곳에 둔다', () => {
  assert.equal(fs.existsSync(REPORT), true);
  const report = fs.readFileSync(REPORT, 'utf8');
  assert.match(report, /logistics-home-finance-live-matrix\.cjs/u);
  assert.match(report, /--execute-safe-noop/u);
  assert.match(report, /logistics-notification-panels-live-browser\.cjs/u);
  assert.match(report, /만기 알림/u);
  assert.match(report, /기존 우측 알림 패널/u);
  assert.match(report, /쓰기 호출 0건/u);

  assert.equal(fs.existsSync(RELEASE_REPORT), true);
  const releaseReport = fs.readFileSync(RELEASE_REPORT, 'utf8');
  assert.match(releaseReport, /building_merge_evidence_count > 0/u);
  assert.match(releaseReport, /occupancy_matches_server:true/u);
  assert.match(releaseReport, /stacking_tenant_count > 0/u);
  assert.match(releaseReport, /data-platform-income-expense/u);
  assert.match(releaseReport, /필수 6개/u);
});
