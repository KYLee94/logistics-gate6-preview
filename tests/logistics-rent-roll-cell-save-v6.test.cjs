const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { pathToFileURL } = require('node:url');

const ROOT = path.resolve(__dirname, '..');
const JSX_PATH = path.join(ROOT, 'src/features/logistics-data-platform/LogisticsDataPlatform.jsx');
const LIVE_MATRIX_PATH = path.join(ROOT, 'scripts/qa/logistics-rent-roll-cell-save-matrix.cjs');

const EDITABLE_FIELDS = Object.freeze([
  'occupancy_status', 'tenant_name', 'business_registration_number', 'temperature_type',
  'goods_type', 'floor_label', 'zone_label', 'subtenant_name', 'free_area_type',
  'exclusive_area_sqm', 'common_area_sqm', 'leased_area_sqm', 'signed_date',
  'commencement_date', 'expiry_date', 'operation_start_date', 'deposit_total_krw',
  'security_type', 'security_ratio', 'monthly_rent_total_krw', 'monthly_cam_total_krw',
  'pallet_rack_fee', 'rent_free_months', 'rent_free_start_date', 'rent_free_end_date',
  'fit_out_months', 'fit_out_amount', 'tenant_improvement_amount',
  'deposit_escalation_enabled', 'deposit_escalation_first_date', 'deposit_escalation_interval_months',
  'deposit_escalation_rate', 'rent_escalation_first_date',
  'rent_escalation_interval_months', 'rent_escalation_rate',
  'cam_escalation_first_date', 'cam_escalation_interval_months', 'cam_escalation_rate',
  'tenant_cost_terms', 'landlord_cost_terms', 'renewal_terms', 'termination_terms',
  'restoration_terms', 'notes',
]);

const DERIVED_FIELDS = Object.freeze([
  'exclusive_area_py', 'common_area_py', 'leased_area_py', 'efficiency_ratio',
  'contract_months', 'wale_years', 'deposit_per_py_krw', 'rent_per_py_krw',
  'cam_per_py_krw', 'pallet_rack_fee_per_py', 'current_total_cost_per_py_krw',
  'effective_rent',
]);

async function schema() {
  const target = path.join(ROOT, 'src/features/logistics-data-platform/rentRollSchema.js');
  return import(`${pathToFileURL(target).href}?cell-save=${Date.now()}-${Math.random()}`);
}

test('렌트롤 56개 컬럼은 편집 44개와 자동계산 12개로 1:1 분류된다', async () => {
  const module = await schema();
  assert.deepEqual(module.RENT_ROLL_EDITABLE_FIELDS, EDITABLE_FIELDS);
  assert.deepEqual(module.RENT_ROLL_DERIVED_FIELDS, DERIVED_FIELDS);
  assert.deepEqual(
    module.RENT_ROLL_COLUMNS.map((column) => column.key),
    [...EDITABLE_FIELDS, ...DERIVED_FIELDS].sort((left, right) => (
      module.RENT_ROLL_COLUMNS.findIndex((column) => column.key === left)
      - module.RENT_ROLL_COLUMNS.findIndex((column) => column.key === right)
    )),
  );
});

test('rent-free periods accept a complete date pair or positive manual months', async () => {
  const module = await schema();
  assert.equal(module.isValidRentFreePeriod({ start_date: '2026-01-01', end_date: '2026-01-31', months: 0 }), true);
  assert.equal(module.isValidRentFreePeriod({ start_date: '', end_date: '', months: '2.5' }), true);
  assert.equal(module.isValidRentFreePeriod({ start_date: '2026-01-01', end_date: '', months: 2 }), false);
  assert.equal(module.isValidRentFreePeriod({ start_date: '', end_date: '', months: 0 }), false);
  assert.deepEqual(
    module.normalizeRentFreePeriod({ start_date: '', end_date: '', months: '2.5', reason: 'legacy' }),
    { start_date: null, end_date: null, months: 2.5, reason: 'legacy', notes: null },
  );
  assert.equal(
    module.normalizeRentFreePeriod({ start_date: '2026-02-01', end_date: '2026-02-28', months: 99 }).months,
    0.89,
  );
});

test('fit-out months preserve positive month-only values and recalculate complete date pairs', async () => {
  const module = await schema();
  assert.equal(module.normalizeFitOutMonths('', '', '3'), 3);
  assert.equal(module.normalizeFitOutMonths('2026-03-01', '2026-03-31', 99), 0.99);
  assert.equal(module.normalizeFitOutMonths('2026-03-01', '', '2'), 2);
  assert.equal(module.normalizeFitOutMonths('', '', 0), null);
});

