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
  assert.match(source, /buildHomeDocumentPayload/u);
  assert.match(source, /\.\.\.homeDocument/u);
  assert.match(source, /expected_revisions:\s*\{/u);
  assert.match(source, /HOME_DOCUMENT_READBACK_MISMATCH/u);
  assert.doesNotMatch(source, /buildHomeOperations|operations:\s*homeOperations/u);
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
  const expectedCore = [
    'OPERATING_REVENUE',
    'PM_FEE',
    'FM_FEE',
    'REPAIRS_MAINTENANCE',
    'UTILITIES',
    'PROPERTY_TAX_PUBLIC_DUES',
    'PROPERTY_INSURANCE',
    'GENERAL_PROPERTY_ADMIN',
    'OTHER_PROPERTY_OPEX',
    'CAPEX',
    'TENANT_IMPROVEMENT',
    'LEASING_COMMISSION',
    'AMC_FEE',
    'CUSTODY_FEE',
    'GENERAL_ADMIN_TRUSTEE_FEE',
    'INTEREST_PAID',
    'PRINCIPAL_REPAYMENT',
    'LOAN_FEE',
    'OTHER_CASH_INFLOW',
    'OTHER_CASH_OUTFLOW',
    'OPENING_CASH_BALANCE',
  ];
  assert.deepEqual(
    [...core.map((account) => account.code)].sort(),
    [...expectedCore].sort(),
  );
  for (const code of ['PARKING_YARD_INCOME', 'DEPOSIT_OPERATING_INCOME', 'VACANCY_LOSS', 'CLEANING']) {
    assert.ok(optional.some((account) => account.code === code), `선택 계정 누락: ${code}`);
  }

  const hierarchy = formulas.buildFinanceAccountHierarchy(
    formulas.KOREAN_LOGISTICS_NOI_ACCOUNTS.map((account, index) => ({
      account_code: account.code,
      display_order: index + 1,
    })),
    new Set(['OPERATING_REVENUE']),
  );
  const income = hierarchy.find((section) => section.key === 'potential_income');
  assert.deepEqual(
    income.accounts.slice(0, 1).map((account) => [account.account_code, account.active]),
    [['OPERATING_REVENUE', true]],
  );
  assert.ok(income.accounts.slice(1).every((account) => account.active === false));

  const calculationAccounts = formulas.filterFinanceCalculationAccounts(
    income.accounts,
    new Set(['OPERATING_REVENUE']),
  );
  assert.deepEqual(
    calculationAccounts.map((account) => account.account_code),
    ['OPERATING_REVENUE'],
    '비활성 계정은 화면 선택만 바꾸고 DB 원장을 삭제하지 않으면서 NOI 계산에서는 제외해야 합니다.',
  );

  const source = read('src/features/logistics-data-platform/LogisticsDataPlatform.jsx');
  const presentationSource = read('src/features/logistics-data-platform/financePresentation.js');
  assert.doesNotMatch(source, /data-testid=["']finance-account-picker["']/u);
  assert.match(source, /data-testid=["']finance-account-row["']/u);
  assert.match(source, /data-testid=["']finance-account-toggle["']/u);
  assert.match(source, /data-finance-account-active=/u);
  assert.match(source, /disabled=\{!writeEnabled \|\| !row\.active \|\| saveState === ["']saving["']\}/u);
  assert.match(source, /pendingAccountFocusRef/u);
  assert.match(source, /accountSelectionAnnouncement/u);
  assert.match(presentationSource, /OPERATING_REVENUE/u);
  assert.match(presentationSource, /영업비용 소계/u);
  assert.doesNotMatch(presentationSource, /수익 차감|effective_gross_income.*영업수익 소계/u);
});

test('NOI·부채상환 후 현금흐름 차트는 키보드와 마우스 호버 상세 툴팁을 제공한다', () => {
  const source = read('src/features/logistics-data-platform/LogisticsDataPlatform.jsx');
  assert.match(source, /data-testid=["']finance-trend-tooltip["']/u);
  assert.match(source, /onMouseEnter/u);
  assert.match(source, /onFocus/u);
  for (const label of ['유효총수입', '운영비용', '순영업소득', '부채상환 후 현금흐름']) {
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

test('홈 전체 문서는 자산과 펀드 xmin을 각각 한 번 검사하고 저장 후 동일 문서를 재조회한다', () => {
  const source = read('src/features/logistics-data-platform/LogisticsDataPlatform.jsx');
  assert.match(source, /expected_revisions:\s*\{[\s\S]{0,180}asset:[\s\S]{0,180}fund:/u);
  assert.match(source, /buildHomeDocumentPayload\(readback\.data\)/u);
  assert.match(source, /documentsEqual\(homeDocument,\s*readbackDocument\)/u);

  const sql = read('supabase/migrations/20260807180000_simplify_logistics_core_to_four_ui_tables.sql');
  assert.match(sql, /expected_xmin\(p_payload,\s*p_expected_revisions,\s*'asset'\)/iu);
  assert.match(sql, /expected_xmin\(p_payload,\s*p_expected_revisions,\s*'fund'\)/iu);
  assert.match(sql, /assert_expected_xmin\(v_actual,\s*v_expected\)/iu);
  assert.match(sql, /v_readback\s*:=\s*logistics_core\.home_read_entry/iu);
  assert.match(sql, /'readback',\s*'verified'/iu);
});

test('렌트롤 고정 열의 제목은 본문 셀과 같은 왼쪽 위치에 함께 고정된다', () => {
  const source = read('src/features/logistics-data-platform/LogisticsDataPlatform.jsx');
  assert.match(source, /data-sticky-column-header=\{stickyLeft == null \? undefined : column\.key\}/u);
  assert.ok(
    (source.match(/const stickyLeft = rentRollStickyLeft\(column\.key\)/gu) || []).length >= 2,
    'column headers and body cells must use the same sticky offset helper',
  );
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
