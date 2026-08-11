const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { pathToFileURL } = require('node:url');

const ROOT = path.resolve(__dirname, '..');
const SCHEMA_PATH = path.join(ROOT, 'src/features/logistics-data-platform/rentRollSchema.js');
const FRONTEND_PATH = path.join(ROOT, 'src/features/logistics-data-platform/LogisticsDataPlatform.jsx');

async function schema() {
  return import(`${pathToFileURL(SCHEMA_PATH).href}?goods-escalation=${Date.now()}-${Math.random()}`);
}

test('용도 선택지는 기존 네 값만 유지하고 취급 화물은 canonical 배열을 왕복한다', async () => {
  const {
    RENT_ROLL_COLUMNS,
    RENT_ROLL_GOODS_OPTIONS,
    normalizeRentRollGoodsTypes,
    rentRollGoodsDisplayOptions,
    serializeRentRollGoodsTypes,
  } = await schema();
  const byKey = new Map(RENT_ROLL_COLUMNS.map((column) => [column.key, column]));

  assert.deepEqual(byKey.get('temperature_type')?.options, [
    ['저온', '저온'], ['상온', '상온'], ['복합', '복합'], ['사무실', '사무실'],
  ]);
  assert.equal(byKey.get('goods_type')?.kind, 'goods_multi_select');
  assert.equal(byKey.get('goods_type')?.label, '주요 취급 화물');
  assert.deepEqual(RENT_ROLL_GOODS_OPTIONS, [
    '가구·인테리어', '기타 공산품', '디지털·가전', '반도체', '식품·음료',
    '의류', '의약품', '일상용품', '종합상품', '화장품',
  ]);
  assert.deepEqual(normalizeRentRollGoodsTypes('식품'), ['식품']);
  assert.deepEqual(normalizeRentRollGoodsTypes('식품, 의약품; 화장품\n식품'), ['식품', '의약품', '화장품']);
  assert.deepEqual(normalizeRentRollGoodsTypes(['식품', ' 의약품 ', '식품']), ['식품', '의약품']);
  assert.deepEqual(serializeRentRollGoodsTypes(['식품', '의약품', '식품']), ['식품', '의약품']);
  assert.deepEqual(serializeRentRollGoodsTypes('기존 단일값'), ['기존 단일값']);
  const storedOrder = ['화장품', '사용자 추가값', '의류'];
  assert.deepEqual(serializeRentRollGoodsTypes(storedOrder), storedOrder);
  const displayed = rentRollGoodsDisplayOptions([storedOrder, '가나다 사용자값']);
  assert.deepEqual(displayed, [...new Set([
    ...RENT_ROLL_GOODS_OPTIONS,
    ...storedOrder,
    '가나다 사용자값',
  ])].sort((left, right) => left.localeCompare(right, 'ko-KR')));
  assert.deepEqual(storedOrder, ['화장품', '사용자 추가값', '의류']);
});

test('그룹 헤더는 실제 컬럼 순서의 연속 구간이며 좌측 고정 두 그룹의 위치와 폭을 고정한다', async () => {
  const {
    RENT_ROLL_COLUMNS,
    rentRollGroupSegments,
    rentRollStickyLeft,
  } = await schema();
  const segments = rentRollGroupSegments(RENT_ROLL_COLUMNS);

  assert.deepEqual(segments.slice(0, 5), [
    { group: '임대 상태', keys: ['occupancy_status'], colSpan: 1, width: 104, stickyLeft: 62 },
    { group: '임차인', keys: ['tenant_name'], colSpan: 1, width: 190, stickyLeft: 166 },
    { group: '임차인 정보', keys: ['business_registration_number'], colSpan: 1, width: 142, stickyLeft: null },
    { group: '공간', keys: ['temperature_type', 'goods_type', 'floor_label', 'zone_label'], colSpan: 4, width: 380, stickyLeft: null },
    { group: '전차 여부', keys: ['subtenant_name', 'free_area_type'], colSpan: 2, width: 232, stickyLeft: null },
  ]);
  assert.equal(segments.reduce((sum, segment) => sum + segment.colSpan, 0), RENT_ROLL_COLUMNS.length);
  assert.equal(segments.reduce((sum, segment) => sum + segment.width, 0), RENT_ROLL_COLUMNS.reduce((sum, column) => sum + column.width, 0));
  assert.equal(rentRollStickyLeft('occupancy_status'), 62);
  assert.equal(rentRollStickyLeft('tenant_name'), 166);
  assert.equal(rentRollStickyLeft('business_registration_number'), null);
});

