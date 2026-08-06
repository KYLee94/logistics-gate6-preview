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
  assert.equal(schema.RENT_ROLL_COLUMNS.some((column) => column.key === 'use_category'), false);
});

test('NOI 본표는 계층별로 활성 계정을 먼저, 비활성 계정을 잠근 채 아래에 배치한다', async () => {
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

  const hierarchy = formulas.buildFinanceAccountHierarchy(
    formulas.KOREAN_LOGISTICS_NOI_ACCOUNTS.map((account, index) => ({
      account_code: account.code,
      display_order: index + 1,
    })),
    new Set(['POTENTIAL_BASE_RENT', 'PARKING_YARD_INCOME']),
  );
  const income = hierarchy.find((section) => section.key === 'potential_income');
  assert.deepEqual(
    income.accounts.slice(0, 2).map((account) => [account.account_code, account.active]),
    [['POTENTIAL_BASE_RENT', true], ['PARKING_YARD_INCOME', true]],
  );
  assert.ok(income.accounts.slice(2).every((account) => account.active === false));

  const calculationAccounts = formulas.filterFinanceCalculationAccounts(
    income.accounts,
    new Set(['POTENTIAL_BASE_RENT']),
  );
  assert.deepEqual(
    calculationAccounts.map((account) => account.account_code),
    ['POTENTIAL_BASE_RENT'],
    '비활성 계정은 화면 선택만 바꾸고 DB 원장을 삭제하지 않으면서 NOI 계산에서는 제외해야 합니다.',
  );

  const source = read('src/features/logistics-data-platform/LogisticsDataPlatform.jsx');
  assert.doesNotMatch(source, /data-testid=["']finance-account-picker["']/u);
  assert.match(source, /data-testid=["']finance-account-row["']/u);
  assert.match(source, /data-testid=["']finance-account-toggle["']/u);
  assert.match(source, /data-finance-account-active=/u);
  assert.match(source, /disabled=\{!writeEnabled \|\| !row\.active\}/u);
  assert.match(source, /pendingAccountFocusRef/u);
  assert.match(source, /accountSelectionAnnouncement/u);
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

test('렌트롤 고정 열의 제목은 본문 셀과 같은 왼쪽 위치에 함께 고정된다', () => {
  const source = read('src/features/logistics-data-platform/LogisticsDataPlatform.jsx');
  assert.match(source, /data-sticky-column-header=\{stickyLeft == null \? undefined : column\.key\}/u);
  assert.match(source, /column\.key === ["']occupancy_status["'][\s\S]*?\? 62/u);
  assert.match(source, /column\.key === ["']tenant_name["'][\s\S]*?\? 166/u);
  assert.match(source, /left: stickyLeft == null \? undefined : stickyLeft/u);
  assert.match(source, /style=\{cellStyle\}/u);
  assert.match(source, /z-\[60\] shadow-\[1px_0_0_#333333\]/u);
});

test('렌트롤 행 드래그는 놓을 위치와 이동 상태를 명확히 표시한다', () => {
  const source = read('src/features/logistics-data-platform/LogisticsDataPlatform.jsx');
  assert.match(source, /data-testid=["']rent-roll-drag-status["']/u);
  assert.match(source, /bounds\.top \+ bounds\.height \/ 2/u);
  assert.match(source, /position === ["']before["'] \? ["']위["'] : ["']아래["']/u);
  assert.match(source, /border-t-2 border-t-\[#5E9EFF\]/u);
  assert.match(source, /border-b-2 border-b-\[#5E9EFF\]/u);
  assert.match(source, /event\.dataTransfer\.dropEffect = ["']move["']/u);
  assert.match(source, /draggedRowId === id \? ["']opacity-45["']/u);
});
