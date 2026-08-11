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

test('렌트롤은 한 셀 한 값의 평면 컬럼과 직접 입력 임차인을 사용한다', async () => {
  const schema = await importFresh('src/features/logistics-data-platform/rentRollSchema.js');
  const columns = schema.RENT_ROLL_COLUMNS;
  const keys = columns.map((column) => column.key);
  const byKey = new Map(columns.map((column) => [column.key, column]));

  assert.equal(new Set(keys).size, keys.length, '렌트롤 컬럼 키가 중복되면 안 됩니다.');
  assert.equal(byKey.get('tenant_name')?.kind, 'text', '임차인명은 선택 목록이 아니라 직접 입력이어야 합니다.');
  assert.equal(columns.some((column) => ['area', 'moneyPair', 'period', 'summary', 'tenant'].includes(column.kind)), false);
  assert.equal(keys.includes('temperature_type'), true);
  assert.equal(keys.includes('goods_type'), true);
  assert.equal(keys.includes('subtenant_name'), true);
  assert.equal(keys.includes('free_area_type'), true);
  assert.equal(keys.includes('signed_date'), true);
  assert.equal(keys.includes('use_category'), false, '참고 렌트롤에 없는 세부 용도 열은 제거합니다.');
  assert.equal(keys.includes('construction_start_date'), false, '사용자 요청에 따라 착공일을 제거합니다.');
  assert.equal(keys.includes('completion_date'), false, '사용자 요청에 따라 준공일을 제거합니다.');
  assert.equal(keys.includes('rent_calculation_method'), false, '근거가 불명확한 임대료 산정 열은 제거합니다.');
  assert.equal(keys.includes('rent_escalation_rate'), true);
  assert.equal(keys.includes('rent_escalation_interval_months'), true);
  assert.equal(keys.includes('rent_escalation_first_date'), true);
  assert.equal(keys.includes('cam_escalation_rate'), true);
  assert.equal(keys.includes('current_total_cost_per_py_krw'), true);
  for (const key of ['deposit_per_py_krw', 'rent_per_py_krw', 'cam_per_py_krw', 'pallet_rack_fee_per_py']) {
    assert.equal(byKey.get(key)?.kind, 'readonly', `${key}는 임대면적 기준 자동계산이어야 합니다.`);
  }
  assert.equal(byKey.get('security_type')?.kind, 'preset_text');
  assert.deepEqual(byKey.get('security_type')?.options, ['보증보험', '근저당권', '없음', '기타']);
  for (const key of ['deposit_escalation_rate', 'rent_escalation_rate', 'cam_escalation_rate']) {
    assert.equal(byKey.get(key)?.kind, 'percent', `${key}는 % 입력이어야 합니다.`);
  }
  assert.equal(byKey.get('tenant_cost_terms')?.kind, 'multi_select');
  assert.equal(byKey.get('landlord_cost_terms')?.kind, 'multi_select');
  for (const key of ['renewal_terms', 'termination_terms', 'restoration_terms']) {
    assert.equal(byKey.get(key)?.kind, 'preset_text', `${key}는 프리셋과 직접 작성을 함께 지원해야 합니다.`);
  }
});

test('E.NOC는 기존 Supabase 0.3025 공식과 결측 계약을 따른다', async () => {
  const schema = await importFresh('src/features/logistics-data-platform/rentRollSchema.js');
  assert.equal(schema.calculateRentRollENoc({
    leased_area_sqm: 1000,
    monthly_rent_total_krw: 10_000_000,
    monthly_cam_total_krw: 2_000_000,
  }), 39669.42);
  assert.equal(schema.calculateRentRollENoc({
    leased_area_sqm: 0,
    monthly_rent_total_krw: 10_000_000,
    monthly_cam_total_krw: 2_000_000,
  }), null);
  assert.equal(schema.calculateRentRollENoc({ leased_area_sqm: 1000 }), null);
});

test('보증금과 모든 평단가는 임대면적 평을 기준으로 자동 계산한다', async () => {
  const schema = await importFresh('src/features/logistics-data-platform/rentRollSchema.js');
  const row = schema.deriveRentRollRow({
    leased_area_sqm: 1_000,
    deposit_total_krw: 10_000_000,
    monthly_rent_total_krw: 10_000_000,
    monthly_cam_total_krw: 2_000_000,
    pallet_rack_fee: 100_000,
  });
  assert.equal(row.leased_area_py, 302.5);
  assert.equal(row.deposit_per_py_krw, 33057.85);
  assert.equal(row.rent_per_py_krw, 33057.85);
  assert.equal(row.cam_per_py_krw, 6611.57);
  assert.equal(row.pallet_rack_fee_per_py, 330.58);
  assert.equal(row.current_total_cost_per_py_krw, 39669.42);
  const irregular = schema.deriveRentRollRow({ leased_area_sqm: 123.45, deposit_total_krw: 10_000_000 });
  assert.equal(
    irregular.deposit_per_py_krw,
    Math.round((10_000_000 / (123.45 * 0.3025)) * 100) / 100,
    '표시용 임대면적(평) 반올림값이 아니라 Supabase의 원본 ㎡×0.3025를 사용해야 합니다.',
  );
});

