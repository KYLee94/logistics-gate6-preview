const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..');

test('사용자 추가 손익항목은 현재 자산의 full statement에서 제거하고 문서 readback으로 확인한다', () => {
  const source = fs.readFileSync(
    path.join(ROOT, 'src', 'features', 'logistics-data-platform', 'LogisticsDataPlatform.jsx'),
    'utf8',
  );
  const financeSource = source.slice(
    source.indexOf('function FinancePanel'),
    source.indexOf('export default function LogisticsDataPlatform'),
  );

  assert.match(financeSource, /const\s+deleteCustomFinanceAccount\s*=\s*async/u);
  assert.match(financeSource, /data-testid=["']finance-custom-account-delete["']/u);
  assert.match(financeSource, /row\.account\?\.is_custom/u);
  assert.match(financeSource, /nextAccounts\s*=\s*accounts\.filter\(\(account\)\s*=>\s*account\.account_code\s*!==\s*row\.key\)/u);
  assert.match(financeSource, /nextEntries\s*=\s*entries\.filter\(\(entry\)\s*=>\s*entry\.account_code\s*!==\s*row\.key\)/u);
  assert.match(financeSource, /nextSelectedAccountCodes\.delete\(row\.key\)/u);
  assert.match(financeSource, /saveFinanceDocument\(\{[\s\S]{0,180}nextAccounts,[\s\S]{0,180}nextEntries,[\s\S]{0,180}nextSelectedAccountCodes/u);
  assert.match(financeSource, /asset_code:\s*assetCode/u);
  assert.match(financeSource, /expected_xmin:\s*financeRevision/u);
  assert.match(financeSource, /documentsEqual\(documentPayload,\s*readbackPayload\)/u);
  assert.doesNotMatch(financeSource, /account_operations|selection_operations|account_mutations_readback/u);
});
