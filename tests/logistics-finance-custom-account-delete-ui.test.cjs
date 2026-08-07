const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..');

test('사용자 추가 손익항목은 현재 자산에서만 삭제되고 mutation readback으로 확인한다', () => {
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
  assert.match(financeSource, /operation:\s*["']delete["']/u);
  assert.match(financeSource, /expected_revision:\s*row\.account\.revision/u);
  assert.match(financeSource, /account_mutations_readback/u);
  assert.match(financeSource, /mutation\.active\s*!==\s*false/u);
  assert.match(financeSource, /resource\.reload\(\)/u);
});