test('부담비용 다중선택은 기존 jsonb 원문과 출처 메타데이터를 보존한다', async () => {
  const schema = await importFresh('src/features/logistics-data-platform/rentRollSchema.js');
  const legacy = {
    raw_text: '전기, 수도, 가스요금 등 제반 공과금',
    source_table: 'public.ll_leases',
    source_column: 'tenant_cost_burden',
  };
  assert.deepEqual(schema.normalizeCostTerms(legacy), ['수도광열비·공과금']);
  const serialized = schema.serializeCostTerms(legacy, ['전기·수도·가스 등 공과금', '사용자 추가 항목']);
  assert.equal(serialized.raw_text, legacy.raw_text);
  assert.equal(serialized.source_table, legacy.source_table);
  assert.equal(serialized.source_column, legacy.source_column);
  assert.deepEqual(serialized.items, ['수도광열비·공과금', '사용자 추가 항목']);
  assert.deepEqual(schema.normalizeCostTerms(serialized), serialized.items);
});

test('한국 물류센터 NOI는 PGI, EGI, NOI, NCF, 부채상환 후 현금흐름을 분리한다', async () => {
  const formulas = await importFresh('src/features/logistics-data-platform/formulas.js');
  assert.equal(formulas.FINANCE_FORMULA_VERSION, 'gate6-korean-logistics-noi-v2');
  const result = formulas.calculateKoreanLogisticsNoi({
    potential_income: 1_000,
    income_loss: 100,
    operating_expense: 300,
    below_noi_cash_cost: 50,
    noncash_addback: 10,
    debt_service: 200,
  });
  assert.deepEqual(result, {
    potential_gross_income: 1_000,
    total_income_loss: 100,
    effective_gross_income: 900,
    total_operating_expense: 300,
    net_operating_income: 600,
    asset_net_cash_flow: 560,
    pre_debt_cash_flow: 560,
    after_debt_service_cash_flow: 360,
    other_cash_inflow: 0,
    other_cash_outflow: 0,
    net_cash_flow: 360,
  });
  assert.equal(formulas.KOREAN_LOGISTICS_NOI_ACCOUNTS.some((row) => row.code === 'DEPRECIATION'), false);
  assert.equal(formulas.KOREAN_LOGISTICS_NOI_ACCOUNTS.some((row) => row.code === 'PROPERTY_TAX_PUBLIC_DUES'), true);
  assert.equal(formulas.KOREAN_LOGISTICS_NOI_ACCOUNTS.some((row) => row.code === 'FM_FEE'), true);
});