test('셀 저장 payload는 허용된 컬럼·복수 렌트프리·fit-out·revision만 포함한다', async () => {
  const module = await schema();
  const row = {
    operation: 'update',
    row_key: 'space-a',
    space_key: 'space-a',
    contract_key: 'contract-a',
    contract_space_key: 'allocation-a',
    rent_term_key: 'term-a',
    tenant_key: 'tenant-a',
    display_order: 1,
    space_revision: 3,
    contract_revision: 4,
    allocation_revision: 5,
    rent_term_revision: 6,
    revision: 3,
    occupancy_status: 'occupied',
    tenant_name: '테스트 임차인',
    floor_label: '1F',
    commencement_date: '2026-01-01',
    expiry_date: '2026-12-31',
    leased_area_sqm: '1000',
    exclusive_area_sqm: '800',
    common_area_sqm: '200',
    deposit_total_krw: '1,000,000',
    monthly_rent_total_krw: '1,000,000',
    monthly_cam_total_krw: '200,000',
    rent_free_months: 1,
    rent_free_periods: [{ start_date: '2026-01-01', end_date: '2026-01-31', months: 1, reason: '오픈 지원', notes: '원문' }],
    fit_out_start_date: '2025-12-01',
    fit_out_end_date: '2025-12-31',
    renewal_terms: '기타(N)',
    termination_terms: '중도해지불가',
    tenant_cost_terms: { raw_text: '원문', items: ['전기·수도·가스 등 공과금'] },
    landlord_cost_terms: { items: ['구조체·기본설비 유지보수'] },
    _draft_id: 'browser-only',
    unexpected_ui_state: 'must-not-leak',
  };

  const payload = module.buildRentRollSaveRow(row);
  for (const key of EDITABLE_FIELDS) {
    assert.equal(Object.hasOwn(payload, key), true, `payload 누락: ${key}`);
  }
  for (const key of DERIVED_FIELDS) {
    assert.equal(Object.hasOwn(payload, key), false, `서버 계산 필드가 payload에 포함됨: ${key}`);
  }
  for (const key of ['rent_free_periods', 'fit_out_start_date', 'fit_out_end_date', 'space_revision', 'contract_revision', 'allocation_revision', 'rent_term_revision']) {
    assert.equal(Object.hasOwn(payload, key), true, `확장 계약 누락: ${key}`);
  }
  assert.equal(payload.renewal_terms, '없음');
  assert.equal(payload.termination_terms, '없음');
  assert.equal(payload.deposit_total_krw, 1000000);
  assert.equal(payload.rent_free_periods[0].reason, '오픈 지원');
  assert.equal(Object.hasOwn(payload, '_draft_id'), false);
  assert.equal(Object.hasOwn(payload, 'unexpected_ui_state'), false);
  assert.deepEqual(module.buildRentRollExpectedRevisions([row]), { 'space-a': 3 });
});

test('operation이 없는 기존 read row는 update로 강제하고 신규와 삭제만 create/delete로 보낸다', async () => {
  const module = await schema();
  const existing = {
    row_key: 'space-existing',
    space_key: 'space-existing',
    contract_key: 'contract-existing',
    contract_space_key: 'allocation-existing',
    rent_term_key: 'term-existing',
    space_revision: 10,
    contract_revision: 4,
    allocation_revision: 5,
    rent_term_revision: 6,
    tenant_name: '기존 임차인',
  };
  assert.equal(module.buildRentRollSaveRow(existing, ['tenant_name']).operation, 'update');
  assert.equal(module.buildRentRollSaveRow(module.emptyRentRollRow('new-row'), ['tenant_name']).operation, 'create');
  assert.equal(module.buildRentRollSaveRow({ ...existing, operation: 'delete' }, []).operation, 'delete');
});

test('기존 행은 수정한 셀과 그 셀의 자동계산 의존값만 보내고 다른 셀은 보내지 않는다', async () => {
  const module = await schema();
  const row = {
    row_key: 'space-existing',
    space_key: 'space-existing',
    contract_key: 'contract-existing',
    contract_space_key: 'allocation-existing',
    rent_term_key: 'term-existing',
    space_revision: 10,
    contract_revision: 4,
    allocation_revision: 5,
    rent_term_revision: 6,
    tenant_name: '보존할 임차인',
    leased_area_sqm: 1000,
    commencement_date: '2026-01-01',
    expiry_date: '2026-12-31',
    monthly_rent_total_krw: 1000000,
    monthly_cam_total_krw: 200000,
    rent_free_months: 1,
    notes: '보존할 비고',
  };
  const payload = module.buildRentRollSaveRow(row, ['monthly_rent_total_krw']);
  assert.equal(Object.hasOwn(payload, 'monthly_rent_total_krw'), true);
  for (const key of ['rent_per_py_krw', 'current_total_cost_per_py_krw', 'effective_rent']) {
    assert.equal(Object.hasOwn(payload, key), false, `서버 계산 필드 누출: ${key}`);
  }
  for (const key of ['tenant_name', 'notes', 'monthly_cam_total_krw', 'leased_area_sqm']) {
    assert.equal(Object.hasOwn(payload, key), false, `변경하지 않은 필드 누출: ${key}`);
  }
});

