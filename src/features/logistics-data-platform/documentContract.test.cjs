const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { pathToFileURL } = require('node:url');

const FEATURE_DIR = __dirname;
const CONTRACT_PATH = path.join(FEATURE_DIR, 'documentContract.js');

async function contract() {
  return import(`${pathToFileURL(CONTRACT_PATH).href}?document-contract=${Date.now()}-${Math.random()}`);
}

test('홈 문서는 asset_code와 fund_code만 관계값으로 사용하고 분리 조회된 투자·대출도 펀드 문서에 중첩한다', async () => {
  const { buildHomeDocumentPayload } = await contract();
  const payload = buildHomeDocumentPayload({
    asset: { asset_code: 'ASSET-01', fund_code: 'FUND-01', name: '자산', revision: 9 },
    funds: [{
      fund_code: 'FUND-01',
      name: '펀드',
      revision: 3,
    }],
    investments: [{ fund_code: 'FUND-01', tranche: '1종', beneficiary_name: '투자자', source_payload: { legacy: true } }],
    loans: [{ fund_code: 'FUND-01', tranche: '선순위', lender_name: '대주', loan_key: 'legacy-loan' }],
  });

  assert.deepEqual(payload, {
    asset: { asset_code: 'ASSET-01', fund_code: 'FUND-01', name: '자산' },
    funds: [{
      fund_code: 'FUND-01',
      name: '펀드',
      investments: [{ tranche: '1종', beneficiary_name: '투자자' }],
      loans: [{ tranche: '선순위', lender_name: '대주' }],
    }],
  });
});

test('렌트롤 저장은 전체 rows 문서만 보내고 배열 순서가 행 순서다', async () => {
  const { buildRentRollDocumentPayload } = await contract();
  const payload = buildRentRollDocumentPayload([
    { tenant_name: 'A', display_order: 9, row_key: 'legacy-a', exclusive_area_py: 10 },
    { tenant_name: 'B', operation: 'delete', source_kind: 'legacy' },
  ]);

  assert.deepEqual(payload, {
    rows: [{ tenant_name: 'A', deposit_escalation_enabled: false }],
  });
});

test('수익비용 저장은 화면 전체 statement 문서를 그대로 정규화한다', async () => {
  const { buildIncomeExpenseDocumentPayload } = await contract();
  const payload = buildIncomeExpenseDocumentPayload({
    months: ['2026-08'],
    sections: [{
      section: 'potential_income',
      accounts: [{ name: '잠재 임대료', selected: true, amounts: [100], entry_key: 'legacy' }],
    }],
    revision: 11,
  });

  assert.deepEqual(payload, { statement: {
    periods: ['2026-08'],
    potential_income: [{ name: '잠재 임대료', selected: true, amounts: { '2026-08': 100 } }],
    income_loss: [],
    operating_expense: [],
    below_noi: [],
    debt_service: [],
  } });
});

test('수익비용 amounts는 유효한 YYYY-MM 키와 유한 숫자만 저장한다', async () => {
  const { buildIncomeExpenseDocumentPayload } = await contract();
  const payload = buildIncomeExpenseDocumentPayload({
    periods: ['2026-01', '2026-02', 'not-a-month'],
    potential_income: [{
      name: '임대료',
      selected: true,
      amounts: {
        '2026-01': 100,
        '2026-02': Number.NaN,
        '2026-03': Number.POSITIVE_INFINITY,
        '2026-04': '400',
        '2026-13': 500,
        entry_key: 'legacy-entry',
        source_id: 'legacy-source',
        revision: 3,
        meta: { legacy: true },
      },
    }],
  });

  assert.deepEqual(payload.statement.periods, ['2026-01', '2026-02']);
  assert.deepEqual(payload.statement.potential_income[0].amounts, { '2026-01': 100 });
  assert.doesNotMatch(JSON.stringify(payload.statement), /entry_key|source_id|revision|meta/u);
});

