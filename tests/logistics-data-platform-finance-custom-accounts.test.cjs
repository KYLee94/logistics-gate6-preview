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

test('이자·TI·LC와 소유자 수수료 네 항목은 모두 기본 선택 계정이다', async () => {
  const formulas = await importFresh('src/features/logistics-data-platform/formulas.js');
  const selected = new Set(
    formulas.KOREAN_LOGISTICS_NOI_ACCOUNTS
      .filter((account) => account.defaultVisible)
      .map((account) => account.code),
  );
  for (const code of [
    'INTEREST_PAID',
    'TENANT_IMPROVEMENT',
    'LEASING_COMMISSION',
    'AMC_FEE',
    'CUSTODY_FEE',
    'GENERAL_ADMIN_TRUSTEE_FEE',
  ]) {
    assert.ok(selected.has(code), `기본 선택 계정 누락: ${code}`);
  }
});

test('서버가 반환한 사용자 정의 계정은 사람용 이름과 지정 hierarchy를 유지한다', async () => {
  const formulas = await importFresh('src/features/logistics-data-platform/formulas.js');
  const serverAccounts = [
    {
      account_code: 'PM_FEE',
      name: 'PM 수수료',
      statement_section: 'operating_expense',
      display_order: 10,
    },
    {
      account_code: 'CUSTOM_COLD_STORAGE_REPAIR',
      name: '저온설비 특별수선',
      statement_section: 'operating_expense',
      display_order: 999,
      is_custom: true,
    },
  ];
  const hierarchy = formulas.buildFinanceAccountHierarchy(
    serverAccounts,
    new Set(['PM_FEE', 'CUSTOM_COLD_STORAGE_REPAIR']),
  );
  const opex = hierarchy.find((section) => section.key === 'operating_expense');
  assert.ok(opex);
  assert.deepEqual(
    opex.accounts.map((account) => [account.account_code, account.label, account.active]),
    [
      ['PM_FEE', 'PM 수수료', true],
      ['CUSTOM_COLD_STORAGE_REPAIR', '저온설비 특별수선', true],
    ],
  );
});

test('활성 계정은 먼저, 비활성 계정은 금액을 보존한 채 hierarchy 하단으로 이동한다', async () => {
  const formulas = await importFresh('src/features/logistics-data-platform/formulas.js');
  const accounts = [
    { account_code: 'PM_FEE', name: 'PM 수수료', statement_section: 'operating_expense', display_order: 10 },
    { account_code: 'FM_FEE', name: 'FM 수수료', statement_section: 'operating_expense', display_order: 20 },
    { account_code: 'CUSTOM_COLD_STORAGE_REPAIR', name: '저온설비 특별수선', statement_section: 'operating_expense', display_order: 999, is_custom: true },
  ];
  const hierarchy = formulas.buildFinanceAccountHierarchy(accounts, new Set(['FM_FEE']));
  const opex = hierarchy.find((section) => section.key === 'operating_expense');
  assert.deepEqual(
    opex.accounts.map((account) => [account.account_code, account.active]),
    [
      ['FM_FEE', true],
      ['PM_FEE', false],
      ['CUSTOM_COLD_STORAGE_REPAIR', false],
    ],
  );
});

test('각 NOI hierarchy는 계정 추가와 Supabase 선택 저장·readback 계약을 제공한다', () => {
  const source = read('src/features/logistics-data-platform/LogisticsDataPlatform.jsx');
  const financeSource = source.slice(
    source.indexOf('function FinancePanel'),
    source.indexOf('export default function LogisticsDataPlatform'),
  );

  assert.match(financeSource, /data-testid=["']finance-custom-account-add["']/u);
  assert.match(financeSource, /data-testid=["']finance-custom-account-name["']/u);
  assert.match(financeSource, /account_operations:/u);
  assert.match(financeSource, /selection_operations:/u);
  assert.match(financeSource, /selection_revision\s*==\s*null\s*\?\s*\{\}\s*:\s*\{\s*expected_revision:/u);
  assert.match(financeSource, /statement_section:/u);
  assert.match(financeSource, /const\s+accountCode\s*=\s*`CUSTOM:\$\{/u);
  assert.match(financeSource, /account_code:\s*accountCode/u);
  assert.match(financeSource, /accounts_readback/u);
  assert.match(financeSource, /resource\.reload\(\)/u);
  assert.doesNotMatch(financeSource, /localStorage/u, '계정 선택 상태는 브라우저가 아니라 Supabase가 진리 원천이어야 합니다.');
});

test('비선택 행은 회색·입력 불가이고 시계열·비교가 손익 입력표보다 먼저 유지된다', () => {
  const source = read('src/features/logistics-data-platform/LogisticsDataPlatform.jsx');
  const statementIndex = source.indexOf('data-testid="finance-statement-table"');
  const trendIndex = source.indexOf('<FinanceTrend');
  const summaryIndex = source.indexOf('data-testid="finance-period-summary"');
  assert.ok(trendIndex > 0 && trendIndex < statementIndex);
  assert.ok(summaryIndex > trendIndex && summaryIndex < statementIndex);
  assert.match(source, /data-finance-account-active=/u);
  assert.match(source, /disabled=\{!writeEnabled \|\| !row\.active\}/u);
  assert.match(source, /row\.active \? "bg-\[#252524\][^"]*" : "bg-\[#202020\] text-\[#68686D\]"/u);
  assert.match(source, /firstInactiveIndex/u);
  assert.match(source, /미사용 계정 · NOI 제외/u);
});
