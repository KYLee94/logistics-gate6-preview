const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { pathToFileURL } = require('node:url');

const ROOT = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(ROOT, relativePath), 'utf8');

async function importFresh(relativePath) {
  const target = path.join(ROOT, relativePath);
  return import(`${pathToFileURL(target).href}?test=${Date.now()}-${Math.random()}`);
}

test('홈은 읽기 화면이 기본이고 명시적인 수정·취소·저장 흐름을 제공한다', () => {
  const source = read('src/features/logistics-data-platform/LogisticsDataPlatform.jsx');
  assert.match(source, /data-testid=["']home-edit["']/u);
  assert.match(source, /data-testid=["']home-cancel["']/u);
  assert.match(source, /data-testid=["']home-save["']/u);
  assert.match(source, /isHomeEditing/u);
  assert.match(source, /buildHomeOperations/u);
  assert.match(source, /operations:\s*homeOperations/u);
});

test('렌트롤 용도는 네 가지 운영 용도만 선택한다', async () => {
  const schema = await importFresh('src/features/logistics-data-platform/rentRollSchema.js');
  const useColumn = schema.RENT_ROLL_COLUMNS.find((column) => column.key === 'temperature_type');
  assert.equal(useColumn?.label, '용도');
  assert.equal(useColumn?.kind, 'select');
  assert.deepEqual(useColumn?.options, [
    ['저온', '저온'],
    ['상온', '상온'],
    ['복합', '복합'],
    ['사무실', '사무실'],
  ]);
  assert.equal(
    schema.RENT_ROLL_COLUMNS.find((column) => column.key === 'use_category')?.label,
    '세부 용도',
  );
});

test('NOI 기본 본표는 MECE 핵심 계정만 보이고 세부 계정은 선택할 수 있다', async () => {
  const formulas = await importFresh('src/features/logistics-data-platform/formulas.js');
  const core = formulas.KOREAN_LOGISTICS_NOI_ACCOUNTS.filter((account) => account.defaultVisible);
  const optional = formulas.KOREAN_LOGISTICS_NOI_ACCOUNTS.filter((account) => !account.defaultVisible);
  assert.deepEqual(core.map((account) => account.code), [
    'POTENTIAL_BASE_RENT',
    'POTENTIAL_CAM_INCOME',
    'EXPENSE_REIMBURSEMENT_INCOME',
    'DEPOSIT_OPERATING_INCOME',
    'OTHER_PROPERTY_INCOME',
    'VACANCY_LOSS',
    'RENT_FREE_CONCESSION_LOSS',
    'PM_FEE',
    'FM_FEE',
    'REPAIRS_MAINTENANCE',
    'UTILITIES',
    'PROPERTY_TAX_PUBLIC_DUES',
    'PROPERTY_INSURANCE',
    'OTHER_PROPERTY_OPEX',
  ]);
  assert.ok(optional.some((account) => account.code === 'CAPEX'));
  assert.ok(optional.some((account) => account.code === 'INTEREST_PAID'));

  const source = read('src/features/logistics-data-platform/LogisticsDataPlatform.jsx');
  assert.match(source, /data-testid=["']finance-account-picker["']/u);
  assert.match(source, /data-testid=["']finance-account-toggle["']/u);
  assert.match(source, /영업수익 소계/u);
  assert.match(source, /영업비용 소계/u);
});

test('NOI·NCF 차트는 키보드와 마우스 호버 상세 툴팁을 제공한다', () => {
  const source = read('src/features/logistics-data-platform/LogisticsDataPlatform.jsx');
  assert.match(source, /data-testid=["']finance-trend-tooltip["']/u);
  assert.match(source, /onMouseEnter/u);
  assert.match(source, /onFocus/u);
  for (const label of ['유효총수입', '운영비용', '순영업소득', '자산 NCF']) {
    assert.ok(source.includes(label), `차트 툴팁 상세값 누락: ${label}`);
  }
});

test('서버 오류와 저장 실패는 원문을 노출하지 않고 팝업으로 안내한다', () => {
  const source = read('src/features/logistics-data-platform/LogisticsDataPlatform.jsx');
  assert.match(source, /role=["']dialog["']/u);
  assert.match(source, /data-testid=["']data-platform-error-dialog["']/u);
  assert.doesNotMatch(source, /error\.message\s*\|\|/u);
  assert.doesNotMatch(source, /저장 실패/u);

  const api = read('src/features/logistics-data-platform/api.js');
  assert.match(api, /friendlyDataPlatformError/u);
  assert.doesNotMatch(api, /result\.error\.message\s*\|\|/u);
});

test('홈 한 번 저장에서 동일 엔티티 여러 필드를 수정해도 최초 revision을 한 번만 검사한다', () => {
  const migrationDir = path.join(ROOT, 'supabase', 'migrations');
  const candidates = fs.readdirSync(migrationDir)
    .filter((name) => /home.*batch.*revision|save.*reliability/iu.test(name))
    .sort();
  assert.ok(candidates.length, '홈 다중 필드 저장 revision 보정 migration이 필요합니다.');
  const sql = read(path.join('supabase', 'migrations', candidates.at(-1)));
  assert.match(sql, /checked_entities/iu);
  assert.match(sql, /not\s*\(entity_name\s*\|\|\s*':'\s*\|\|\s*entity_key\s*=\s*any\s*\(checked_entities\)\)/iu);
});