test('수익비용 셀 편집은 같은 계정 월의 복수 내역을 화면 합계 하나로 만들고 빈칸은 삭제한다', async () => {
  const { replaceFinanceCellValue } = await contract();
  const source = [
    { account_code: 'RENT', month: '2026-08', amount: 100, source_kind: 'derived' },
    { account_code: 'RENT', month: '2026-08', amount: 20, entry_key: 'legacy' },
    { account_code: 'RENT', month: '2026-09', amount: 130 },
    { account_code: 'CAM', month: '2026-08', amount: 10 },
  ];

  assert.deepEqual(replaceFinanceCellValue(source, 'RENT', '2026-08', '150'), [
    { account_code: 'RENT', month: '2026-09', amount: 130 },
    { account_code: 'CAM', month: '2026-08', amount: 10 },
    { account_code: 'RENT', month: '2026-08', amount: 150, operation: 'update' },
  ]);
  assert.deepEqual(replaceFinanceCellValue(source, 'RENT', '2026-08', ''), [
    { account_code: 'RENT', month: '2026-09', amount: 130 },
    { account_code: 'CAM', month: '2026-08', amount: 10 },
  ]);
});

test('문서 직렬화 계층은 화면별 전체 문서 builder를 공개하고 행별 저장 계약을 만들지 않는다', () => {
  const source = fs.readFileSync(CONTRACT_PATH, 'utf8');
  assert.match(source, /export function buildHomeDocumentPayload/u);
  assert.match(source, /export function buildRentRollDocumentPayload/u);
  assert.match(source, /export function buildIncomeExpenseDocumentPayload/u);
  assert.doesNotMatch(source, /\b(?:operations|expected_revisions)\b/u);
});

test('여러 펀드에서 fund_code 없는 투자·대출은 임의 연결하지 않는다', async () => {
  const { buildHomeDocumentPayload } = await contract();
  const payload = buildHomeDocumentPayload({
    asset: { asset_code: 'ASSET-01', fund_code: 'FUND-01' },
    funds: [{ fund_code: 'FUND-01' }, { fund_code: 'FUND-02' }],
    investments: [{ beneficiary_name: '연결 불명' }],
    loans: [{ lender_name: '연결 불명' }],
  });

  assert.deepEqual(payload.funds, [
    { fund_code: 'FUND-01', investments: [], loans: [] },
    { fund_code: 'FUND-02', investments: [], loans: [] },
  ]);
});

test('홈 문서는 실제 네 컬럼 문서 계약에 없는 필드를 버리고 빈 스칼라를 null로 정규화한다', async () => {
  const { buildHomeDocumentPayload } = await contract();
  const payload = buildHomeDocumentPayload({
    asset: {
      asset_code: 'ASSET-01', fund_code: 'FUND-01', name: '', address: '서울',
      legal_form: 'legacy', source_ref: 'legacy',
    },
    funds: [{
      fund_code: 'FUND-01', name: '', status: 'legacy',
      investments: [{ beneficiary_name: '투자자', fund_code: 'FUND-01', memo: 'legacy' }],
      loans: [{ lender_name: '대주', fund_code: 'FUND-01', outstanding_amount: 1 }],
    }],
  });

  assert.deepEqual(payload, {
    asset: { asset_code: 'ASSET-01', fund_code: 'FUND-01', name: null, address: '서울' },
    funds: [{
      fund_code: 'FUND-01', name: null,
      investments: [{ beneficiary_name: '투자자' }],
      loans: [{ lender_name: '대주' }],
    }],
  });
});

test('home serializer converts edited numeric strings and omits empty nested numeric and date fields', async () => {
  const { buildHomeDocumentPayload } = await contract();
  const payload = buildHomeDocumentPayload({
    asset: {
      asset_code: 'ASSET-01', fund_code: 'FUND-01', land_area_sqm: '1,234.5',
      parking_count: '10', building_coverage_ratio: '45.25',
    },
    funds: [{ fund_code: 'FUND-01', ownership_ratio: '100' }],
    investments: [{
      fund_code: 'FUND-01', beneficiary_name: 'Investor',
      agreed_amount_krw: '1000000', contributed_amount_krw: '',
    }],
    loans: [{
      fund_code: 'FUND-01', lender_name: 'Lender',
      committed_amount_krw: '2,000,000', coupon_rate: '5.25',
      all_in_rate: '', fee_rate: null, drawdown_date: '', maturity_date: null,
    }],
  });

  assert.deepEqual(payload, {
    asset: {
      asset_code: 'ASSET-01', fund_code: 'FUND-01', land_area_sqm: 1234.5,
      building_coverage_ratio: 45.25, parking_count: 10,
    },
    funds: [{
      fund_code: 'FUND-01', ownership_ratio: 100,
      investments: [{ beneficiary_name: 'Investor', agreed_amount_krw: 1000000 }],
      loans: [{
        lender_name: 'Lender', committed_amount_krw: 2000000, coupon_rate: 5.25,
      }],
    }],
  });
});