test('렌트롤은 편집 중 서버 요청 없이 초안을 유지하고 사용자가 명시적으로 일괄 저장한다', () => {
  const source = fs.readFileSync(path.join(ROOT, 'src/features/logistics-data-platform/LogisticsDataPlatform.jsx'), 'utf8');
  const rentRollSource = source.slice(
    source.indexOf('function RentRollPanel'),
    source.indexOf('function periodFor'),
  );

  assert.match(source, /data-save-state/u);
  assert.match(source, /custom-scrollbar/u);
  assert.match(source, /tenant_name[\s\S]{0,400}<input/iu);
  assert.doesNotMatch(source, /tenant_name[\s\S]{0,400}<select/iu);
  assert.match(source, /data-testid=["']rent-roll-drag-handle["']/u);
  assert.match(source, /draggable=/u);
  assert.match(source, /onDragStart/u);
  assert.match(source, /onDrop/u);
  assert.doesNotMatch(source, /rent-roll-move-up|rent-roll-move-down/u);
  assert.match(source, /const changedRange = changed\.slice\(rangeStart, rangeEnd \+ 1\)/u);
  assert.match(rentRollSource, /dirtyRowIds/u);
  assert.match(rentRollSource, /validationMessages/u);
  assert.match(rentRollSource, /data-testid=["']rent-roll-save["']/u);
  assert.match(rentRollSource, /변경사항 저장/u);
  assert.match(rentRollSource, /rentRollEditingDisabled/u);
  assert.match(rentRollSource, /beforeunload/u);
  assert.match(rentRollSource, /gate6-rent-roll-draft-/u);
  assert.match(rentRollSource, /draftHydratedRef/u);
  assert.match(rentRollSource, /undoArchive/u);
  assert.match(rentRollSource, /data-testid=\{row\.operation === ["']delete["'] \? ["']rent-roll-archive-undo["']/u);
  assert.match(rentRollSource, /rowEditingDisabled/u);
  assert.match(rentRollSource, /focusRentRollRow/u);
  assert.match(rentRollSource, /data-validation-row-id/u);
  assert.match(rentRollSource, /aria-invalid/u);
  assert.match(source, /aria-live=["']polite["']/u);
  assert.doesNotMatch(rentRollSource, /blurSave/u);
  assert.doesNotMatch(rentRollSource, /onBlur=.*saveRows/u);
  assert.doesNotMatch(rentRollSource, /void saveRows\(changedRange\)/u);
  assert.doesNotMatch(rentRollSource, /void saveRows\(\[next\]\)/u);
  assert.match(rentRollSource, /draggable=\{!rowEditingDisabled\}/u);
  assert.match(rentRollSource, /disabled=\{rowEditingDisabled\}/u);
  assert.match(source, /MultiSelectCell/u);
  assert.match(source, /PresetTextCell/u);
  assert.match(source, /column\?\.kind === ["']multi_select["'][\s\S]{0,160}serializeCostTerms/u);
  assert.match(source, /column\?\.kind === ["']percent["'][\s\S]{0,160}percentStoredValue/u);
  assert.doesNotMatch(source, /finance-statement-scroll[\s\S]{0,160}max-h/iu);
});

test('v2 API는 홈 저장을 공개 write action으로 라우팅한다', async () => {
  const contracts = await importFresh('supabase/functions/ll-dashboard-api/v2/contracts.ts');
  const router = await importFresh('supabase/functions/ll-dashboard-api/v2/router.ts');
  assert.equal(contracts.V2_PUBLIC_ACTIONS.includes('v2/home/batch-save'), true);
  assert.equal(router.rpcNameForAction('v2/home/batch-save'), 'home_batch_save');
  assert.throws(() => router.buildRpcArguments('v2/home/batch-save', {
    asset_key: 'asset', payload: { operations: [] },
  }), /CLIENT_REQUEST_ID_REQUIRED/u);
});

test('렌트롤 권리·비용은 기타 버튼 없이 취급화물과 같은 항목 추가 다중선택을 사용한다', () => {
  const frontendSource = fs.readFileSync(
    path.join(ROOT, 'src/features/logistics-data-platform/LogisticsDataPlatform.jsx'),
    'utf8',
  );
  const presetCell = frontendSource.slice(
    frontendSource.indexOf('function PresetTextCell'),
    frontendSource.indexOf('function MultiSelectCell'),
  );
  const addableMultiSelectCell = frontendSource.slice(
    frontendSource.indexOf('function AddableMultiSelectCell'),
    frontendSource.indexOf('function MultiSelectCell'),
  );

  assert.match(presetCell, /className=["']flex min-w-\[220px\] items-center gap-1["']/u);
  assert.match(presetCell, /if \(next === ["']기타["']\)[\s\S]*?setCustomMode\(true\)/u);
  assert.match(presetCell, /setCustomMode\(false\)[\s\S]*?onChange\(next\)/u);
  assert.match(presetCell, /\{showCustom \? \([\s\S]*?직접 작성[\s\S]*?\) : null\}/u);
  assert.doesNotMatch(presetCell, /className=["']grid[^"']*["']/u);

  assert.match(addableMultiSelectCell, /type="checkbox"/u);
  assert.match(addableMultiSelectCell, /placeholder=\{`\$\{label\} 항목 추가`\}/u);
  assert.match(addableMultiSelectCell, />추가<\/button>/u);
  assert.doesNotMatch(addableMultiSelectCell, />기타<\/button>|customMode/u);
  assert.match(addableMultiSelectCell, /className=["']mt-2 flex items-center gap-1["']/u);
});

test('신규 DB 계약은 직접입력 임차인, eNOC readback, NOI 상세계정을 포함한다', () => {
  const migrationDir = path.join(ROOT, 'supabase/migrations');
  const migrationName = fs.readdirSync(migrationDir).find((name) => /editable.*noi.*rent|rent.*noi.*editable/iu.test(name));
  assert.ok(migrationName, '편집·NOI·렌트롤 migration이 필요합니다.');
  const sql = fs.readFileSync(path.join(migrationDir, migrationName), 'utf8');
  assert.match(sql, /create or replace function logistics_api\.home_batch_save/iu);
  assert.match(sql, /tenant_name/iu);
  assert.match(sql, /business_registration_number/iu);
  assert.match(sql, /0\.3025/iu);
  assert.match(sql, /current_monthly_cost_total/iu);
  assert.match(sql, /e_noc/iu);
  assert.match(sql, /PROPERTY_TAX_PUBLIC_DUES/iu);
  assert.match(sql, /RENT_FREE_CONCESSION_LOSS/iu);
  assert.match(sql, /FINANCE_DERIVED_ACCOUNT_FORBIDDEN/iu);
});