test('보증금 인상 여부는 N이 기본이고 N 전환 후에도 상세 조건을 보존한다', async () => {
  const { RENT_ROLL_COLUMNS, deriveRentRollRow, emptyRentRollRow } = await schema();
  const byKey = new Map(RENT_ROLL_COLUMNS.map((column) => [column.key, column]));

  assert.deepEqual(byKey.get('deposit_escalation_enabled')?.options, [['N', 'N'], ['Y', 'Y']]);
  assert.equal(emptyRentRollRow('new').deposit_escalation_enabled, 'N');
  assert.equal(deriveRentRollRow({}).deposit_escalation_enabled, 'N');
  const disabledRow = deriveRentRollRow({
    deposit_escalation_enabled: 'N',
    deposit_escalation_first_date: '2027-01-01',
    deposit_escalation_interval_months: 12,
    deposit_escalation_rate: '2%',
  });
  assert.equal(disabledRow.deposit_escalation_enabled, 'N');
  assert.equal(disabledRow.deposit_escalation_first_date, '2027-01-01');
  assert.equal(disabledRow.deposit_escalation_interval_months, 12);
  assert.equal(disabledRow.deposit_escalation_rate, '2%');
  assert.equal(deriveRentRollRow({ deposit_escalation_enabled: true }).deposit_escalation_enabled, 'Y');
});

test('렌트롤 UI는 취급 화물 한 줄 다중선택·사용자 추가와 보증금 상세 비활성화를 제공한다', () => {
  const source = fs.readFileSync(FRONTEND_PATH, 'utf8');
  const goodsCell = source.slice(
    source.indexOf('function AddableMultiSelectCell'),
    source.indexOf('function MultiSelectCell'),
  );
  const header = source.slice(
    source.indexOf('data-testid="rent-roll-table"'),
    source.indexOf('<tbody>', source.indexOf('data-testid="rent-roll-table"')),
  );

  assert.match(goodsCell, /type="checkbox"/u);
  assert.match(goodsCell, /placeholder=\{`\$\{label\} 항목 추가`\}/u);
  assert.match(goodsCell, /whitespace-nowrap/u);
  assert.match(source, /column\.kind === "goods_multi_select"[\s\S]{0,500}<GoodsMultiSelectCell/u);
  assert.match(source, /depositEscalationDetailsDisabled/u);
  assert.match(source, /depositEscalationDetailsDisabled[\s\S]{0,240}deposit_escalation_enabled/u);
  assert.match(source, /fieldDisplayValue\s*=\s*depositEscalationDetailsDisabled\s*\?\s*""\s*:\s*row\[column\.key\]/u);
  assert.match(source, /rentRollGroupSegments\(RENT_ROLL_DISPLAY_COLUMNS\)/u);
  assert.match(header, /RENT_ROLL_GROUP_SEGMENTS\.map/u);
  assert.match(header, /data-sticky-group-header/u);
  assert.match(header, /left:\s*segment\.stickyLeft/u);
  assert.match(header, /minWidth:\s*segment\.width/u);
  assert.match(header, /width:\s*segment\.width/u);
  assert.match(header, /z-\[55\]/u);
  assert.match(header, /border-b border-r border-\[#333333\] bg-\[#202020\]/u);
});

test('수익증권 표는 중복 펀드 열을 제거하고 tranche를 종 구분으로 표시한다', () => {
  const source = fs.readFileSync(FRONTEND_PATH, 'utf8');
  const investmentStart = source.indexOf('수익증권');
  const investmentTable = source.slice(
    investmentStart,
    source.indexOf('</Section>', investmentStart),
  );

  assert.match(investmentTable, /\["종 구분", "투자자", "약정액", "투입액"\]/u);
  assert.match(investmentTable, /<AddableSingleSelectCell/u);
  assert.match(investmentTable, /options=\{investmentShareClassOptions\}/u);
  assert.doesNotMatch(investmentTable, /\["fund_name", "text"\]/u);
  assert.doesNotMatch(investmentTable, /\["펀드",/u);
});