test('home serializer keeps empty loan rows valid after the UI adds blank aliases', async () => {
  const { buildHomeDocumentPayload, documentsEqual } = await contract();
  const draft = {
    asset: { asset_code: 'ASSET-DONGSAN', fund_code: 'FUND-DONGSAN' },
    funds: [{ fund_code: 'FUND-DONGSAN' }],
    loans: Array.from({ length: 3 }, () => ({
      committed_amount_krw: '', coupon_rate: '', all_in_rate: '', fee_rate: '',
    })),
  };
  const payload = buildHomeDocumentPayload(draft);

  assert.deepEqual(payload.funds[0].loans, [{}, {}, {}]);
  assert.equal(documentsEqual(payload, {
    asset: { asset_code: 'ASSET-DONGSAN', fund_code: 'FUND-DONGSAN' },
    funds: [{ fund_code: 'FUND-DONGSAN', investments: [], loans: [{}, {}, {}] }],
  }), true);
});

test('home serializer resolves legacy investment and loan aliases without leaking hidden fields', async () => {
  const { buildHomeDocumentPayload } = await contract();
  const payload = buildHomeDocumentPayload({
    asset: { asset_code: 'ASSET-01', fund_code: 'FUND-01' },
    funds: [{ fund_code: 'FUND-01' }],
    investments: [{
      fund_code: 'FUND-01', beneficiary_name: 'Investor',
      commitment_amount_krw: '1,000', invested_amount_krw: '900',
      beneficiary_key: 'hidden', source_payload: { hidden: true },
    }],
    loans: [{
      fund_code: 'FUND-01', lender_name: 'Lender',
      loan_rate: '4.5%', all_in: '5.0%', fee: '0.5%',
      loan_key: 'hidden', meta: { hidden: true },
    }],
  });

  assert.deepEqual(payload.funds[0], {
    fund_code: 'FUND-01',
    investments: [{
      beneficiary_name: 'Investor', agreed_amount_krw: 1000, contributed_amount_krw: 900,
    }],
    loans: [{ lender_name: 'Lender', coupon_rate: 4.5, all_in_rate: 5, fee_rate: 0.5 }],
  });
  assert.doesNotMatch(JSON.stringify(payload), /_key|source_|meta/u);
});

test('one numeric home edit changes only the intended canonical field', async () => {
  const { buildHomeDocumentPayload } = await contract();
  const read = {
    asset: {
      asset_code: 'ASSET-01', fund_code: 'FUND-01', name: 'Asset',
      land_area_sqm: 1000, revision: '10', hidden_status: 'read-only',
    },
    funds: [{ fund_code: 'FUND-01', name: 'Fund', ownership_ratio: 100, revision: '11' }],
    investments: [{
      fund_code: 'FUND-01', beneficiary_name: 'Investor', agreed_amount_krw: 500,
    }],
    loans: [{ fund_code: 'FUND-01', lender_name: 'Lender', coupon_rate: 4.5 }],
  };
  const draft = structuredClone(read);
  draft.asset.land_area_sqm = '1001';

  const sourceDocument = buildHomeDocumentPayload(read);
  const draftDocument = buildHomeDocumentPayload(draft);
  assert.equal(draftDocument.asset.land_area_sqm, 1001);
  assert.deepEqual(
    { ...draftDocument, asset: { ...draftDocument.asset, land_area_sqm: 1000 } },
    sourceDocument,
  );
});