test('기존 복합 만기 원문은 다른 셀의 sparse 저장을 막지 않고 만기 셀을 수정할 때만 검증한다', async () => {
  const module = await schema();
  const legacyRow = {
    operation: 'update',
    row_key: 'space-legacy-expiry',
    space_key: 'space-legacy-expiry',
    occupancy_status: 'occupied',
    tenant_name: '기존 임차인',
    floor_label: 'B2~3',
    commencement_date: '2024-01-01',
    expiry_date: null,
    data_exceptions: [{ code: 'LEGACY_MULTIPLE_DATE_CONFLICT', status: 'blocked' }],
  };
  assert.deepEqual(module.validateRentRollDelta(legacyRow, ['tenant_name']), []);
  assert.deepEqual(module.validateRentRollDelta(
    { ...legacyRow, expiry_date: '2028-06-30/2029-12-31' },
    ['expiry_date'],
  ), ['1행: expiry_date는 YYYY-MM-DD 형식이어야 합니다.']);
  assert.deepEqual(module.validateRentRollDelta(
    { ...legacyRow, expiry_date: '2029-12-31' },
    ['expiry_date'],
  ), []);
});

test('browser _draft_id is only row identity and does not turn an existing row into create validation', async () => {
  const module = await schema();
  const existing = {
    _draft_id: 'browser-existing-row',
    occupancy_status: 'occupied',
    tenant_name: '기존 임차인 수정',
    expiry_date: '2024-12-31',
  };

  assert.deepEqual(module.validateRentRollDelta(existing, ['tenant_name']), []);
  assert.notDeepEqual(module.validateRentRollDelta(
    { ...existing, expiry_date: 'invalid-date' },
    ['expiry_date'],
  ), []);

  const created = module.emptyRentRollRow('browser-new-row');
  assert.equal(created.operation, 'create');
  assert.ok(module.validateRentRollDelta(created, ['tenant_name']).length >= 3);
});

test('저장 readback은 변경 셀과 복수 렌트프리 배열을 의미값으로 비교한다', async () => {
  const module = await schema();
  const payloadRows = [{
    operation: 'update',
    row_key: 'space-readback',
    space_key: 'space-readback',
    monthly_rent_total_krw: 1234567,
    rent_escalation_rate: '3%',
    termination_terms: '없음',
    tenant_cost_terms: { raw_text: '보존', items: ['전기·수도·가스 등 공과금'] },
    rent_free_periods: [{
      start_date: '2026-01-01',
      end_date: '2026-01-31',
      months: 1,
      reason: '오픈 지원',
      notes: '1차',
    }],
  }];
  const readbackRows = [{
    row_key: 'space-readback',
    space_key: 'space-readback',
    monthly_rent_total_krw: '1234567',
    rent_escalation_rate: 0.03,
    termination_terms: '중도해지불가',
    tenant_cost_terms: { items: ['전기·수도·가스 등 공과금'], source: 'legacy' },
    rent_free_periods: [{
      id: 'server-id',
      start_date: '2026-01-01',
      end_date: '2026-01-31',
      months: '1',
      reason: '오픈 지원',
      notes: '1차',
    }],
  }];
  assert.deepEqual(module.rentRollReadbackMismatches(payloadRows, readbackRows), []);
  assert.deepEqual(
    module.rentRollReadbackMismatches(payloadRows, [{ ...readbackRows[0], monthly_rent_total_krw: 100 }])
      .map((issue) => issue.field),
    ['monthly_rent_total_krw'],
  );
  const createdPayload = [{
    operation: 'create',
    row_key: 'space-client',
    space_key: 'space-client',
    contract_space_key: 'allocation-client',
    rent_term_key: 'term-client',
    tenant_name: '신규 임차인',
  }];
  assert.deepEqual(module.rentRollReadbackMismatches(
    createdPayload,
    [{
      row_key: 'space-server',
      space_key: 'space-server',
      contract_space_key: 'allocation-client',
      rent_term_key: 'term-client',
      tenant_name: '신규 임차인',
    }],
    [{ client_space_key: 'space-client', server_space_key: 'space-server' }],
  ), []);
});