test('렌트롤 문서는 삭제 행과 서버 파생 필드를 제외하고 rent-free 저장 구조를 서버와 동일하게 만든다', async () => {
  const { buildRentRollDocumentPayload } = await contract();
  const payload = buildRentRollDocumentPayload([
    {
      _draft_id: 'ui-1', operation: 'update', tenant_name: 'A', floor_label: '2F',
      rent_free_months: 1, current_total_cost_per_py_krw: 120,
      rent_free_periods: [{ start_date: '2026-01-01', end_date: '2026-01-31', months: 1, reason: '신규', notes: '' }],
    },
    { _draft_id: 'ui-2', operation: 'delete', tenant_name: 'B' },
  ]);

  assert.deepEqual(payload, {
    rows: [{
      tenant_name: 'A', floor_label: '2F', deposit_escalation_enabled: false,
      rent_free_periods: [{ start_date: '2026-01-01', end_date: '2026-01-31', months: 0.99, reason: '신규', notes: '' }],
    }],
  });
});

test('rent-free document keeps positive month-only periods and recalculates dated periods', async () => {
  const { buildRentRollDocumentPayload } = await contract();
  const payload = buildRentRollDocumentPayload([{
    tenant_name: 'A',
    rent_free_periods: [
      { start_date: null, end_date: null, months: '2.5', reason: 'legacy month only', notes: '' },
      { start_date: '2026-02-01', end_date: '2026-02-28', months: 99, reason: 'dated', notes: '' },
    ],
  }]);

  assert.deepEqual(payload.rows[0].rent_free_periods, [
    { start_date: null, end_date: null, months: 2.5, reason: 'legacy month only', notes: '' },
    { start_date: '2026-02-01', end_date: '2026-02-28', months: 0.89, reason: 'dated', notes: '' },
  ]);
});

test('rent-roll document keeps month-only fit-out and recalculates dated fit-out', async () => {
  const { buildRentRollDocumentPayload } = await contract();
  const payload = buildRentRollDocumentPayload([
    { tenant_name: 'month only', fit_out_start_date: null, fit_out_end_date: null, fit_out_months: '3' },
    { tenant_name: 'dated', fit_out_start_date: '2026-03-01', fit_out_end_date: '2026-03-31', fit_out_months: 99 },
  ]);

  assert.equal(payload.rows[0].fit_out_months, 3);
  assert.equal(payload.rows[1].fit_out_months, 0.99);
});

test('rent-roll document converts numeric input strings and omits blank optional numbers and dates', async () => {
  const { buildRentRollDocumentPayload } = await contract();
  const payload = buildRentRollDocumentPayload([{
    tenant_name: 'Tenant',
    leased_area_sqm: '1,234.5',
    deposit_total_krw: '',
    monthly_rent_total_krw: '1000000',
    signed_date: '',
    commencement_date: '2026-01-01',
  }]);
  assert.deepEqual(payload.rows[0], {
    tenant_name: 'Tenant',
    leased_area_sqm: 1234.5,
    monthly_rent_total_krw: 1000000,
    commencement_date: '2026-01-01',
    deposit_escalation_enabled: false,
  });
});

test('rent-roll document canonicalizes multi-value goods and preserves disabled deposit escalation details', async () => {
  const { buildRentRollDocumentPayload } = await contract();
  const payload = buildRentRollDocumentPayload([
    {
      tenant_name: 'multi',
      goods_type: ['식품', ' 의약품 ', '식품'],
      deposit_escalation_enabled: 'N',
      deposit_escalation_first_date: '2027-01-01',
      deposit_escalation_interval_months: '12',
      deposit_escalation_rate: '2%',
    },
    { tenant_name: 'legacy single', goods_type: '기존 단일값' },
  ]);

  assert.deepEqual(payload.rows, [
    {
      tenant_name: 'multi',
      goods_type: ['식품', '의약품'],
      deposit_escalation_enabled: false,
      deposit_escalation_first_date: '2027-01-01',
      deposit_escalation_interval_months: 12,
      deposit_escalation_rate: '2%',
    },
    { tenant_name: 'legacy single', goods_type: ['기존 단일값'], deposit_escalation_enabled: false },
  ]);
});

test('렌트롤 비용 조건은 items 문자열 배열, 갱신·해지·복구 조건은 문자열로만 저장한다', async () => {
  const { buildRentRollDocumentPayload } = await contract();
  const payload = buildRentRollDocumentPayload([{
    tenant_name: 'A',
    tenant_cost_terms: {
      id: 'legacy-id',
      contract_key: 'legacy-contract',
      source_system: 'legacy',
      revision: 3,
      meta: { imported: true },
      items: ['전기료', ' 전기료 ', '수도료'],
    },
    landlord_cost_terms: { selected_items: ['보험료'], cost_key: 'legacy-cost' },
    renewal_terms: { text: '3년 1회', meta: 'legacy' },
    termination_terms: '없음',
    restoration_terms: { value: '임차인 원상복구', source_note: 'legacy' },
  }]);

  assert.deepEqual(payload, { rows: [{
    tenant_name: 'A',
    deposit_escalation_enabled: false,
    tenant_cost_terms: { items: ['전기료', '수도료'] },
    landlord_cost_terms: { items: ['보험료'] },
    renewal_terms: '3년 1회',
    termination_terms: '없음',
    restoration_terms: '임차인 원상복구',
  }] });
  assert.doesNotMatch(JSON.stringify(payload), /(?:"id"|_id"|_key"|"source_|revision"|"meta")/u);
});

test('수익비용 statement와 기존 화면 projection은 이름·선택·기간별 금액을 왕복한다', async () => {
  const { buildIncomeExpenseStatement, projectIncomeExpenseStatement } = await contract();
  const definitions = [
    { section: 'potential_income', code: 'RENT', label: '임대료', defaultVisible: true },
    { section: 'operating_expense', code: 'PM', label: 'PM 수수료', defaultVisible: true },
  ];
  const projection = projectIncomeExpenseStatement({
    periods: ['2026-07', '2026-08'],
    potential_income: [{ name: '임대료', selected: true, amounts: { '2026-07': 100, '2026-08': 110 } }],
    income_loss: [],
    operating_expense: [{ name: 'PM 수수료', selected: false, amounts: { '2026-08': 10 } }],
    below_noi: [],
    debt_service: [],
  }, definitions);

  assert.deepEqual(projection.selectedAccountCodes, ['RENT']);
  assert.equal(projection.entries.length, 3);
  assert.deepEqual(buildIncomeExpenseStatement(projection), {
    periods: ['2026-07', '2026-08'],
    potential_income: [{ name: '임대료', selected: true, amounts: { '2026-07': 100, '2026-08': 110 } }],
    income_loss: [],
    operating_expense: [{ name: 'PM 수수료', selected: false, amounts: { '2026-08': 10 } }],
    below_noi: [],
    debt_service: [],
  });
});

test('수익비용 저장 periods는 조회기간이 아니라 실제 금액 entry의 월만 보존한다', async () => {
  const { buildIncomeExpenseStatement, financePeriodsFromEntries } = await contract();
  const accounts = [{
    account_code: 'RENT',
    name: '임대료',
    statement_section: 'potential_income',
  }];
  const entries = [
    { account_code: 'RENT', month: '2026-07', amount: 0, operation: 'update' },
    { account_code: 'RENT', month: '2026-09-15', amount: 100, operation: 'update' },
    { account_code: 'RENT', month: '2026-10', amount: 200, operation: 'delete' },
    { account_code: 'RENT', month: 'not-a-month', amount: 300, operation: 'update' },
  ];

  assert.deepEqual(financePeriodsFromEntries(entries), ['2026-07', '2026-09']);
  assert.deepEqual(buildIncomeExpenseStatement({
    periods: ['2026-01', '2026-02'],
    accounts,
    entries,
    selectedAccountCodes: ['RENT'],
  }).periods, ['2026-07', '2026-09']);
  assert.deepEqual(buildIncomeExpenseStatement({
    periods: ['2026-01', '2026-02'],
    accounts,
    entries: [],
    selectedAccountCodes: ['RENT'],
  }).periods, []);
});

test('readback 비교는 객체 key 순서에는 무관하고 실제 값 차이는 감지한다', async () => {
  const { documentsEqual } = await contract();
  assert.equal(documentsEqual({ asset: { name: 'A', asset_code: '01' } }, { asset: { asset_code: '01', name: 'A' } }), true);
  assert.equal(documentsEqual({ rows: [{ name: 'A' }] }, { rows: [{ name: 'B' }] }), false);
});