test('권리 없음 표현은 화면·payload에서 모두 없음으로 정규화한다', async () => {
  const module = await schema();
  for (const value of ['기타(없음)', '기타 ( 없음 )', '기타(N)', '기타 (n)', 'N', 'no', '중도해지불가', '중도해지 불가', '없음']) {
    assert.equal(module.normalizeRentRollOptionTerm(value), '없음', value);
  }
  assert.equal(module.normalizeRentRollOptionTerm('임차인 중도해지권'), '임차인 중도해지권');
  const renewal = module.RENT_ROLL_COLUMNS.find((column) => column.key === 'renewal_terms');
  const termination = module.RENT_ROLL_COLUMNS.find((column) => column.key === 'termination_terms');
  assert.equal(renewal.options.includes('없음'), true);
  assert.equal(termination.options.includes('없음'), true);
  assert.equal(termination.options.includes('중도해지 불가'), false);
});

test('직접 입력 금액과 자동계산값은 콤마 표시하고 실효 임대료는 원 단위 버림한다', async () => {
  const module = await schema();
  const derived = module.deriveRentRollRow({
    leased_area_sqm: 1000,
    exclusive_area_sqm: 800,
    common_area_sqm: 200,
    commencement_date: '2026-01-01',
    expiry_date: '2026-12-31',
    monthly_rent_total_krw: 1000000,
    monthly_cam_total_krw: 200000,
    deposit_total_krw: 10000000,
    pallet_rack_fee: 123456.78,
    rent_free_months: 1,
  });
  assert.equal(derived.effective_rent, 916666);
  assert.equal(module.formatRentRollNumber(1234567.89, 2), '1,234,567.89');
  assert.equal(module.formatRentRollNumber(derived.effective_rent, 0), '916,666');
  for (const key of DERIVED_FIELDS) {
    if (derived[key] !== null && derived[key] !== undefined) {
      assert.match(module.formatRentRollNumber(derived[key], key === 'effective_rent' ? 0 : 2), /\d{1,3}(?:,\d{3})*(?:\.\d+)?/u, key);
    }
  }
});

test('UI는 입력 중 원격 저장·오류 팝업을 열지 않고 저장 버튼에서만 허용 payload를 전송한다', () => {
  const source = fs.readFileSync(JSX_PATH, 'utf8');
  const rentRoll = source.slice(source.indexOf('function RentRollPanel'), source.indexOf('function periodFor'));
  assert.match(rentRoll, /const\s+intendedDocument\s*=\s*buildRentRollDocumentPayload\(rows,\s*\{\s*asOfDate:\s*todayKst\(\)\s*\}\)/u);
  assert.match(rentRoll, /asset_code:\s*assetCode/u);
  assert.match(rentRoll, /expected_xmin:\s*rentRevision/u);
  assert.match(rentRoll, /\.\.\.intendedDocument/u);
  assert.match(rentRoll, /onClick=\{\(\)\s*=>\s*void saveDirtyRows\(\)\}/u);
  assert.match(rentRoll, /saveInFlightRef\.current/u);
  assert.match(rentRoll, /DATA_PLATFORM_ACTIONS\.rentRollRead[\s\S]*?buildRentRollDocumentPayload\([\s\S]{0,120}readbackRows,[\s\S]{0,120}asOfDate:\s*todayKst\(\)[\s\S]*?documentsEqual\(intendedDocument,\s*readbackDocument\)/u);
  assert.doesNotMatch(rentRoll, /expected_revisions|asset_key|key_mappings|buildRentRollSaveRow/u);
  assert.match(rentRoll, /validateRentRollDelta\(row, changedFields\)/u);
  assert.doesNotMatch(rentRoll, /on(?:Change|Blur)=\{[^}]*invokeDataPlatform/u);
  assert.doesNotMatch(rentRoll, /onBlur=.*saveRows/u);
  assert.match(rentRoll, /formatRentRollReadonlyValue\(column, row\)/u);
  assert.match(rentRoll, /rent_free_periods:\s*canonicalPeriods/u);
  const liveMatrix = fs.readFileSync(LIVE_MATRIX_PATH, 'utf8');
  assert.match(liveMatrix, /const\s+derivedReadback\s*=\s*schema\.deriveRentRollRow\(readback\)/u);
  assert.match(liveMatrix, /schema\.rentRollReadbackMismatches\(\[editablePayload\],\s*\[readback\]\)/u);
  assert.match(liveMatrix, /compareReadbackFields\(expected,\s*derivedReadback,\s*derivedFields\)/u);
  assert.match(liveMatrix, /function\s+rentFreeBusinessValues\(periods\)/u);
  assert.match(liveMatrix, /rentFreeBusinessValues\(readback\.rent_free_periods\)/u);
  assert.match(source, /렌트프리 사유/u);
  assert.match(source, /렌트프리 비고/u);
  assert.match(source, /type="number"[\s\S]{0,320}rent-free-months/u);
  assert.match(source, /isValidRentFreePeriod\(period\)/u);
  assert.match(source, /normalizeRentFreePeriod/u);
});