test('새 만기 응답 maturity_type/maturity_date/name을 기존 표시 필드와 함께 정규화한다', async () => {
  const { normalizeMaturityRows } = await contract();
  assert.deepEqual(normalizeMaturityRows({ maturities: [
    { maturity_type: 'lease', maturity_date: '2026-08-31', name: '임차인 A' },
  ] }), [{
    maturity_type: 'lease', maturity_date: '2026-08-31', name: '임차인 A',
    type: 'lease', official_date: '2026-08-31', target_name: '임차인 A', tenant_name: '임차인 A',
  }]);
});

test('asset directory keeps all unique assets and reconciles refresh selection', async () => {
  const { normalizeAssetDirectory, reconcileAssetCode } = await contract();
  const directory = normalizeAssetDirectory({
    assets: [
      ...Array.from({ length: 19 }, (_, index) => ({
        asset_code: `ASSET-${String(index + 1).padStart(2, '0')}`,
        name: `Asset ${index + 1}`,
      })),
      { asset_code: 'ASSET-01', name: 'duplicate' },
      { asset_code: '', name: 'invalid' },
    ],
  });

  assert.equal(directory.length, 19);
  assert.equal(reconcileAssetCode(directory, 'ASSET-07'), 'ASSET-07');
  assert.equal(reconcileAssetCode(directory, 'REMOVED'), 'ASSET-01');
  assert.equal(reconcileAssetCode([], 'ASSET-07'), 'ASSET-07');
});

test('home detail accepts only the currently selected asset document', async () => {
  const { primaryHomeDataForAsset } = await contract();
  const gyeongsan = { asset: { asset_code: 'ASSET-GYEONGSAN' }, occupancy_summary: { occupancy_rate: 100 } };
  assert.equal(primaryHomeDataForAsset(gyeongsan, 'ASSET-GYEONGSAN'), gyeongsan);
  assert.equal(primaryHomeDataForAsset(gyeongsan, 'ASSET-ICHEON'), null);
  assert.equal(primaryHomeDataForAsset({ assets: [] }, 'ASSET-GYEONGSAN'), null);
});

test('home current occupancy includes only occupied rows active on the as-of date', async () => {
  const { isCurrentOccupiedRentRollRow } = await contract();
  const asOfDate = '2026-08-10';

  assert.equal(isCurrentOccupiedRentRollRow({ occupancy_status: 'occupied' }, asOfDate), true);
  assert.equal(isCurrentOccupiedRentRollRow({
    occupancy_status: 'occupied',
    commencement_date: '2026-08-10',
    expiry_date: '2026-08-10',
  }, asOfDate), true);
  assert.equal(isCurrentOccupiedRentRollRow({
    occupancy_status: 'occupied',
    commencement_date: '2026-08-11',
  }, asOfDate), false);
  assert.equal(isCurrentOccupiedRentRollRow({
    occupancy_status: 'occupied',
    expiry_date: '2026-08-09',
  }, asOfDate), false);
  assert.equal(isCurrentOccupiedRentRollRow({ occupancy_status: 'vacant' }, asOfDate), false);
});

test('expired rent-roll rows remain in the document even when an old archive draft marks delete', async () => {
  const { buildRentRollDocumentPayload } = await contract();
  const payload = buildRentRollDocumentPayload([
    { tenant_name: 'expired archive', expiry_date: '2024-12-31', operation: 'delete' },
    { tenant_name: 'expired active', expiry_date: '2025-01-31', operation: 'update' },
    { tenant_name: 'future archive', expiry_date: '2027-12-31', operation: 'delete' },
    { tenant_name: 'future active', expiry_date: '2027-12-31', operation: 'update' },
  ], { asOfDate: '2026-08-10' });

  assert.deepEqual(payload.rows.map((row) => row.tenant_name), [
    'expired archive',
    'expired active',
    'future active',
  ]);
  assert.equal(payload.rows.some((row) => Object.hasOwn(row, 'operation')), false);
});
